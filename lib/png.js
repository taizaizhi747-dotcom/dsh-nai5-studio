import fs from 'node:fs';
import zlib from 'node:zlib';

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MANAGED_TEXT_KEYS = new Set(['Software', 'Source', 'Title', 'Description', 'Comment']);
const utf8FatalDecoder = new TextDecoder('utf-8', { fatal: true });

function decodeTextChunkValue(buf) {
  try {
    return utf8FatalDecoder.decode(buf);
  } catch {
    return buf.toString('latin1');
  }
}

function makePngChunk(typeStr, chunkData) {
  const chunkLen = Buffer.alloc(4);
  chunkLen.writeUInt32BE(chunkData.length, 0);
  const chunkType = Buffer.from(typeStr, 'latin1');
  const crcVal = zlib.crc32(Buffer.concat([chunkType, chunkData]));
  const chunkCrc = Buffer.alloc(4);
  chunkCrc.writeUInt32BE(crcVal, 0);
  return Buffer.concat([chunkLen, chunkType, chunkData, chunkCrc]);
}

function buildMetadataChunk(key, val) {
  const strVal = String(val);
  const keyBuf = Buffer.from(key, 'latin1');
  // Pure Latin-1 uses tEXt; any codepoint > 0xFF (e.g. CJK) uses uncompressed iTXt (UTF-8)
  if (/[^\u0000-\u00ff]/.test(strVal)) {
    const valBuf = Buffer.from(strVal, 'utf8');
    const header = Buffer.from([0, 0, 0, 0, 0]);
    return makePngChunk('iTXt', Buffer.concat([keyBuf, header, valBuf]));
  }
  const valBuf = Buffer.from(strVal, 'latin1');
  return makePngChunk('tEXt', Buffer.concat([keyBuf, Buffer.from([0]), valBuf]));
}

function parseTextOrItxtChunk(type, data) {
  if (type === 'tEXt') {
    const nullIdx = data.indexOf(0);
    if (nullIdx === -1) return null;
    return {
      key: data.toString('latin1', 0, nullIdx),
      val: decodeTextChunkValue(data.subarray(nullIdx + 1))
    };
  }
  if (type === 'iTXt') {
    const null1 = data.indexOf(0);
    if (null1 === -1 || null1 + 3 >= data.length) return null;
    const key = data.toString('latin1', 0, null1);
    const compFlag = data[null1 + 1];
    const compMethod = data[null1 + 2];
    const null2 = data.indexOf(0, null1 + 3);
    if (null2 === -1) return null;
    const null3 = data.indexOf(0, null2 + 1);
    if (null3 === -1) return null;
    const rawText = data.subarray(null3 + 1);
    if (compFlag === 0) {
      return { key, val: rawText.toString('utf8') };
    }
    if (compFlag === 1 && compMethod === 0) {
      try {
        return { key, val: zlib.inflateSync(rawText).toString('utf8') };
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * NovelAI compatible PNG tEXt / iTXt chunk metadata injector & reader.
 * Strips pre-existing managed metadata chunks so upstream blocks never shadow injected values.
 */
export function injectPngMetadata(pngBuffer, metadata) {
  if (!Buffer.isBuffer(pngBuffer)) {
    pngBuffer = Buffer.from(pngBuffer);
  }

  if (pngBuffer.length < 33 || !pngBuffer.subarray(0, 8).equals(PNG_SIG)) {
    return pngBuffer;
  }

  const ihdrChunks = [];
  const tailChunks = [];
  let offset = 8;
  let sawIhdr = false;

  while (offset + 12 <= pngBuffer.length) {
    const len = pngBuffer.readUInt32BE(offset);
    const type = pngBuffer.toString('latin1', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + len;
    const chunkEnd = dataEnd + 4;
    if (chunkEnd > pngBuffer.length) break;

    let skip = false;
    if (type === 'tEXt' || type === 'iTXt') {
      const data = pngBuffer.subarray(dataStart, dataEnd);
      const nullIdx = data.indexOf(0);
      if (nullIdx !== -1) {
        const key = data.toString('latin1', 0, nullIdx);
        if (MANAGED_TEXT_KEYS.has(key)) {
          skip = true;
        }
      }
    }

    if (!skip) {
      const rawChunk = pngBuffer.subarray(offset, chunkEnd);
      if (type === 'IHDR' && !sawIhdr) {
        ihdrChunks.push(rawChunk);
        sawIhdr = true;
      } else {
        tailChunks.push(rawChunk);
      }
    }

    offset = chunkEnd;
    if (type === 'IEND') break;
  }

  if (!sawIhdr) return pngBuffer;

  const entries = [
    ['Software', 'NovelAI'],
    ['Source', metadata.model || 'NovelAI Diffusion V5'],
    ['Title', 'AI generated image'],
    ['Description', metadata.prompt || ''],
    ['Comment', JSON.stringify(metadata)]
  ];

  const metaChunks = [];
  for (const [key, val] of entries) {
    if (val === undefined || val === null || val === '') continue;
    metaChunks.push(buildMetadataChunk(key, val));
  }

  return Buffer.concat([
    PNG_SIG,
    ...ihdrChunks,
    ...metaChunks,
    ...tailChunks
  ]);
}

export function readPngMetadata(pngBuffer) {
  if (!Buffer.isBuffer(pngBuffer)) {
    pngBuffer = Buffer.from(pngBuffer);
  }

  if (pngBuffer.length < 33 || !pngBuffer.subarray(0, 8).equals(PNG_SIG)) {
    return {};
  }

  const result = {};
  let offset = 8;
  while (offset + 12 <= pngBuffer.length) {
    const len = pngBuffer.readUInt32BE(offset);
    const type = pngBuffer.toString('latin1', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + len;

    if (dataEnd + 4 > pngBuffer.length) break;

    if (type === 'IHDR' && len >= 8) {
      result.width = pngBuffer.readUInt32BE(dataStart);
      result.height = pngBuffer.readUInt32BE(dataStart + 4);
    } else if (type === 'tEXt' || type === 'iTXt') {
      const parsed = parseTextOrItxtChunk(type, pngBuffer.subarray(dataStart, dataEnd));
      if (parsed) {
        result[parsed.key] = parsed.val;
        if (parsed.key === 'Comment') {
          try {
            result.parameters = JSON.parse(parsed.val);
          } catch {}
        }
      }
    } else if (type === 'IEND') {
      break;
    }

    offset = dataEnd + 4;
  }

  return result;
}

/**
 * Fast 24-byte PNG IHDR dimension reader (no full-file read, zero image decode).
 */
export function readPngDimensions(filePath) {
  let fd = null;
  try {
    fd = fs.openSync(filePath, 'r');
    const buf = Buffer.allocUnsafe(24);
    const bytesRead = fs.readSync(fd, buf, 0, 24, 0);
    if (bytesRead < 24 || !buf.subarray(0, 8).equals(PNG_SIG)) return null;
    if (buf.toString('latin1', 12, 16) !== 'IHDR') return null;
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    if (width > 0 && height > 0) return { width, height };
  } catch {} finally {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch {}
    }
  }
  return null;
}

/**
 * Zero-pixel-allocation PNG chunk scanner: skips IDAT/binary chunks via positional reads,
 * reading only IHDR dimensions and tEXt/iTXt metadata chunks.
 */
export function readPngMetadataFromFile(filePath) {
  let fd = null;
  try {
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    if (fileSize < 33) return {};

    fd = fs.openSync(filePath, 'r');
    const sigBuf = Buffer.allocUnsafe(8);
    if (fs.readSync(fd, sigBuf, 0, 8, 0) < 8 || !sigBuf.equals(PNG_SIG)) {
      return {};
    }

    const result = {};
    const headerBuf = Buffer.allocUnsafe(8);
    let offset = 8;

    while (offset + 12 <= fileSize) {
      if (fs.readSync(fd, headerBuf, 0, 8, offset) < 8) break;
      const len = headerBuf.readUInt32BE(0);
      const type = headerBuf.toString('latin1', 4, 8);
      const dataStart = offset + 8;
      const dataEnd = dataStart + len;
      if (dataEnd + 4 > fileSize) break;

      if (type === 'IHDR' && len >= 8) {
        const ihdr = Buffer.allocUnsafe(8);
        if (fs.readSync(fd, ihdr, 0, 8, dataStart) === 8) {
          result.width = ihdr.readUInt32BE(0);
          result.height = ihdr.readUInt32BE(4);
        }
      } else if ((type === 'tEXt' || type === 'iTXt') && len > 0 && len < 2 * 1024 * 1024) {
        const data = Buffer.allocUnsafe(len);
        if (fs.readSync(fd, data, 0, len, dataStart) === len) {
          const parsed = parseTextOrItxtChunk(type, data);
          if (parsed) {
            result[parsed.key] = parsed.val;
            if (parsed.key === 'Comment') {
              try {
                result.parameters = JSON.parse(parsed.val);
              } catch {}
            }
          }
        }
      } else if (type === 'IEND') {
        break;
      }

      offset = dataEnd + 4;
    }

    return result;
  } catch {
    return {};
  } finally {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch {}
    }
  }
}

/**
 * Normalize parsed NovelAI PNG metadata into a unified workbench record shape.
 */
export function extractNormalizedMeta(filePath) {
  const raw = readPngMetadataFromFile(filePath);
  const p = raw.parameters && typeof raw.parameters === 'object' ? raw.parameters : {};

  let characterPrompts = Array.isArray(p.characterPrompts) ? p.characterPrompts : [];
  if (characterPrompts.length === 0 && Array.isArray(p.v4_prompt?.caption?.char_captions)) {
    const negCaps = Array.isArray(p.v4_negative_prompt?.caption?.char_captions)
      ? p.v4_negative_prompt.caption.char_captions
      : [];
    characterPrompts = p.v4_prompt.caption.char_captions.map((c, idx) => {
      const center = Array.isArray(c.centers) && c.centers[0] ? c.centers[0] : {};
      return {
        prompt: c.char_caption || '',
        negativePrompt: negCaps[idx]?.char_caption || '',
        uc: negCaps[idx]?.char_caption || '',
        x: typeof center.x === 'number' ? center.x : 0.5,
        y: typeof center.y === 'number' ? center.y : 0.5,
        useCoords: p.use_coords !== false
      };
    });
  }

  let stylePrompt = p.stylePrompt || '';
  let prompt = raw.Description || p.prompt || '';
  if (!stylePrompt && prompt && prompt.includes('</style>')) {
    const m = prompt.match(/^(<artist>[\s\S]*?<\/style>)\s*,?\s*/i);
    if (m) {
      stylePrompt = m[1];
      prompt = prompt.slice(m[0].length);
    }
  } else if (stylePrompt && prompt.startsWith(stylePrompt)) {
    prompt = prompt.slice(stylePrompt.length).replace(/^,\s*/, '');
  }

  return {
    width: Number(p.width || raw.width) || undefined,
    height: Number(p.height || raw.height) || undefined,
    prompt: prompt || undefined,
    uc: (p.uc || p.negative_prompt) || undefined,
    stylePrompt: stylePrompt || undefined,
    characterPrompts: characterPrompts.length > 0 ? characterPrompts : undefined,
    steps: Number(p.steps) || undefined,
    cfg: Number(p.scale || p.cfg) || undefined,
    cfgRescale: p.cfg_rescale !== undefined ? Number(p.cfg_rescale) : (p.cfgRescale !== undefined ? Number(p.cfgRescale) : undefined),
    sampler: p.sampler || undefined,
    seed: p.seed !== undefined ? p.seed : undefined
  };
}
