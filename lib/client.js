import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { extractPngFromZip } from './zip.js';
import { injectPngMetadata } from './png.js';
import { sanitizeParams } from './linter.js';
import { archiveManager } from './archive.js';
import { resolveImageNaming } from './naming.js';
import { danbooruEngine } from './danbooru.js';
import { thumbService } from './thumb.js';
import {
  DEFAULT_ENDPOINT,
  getDataDir,
  getDefaultOutputDir,
  getCredentialsFile,
  getArtistPresetsFile,
  getOcPresetsFile,
  getCharacterRulesFile,
  getCodexDir,
  getDanbooruCsvFile,
  getWallpaperFile,
  getWorkersDir,
  resolvePythonCommand
} from './paths.js';

const artistPresetsCache = new Map();

export function normalizePresetCollection(raw, defaultPrefix = 'custom') {
  const result = [];
  if (Array.isArray(raw)) {
    raw.forEach((item, idx) => {
      if (!item || typeof item !== 'object') return;
      const prompt = String(item.stylePrompt || item.prompt || '').trim();
      const name = String(item.name || item.title || '').trim();
      if (!name && !prompt) return;
      const codeRaw = item.code !== undefined ? String(item.code).trim() : '';
      const code = codeRaw || (defaultPrefix === 'artist' ? String(idx + 1).padStart(2, '0') : '');
      result.push({
        id: String(item.id || item.uiId || `${defaultPrefix}-${code || idx + 1}`).trim(),
        ...(code ? { code } : {}),
        name: name || `${defaultPrefix}-${idx + 1}`,
        group: String(item.group || item.category || 'Custom').trim() || 'Custom',
        prompt
      });
    });
    return result;
  }

  if (raw && typeof raw === 'object') {
    const keys = Object.keys(raw).sort((a, b) => {
      const na = Number(a);
      const nb = Number(b);
      if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
      return a.localeCompare(b);
    });
    for (const key of keys) {
      const entry = raw[key];
      if (!entry || typeof entry !== 'object') continue;
      const prompt = String(entry.stylePrompt || entry.prompt || '').trim();
      const cleanName = String(entry.name || key).trim();
      const isNumericKey = /^\d+$/.test(key);
      const code = isNumericKey ? key.padStart(2, '0') : key;
      const displayName = (isNumericKey && !cleanName.startsWith(`[${code}]`))
        ? `[${code}] ${cleanName}`
        : cleanName;
      result.push({
        id: String(entry.uiId || entry.id || `${defaultPrefix}-${code}`).trim(),
        code,
        name: displayName,
        group: String(entry.group || 'Custom').trim() || 'Custom',
        prompt
      });
    }
  }
  return result;
}

function loadArtistPresetsRaw(config = {}) {
  const filePath = getArtistPresetsFile(config);
  try {
    if (!fs.existsSync(filePath)) return null;
    const stat = fs.statSync(filePath);
    const cached = artistPresetsCache.get(filePath);
    if (cached && cached.mtimeMs === stat.mtimeMs) {
      return cached.raw;
    }
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    artistPresetsCache.set(filePath, { mtimeMs: stat.mtimeMs, raw: parsed });
    return parsed;
  } catch (err) {
    console.warn('[NovelAIClient] Failed reading optional artist_presets.json:', err?.message || err);
    return null;
  }
}

export function loadArtistPresetsList(config = {}) {
  const raw = loadArtistPresetsRaw(config);
  return raw ? normalizePresetCollection(raw, 'artist') : [];
}

export function loadOcPresetsList(config = {}) {
  const filePath = getOcPresetsFile(config);
  try {
    if (!fs.existsSync(filePath)) return [];
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return normalizePresetCollection(raw, 'oc');
  } catch (err) {
    console.warn('[NovelAIClient] Failed reading optional oc_presets.json:', err?.message || err);
    return [];
  }
}

export function saveExternalPresets(kind, items, config = {}) {
  const prefix = kind === 'oc' ? 'oc' : 'artist';
  const filePath = prefix === 'oc' ? getOcPresetsFile(config) : getArtistPresetsFile(config);
  const normalized = normalizePresetCollection(items, prefix);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(normalized, null, 2) + '\n', 'utf8');
  if (prefix === 'artist') {
    artistPresetsCache.delete(filePath);
    danbooruEngine.reset();
  }
  return { filePath, items: normalized };
}

export function resolveStylePreset(style, config = {}) {
  if (style === undefined || style === null) return '';
  const rawQuery = String(style).trim();
  if (!rawQuery) return '';

  const list = loadArtistPresetsList(config);
  if (list.length === 0) return '';

  const stripped = rawQuery.replace(/^s/i, '');
  const numericKey = /^\d+$/.test(stripped) ? stripped.padStart(2, '0') : '';

  const hit =
    list.find(item => (numericKey && item.code === numericKey) || item.code === rawQuery) ||
    list.find(item => item.id === rawQuery) ||
    list.find(item => item.name.toLowerCase() === rawQuery.toLowerCase());

  return hit?.prompt || '';
}

function clamp01(val, fallback = 0) {
  const n = Number(val);
  if (val === undefined || val === null || val === '' || Number.isNaN(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

function round2(val) {
  return Math.round(Number(val) * 100) / 100;
}

export function stripV5XmlTags(text) {
  return String(text || '')
    .replace(/<\/?(artist|style)>/gi, ' ')
    .replace(/\s+/g, ' ')
    .replace(/,\s*,+/g, ', ')
    .replace(/^,\s*|\s*,\s*$/g, '')
    .trim();
}

export function buildMultipartFormBuffer(requestPayload, { imageBuf = null, maskBuf = null, refBuffers = [] } = {}) {
  const boundary = `----DshNaiBoundary${crypto.randomBytes(12).toString('hex')}`;
  const chunks = [];
  const pushStr = (s) => chunks.push(Buffer.from(s, 'utf8'));

  if (Buffer.isBuffer(imageBuf) && imageBuf.length > 0) {
    pushStr(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="image"\r\nContent-Type: image/png\r\n\r\n`);
    chunks.push(imageBuf);
    pushStr('\r\n');
  }

  if (Buffer.isBuffer(maskBuf) && maskBuf.length > 0) {
    pushStr(`--${boundary}\r\nContent-Disposition: form-data; name="mask"; filename="mask"\r\nContent-Type: image/png\r\n\r\n`);
    chunks.push(maskBuf);
    pushStr('\r\n');
  }

  const reqJson = JSON.stringify(requestPayload);
  pushStr(`--${boundary}\r\nContent-Disposition: form-data; name="request"\r\nContent-Type: application/json\r\n\r\n`);
  pushStr(reqJson);
  pushStr('\r\n');

  refBuffers.forEach((buf, idx) => {
    if (!Buffer.isBuffer(buf) || buf.length === 0) return;
    pushStr(`--${boundary}\r\nContent-Disposition: form-data; name="director_ref_${idx}"; filename="blob"\r\nContent-Type: image/png\r\n\r\n`);
    chunks.push(buf);
    pushStr('\r\n');
  });

  pushStr(`--${boundary}--\r\n`);
  const body = Buffer.concat(chunks);
  return {
    body,
    contentType: `multipart/form-data; boundary=${boundary}`,
    contentLength: body.length
  };
}

export function extractPngOrZipBuffer(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 8) {
    throw new Error('Empty image response from NovelAI');
  }
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return buf;
  }
  return extractPngFromZip(buf);
}

export async function runImageHelper(args = [], stdinBuffer = null) {
  const pythonCmd = resolvePythonCommand();
  if (!pythonCmd) {
    throw new Error('Python 3 with Pillow is required for image processing (`pip install Pillow`).');
  }
  const helperScript = path.join(getWorkersDir(), 'image_helper.py');
  return new Promise((resolve, reject) => {
    const child = execFile(
      pythonCmd,
      ['-B', helperScript, ...args],
      { maxBuffer: 64 * 1024 * 1024, encoding: 'utf8', windowsHide: true },
      (err, stdout, stderr) => {
        if (err) {
          const detail = stderr || err.message;
          if (/No module named ['"]PIL['"]/i.test(detail)) {
            return reject(new Error('Image processing requires Pillow (`pip install Pillow`).'));
          }
          return reject(new Error(`image_helper.py failed: ${detail}`));
        }
        try {
          resolve(JSON.parse(String(stdout || '{}')));
        } catch (parseErr) {
          reject(new Error(`image_helper.py invalid JSON: ${parseErr.message}`));
        }
      }
    );
    if (stdinBuffer && child.stdin) {
      child.stdin.write(stdinBuffer);
      child.stdin.end();
    } else if (child.stdin) {
      child.stdin.end();
    }
  });
}

export function decodeImageInputToBuffer(input) {
  if (Buffer.isBuffer(input)) return input;
  const raw = String(input || '').trim();
  if (!raw) throw new Error('Missing image input');
  if (raw.startsWith('data:image/')) {
    const commaIdx = raw.indexOf(',');
    if (commaIdx === -1) throw new Error('Invalid data URL');
    return Buffer.from(raw.slice(commaIdx + 1), 'base64');
  }
  if (!raw.includes('\n') && raw.length < 520 && fs.existsSync(raw)) {
    return fs.readFileSync(raw);
  }
  return Buffer.from(raw, 'base64');
}

export function estimateLocalCost(params = {}) {
  const action = String(params.action || 'generate').toLowerCase();
  const w = Number(params.width) || 832;
  const h = Number(params.height) || 1216;
  const count = Math.max(1, Number(params.count) || 1);
  const pixels = w * h;

  if (action === 'upscale') {
    const scale = Number(params.scale) === 4 ? 4 : 2;
    const perPass = Math.max(4, Math.round((pixels / 1048576) * 7));
    return scale === 4 ? perPass * 2 : perPass;
  }
  if (action === 'director') {
    return Math.max(4, Math.round((pixels / 1048576) * 6));
  }

  const steps = params.effort === 'medium' ? 14 : (Number(params.steps) || 28);
  if (pixels <= 1048576 && steps <= 28) {
    return 0;
  }
  const ratio = Math.max(1, pixels / (832 * 1216));
  return Math.max(2, Math.round(20 * ratio * (steps / 28))) * count;
}

let sharedClientInstance = null;

export class NovelAIClient {
  constructor(config = {}) {
    this.config = config && typeof config === 'object' ? { ...config } : {};
    this._seq = 0;
    this._eventListeners = new Set();
    this._vibeEncodeCache = new Map();
    this._syncSubsystems();
    this.sessionBridge = {
      locks: {
        enabled: false,
        lockStyle: true,
        lockAspect: true,
        lockRatingUc: false,
        lockSeed: false,
        lockChars2D: false
      },
      overrides: {
        artistId: '',
        artistName: '',
        stylePrompt: '',
        aspectRatio: '2:3',
        width: 832,
        height: 1216,
        ucMode: 'safe',
        negativePrompt: '',
        seedMode: 'random',
        seed: '',
        characterPrompts: []
      },
      lastEvent: {
        seq: 0,
        status: 'idle',
        source: 'idle',
        startedAt: 0,
        completedAt: 0,
        error: null,
        lastRecord: null
      }
    };
  }

  _syncSubsystems() {
    archiveManager.setConfig(this.config);
    danbooruEngine.configure(this.config);
    const outDir = this.getOutputDir();
    archiveManager.setOutputDir(outDir);
    thumbService.setOutputDir(outDir);
  }

  subscribeEvents(fn) {
    if (typeof fn !== 'function') return () => {};
    this._eventListeners.add(fn);
    return () => this._eventListeners.delete(fn);
  }

  updateConfig(config = {}) {
    if (!config || typeof config !== 'object') return;
    this.config = { ...this.config, ...config };
    this._syncSubsystems();
  }

  async _fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    if (typeof timer.unref === 'function') timer.unref();
    try {
      return await fetch(url, { ...options, signal: ctrl.signal });
    } catch (err) {
      if (err?.name === 'AbortError') {
        throw new Error(`Request timed out after ${timeoutMs}ms: ${url}`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  _emitEvent(ev) {
    for (const fn of this._eventListeners) {
      try {
        fn(ev);
      } catch (err) {
        console.warn('[NovelAIClient] Event listener error:', err?.message || err);
      }
    }
  }

  _getCredentialsPath() {
    return getCredentialsFile(this.config);
  }

  getOutputDir() {
    const store = this._loadStore();
    return store.outputDir || this.config.outputDir || getDefaultOutputDir(this.config);
  }

  hasCredentials() {
    return this._loadStore().accounts.length > 0;
  }

  getPublicConfig() {
    return {
      dataDir: getDataDir(this.config),
      outputDir: this.getOutputDir(),
      credentialsFile: this._getCredentialsPath(),
      artistPresetsFile: getArtistPresetsFile(this.config),
      ocPresetsFile: getOcPresetsFile(this.config),
      characterRulesFile: getCharacterRulesFile(this.config),
      codexDir: getCodexDir(this.config),
      danbooruCsv: getDanbooruCsvFile(this.config),
      hasWallpaper: Boolean(getWallpaperFile(this.config)),
      defaultEndpoint: DEFAULT_ENDPOINT,
      hasCredentials: this.hasCredentials()
    };
  }

  getBridgeState() {
    if (!this.sessionBridge.lastEvent.lastRecord) {
      try {
        const recent = archiveManager.listRecent(1);
        const first = Array.isArray(recent) ? recent[0] : recent?.records?.[0];
        if (first) {
          this.sessionBridge.lastEvent.lastRecord = first;
        }
      } catch (err) {
        console.warn('[NovelAIClient] Failed reading initial archive record:', err?.message || err);
      }
    }
    return this.sessionBridge;
  }

  updateBridgeState(patch = {}) {
    if (patch.locks && typeof patch.locks === 'object') {
      this.sessionBridge.locks = {
        ...this.sessionBridge.locks,
        ...patch.locks
      };
    }
    if (patch.overrides && typeof patch.overrides === 'object') {
      this.sessionBridge.overrides = {
        ...this.sessionBridge.overrides,
        ...patch.overrides
      };
    }
    const state = this.getBridgeState();
    this._emitEvent({ type: 'bridge_update', bridge: state });
    return state;
  }

  applyAgentBridgeLocks(rawParams = {}) {
    const { locks, overrides } = this.sessionBridge;
    if (!locks || !locks.enabled) return rawParams;
    const merged = { ...rawParams };

    if (locks.lockStyle && overrides.stylePrompt) {
      merged.stylePrompt = overrides.stylePrompt;
    }
    if (locks.lockAspect && overrides.width && overrides.height) {
      merged.width = Number(overrides.width) || 832;
      merged.height = Number(overrides.height) || 1216;
    }
    if (locks.lockRatingUc && overrides.negativePrompt) {
      merged.negativePrompt = overrides.negativePrompt;
      merged.uc = overrides.negativePrompt;
    }
    if (locks.lockSeed && overrides.seedMode === 'fixed' && overrides.seed !== '' && overrides.seed !== null) {
      merged.seed = Number(overrides.seed);
    }
    if (locks.lockChars2D && Array.isArray(overrides.characterPrompts) && overrides.characterPrompts.length > 0) {
      if (!Array.isArray(merged.characterPrompts) || merged.characterPrompts.length === 0) {
        merged.characterPrompts = overrides.characterPrompts;
      } else {
        merged.characterPrompts = merged.characterPrompts.map((cp, idx) => {
          const ov = overrides.characterPrompts[idx];
          if (!ov) return cp;
          return {
            ...cp,
            x: typeof ov.x === 'number' ? ov.x : cp.x,
            y: typeof ov.y === 'number' ? ov.y : cp.y,
            useCoords: true
          };
        });
      }
    }
    return merged;
  }

  _maskToken(token) {
    const raw = String(token || '').trim();
    if (!raw) return '';
    if (raw.length <= 10) return `${raw.slice(0, 2)}***${raw.slice(-2)}`;
    return `${raw.slice(0, 6)}...${raw.slice(-4)}`;
  }

  _normalizeEndpoint(endpoint) {
    let ep = String(endpoint || '').trim().replace(/\/+$/, '');
    if (ep && !/^https?:\/\//i.test(ep)) {
      ep = `https://${ep}`;
    }
    return ep;
  }

  _defaultAccountName(endpoint) {
    try {
      const host = new URL(endpoint).hostname;
      return host || 'Custom API';
    } catch {
      return 'Custom API';
    }
  }

  _buildUniqueAccountId(name, endpoint, existingIds = new Set()) {
    let base = '';
    try {
      const host = new URL(endpoint).hostname.split('.')[0];
      base = String(host || name || 'account').toLowerCase().replace(/[^a-z0-9_-]/g, '');
    } catch {
      base = String(name || 'account').toLowerCase().replace(/[^a-z0-9_-]/g, '');
    }
    if (!base) base = 'custom';
    let candidate = `acc-${base}`;
    let idx = 2;
    while (existingIds.has(candidate)) {
      candidate = `acc-${base}-${idx++}`;
    }
    return candidate;
  }

  _loadStore() {
    const credFile = this._getCredentialsPath();
    let raw = {};
    if (fs.existsSync(credFile)) {
      try {
        raw = JSON.parse(fs.readFileSync(credFile, 'utf8')) || {};
      } catch (err) {
        console.error('[NovelAIClient] Error reading credentials file:', err);
      }
    }

    const outputDir = raw.outputDir || this.config.outputDir || getDefaultOutputDir(this.config);
    const accounts = [];
    const seenIds = new Set();

    if (Array.isArray(raw.accounts)) {
      for (const item of raw.accounts) {
        if (!item || !item.endpoint || !item.token) continue;
        const endpoint = this._normalizeEndpoint(item.endpoint);
        const token = String(item.token).trim();
        const name = String(item.name || this._defaultAccountName(endpoint)).trim();
        let id = String(item.id || '').trim();
        if (!id || seenIds.has(id)) {
          id = this._buildUniqueAccountId(name, endpoint, seenIds);
        }
        seenIds.add(id);
        accounts.push({ id, name, endpoint, token });
      }
    }

    if (accounts.length === 0 && raw.endpoint && raw.token) {
      const endpoint = this._normalizeEndpoint(raw.endpoint);
      const token = String(raw.token).trim();
      const name = this._defaultAccountName(endpoint);
      const id = this._buildUniqueAccountId(name, endpoint, seenIds);
      accounts.push({ id, name, endpoint, token });
    }

    const envToken = process.env.NAI_TOKEN || process.env.NOVELAI_API_KEY || '';
    const envEndpoint = process.env.NAI_ENDPOINT || DEFAULT_ENDPOINT;
    if (accounts.length === 0 && (this.config.token || envToken)) {
      const endpoint = this._normalizeEndpoint(this.config.endpoint || envEndpoint);
      const token = String(this.config.token || envToken).trim();
      const name = this._defaultAccountName(endpoint);
      const id = this._buildUniqueAccountId(name, endpoint, seenIds);
      accounts.push({ id, name, endpoint, token });
    }

    let activeAccountId = String(raw.activeAccountId || '').trim();
    if (!accounts.some(a => a.id === activeAccountId)) {
      if (raw.endpoint && raw.token) {
        const normEp = this._normalizeEndpoint(raw.endpoint);
        const match = accounts.find(a => a.endpoint === normEp && a.token === String(raw.token).trim());
        activeAccountId = match ? match.id : (accounts[0]?.id || '');
      } else {
        activeAccountId = accounts[0]?.id || '';
      }
    }

    return { activeAccountId, outputDir, accounts };
  }

  _saveStore(store) {
    const credFile = this._getCredentialsPath();
    const accounts = Array.isArray(store.accounts) ? store.accounts : [];
    let active = accounts.find(a => a.id === store.activeAccountId);
    if (!active && accounts.length > 0) {
      active = accounts[0];
      store.activeAccountId = active.id;
    }

    const payload = {
      activeAccountId: store.activeAccountId || '',
      endpoint: active ? active.endpoint : '',
      token: active ? active.token : '',
      outputDir: store.outputDir || getDefaultOutputDir(this.config),
      accounts
    };

    const dir = path.dirname(credFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(credFile, JSON.stringify(payload, null, 2) + '\n', 'utf8');
    return payload;
  }

  listAccounts() {
    const store = this._loadStore();
    return {
      activeAccountId: store.activeAccountId,
      outputDir: store.outputDir,
      accounts: store.accounts.map(a => ({
        id: a.id,
        name: a.name,
        endpoint: a.endpoint,
        tokenMasked: this._maskToken(a.token),
        isActive: a.id === store.activeAccountId
      }))
    };
  }

  _emitAccountUpdate() {
    const summary = this.listAccounts();
    const active = summary.accounts.find(a => a.id === summary.activeAccountId) || null;
    this._emitEvent({
      type: 'account_update',
      activeAccountId: summary.activeAccountId,
      activeAccount: active,
      accounts: summary.accounts,
      updatedAt: new Date().toISOString()
    });
    return summary;
  }

  switchAccount(idOrQuery) {
    const query = String(idOrQuery || '').trim();
    if (!query) throw new Error('Account id or name is required');
    const store = this._loadStore();
    const qLower = query.toLowerCase();
    const target =
      store.accounts.find(a => a.id === query) ||
      store.accounts.find(a => a.name.toLowerCase() === qLower) ||
      store.accounts.find(a => a.name.toLowerCase().includes(qLower) || a.endpoint.toLowerCase().includes(qLower));
    if (!target) {
      throw new Error(`未找到匹配账号: ${query}`);
    }
    store.activeAccountId = target.id;
    this._saveStore(store);
    const summary = this._emitAccountUpdate();
    const activeAccount = summary.accounts.find(a => a.id === target.id);
    return { ...summary, activeAccount };
  }

  addOrUpdateAccount({ id, name, endpoint, token, activate = true } = {}) {
    const store = this._loadStore();
    const normEp = this._normalizeEndpoint(endpoint);
    if (!normEp || !/^https?:\/\/.+/i.test(normEp)) {
      throw new Error('请输入有效的 http/https 接口地址 (Endpoint)');
    }
    const cleanToken = String(token || '').trim();
    let existing = id ? store.accounts.find(a => a.id === id) : null;
    if (!existing && cleanToken) {
      existing = store.accounts.find(a => a.endpoint === normEp && a.token === cleanToken) || null;
    }

    if (!existing && !cleanToken) {
      throw new Error('请填写 API Key / Token');
    }

    const finalName = String(name || '').trim() || existing?.name || this._defaultAccountName(normEp);
    let savedId;
    if (existing) {
      existing.name = finalName;
      existing.endpoint = normEp;
      if (cleanToken) existing.token = cleanToken;
      savedId = existing.id;
    } else {
      const seenIds = new Set(store.accounts.map(a => a.id));
      savedId = this._buildUniqueAccountId(finalName, normEp, seenIds);
      store.accounts.push({
        id: savedId,
        name: finalName,
        endpoint: normEp,
        token: cleanToken
      });
    }

    if (activate !== false || !store.activeAccountId) {
      store.activeAccountId = savedId;
    }

    this._saveStore(store);
    const summary = this._emitAccountUpdate();
    const account = summary.accounts.find(a => a.id === savedId);
    return { ...summary, account };
  }

  deleteAccount(id) {
    const targetId = String(id || '').trim();
    if (!targetId) throw new Error('Account id is required');
    const store = this._loadStore();
    const idx = store.accounts.findIndex(a => a.id === targetId);
    if (idx === -1) throw new Error(`账号不存在: ${targetId}`);
    if (store.accounts.length <= 1) {
      throw new Error('至少保留一个可用账号，无法删除最后一个账号');
    }
    store.accounts.splice(idx, 1);
    if (store.activeAccountId === targetId) {
      store.activeAccountId = store.accounts[0].id;
    }
    this._saveStore(store);
    return this._emitAccountUpdate();
  }

  getCredentials() {
    const store = this._loadStore();
    const active = store.accounts.find(a => a.id === store.activeAccountId) || store.accounts[0];
    if (active && active.endpoint && active.token) {
      const outDir = store.outputDir || this.config.outputDir || getDefaultOutputDir(this.config);
      archiveManager.setOutputDir(outDir);
      thumbService.setOutputDir(outDir);
      return {
        id: active.id,
        name: active.name,
        endpoint: active.endpoint,
        token: active.token,
        outputDir: outDir
      };
    }
    throw new Error('尚未配置 NovelAI API 账号。请在工作台右上角「配置账号」中添加官方或兼容中转 API Key。');
  }

  async getUserData(overrideCreds = null) {
    if (!overrideCreds && !this.hasCredentials()) {
      return {
        configured: false,
        tier: '未配置',
        anlasBalance: null,
        balanceSupported: false,
        active: false,
        accountId: '',
        accountName: '',
        endpoint: ''
      };
    }

    const creds = overrideCreds && overrideCreds.endpoint && overrideCreds.token
      ? {
          id: overrideCreds.id || '',
          name: overrideCreds.name || this._defaultAccountName(overrideCreds.endpoint),
          endpoint: this._normalizeEndpoint(overrideCreds.endpoint),
          token: String(overrideCreds.token).trim()
        }
      : this.getCredentials();

    const baseUrl = creds.endpoint.replace(/\/+$/, '');
    const headers = {
      'Authorization': `Bearer ${creds.token}`,
      'User-Agent': 'dsh-nai5-studio/1.0',
      'Accept': 'application/json'
    };

    let userStatus = 0;
    try {
      const res = await this._fetchWithTimeout(`${baseUrl}/user/data`, { headers }, 12000);
      userStatus = res.status;
      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        const sub = data.subscription || {};
        const training = sub.trainingStepsLeft || {};
        const balance = (training.fixedTrainingStepsLeft || 0) + (training.purchasedTrainingSteps || 0);
        const tierNames = { 0: 'Paper', 1: 'Tablet', 2: 'Scroll', 3: 'Opus' };
        return {
          configured: true,
          tier: tierNames[sub.tier] || 'Custom',
          anlasBalance: balance,
          balanceSupported: true,
          active: sub.active !== false,
          accountId: creds.id || '',
          accountName: creds.name || '',
          endpoint: baseUrl
        };
      }
    } catch {
      // Fall through to OpenAI-compatible relay probe
    }

    const modelsRes = await this._fetchWithTimeout(`${baseUrl}/v1/models`, { headers }, 12000);
    const modelsType = (modelsRes.headers.get('content-type') || '').toLowerCase();
    if (modelsRes.ok && modelsType.includes('application/json')) {
      const modelsData = await modelsRes.json();
      if (modelsData && Array.isArray(modelsData.data)) {
        return {
          configured: true,
          tier: '中转 API',
          anlasBalance: -1,
          balanceSupported: false,
          active: true,
          modelsCount: modelsData.data.length,
          accountId: creds.id || '',
          accountName: creds.name || '',
          endpoint: baseUrl
        };
      }
    }

    throw new Error(`账号连接校验失败 (/user/data HTTP ${userStatus || 'ERR'}, /v1/models HTTP ${modelsRes.status})`);
  }

  async testAccount({ id, endpoint, token } = {}) {
    const start = Date.now();
    let targetCreds = null;
    if (id) {
      const store = this._loadStore();
      const found = store.accounts.find(a => a.id === id);
      if (!found) throw new Error(`账号不存在: ${id}`);
      targetCreds = found;
    } else if (endpoint && token) {
      targetCreds = { endpoint, token };
    }
    const data = await this.getUserData(targetCreds);
    return {
      ...data,
      latencyMs: Date.now() - start
    };
  }

  async estimateCost(rawParams = {}) {
    const p = sanitizeParams(rawParams);
    if (!this.hasCredentials()) {
      return estimateLocalCost(p);
    }
    const { endpoint, token } = this.getCredentials();
    try {
      const res = await this._fetchWithTimeout(`${endpoint.replace(/\/+$/, '')}/ai/generate-image/request-price`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'dsh-nai5-studio/1.0'
        },
        body: JSON.stringify({
          model: p.model,
          parameters: {
            width: p.width,
            height: p.height,
            steps: p.steps,
            n_samples: 1
          }
        })
      }, 8000);
      if (res.ok) {
        const data = await res.json();
        if (typeof data.price === 'number') return data.price;
      }
    } catch (err) {
      console.warn('[NovelAIClient] Remote estimateCost fallback to local:', err?.message || err);
    }
    return estimateLocalCost(p);
  }

  enhanceWithCodex(params) {
    const p = { ...params };
    danbooruEngine.configure(this.config);
    danbooruEngine.ensureLoaded();

    // Resolve optional numbered/named user style preset if provided
    if (!p.stylePrompt && p.style !== undefined && p.style !== null && String(p.style).trim() !== '') {
      const resolvedStyle = resolveStylePreset(p.style, this.config);
      if (resolvedStyle) {
        p.stylePrompt = resolvedStyle;
      }
    }

    // Translate Chinese tokens only when optional Danbooru CSV / codex packs exist
    const translateChineseTokens = (text) => {
      if (!text || !/[\u4e00-\u9fa5]/.test(text)) return text;
      return text.split(',').map(seg => {
        const trimmed = seg.trim();
        if (!/[\u4e00-\u9fa5]/.test(trimmed)) return seg;
        const weightMatch = trimmed.match(/^(-?\d+(?:\.\d+)?::)?([\s\S]*?)(::)?$/);
        const core = (weightMatch ? weightMatch[2] : trimmed).trim();
        if (!/[\u4e00-\u9fa5]/.test(core)) return seg;
        const dbHit = danbooruEngine.searchDanbooru(core, { limit: 1 });
        if (dbHit?.results?.length > 0 && dbHit.results[0].tag) {
          const prefix = weightMatch?.[1] || '';
          const suffix = weightMatch?.[3] || '';
          return ` ${prefix}${dbHit.results[0].tag}${suffix}`;
        }
        const cxHit = danbooruEngine.searchCodex(core, { limit: 1 });
        if (cxHit?.results?.length > 0 && cxHit.results[0].prompt) {
          return ` ${cxHit.results[0].prompt}`;
        }
        return seg;
      }).join(',');
    };

    p.positivePrompt = translateChineseTokens(p.positivePrompt).trim();
    if (Array.isArray(p.characterPrompts)) {
      p.characterPrompts = p.characterPrompts.map(cp => ({
        ...cp,
        prompt: translateChineseTokens(cp.prompt || '').trim()
      }));
    }

    // Universal quality baseline & anti-distortion guards
    const baseUcTags = [
      'worst quality', 'bad quality', 'lowres', 'artistic error', 'bad hands', 'mutated hands', 'bad anatomy',
      'distorted architecture', 'warped background', 'crooked walls', 'warped perspective'
    ];
    const currentUc = (p.negativePrompt || '').toLowerCase();
    const missingUc = baseUcTags.filter(t => !currentUc.includes(t));
    if (missingUc.length > 0) {
      p.negativePrompt = p.negativePrompt ? `${p.negativePrompt}, ${missingUc.join(', ')}` : missingUc.join(', ');
    }

    return p;
  }

  async generateImage(rawParams = {}, options = {}) {
    const source = options.source || 'agent';
    const effectiveRaw = source === 'agent' ? this.applyAgentBridgeLocks(rawParams) : rawParams;
    const { endpoint, token, outputDir } = this.getCredentials();

    const hasExplicitSeed = effectiveRaw.seed !== undefined &&
      effectiveRaw.seed !== null &&
      effectiveRaw.seed !== '' &&
      !Number.isNaN(Number(effectiveRaw.seed)) &&
      Number(effectiveRaw.seed) >= 0;
    const explicitKey = effectiveRaw.idempotencyKey ? `key:${String(effectiveRaw.idempotencyKey).trim()}` : '';

    let p = sanitizeParams(effectiveRaw);
    p = this.enhanceWithCodex(p);
    const startedAt = Date.now();

    const isSpecialAction = Boolean(effectiveRaw.action && effectiveRaw.action !== 'generate') ||
      (Array.isArray(effectiveRaw.vibeReferences) && effectiveRaw.vibeReferences.length > 0) ||
      (Array.isArray(effectiveRaw.preciseReferences) && effectiveRaw.preciseReferences.length > 0);
    const deterministicCacheKey = isSpecialAction
      ? ''
      : (explicitKey || (hasExplicitSeed && p.count === 1 ? archiveManager.fingerprint(p) : ''));
    const inFlightKey = deterministicCacheKey || archiveManager.fingerprint({
      ...p,
      action: effectiveRaw.action || 'generate',
      seed: isSpecialAction ? `${p.seed}_${Date.now()}` : '__random__'
    });

    if (deterministicCacheKey) {
      const cached = archiveManager.getCached(deterministicCacheKey);
      if (cached && fs.existsSync(cached.filePath)) {
        const cachedFull = {
          ...cached,
          source_path: cached.filePath,
          prompt: cached.prompt || p.positivePrompt,
          uc: cached.uc || p.negativePrompt,
          stylePrompt: cached.stylePrompt || p.stylePrompt,
          characterPrompts: cached.characterPrompts || p.characterPrompts
        };
        this.sessionBridge.lastEvent = {
          seq: ++this._seq,
          status: 'done',
          source,
          startedAt,
          completedAt: Date.now(),
          error: null,
          lastRecord: cachedFull
        };
        this._emitEvent({ type: 'bridge_update', bridge: this.sessionBridge });
        return cached;
      }
    }

    const existingPending = archiveManager.getPending(inFlightKey);
    if (existingPending) {
      return await existingPending;
    }

    this.sessionBridge.lastEvent = {
      ...this.sessionBridge.lastEvent,
      seq: ++this._seq,
      status: 'generating',
      source,
      startedAt,
      error: null
    };
    this._emitEvent({ type: 'bridge_update', bridge: this.sessionBridge });

    const taskPromise = (async () => {
      try {
        const count = Math.max(1, Math.min(8, Number(p.count) || 1));
        const batchResults = [];
        for (let idx = 0; idx < count; idx++) {
          const iterParams = {
            ...p,
            seed: idx === 0 ? p.seed : (p.seed + idx) % 4294967296
          };
          const record = await this._executeGenerationCall(iterParams, {
            endpoint,
            token,
            outputDir,
            source,
            action: effectiveRaw.action || 'generate',
            suffix: effectiveRaw.suffix || '',
            imageInput: effectiveRaw.image,
            maskInput: effectiveRaw.mask,
            maskRegions: effectiveRaw.maskRegions,
            strength: effectiveRaw.strength,
            noise: effectiveRaw.noise,
            colorCorrect: effectiveRaw.colorCorrect,
            vibeReferences: effectiveRaw.vibeReferences || p.vibeReferences,
            preciseReferences: effectiveRaw.preciseReferences || p.preciseReferences
          });
          batchResults.push(record);
        }

        const primary = batchResults[0];
        const finalResult = count > 1
          ? { ...primary, count: batchResults.length, results: batchResults }
          : primary;

        this.sessionBridge.lastEvent = {
          seq: ++this._seq,
          status: 'done',
          source,
          startedAt,
          completedAt: Date.now(),
          error: null,
          lastRecord: primary
        };
        this._emitEvent({ type: 'bridge_update', bridge: this.sessionBridge });

        if (deterministicCacheKey && count === 1) {
          archiveManager.setCached(deterministicCacheKey, finalResult);
        }
        return finalResult;
      } catch (err) {
        this.sessionBridge.lastEvent = {
          ...this.sessionBridge.lastEvent,
          seq: ++this._seq,
          status: 'error',
          source,
          completedAt: Date.now(),
          error: err.message
        };
        this._emitEvent({ type: 'bridge_update', bridge: this.sessionBridge });
        throw err;
      } finally {
        archiveManager.clearPending(inFlightKey);
      }
    })();

    archiveManager.setPending(inFlightKey, taskPromise);
    return await taskPromise;
  }

  async _resizeImage(input, width, height, opts = {}) {
    const buf = decodeImageInputToBuffer(input);
    const args = [
      'resize',
      '--width', String(width),
      '--height', String(height),
      '--mode', opts.mode || 'stretch'
    ];
    if (opts.flattenWhite) args.push('--flatten-white');
    if (opts.grayscale) args.push('--grayscale');
    if (opts.binaryMask) args.push('--binary-mask');
    const res = await runImageHelper(args, buf);
    if (!res?.base64) throw new Error('Image resize returned empty buffer');
    return Buffer.from(res.base64, 'base64');
  }

  async _prepareDirectorRefImage(input) {
    const buf = decodeImageInputToBuffer(input);
    const res = await runImageHelper(['prepare-ref'], buf);
    if (!res?.base64) throw new Error('Reference image prepare-ref returned empty buffer');
    return Buffer.from(res.base64, 'base64');
  }

  async _encodeVibeImage(rawBuf, model, infoExtracted, { endpoint, token } = {}) {
    const rawB64 = rawBuf.toString('base64');
    if (!endpoint || !token) return rawB64;
    const sha = crypto.createHash('sha256').update(rawB64).digest('hex');
    const cacheKey = `${model}|${infoExtracted}|${sha}`;
    if (this._vibeEncodeCache?.has(cacheKey)) {
      return this._vibeEncodeCache.get(cacheKey);
    }
    const res = await this._fetchWithTimeout(`${endpoint.replace(/\/+$/, '')}/ai/encode-vibe`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'dsh-nai5-studio/2.0'
      },
      body: JSON.stringify({
        image: rawB64,
        information_extracted: infoExtracted,
        model
      })
    }, 60000);
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Vibe Transfer encoding failed (HTTP ${res.status}): ${errText}`);
    }
    const encodedB64 = Buffer.from(await res.arrayBuffer()).toString('base64');
    if (this._vibeEncodeCache) this._vibeEncodeCache.set(cacheKey, encodedB64);
    return encodedB64;
  }

  async _buildGenerationPayload(p, modeOpts = {}) {
    const action = modeOpts.action || 'generate';
    const preciseRefs = Array.isArray(modeOpts.preciseReferences) ? modeOpts.preciseReferences.filter((r) => r && r.image) : [];
    const vibeRefs = preciseRefs.length === 0 && Array.isArray(modeOpts.vibeReferences)
      ? modeOpts.vibeReferences.filter((r) => r && r.image)
      : [];

    let model = String(p.model || 'nai-diffusion-5-full');
    const needsV45 = (preciseRefs.length > 0 || vibeRefs.length > 0) && !model.includes('4-5') && !model.includes('4.5');
    if (needsV45) {
      model = 'nai-diffusion-4-5-full';
    }

    if (action === 'infill') {
      if (model.includes('4-5') || model.includes('4.5')) {
        model = 'nai-diffusion-4-5-full-inpainting';
      } else {
        model = 'nai-diffusion-5-full-inpainting';
      }
    } else if (!model.includes('4-5') && !model.includes('4.5') && p.effort === 'medium' && !model.includes('-medium')) {
      model = 'nai-diffusion-5-full-medium';
    }

    const isV5 = !model.includes('4-5') && !model.includes('4.5');
    const isMedium = isV5 && model.includes('nai-diffusion-5-full-medium');

    let fullPrompt = p.positivePrompt || '';
    if (p.stylePrompt) {
      fullPrompt = fullPrompt ? `${p.stylePrompt}, ${fullPrompt}` : p.stylePrompt;
    }
    if (!isV5) {
      fullPrompt = stripV5XmlTags(fullPrompt);
    }
    if (p.transparentBackground && isV5 && !/transparent background/i.test(fullPrompt)) {
      fullPrompt = fullPrompt ? `${fullPrompt}, transparent background` : 'transparent background';
    }
    if (!fullPrompt.includes('very aesthetic') && !fullPrompt.includes('masterpiece')) {
      fullPrompt = fullPrompt ? `${fullPrompt}, very aesthetic, masterpiece` : 'very aesthetic, masterpiece';
    }

    const effectiveNegative = isMedium ? '' : (p.negativePrompt || '');
    const effectiveSteps = isMedium ? 14 : p.steps;
    const effectiveSampler = isMedium ? 'k_euler_ancestral' : p.sampler;
    const effectiveRescale = isMedium ? 0 : p.cfgRescale;
    const effectiveUcPreset = isMedium ? 0 : (p.ucPreset ?? 3);
    const effectiveNoiseSchedule = isV5 ? 'karras' : (p.noiseSchedule || 'karras');

    const cappedChars = (p.characterPrompts || []).slice(0, isV5 ? 22 : 6);
    const useCoords = cappedChars.some((c) => c.useCoords);
    const charCaptions = cappedChars.map((c) => ({
      char_caption: isV5 ? c.prompt : stripV5XmlTags(c.prompt),
      centers: [{ x: c.useCoords ? c.x : 0.5, y: c.useCoords ? c.y : 0.5 }]
    }));
    const hasAnyCharUc = !isMedium && cappedChars.some((c) => Boolean(c.negativePrompt && c.negativePrompt.trim()));
    const negCharCaptions = hasAnyCharUc
      ? cappedChars.map((c) => ({
          char_caption: c.negativePrompt || '',
          centers: [{ x: c.useCoords ? c.x : 0.5, y: c.useCoords ? c.y : 0.5 }]
        }))
      : [];

    const qualityPreset = p.qualityPreset || 'none';
    const qualityToggle = qualityPreset !== 'none';

    const parameters = {
      params_version: 4,
      width: p.width,
      height: p.height,
      scale: p.cfgScale,
      sampler: effectiveSampler,
      steps: effectiveSteps,
      n_samples: 1,
      seed: p.seed,
      noise_schedule: effectiveNoiseSchedule,
      uc: effectiveNegative,
      negative_prompt: effectiveNegative,
      ucPreset: effectiveUcPreset,
      uc_preset: effectiveUcPreset,
      cfg_rescale: effectiveRescale,
      legacy: false,
      legacy_v3_extend: false,
      dynamic_thresholding: isV5 ? false : effectiveRescale > 0,
      skip_cfg_above_sigma: p.variety && !isV5 ? 58 : null,
      qualityPresetId: qualityPreset,
      qualityToggle,
      quality_toggle: qualityToggle,
      tag_hint_qt: qualityPreset === 'standard' ? 1 : qualityPreset === 'light' ? 3 : 0,
      use_coords: useCoords,
      v4_prompt: {
        caption: {
          base_caption: fullPrompt,
          char_captions: charCaptions
        },
        use_coords: useCoords,
        use_order: true,
        legacy_uc: false
      },
      v4_negative_prompt: {
        caption: {
          base_caption: effectiveNegative,
          char_captions: negCharCaptions
        },
        use_coords: useCoords && hasAnyCharUc,
        use_order: false,
        legacy_uc: false
      }
    };

    if (effectiveSampler === 'k_euler_ancestral' && effectiveNoiseSchedule !== 'native') {
      parameters.deliberate_euler_ancestral_bug = false;
      parameters.prefer_brownian = true;
    }

    if (isV5) {
      parameters.tag_hint_transparent_background = Boolean(p.transparentBackground);
      parameters.straight_alpha = Boolean(p.transparentBackground);
    }

    let imageBuf = null;
    let maskBuf = null;

    if (action === 'img2img') {
      imageBuf = await this._resizeImage(modeOpts.imageInput, p.width, p.height, { mode: 'stretch' });
      parameters.image = imageBuf.toString('base64');
      parameters.strength = clamp01(modeOpts.strength, 0.55);
      parameters.noise = clamp01(modeOpts.noise, 0);
      parameters.extra_noise_seed = Math.max(0, Math.round(p.seed) - 1);
      if (isV5) parameters.upscaled_enhance = true;
    } else if (action === 'infill') {
      imageBuf = await this._resizeImage(modeOpts.imageInput, p.width, p.height, { mode: 'stretch' });
      if (modeOpts.maskInput) {
        maskBuf = await this._resizeImage(modeOpts.maskInput, p.width, p.height, { mode: 'stretch', binaryMask: true });
      } else if (Array.isArray(modeOpts.maskRegions) && modeOpts.maskRegions.length > 0) {
        const res = await runImageHelper([
          'rect-mask',
          '--width', String(p.width),
          '--height', String(p.height),
          '--regions', JSON.stringify(modeOpts.maskRegions)
        ]);
        maskBuf = Buffer.from(res.base64, 'base64');
      } else {
        throw new Error('inpaint requires mask (base64/path) or maskRegions');
      }
      const normStrength = clamp01(modeOpts.strength, 0.7);
      parameters.image = imageBuf.toString('base64');
      parameters.mask = maskBuf.toString('base64');
      parameters.add_original_image = false;
      parameters.inpaintImg2ImgStrength = normStrength;
      parameters.strength = 0.7;
      if (normStrength < 0.999) {
        parameters.img2img = { strength: normStrength, color_correct: modeOpts.colorCorrect !== false };
      }
      parameters.noise = 0;
      parameters.extra_noise_seed = Math.max(0, Math.round(p.seed) - 1);
    }

    if (vibeRefs.length > 0) {
      const refImages = [];
      const refInfo = [];
      const refStrength = [];
      for (const ref of vibeRefs.slice(0, 6)) {
        const buf = await this._resizeImage(ref.image, 1024, 1024, { mode: 'contain_white', flattenWhite: true });
        const info = round2(clamp01(ref.infoExtracted, 1));
        const encoded = await this._encodeVibeImage(buf, model, info, {
          endpoint: modeOpts.endpoint,
          token: modeOpts.token
        });
        refImages.push(encoded);
        refInfo.push(info);
        refStrength.push(round2(clamp01(ref.strength, 0.6)));
      }
      parameters.reference_image_multiple = refImages;
      parameters.reference_information_extracted_multiple = refInfo;
      parameters.reference_strength_multiple = refStrength;
    }

    let multipartBuffers = null;
    if (preciseRefs.length > 0) {
      const refBuffers = [];
      const cachedEntries = [];
      const descriptions = [];
      const strengthVals = [];
      const secondaryVals = [];
      const infoVals = [];

      for (let i = 0; i < Math.min(4, preciseRefs.length); i++) {
        const ref = preciseRefs[i];
        const buf = await this._prepareDirectorRefImage(ref.image);
        const sha = crypto.createHash('sha256').update(buf).digest('hex');
        refBuffers.push(buf);
        cachedEntries.push({ cache_secret_key: sha, data: `director_ref_${i}` });
        descriptions.push({
          caption: { base_caption: String(ref.type || 'character&style'), char_captions: [] },
          legacy_uc: false
        });
        strengthVals.push(round2(clamp01(ref.strength, 1)));
        secondaryVals.push(round2(clamp01(1 - clamp01(ref.fidelity, 1), 0)));
        infoVals.push(1);
      }

      parameters.director_reference_images_cached = cachedEntries;
      parameters.normalize_reference_strength_multiple = true;
      parameters.director_reference_descriptions = descriptions;
      parameters.director_reference_strength_values = strengthVals;
      parameters.director_reference_secondary_strength_values = secondaryVals;
      parameters.director_reference_information_extracted = infoVals;
      delete parameters.director_reference_images;

      if (imageBuf) parameters.image = 'image';
      if (maskBuf) parameters.mask = 'mask';
      multipartBuffers = { imageBuf, maskBuf, refBuffers };
    }

    const payload = {
      action,
      input: fullPrompt,
      model,
      parameters
    };

    return { payload, fullPrompt, model, isMedium, effectiveNegative, effectiveSteps, effectiveSampler, effectiveRescale, multipartBuffers };
  }

  async _executeGenerationCall(p, modeOpts) {
    const { endpoint, token, outputDir } = this.getCredentials();
    const built = await this._buildGenerationPayload(p, { ...modeOpts, endpoint, token });
    const { payload, fullPrompt, model, isMedium, effectiveNegative, effectiveSteps, effectiveSampler, effectiveRescale, multipartBuffers } = built;

    let body;
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/zip, application/octet-stream',
      'User-Agent': 'dsh-nai5-studio/2.0'
    };

    if (multipartBuffers) {
      const mp = buildMultipartFormBuffer(payload, multipartBuffers);
      headers['Content-Type'] = mp.contentType;
      headers['Content-Length'] = String(mp.contentLength);
      body = mp.body;
    } else {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(payload);
    }

    const res = await this._fetchWithTimeout(`${endpoint.replace(/\/+$/, '')}/ai/generate-image`, {
      method: 'POST',
      headers,
      body
    }, 120000);

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`NovelAI generation failed (HTTP ${res.status}): ${errText}`);
    }

    const zipBuffer = Buffer.from(await res.arrayBuffer());
    const rawPng = extractPngOrZipBuffer(zipBuffer);

    return await this._saveAndArchivePng(rawPng, {
      p,
      fullPrompt,
      model,
      isMedium,
      effectiveNegative,
      effectiveSteps,
      effectiveSampler,
      effectiveRescale,
      outputDir,
      suffix: modeOpts.suffix || (modeOpts.action === 'img2img' ? 'i2i' : modeOpts.action === 'infill' ? 'inpaint' : '')
    });
  }

  async _saveAndArchivePng(rawPng, ctx) {
    const {
      p,
      fullPrompt,
      model,
      effectiveNegative,
      effectiveSteps,
      effectiveSampler,
      effectiveRescale,
      outputDir,
      suffix = ''
    } = ctx;

    const finalPng = injectPngMetadata(rawPng, {
      prompt: fullPrompt,
      uc: effectiveNegative,
      stylePrompt: p.stylePrompt,
      characterPrompts: p.characterPrompts,
      seed: p.seed,
      width: p.width,
      height: p.height,
      steps: effectiveSteps,
      scale: p.cfgScale,
      sampler: effectiveSampler,
      model
    });

    const naming = resolveImageNaming({ ...p, suffix }, p.seed, new Date(), this.config);
    const targetDir = path.join(outputDir, naming.dateDir, naming.charDir);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const targetPath = path.join(targetDir, naming.filename).replace(/\\/g, '/');
    archiveManager.markInternalWrite(targetPath);
    fs.writeFileSync(targetPath, finalPng);

    try {
      const stat = fs.statSync(targetPath);
      await thumbService.ensureThumbnail(targetPath, stat.mtimeMs, 320);
    } catch (err) {
      console.warn('[NovelAIClient] Thumbnail pre-generation skipped:', err?.message || err);
    }

    const anlas = estimateLocalCost({ ...p, count: 1 });
    archiveManager.append({
      character: naming.character,
      topic: naming.topic,
      rating: naming.rating,
      prompt: p.positivePrompt,
      uc: effectiveNegative,
      stylePrompt: p.stylePrompt,
      characterPrompts: p.characterPrompts,
      seed: p.seed,
      width: p.width,
      height: p.height,
      steps: effectiveSteps,
      cfg: p.cfgScale,
      cfgRescale: effectiveRescale,
      sampler: effectiveSampler,
      anlas,
      sourcePath: targetPath
    });

    return {
      ok: true,
      filePath: targetPath,
      source_path: targetPath,
      filename: naming.filename,
      character: naming.character,
      topic: naming.topic,
      rating: naming.rating,
      prompt: p.positivePrompt,
      uc: effectiveNegative,
      stylePrompt: p.stylePrompt,
      seed: p.seed,
      anlas,
      width: p.width,
      height: p.height,
      steps: effectiveSteps,
      cfg: p.cfgScale,
      cfgRescale: effectiveRescale,
      sampler: effectiveSampler,
      noiseSchedule: p.noiseSchedule,
      effort: p.effort,
      variety: Boolean(p.variety),
      transparentBackground: Boolean(p.transparentBackground),
      model,
      characterPrompts: p.characterPrompts
    };
  }

  async img2img(rawParams = {}, options = {}) {
    if (!rawParams?.image) throw new Error('img2img requires source image (file path, base64, or data URL)');
    return await this.generateImage(
      { ...rawParams, action: 'img2img', suffix: rawParams.suffix || 'i2i' },
      options
    );
  }

  async inpaint(rawParams = {}, options = {}) {
    if (!rawParams?.image) throw new Error('inpaint requires source image');
    if (!rawParams?.mask && (!Array.isArray(rawParams.maskRegions) || rawParams.maskRegions.length === 0)) {
      throw new Error('inpaint requires mask image or maskRegions');
    }
    return await this.generateImage(
      { ...rawParams, action: 'infill', suffix: rawParams.suffix || 'inpaint' },
      options
    );
  }

  async upscaleImage({ image, scale = 2, character = '', topic = '' } = {}, options = {}) {
    if (!image) throw new Error('upscaleImage requires image input');
    const source = options.source || 'studio';
    const { endpoint, token, outputDir } = this.getCredentials();
    const targetScale = Number(scale) === 4 ? 4 : 2;
    const passes = targetScale === 4 ? 2 : 1;

    let currentBuf = decodeImageInputToBuffer(image);
    const metaInfo = await runImageHelper(['inspect'], currentBuf);
    let curW = Number(metaInfo?.width) || 832;
    let curH = Number(metaInfo?.height) || 1216;

    for (let pass = 0; pass < passes; pass++) {
      const res = await this._fetchWithTimeout(`${endpoint.replace(/\/+$/, '')}/ai/upscale`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'dsh-nai5-studio/2.0'
        },
        body: JSON.stringify({
          image: currentBuf.toString('base64'),
          width: curW,
          height: curH,
          scale: 2,
          model: 'nai-diffusion-5-curated',
          declared_blur_sigma: 0
        })
      }, 120000);

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`NovelAI upscale failed (HTTP ${res.status}): ${errText}`);
      }
      const rawBuf = Buffer.from(await res.arrayBuffer());
      currentBuf = extractPngOrZipBuffer(rawBuf);
      curW *= 2;
      curH *= 2;
    }

    const outMeta = await runImageHelper(['inspect'], currentBuf);
    const finalW = Number(outMeta?.width) || curW;
    const finalH = Number(outMeta?.height) || curH;
    const seed = Math.floor(Math.random() * 4294967295);
    const prevComment = metaInfo?.comment || {};
    const prevPrompt = prevComment.prompt || metaInfo?.text?.Description || '';
    const prevUc = prevComment.uc || '';
    const p = sanitizeParams({
      positivePrompt: prevPrompt || 'upscaled artwork',
      negativePrompt: prevUc,
      character,
      topic: topic || `upscale${targetScale}x`,
      seed,
      width: Math.min(3072, finalW),
      height: Math.min(3072, finalH)
    });
    const finalResult = await this._saveAndArchivePng(currentBuf, {
      p: { ...p, width: finalW, height: finalH },
      fullPrompt: prevPrompt || p.positivePrompt,
      model: 'upscale',
      effectiveNegative: prevUc,
      effectiveSteps: prevComment.steps || 28,
      effectiveSampler: prevComment.sampler || 'k_euler_ancestral',
      effectiveRescale: 0,
      outputDir,
      suffix: `upscale${targetScale}x`
    });
    finalResult.width = finalW;
    finalResult.height = finalH;
    finalResult.anlas = estimateLocalCost({ action: 'upscale', width: finalW / targetScale, height: finalH / targetScale, scale: targetScale });

    this.sessionBridge.lastEvent = {
      seq: ++this._seq,
      status: 'done',
      source,
      startedAt: Date.now(),
      completedAt: Date.now(),
      error: null,
      lastRecord: finalResult
    };
    this._emitEvent({ type: 'bridge_update', bridge: this.sessionBridge });
    return finalResult;
  }

  async directorTool({ image, tool = 'bg-removal', defry = 0, prompt = '', emotion = 'neutral', emotionLevel = 'normal', character = '', topic = '' } = {}, options = {}) {
    if (!image) throw new Error('directorTool requires image input');
    const source = options.source || 'studio';
    const { endpoint, token, outputDir } = this.getCredentials();
    const rawBuf = decodeImageInputToBuffer(image);
    const metaInfo = await runImageHelper(['inspect'], rawBuf);
    let w = Number(metaInfo?.width) || 832;
    let h = Number(metaInfo?.height) || 1216;
    if (w * h > 1048576) {
      const ratio = Math.sqrt(1048576 / (w * h));
      w = Math.max(64, Math.floor((w * ratio) / 64) * 64);
      h = Math.max(64, Math.floor((h * ratio) / 64) * 64);
    }
    const pngBuf = await this._resizeImage(rawBuf, w, h, { mode: 'stretch', flattenWhite: true });

    const reqBody = {
      image: pngBuf.toString('base64'),
      width: w,
      height: h,
      req_type: String(tool || 'bg-removal'),
      defry: Math.max(0, Math.min(5, Math.round(Number(defry) || 0)))
    };
    if (reqBody.req_type === 'colorize' && prompt) {
      reqBody.prompt = String(prompt);
    } else if (reqBody.req_type === 'emotion') {
      reqBody.prompt = `${emotion};;${emotionLevel}`;
    }

    const res = await this._fetchWithTimeout(`${endpoint.replace(/\/+$/, '')}/ai/augment-image`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'dsh-nai5-studio/2.0'
      },
      body: JSON.stringify(reqBody)
    }, 120000);

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`NovelAI Director Tool (${reqBody.req_type}) failed (HTTP ${res.status}): ${errText}`);
    }
    const rawResp = Buffer.from(await res.arrayBuffer());
    const outPng = extractPngOrZipBuffer(rawResp);
    const seed = Math.floor(Math.random() * 4294967295);
    const p = sanitizeParams({
      positivePrompt: prompt || metaInfo?.comment?.prompt || reqBody.req_type,
      negativePrompt: '',
      character,
      topic: topic || reqBody.req_type,
      seed,
      width: w,
      height: h
    });

    const finalResult = await this._saveAndArchivePng(outPng, {
      p,
      fullPrompt: p.positivePrompt,
      model: 'director-tool',
      effectiveNegative: '',
      effectiveSteps: 28,
      effectiveSampler: 'k_euler_ancestral',
      effectiveRescale: 0,
      outputDir,
      suffix: `director-${reqBody.req_type}`
    });
    finalResult.anlas = estimateLocalCost({ action: 'director', width: w, height: h });

    this.sessionBridge.lastEvent = {
      seq: ++this._seq,
      status: 'done',
      source,
      startedAt: Date.now(),
      completedAt: Date.now(),
      error: null,
      lastRecord: finalResult
    };
    this._emitEvent({ type: 'bridge_update', bridge: this.sessionBridge });
    return finalResult;
  }
}

export function getSharedClient(config = {}) {
  if (!sharedClientInstance) {
    sharedClientInstance = new NovelAIClient(config);
  } else if (config && typeof config === 'object' && Object.keys(config).length > 0) {
    sharedClientInstance.updateConfig(config);
  }
  return sharedClientInstance;
}
