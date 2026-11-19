import zlib from 'node:zlib';

/**
 * Pure Node.js ZIP archive parser to extract the first PNG image.
 * Uses standard ZIP format parsing from End of Central Directory (EOCD).
 * Zero external dependencies.
 */
export function extractPngFromZip(buf) {
  if (!Buffer.isBuffer(buf)) {
    buf = Buffer.from(buf);
  }

  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return buf;
  }

  let eocdOffset = -1;
  const maxSearch = Math.min(buf.length - 22, 65536 + 22);
  for (let i = buf.length - 22; i >= buf.length - maxSearch && i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    throw new Error('Invalid response: Neither raw PNG nor standard ZIP archive (EOCD not found)');
  }

  const cdOffset = buf.readUInt32LE(eocdOffset + 16);
  const totalEntries = buf.readUInt16LE(eocdOffset + 10);

  let entryOffset = cdOffset;
  for (let e = 0; e < totalEntries; e++) {
    if (entryOffset + 46 > buf.length || buf.readUInt32LE(entryOffset) !== 0x02014b50) {
      break;
    }

    const compression = buf.readUInt16LE(entryOffset + 10);
    const compressedSize = buf.readUInt32LE(entryOffset + 20);
    const nameLen = buf.readUInt16LE(entryOffset + 28);
    const extraLen = buf.readUInt16LE(entryOffset + 30);
    const commentLen = buf.readUInt16LE(entryOffset + 32);
    const localHeaderOffset = buf.readUInt32LE(entryOffset + 42);

    const filename = buf.toString('utf8', entryOffset + 46, entryOffset + 46 + nameLen);

    if (localHeaderOffset + 30 <= buf.length && buf.readUInt32LE(localHeaderOffset) === 0x04034b50) {
      const localNameLen = buf.readUInt16LE(localHeaderOffset + 26);
      const localExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;

      if (dataStart + compressedSize <= buf.length) {
        const compressedData = buf.subarray(dataStart, dataStart + compressedSize);
        let uncompressed;
        if (compression === 0) {
          uncompressed = compressedData;
        } else if (compression === 8) {
          uncompressed = zlib.inflateRawSync(compressedData);
        } else {
          throw new Error(`Unsupported zip compression method: ${compression}`);
        }

        if (filename.toLowerCase().endsWith('.png') ||
            (uncompressed.length >= 8 && uncompressed.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))) {
          return uncompressed;
        }
      }
    }

    entryOffset += 46 + nameLen + extraLen + commentLen;
  }

  throw new Error('No valid PNG file found in the ZIP archive');
}
