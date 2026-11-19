import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawn, spawnSync } from 'node:child_process';

import {
  getDataDir,
  getDefaultOutputDir,
  getCredentialsFile,
  getArtistPresetsFile,
  getWallpaperFile,
  resolvePythonCommand
} from '../lib/paths.js';
import { sanitizeParams } from '../lib/linter.js';
import { resolveImageNaming } from '../lib/naming.js';
import { injectPngMetadata, readPngMetadata, readPngMetadataFromFile } from '../lib/png.js';
import { extractPngFromZip } from '../lib/zip.js';
import { isWithinOutputDir, isAllowedOrigin, createApiHandler } from '../lib/api.js';
import {
  NovelAIClient,
  resolveStylePreset,
  loadArtistPresetsList,
  saveExternalPresets,
  estimateLocalCost
} from '../lib/client.js';
import { danbooruEngine } from '../lib/danbooru.js';

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function makeChunk(type, data) {
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'latin1');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(zlib.crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function makeMinimalPng(extraChunks = [], width = 64, height = 64) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const rawRow = Buffer.alloc(1 + width * 4);
  const idat = zlib.deflateSync(Buffer.concat(Array.from({ length: height }, () => rawRow)));
  return Buffer.concat([
    PNG_SIG,
    makeChunk('IHDR', ihdr),
    ...extraChunks,
    makeChunk('IDAT', idat),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

function makeSingleEntryZip(filename, contentBuf, deflate = true) {
  const nameBuf = Buffer.from(filename, 'utf8');
  const compMethod = deflate ? 8 : 0;
  const payload = deflate ? zlib.deflateRawSync(contentBuf) : contentBuf;
  const crc = zlib.crc32(contentBuf);

  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(compMethod, 8);
  localHeader.writeUInt32LE(crc, 14);
  localHeader.writeUInt32LE(payload.length, 18);
  localHeader.writeUInt32LE(contentBuf.length, 22);
  localHeader.writeUInt16LE(nameBuf.length, 26);

  const cdOffset = localHeader.length + nameBuf.length + payload.length;
  const centralDir = Buffer.alloc(46);
  centralDir.writeUInt32LE(0x02014b50, 0);
  centralDir.writeUInt16LE(20, 4);
  centralDir.writeUInt16LE(20, 6);
  centralDir.writeUInt16LE(compMethod, 10);
  centralDir.writeUInt32LE(crc, 16);
  centralDir.writeUInt32LE(payload.length, 20);
  centralDir.writeUInt32LE(contentBuf.length, 24);
  centralDir.writeUInt16LE(nameBuf.length, 28);
  centralDir.writeUInt32LE(0, 42);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(centralDir.length + nameBuf.length, 12);
  eocd.writeUInt32LE(cdOffset, 16);

  return Buffer.concat([localHeader, nameBuf, payload, centralDir, nameBuf, eocd]);
}

function checkPythonPillow() {
  const py = resolvePythonCommand();
  if (!py) return null;
  const probe = spawnSync(py, ['-c', 'import PIL; from PIL import Image'], {
    encoding: 'utf8',
    timeout: 5000,
    windowsHide: true
  });
  return probe.status === 0 ? py : null;
}

test('paths.js resolves cross-platform defaults, config/env overrides, and optional wallpaper', () => {
  const tmpData = fs.mkdtempSync(path.join(os.tmpdir(), 'nai5-paths-'));
  const prevEnvData = process.env.NAI5_DATA_DIR;
  try {
    delete process.env.NAI5_DATA_DIR;
    const cfg = { dataDir: tmpData, outputDir: path.join(tmpData, 'outputs') };
    assert.equal(getDataDir(cfg), path.resolve(tmpData));
    assert.equal(getDefaultOutputDir(cfg), path.resolve(tmpData, 'outputs'));
    assert.equal(getCredentialsFile(cfg), path.join(tmpData, 'credentials.json'));
    assert.equal(getArtistPresetsFile(cfg), path.join(tmpData, 'artist_presets.json'));
    assert.equal(getWallpaperFile(cfg), '');

    const wpPath = path.join(tmpData, 'wallpaper.webp');
    fs.writeFileSync(wpPath, 'fake-webp');
    assert.equal(getWallpaperFile(cfg), wpPath);

    process.env.NAI5_DATA_DIR = path.join(tmpData, 'env-override');
    assert.equal(getDataDir({}), path.resolve(tmpData, 'env-override'));
  } finally {
    if (prevEnvData === undefined) delete process.env.NAI5_DATA_DIR;
    else process.env.NAI5_DATA_DIR = prevEnvData;
    fs.rmSync(tmpData, { recursive: true, force: true });
  }
});

test('linter preserves 1girl, 1boy, strips solo, clamps 3MP / 22 chars, fixes artist digits, and preserves 0 CFG', () => {
  const duo = sanitizeParams({
    positivePrompt: '1girl, 1boy, solo, holding hands, artist:demo01::',
    cfgScale: 0,
    cfgRescale: 0
  });
  assert.match(duo.positivePrompt, /\b1girl\b/);
  assert.match(duo.positivePrompt, /\b1boy\b/);
  assert.doesNotMatch(duo.positivePrompt, /\bsolo\b/i);
  assert.match(duo.positivePrompt, /artist:demo01, ::/);
  assert.match(duo.negativePrompt, /identical faces/);
  assert.equal(duo.cfgScale, 0);
  assert.equal(duo.cfgRescale, 0);

  const manyChars = Array.from({ length: 25 }, (_, i) => ({ prompt: `char_${i}` }));
  const clamped = sanitizeParams({
    positivePrompt: '2girls, 1girl, solo, beach',
    width: 2560,
    height: 2560,
    characterPrompts: manyChars
  });
  assert.doesNotMatch(clamped.positivePrompt, /\b1girl\b/i);
  assert.ok(clamped.width * clamped.height <= 3145728);
  assert.equal(clamped.width % 64, 0);
  assert.equal(clamped.height % 64, 0);
  assert.equal(clamped.characterPrompts.length, 22);
});

test('naming supports neutral defaults, optional character_rules.json, characterPrompts, and path sanitization', () => {
  const tmpData = fs.mkdtempSync(path.join(os.tmpdir(), 'nai5-naming-'));
  try {
    const cfg = { dataDir: tmpData };
    const neutral = resolveImageNaming({
      positivePrompt: '1girl, sitting by the window, cherry blossoms'
    }, 123, new Date('2026-11-19T10:20:30Z'), cfg);
    assert.equal(neutral.character, '综合创作');
    assert.equal(neutral.topic, '窗边');
    assert.equal(neutral.rating, 'Safe');
    assert.equal(neutral.styleCode, 'custom');

    const rulesPath = path.join(tmpData, 'character_rules.json');
    fs.writeFileSync(rulesPath, JSON.stringify([
      { name: 'Alice', pattern: '\\balice\\b' }
    ]), 'utf8');

    const matched = resolveImageNaming({
      positivePrompt: 'sunset rooftop',
      characterPrompts: [{ prompt: 'alice, navy blazer, bikini' }],
      style: '02'
    }, 456, new Date('2026-11-19T10:20:30Z'), cfg);
    assert.equal(matched.character, 'Alice');
    assert.equal(matched.rating, 'R18');
    assert.equal(matched.styleCode, 'S02');

    const safeChar = resolveImageNaming({
      positivePrompt: '1girl',
      character: '../../evil_name/test'
    }, 99, new Date(), cfg);
    assert.ok(!safeChar.charDir.includes('..'));
    assert.ok(!safeChar.charDir.includes('/'));
    assert.ok(!safeChar.charDir.includes('_'));
  } finally {
    fs.rmSync(tmpData, { recursive: true, force: true });
  }
});

test('png strips duplicate upstream metadata and round-trips CJK via iTXt', () => {
  const oldDesc = makeChunk('tEXt', Buffer.concat([
    Buffer.from('Description', 'latin1'),
    Buffer.from([0]),
    Buffer.from('OLD_UPSTREAM_PROMPT', 'latin1')
  ]));
  const oldComment = makeChunk('tEXt', Buffer.concat([
    Buffer.from('Comment', 'latin1'),
    Buffer.from([0]),
    Buffer.from(JSON.stringify({ prompt: 'OLD_COMMENT', seed: 1 }), 'latin1')
  ]));
  const rawPng = makeMinimalPng([oldDesc, oldComment]);

  const injected = injectPngMetadata(rawPng, {
    prompt: '爱丽丝，黄昏天台, 1girl, masterpiece',
    uc: 'worst quality',
    seed: 777,
    width: 832,
    height: 1216
  });

  const memMeta = readPngMetadata(injected);
  assert.equal(memMeta.Description, '爱丽丝，黄昏天台, 1girl, masterpiece');
  assert.equal(memMeta.parameters?.seed, 777);
  assert.equal(memMeta.parameters?.prompt, '爱丽丝，黄昏天台, 1girl, masterpiece');

  const tmpFile = path.join(os.tmpdir(), `nai5-test-${Date.now()}.png`);
  try {
    fs.writeFileSync(tmpFile, injected);
    const fileMeta = readPngMetadataFromFile(tmpFile);
    assert.equal(fileMeta.Description, '爱丽丝，黄昏天台, 1girl, masterpiece');
    assert.equal(fileMeta.parameters?.seed, 777);
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
});

test('zip extracts both raw PNG passthrough and deflated/stored ZIP archives', () => {
  const png = makeMinimalPng();
  assert.ok(extractPngFromZip(png).equals(png));

  const zippedDeflate = makeSingleEntryZip('image_0.png', png, true);
  assert.ok(extractPngFromZip(zippedDeflate).equals(png));

  const zippedStore = makeSingleEntryZip('image_0.png', png, false);
  assert.ok(extractPngFromZip(zippedStore).equals(png));
});

test('api boundary guards and HTTP endpoints handle unconfigured state, presets import, and config cleanly', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nai5-api-'));
  const siblingRoot = `${tmpDir}2`;
  const outDir = path.join(tmpDir, 'outputs');
  fs.mkdirSync(siblingRoot, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });

  const client = new NovelAIClient({ dataDir: tmpDir, outputDir: outDir });
  const server = http.createServer(createApiHandler(client));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const insideFile = path.join(outDir, '2026-11-19', 'test.png');
    assert.equal(isWithinOutputDir(insideFile, outDir), true);
    assert.equal(isWithinOutputDir(outDir, outDir), false);
    assert.equal(isWithinOutputDir(path.join(outDir, '..', 'secret.json'), outDir), false);
    assert.equal(isWithinOutputDir(path.join(siblingRoot, 'leak.png'), outDir), false);

    assert.equal(isAllowedOrigin(''), true);
    assert.equal(isAllowedOrigin('http://localhost:3000'), true);
    assert.equal(isAllowedOrigin('http://127.0.0.1:5173'), true);
    assert.equal(isAllowedOrigin('app://-'), true);
    assert.equal(isAllowedOrigin('file://'), true);
    assert.equal(isAllowedOrigin('https://untrusted.example'), false);

    const stateRes = await fetch(`${baseUrl}/api/novelai/state`);
    assert.equal(stateRes.status, 200);
    const stateJson = await stateRes.json();
    assert.equal(stateJson.ok, true);
    assert.equal(stateJson.configured, false);

    const cfgRes = await fetch(`${baseUrl}/api/novelai/config`);
    assert.equal(cfgRes.status, 200);
    const cfgJson = await cfgRes.json();
    assert.equal(cfgJson.ok, true);
    assert.equal(cfgJson.hasWallpaper, false);
    assert.equal(cfgJson.hasCredentials, false);

    const forbiddenRes = await fetch(`${baseUrl}/api/novelai/config`, {
      headers: { Origin: 'https://untrusted.example' }
    });
    assert.equal(forbiddenRes.status, 403);

    const saveRes = await fetch(`${baseUrl}/api/novelai/presets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'artist',
        items: {
          '01': { name: 'Soft Pastel', group: 'Painterly', stylePrompt: '<style> pastel, soft </style>' }
        }
      })
    });
    assert.equal(saveRes.status, 200);
    const saveJson = await saveRes.json();
    assert.equal(saveJson.ok, true);
    assert.equal(saveJson.count, 1);

    const preRes = await fetch(`${baseUrl}/api/novelai/presets`);
    const preJson = await preRes.json();
    assert.equal(preJson.artistPresets.length, 1);
    assert.equal(preJson.artistPresets[0].prompt, '<style> pastel, soft </style>');
  } finally {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(siblingRoot, { recursive: true, force: true });
  }
});

test('client manages accounts cleanly in tmpdir and never injects hardcoded style presets', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nai5-client-'));
  try {
    const cfg = { dataDir: tmpDir, outputDir: path.join(tmpDir, 'out') };
    const client = new NovelAIClient(cfg);
    assert.equal(client.hasCredentials(), false);
    assert.equal(resolveStylePreset('01', cfg), '');

    const enhancedNoStyle = client.enhanceWithCodex({
      positivePrompt: '1girl, rooftop',
      negativePrompt: ''
    });
    assert.equal(enhancedNoStyle.stylePrompt || '', '');
    assert.match(enhancedNoStyle.negativePrompt, /worst quality/);

    const events = [];
    const unsub = client.subscribeEvents((ev) => events.push(ev));
    client.addOrUpdateAccount({
      name: 'Official',
      endpoint: 'https://image.novelai.net',
      token: 'pst-demo-token-1'
    });
    client.addOrUpdateAccount({
      name: 'Secondary',
      endpoint: 'https://relay.example.invalid',
      token: 'sk-demo-token-2'
    });
    assert.equal(client.listAccounts().accounts.length, 2);
    const switched = client.switchAccount('Official');
    assert.equal(switched.activeAccount.name, 'Official');
    client.deleteAccount(switched.accounts.find(a => a.name === 'Secondary').id);
    assert.equal(client.listAccounts().accounts.length, 1);
    unsub();
    assert.ok(events.length >= 3);

    // Optional artist_presets.json supports both keyed object map and array formats
    saveExternalPresets('artist', [
      { code: '01', name: 'Crisp Cel', group: 'Anime', prompt: '<style> clean lineart </style>' }
    ], cfg);
    assert.equal(loadArtistPresetsList(cfg).length, 1);
    assert.equal(resolveStylePreset('S1', cfg), '<style> clean lineart </style>');

    assert.equal(estimateLocalCost({ width: 832, height: 1216, steps: 28 }), 0);
    assert.ok(estimateLocalCost({ width: 1280, height: 1920, steps: 28 }) > 0);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('danbooru engine supports graceful empty state, UTF-8/GBK CSVs, optional codexes, and neutral synonyms', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nai5-danbooru-'));
  try {
    danbooruEngine.configure({
      dataDir: tmpDir,
      codexDir: path.join(tmpDir, 'missing-codexes'),
      danbooruCsv: path.join(tmpDir, 'missing.csv')
    });
    const emptyRel = danbooruEngine.getRelatedTags(['逆光']);
    assert.ok(emptyRel.related_tags.includes('backlighting'));
    const emptyArt = danbooruEngine.recommendArtists(['watercolor']);
    assert.equal(emptyArt.fallback, true);
    assert.deepEqual(emptyArt.recommended_artists, []);

    const csvPath = path.join(tmpDir, 'danbooru-cn.csv');
    const codexDir = path.join(tmpDir, 'codexes');
    fs.mkdirSync(codexDir, { recursive: true });
    fs.writeFileSync(
      csvPath,
      'tag,cn_name,wiki,post_count,category,nsfw\n' +
      'backlighting,逆光,,12000,0,0\n' +
      'sample_artist,"示例画师",,5000,1,0\n',
      'utf8'
    );
    fs.writeFileSync(
      path.join(codexDir, 'sample_pack.json'),
      JSON.stringify({
        title: 'Sample Pack',
        entries: [
          {
            title: 'Waterfront Dusk',
            chapter: 'Scenes',
            prompt: 'artist:sample_artist, watercolor, twilight harbor, rim light',
            negative: 'harsh contrast'
          }
        ]
      }),
      'utf8'
    );

    danbooruEngine.configure({ dataDir: tmpDir, codexDir, danbooruCsv: csvPath });
    const dbRes = danbooruEngine.searchDanbooru('逆光', { compact: true });
    assert.equal(dbRes.results[0].tag, 'backlighting');

    const cxRes = danbooruEngine.searchCodex('watercolor', { compact: true, include_negative: true });
    assert.equal(cxRes.count, 1);
    assert.equal(cxRes.results[0].codex, 'Sample Pack');
    assert.equal(cxRes.results[0].negative, 'harsh contrast');

    const artRes = danbooruEngine.recommendArtists(['watercolor'], { limit: 5 });
    assert.ok(artRes.recommended_artists.includes('artist:sample_artist'));
  } finally {
    danbooruEngine.reset();
    danbooruEngine.configure({});
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('built client.js loads in mocked __ModuleLoader__ with dsh-nai5-studio id and zero hardcoded presets', () => {
  const clientPath = path.resolve(import.meta.dirname, '../client.js');
  const code = fs.readFileSync(clientPath, 'utf8');
  let captured = null;
  const prevWindow = globalThis.window;
  try {
    globalThis.window = {
      __ModuleLoader__: { load(mod) { captured = mod; } },
      addEventListener() {},
      removeEventListener() {}
    };
    new Function(code)();
    assert.ok(captured && typeof captured.factory === 'function');
    assert.equal(captured.id, 'dsh-nai5-studio');
    const mockReact = {
      createElement: () => ({}),
      Fragment: 'Fragment',
      useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
      useEffect: () => {},
      useCallback: (fn) => fn,
      useRef: (v) => ({ current: v }),
      useMemo: (fn) => fn()
    };
    const plugin = captured.factory((id) => (id === 'react' ? mockReact : null));
    assert.equal(plugin.name, 'dsh-nai5-studio');
    assert.equal(typeof plugin.apply, 'function');
  } finally {
    globalThis.window = prevWindow;
  }
});

test('mcp_server.mjs handles initialize, tools/list (12 tools), and list_accounts with isolated NAI5_DATA_DIR', async () => {
  const tmpData = fs.mkdtempSync(path.join(os.tmpdir(), 'nai5-mcp-'));
  const serverPath = path.resolve(import.meta.dirname, '../mcp_server.mjs');
  const child = spawn(process.execPath, [serverPath], {
    env: { ...process.env, NAI5_DATA_DIR: tmpData },
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true
  });

  const responses = new Map();
  let buffer = '';
  const waiters = new Map();

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const ln of lines) {
      if (!ln.trim()) continue;
      const msg = JSON.parse(ln);
      if (msg.id !== undefined && msg.id !== null) {
        responses.set(msg.id, msg);
        const w = waiters.get(msg.id);
        if (w) {
          waiters.delete(msg.id);
          w(msg);
        }
      }
    }
  });

  function rpc(id, method, params = {}) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`MCP timeout for ${method}`)), 8000);
      waiters.set(id, (msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  }

  try {
    const initRes = await rpc(1, 'initialize', { protocolVersion: '2024-11-05' });
    assert.equal(initRes.result.serverInfo.name, 'dsh-nai5-studio');

    const listRes = await rpc(2, 'tools/list');
    assert.equal(listRes.result.tools.length, 12);

    const accRes = await rpc(3, 'tools/call', { name: 'list_accounts', arguments: {} });
    assert.equal(accRes.result.isError, false);
    const parsedAcc = JSON.parse(accRes.result.content[0].text);
    assert.equal(parsedAcc.ok, true);
    assert.deepEqual(parsedAcc.accounts, []);
  } finally {
    child.stdin.end();
    child.kill();
    fs.rmSync(tmpData, { recursive: true, force: true });
  }
});

test('Python workers process thumbnails and 4koma comic pages when Pillow is installed', (t) => {
  const pythonCmd = checkPythonPillow();
  if (!pythonCmd) {
    t.skip('Python 3 with Pillow is not installed in this environment');
    return;
  }

  const thumbWorker = path.resolve(import.meta.dirname, '../workers/thumb_worker.py');
  const stitchWorker = path.resolve(import.meta.dirname, '../workers/stitch_comic.py');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nai5-py-'));

  try {
    const pngBuf = makeMinimalPng([], 64, 64);
    const jobs = [];
    for (let i = 1; i <= 4; i++) {
      const src = path.join(tmpDir, `src_${i}.png`);
      const dst = path.join(tmpDir, `dst_${i}.webp`);
      fs.writeFileSync(src, pngBuf);
      jobs.push({ id: i, src, dst, maxW: 32 });
    }
    const stdinText = jobs.map(j => JSON.stringify(j)).join('\n') + '\n';
    const thumbProc = spawnSync(pythonCmd, ['-B', '-u', thumbWorker], {
      input: stdinText,
      encoding: 'utf8',
      timeout: 15000,
      windowsHide: true
    });
    assert.equal(thumbProc.status, 0, thumbProc.stderr);
    const lines = thumbProc.stdout.trim().split(/\r?\n/);
    assert.equal(lines.length, 4);
    const results = lines.map(l => JSON.parse(l));
    assert.deepEqual(results.map(r => r.id).sort((a, b) => a - b), [1, 2, 3, 4]);
    assert.ok(results.every(r => r.ok === true));

    const comicOut = path.join(tmpDir, 'comic.png');
    const stitchProc = spawnSync(pythonCmd, [
      '-B',
      stitchWorker,
      '--panels', ...jobs.map(j => j.src),
      '--layout', '4koma',
      '--out', comicOut,
      '--dialogues', 'Line 1', 'Line 2', 'Line 3', 'Line 4'
    ], {
      encoding: 'utf8',
      timeout: 15000,
      windowsHide: true
    });
    assert.equal(stitchProc.status, 0, stitchProc.stderr);
    assert.ok(fs.existsSync(comicOut) && fs.statSync(comicOut).size > 0);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('bundled agent skill exists with valid frontmatter and package.json includes skills/', () => {
  const rootDir = path.resolve(import.meta.dirname, '..');
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  assert.ok(Array.isArray(pkg.files) && pkg.files.includes('skills'));

  const skillPath = path.join(rootDir, 'skills', 'nai5-studio-workflow', 'SKILL.md');
  const guidePath = path.join(rootDir, 'skills', 'nai5-studio-workflow', 'references', 'v5-prompt-guide.md');
  assert.ok(fs.existsSync(skillPath));
  assert.ok(fs.existsSync(guidePath));

  const skillContent = fs.readFileSync(skillPath, 'utf8');
  assert.match(skillContent, /^---\r?\n[\s\S]*?name:\s*nai5-studio-workflow[\s\S]*?description:\s*.+[\s\S]*?\r?\n---/);

  const guideContent = fs.readFileSync(guidePath, 'utf8');
  assert.match(guideContent, /characterPrompts/);
  assert.match(guideContent, /stitch_comic/);
});
