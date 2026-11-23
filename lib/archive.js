import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { readPngDimensions, extractNormalizedMeta } from './png.js';
import { getArchiveFile, getDefaultOutputDir } from './paths.js';

const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000;
const SUPPORTED_EXT_RE = /\.(png|jpe?g|webp)$/i;

function normalizePath(p) {
  return String(p || '').replace(/\\/g, '/');
}

function parseFilenameParts(filename, fullPath, outDir = '') {
  const stem = filename.replace(SUPPORTED_EXT_RE, '');
  const parts = stem.split('_');
  const normFull = normalizePath(fullPath);
  const rel = outDir ? normalizePath(path.relative(outDir, fullPath)) : '';
  const relSegs = rel ? rel.split('/').filter(Boolean) : [];
  const mDate = String(normFull).match(/\d{4}-\d{2}-\d{2}/);

  if (parts.length >= 6 && /^\d{6}$/.test(parts[0])) {
    const timeStr = parts[0];
    const charName = parts[1];
    const topic = parts[2];
    const rating = parts[3];
    const styleCode = parts[4];
    const seedStr = parts[5].replace(/^s/, '');
    return {
      timeStr,
      charName,
      topic,
      rating,
      styleCode,
      seed: Number(seedStr) || seedStr,
      dateStr: mDate ? mDate[0] : ''
    };
  }

  let dateStr = mDate ? mDate[0] : '';
  let timeStr = '000000';
  try {
    const st = fs.statSync(fullPath);
    if (!dateStr) dateStr = st.mtime.toISOString().slice(0, 10);
    timeStr = st.mtime.toISOString().slice(11, 19).replace(/:/g, '');
  } catch {
    if (!dateStr) dateStr = '2026-01-01';
  }

  let charName = '综合创作';
  if (relSegs.length >= 3 && /^\d{4}-\d{2}-\d{2}$/.test(relSegs[0])) {
    charName = relSegs[1];
  } else {
    const parentName = path.basename(path.dirname(normFull));
    if (parentName && parentName !== path.basename(normalizePath(outDir || ''))) {
      charName = parentName;
    }
  }
  const seedMatch = stem.match(/_s(\d+)/) || stem.match(/_(\d{5,12})(?:_|$)/) || stem.match(/(\d{6,12})/);
  const rating = /_(X|R18)_/i.test(stem) ? RegExp.$1.toUpperCase() : 'Safe';
  return {
    timeStr,
    charName,
    topic: '立绘',
    rating,
    styleCode: stem.includes('upscale') ? 'upscale' : 'custom',
    seed: seedMatch ? (Number(seedMatch[1]) || seedMatch[1]) : 0,
    dateStr
  };
}

class ArchiveManager {
  constructor() {
    this._config = {};
    this.outputDir = normalizePath(getDefaultOutputDir());
    this.journal = new Map();
    this._pending = new Map();
    this._recentlyWritten = new Map();
    this._fullIndex = null;
    this._pathMap = new Map();
    this._metaCache = new Map();
    this._metaDirty = false;
    this._metaSaveTimer = null;
    this._cachedGalleryMeta = null;
    this._cachedGalleryMetaVersion = -1;
    this._version = 0;
    this._subscribers = new Set();
    this._watcher = null;
    this._watchTimer = null;
    this._backfillRunning = false;
    this._backfillTimer = null;
    this._favorites = null;
  }

  setConfig(config = {}) {
    const prevArchive = this.getArchiveFilePath();
    this._config = config && typeof config === 'object' ? { ...config } : {};
    const nextArchive = this.getArchiveFilePath();
    if (nextArchive !== prevArchive) {
      this._fullIndex = null;
      this._cachedGalleryMeta = null;
    }
  }

  setOutputDir(dir) {
    if (dir && typeof dir === 'string') {
      const clean = normalizePath(path.resolve(dir)).replace(/\/+$/, '');
      if (clean !== this.outputDir) {
        this.outputDir = clean;
        this._fullIndex = null;
        this._metaCache.clear();
        this._cachedGalleryMeta = null;
        this._favorites = null;
        this._startWatcher();
      }
    }
  }

  getOutputDir() {
    return this.outputDir || normalizePath(getDefaultOutputDir(this._config));
  }

  getArchiveFilePath() {
    return getArchiveFile(this.getOutputDir(), this._config);
  }

  getMetaCachePath() {
    return path.resolve(this.getOutputDir(), '.cache/meta-cache.json');
  }

  getFavoritesPath() {
    return path.resolve(this.getOutputDir(), '.cache/favorites.json');
  }

  _favoriteKey(filePath) {
    const abs = path.resolve(String(filePath || ''));
    const out = path.resolve(this.getOutputDir());
    const normAbs = normalizePath(abs).toLowerCase();
    const normOut = normalizePath(out).toLowerCase();
    if (normAbs.startsWith(`${normOut}/`)) {
      return normalizePath(path.relative(out, abs)).toLowerCase();
    }
    return normAbs;
  }

  _loadFavorites() {
    if (this._favorites) return this._favorites;
    this._favorites = new Set();
    const favPath = this.getFavoritesPath();
    if (fs.existsSync(favPath)) {
      try {
        const arr = JSON.parse(fs.readFileSync(favPath, 'utf8'));
        if (Array.isArray(arr)) {
          for (const k of arr) {
            if (typeof k === 'string' && k.trim()) {
              this._favorites.add(k.trim().replace(/\\/g, '/').toLowerCase());
            }
          }
        }
      } catch (err) {
        console.warn('[ArchiveManager] Failed loading favorites.json:', err?.message || err);
      }
    }
    return this._favorites;
  }

  _saveFavorites() {
    if (!this._favorites) return;
    try {
      const favPath = this.getFavoritesPath();
      const dir = path.dirname(favPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const tmp = `${favPath}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify([...this._favorites], null, 2), 'utf8');
      fs.renameSync(tmp, favPath);
    } catch (err) {
      console.warn('[ArchiveManager] Failed saving favorites.json:', err?.message || err);
    }
  }

  isFavorite(filePath) {
    if (!filePath) return false;
    return this._loadFavorites().has(this._favoriteKey(filePath));
  }

  toggleFavorite(filePath) {
    if (!filePath) return { ok: false, isFavorite: false };
    const set = this._loadFavorites();
    const key = this._favoriteKey(filePath);
    let next;
    if (set.has(key)) {
      set.delete(key);
      next = false;
    } else {
      set.add(key);
      next = true;
    }
    this._saveFavorites();
    const normPath = normalizePath(filePath);
    const rec = this._pathMap.get(normPath);
    if (rec) rec.isFavorite = next;
    this._version++;
    this._cachedGalleryMeta = null;
    this._emit({ type: 'favorite_changed', path: normPath, isFavorite: next, version: this._version });
    return { ok: true, path: normPath, isFavorite: next, count: set.size };
  }

  listFavorites() {
    const all = this._ensureIndex();
    return all.filter((r) => this.isFavorite(r.source_path)).map((r) => ({ ...r, isFavorite: true }));
  }

  getVersion() {
    return this._version;
  }

  subscribe(fn) {
    if (typeof fn !== 'function') return () => {};
    this._subscribers.add(fn);
    return () => this._subscribers.delete(fn);
  }

  _emit(event) {
    for (const fn of this._subscribers) {
      try {
        fn(event);
      } catch (err) {
        console.warn('[ArchiveManager] Subscriber failed:', err?.message || err);
      }
    }
  }

  _normalizeWatchKey(filePath) {
    const resolved = normalizePath(path.resolve(String(filePath || '')));
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
  }

  markInternalWrite(filePath, ttlMs = 5000) {
    if (!filePath) return;
    const now = Date.now();
    for (const [k, exp] of this._recentlyWritten.entries()) {
      if (exp <= now) this._recentlyWritten.delete(k);
    }
    this._recentlyWritten.set(this._normalizeWatchKey(filePath), now + ttlMs);
  }

  _isRecentInternalWrite(filePath) {
    const key = this._normalizeWatchKey(filePath);
    const exp = this._recentlyWritten.get(key);
    if (!exp) return false;
    if (exp <= Date.now()) {
      this._recentlyWritten.delete(key);
      return false;
    }
    return true;
  }

  _startWatcher() {
    if (this._watcher) {
      try { this._watcher.close(); } catch {}
      this._watcher = null;
    }
    const dir = this.getOutputDir();
    if (!fs.existsSync(dir)) return;
    try {
      this._watcher = fs.watch(dir, { recursive: true }, (_eventType, filename) => {
        if (!filename) return;
        const norm = normalizePath(filename);
        if (norm.includes('.cache/') || norm.startsWith('.cache') || !SUPPORTED_EXT_RE.test(norm)) return;
        const fullPath = path.join(dir, String(filename));
        if (this._isRecentInternalWrite(fullPath)) return;
        if (this._watchTimer) clearTimeout(this._watchTimer);
        this._watchTimer = setTimeout(() => {
          this.refreshIndex('fs_watch');
        }, 1200);
        if (typeof this._watchTimer.unref === 'function') this._watchTimer.unref();
      });
      if (typeof this._watcher.unref === 'function') this._watcher.unref();
    } catch (err) {
      console.warn('[ArchiveManager] Failed to start fs.watch:', err?.message || err);
    }
  }

  dispose() {
    if (this._watcher) {
      try { this._watcher.close(); } catch {}
      this._watcher = null;
    }
    if (this._watchTimer) {
      clearTimeout(this._watchTimer);
      this._watchTimer = null;
    }
    if (this._metaSaveTimer) {
      clearTimeout(this._metaSaveTimer);
      this._metaSaveTimer = null;
    }
    if (this._backfillTimer) {
      clearTimeout(this._backfillTimer);
      this._backfillTimer = null;
    }
    this._backfillRunning = false;
    this._favorites = null;
    if (this._metaDirty) {
      this._flushMetaCache();
    }
    this._recentlyWritten.clear();
  }

  _loadMetaCache() {
    this._metaCache.clear();
    const cachePath = this.getMetaCachePath();
    if (!fs.existsSync(cachePath)) return;
    try {
      const raw = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      if (raw && typeof raw === 'object') {
        for (const [k, v] of Object.entries(raw)) {
          if (v && typeof v === 'object') {
            this._metaCache.set(k, v);
          }
        }
      }
    } catch (err) {
      console.warn('[ArchiveManager] Failed loading meta-cache:', err?.message || err);
    }
  }

  _scheduleMetaCacheSave() {
    this._metaDirty = true;
    if (this._metaSaveTimer) return;
    this._metaSaveTimer = setTimeout(() => {
      this._metaSaveTimer = null;
      this._flushMetaCache();
    }, 1500);
    if (typeof this._metaSaveTimer.unref === 'function') this._metaSaveTimer.unref();
  }

  _flushMetaCache() {
    if (!this._metaDirty) return;
    this._metaDirty = false;
    try {
      const cachePath = this.getMetaCachePath();
      const dir = path.dirname(cachePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const obj = {};
      for (const [k, v] of this._metaCache.entries()) {
        obj[k] = v;
      }
      const tmp = `${cachePath}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(obj), 'utf8');
      fs.renameSync(tmp, cachePath);
    } catch (err) {
      console.warn('[ArchiveManager] Failed flushing meta-cache:', err?.message || err);
    }
  }

  fingerprint(params) {
    const raw = JSON.stringify({
      prompt: params.positivePrompt || params.prompt || '',
      uc: params.negativePrompt || params.uc || '',
      style: params.stylePrompt || '',
      chars: params.characterPrompts || [],
      seed: params.seed,
      width: params.width,
      height: params.height,
      steps: params.steps,
      cfg: params.cfgScale || params.scale
    });
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  getCached(fp) {
    const entry = this.journal.get(fp);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > IDEMPOTENCY_TTL_MS) {
      this.journal.delete(fp);
      return null;
    }
    return entry.result;
  }

  setCached(fp, result) {
    this.journal.set(fp, {
      timestamp: Date.now(),
      result
    });
  }

  getPending(key) {
    return this._pending.get(key) || null;
  }

  setPending(key, promise) {
    this._pending.set(key, promise);
  }

  clearPending(key) {
    this._pending.delete(key);
  }

  _buildRecord({ filePath, parsed, archiveMeta, cachedMeta }) {
    const meta = archiveMeta || cachedMeta || {};
    const { timeStr, charName, topic, rating, styleCode, seed, dateStr } = parsed;
    const hasArchive = Boolean(archiveMeta && archiveMeta.prompt);
    const hasFullCached = Boolean(cachedMeta && cachedMeta._metaHydrated);
    const hasDims = Boolean((archiveMeta && archiveMeta.width && archiveMeta.height) || (cachedMeta && cachedMeta.width && cachedMeta.height));

    return {
      task_id: meta.task_id || undefined,
      source_path: filePath,
      filename: path.basename(filePath),
      time: timeStr,
      character: meta.character || charName,
      topic: meta.topic || topic,
      rating: meta.rating || rating,
      styleCode,
      seed: meta.seed !== undefined ? meta.seed : seed,
      date: dateStr,
      month: dateStr.slice(0, 7),
      prompt: meta.prompt || `${charName}, ${topic}`,
      uc: meta.uc || '',
      stylePrompt: meta.stylePrompt || '',
      characterPrompts: Array.isArray(meta.characterPrompts) ? meta.characterPrompts : [],
      width: Number(meta.width) || 832,
      height: Number(meta.height) || 1216,
      steps: Number(meta.steps) || 28,
      cfg: Number(meta.cfg) || 5.5,
      cfgRescale: Number(meta.cfgRescale) || 0,
      sampler: meta.sampler || 'k_euler_ancestral',
      anlas: meta.anlas !== undefined ? meta.anlas : 35,
      timestamp: meta.timestamp || `${dateStr}T${timeStr.slice(0, 2)}:${timeStr.slice(2, 4)}:${timeStr.slice(4, 6)}`,
      _dimHydrated: hasDims,
      _metaHydrated: hasArchive || hasFullCached,
      isFavorite: this.isFavorite(filePath)
    };
  }

  _ensureIndex() {
    if (this._fullIndex) return this._fullIndex;

    if (!this._watcher) this._startWatcher();
    if (this._metaCache.size === 0) this._loadMetaCache();

    const archiveFile = this.getArchiveFilePath();
    const promptMap = new Map();
    if (fs.existsSync(archiveFile)) {
      try {
        const content = fs.readFileSync(archiveFile, 'utf8');
        for (const line of content.split('\n')) {
          if (!line.trim()) continue;
          try {
            const obj = JSON.parse(line);
            const sp = normalizePath(obj.source_path);
            if (sp) promptMap.set(sp, obj);
          } catch {}
        }
      } catch (err) {
        console.warn('[ArchiveManager] Failed reading archive journal:', err?.message || err);
      }
    }

    const allItems = [];
    const newPathMap = new Map();
    const outDir = this.getOutputDir();
    const self = this;

    function scan(dir) {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const ent of entries) {
          const full = path.join(dir, ent.name);
          if (ent.isDirectory()) {
            if (ent.name !== '漫画' && ent.name !== 'comics' && ent.name !== '.cache' && !ent.name.startsWith('.')) scan(full);
          } else if (SUPPORTED_EXT_RE.test(ent.name)) {
            const parsed = parseFilenameParts(ent.name, full, outDir);
            if (!parsed) continue;
            const normPath = normalizePath(full);
            const archiveMeta = promptMap.get(normPath);
            const cachedMeta = self._metaCache.get(normPath);
            const rec = self._buildRecord({
              filePath: normPath,
              parsed,
              archiveMeta,
              cachedMeta
            });
            allItems.push(rec);
            newPathMap.set(normPath, rec);
          }
        }
      } catch (err) {
        console.warn('[ArchiveManager] Directory scan failed:', err?.message || err);
      }
    }

    if (fs.existsSync(outDir)) {
      scan(outDir);
    }

    allItems.sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return b.time.localeCompare(a.time);
    });

    this._fullIndex = allItems;
    this._pathMap = newPathMap;
    this._version++;
    this._cachedGalleryMeta = null;
    return allItems;
  }

  refreshIndex(reason = 'manual') {
    this._fullIndex = null;
    const all = this._ensureIndex();
    this._emit({
      type: 'index_refreshed',
      reason,
      version: this._version,
      total: all.length
    });
    return all;
  }

  append(record) {
    try {
      const taskId = record.taskId || `task_${Date.now()}`;
      const ts = new Date().toISOString();
      const normPath = normalizePath(record.sourcePath);
      const entry = {
        task_id: taskId,
        timestamp: ts,
        character: record.character || '',
        topic: record.topic || '',
        rating: record.rating || '',
        prompt: record.prompt || '',
        uc: record.uc || '',
        stylePrompt: record.stylePrompt || '',
        characterPrompts: record.characterPrompts || [],
        seed: record.seed,
        width: record.width,
        height: record.height,
        steps: record.steps,
        cfg: record.cfg,
        cfgRescale: record.cfgRescale || 0,
        sampler: record.sampler || 'k_euler_ancestral',
        anlas: record.anlas,
        source_path: normPath
      };

      const archiveFile = this.getArchiveFilePath();
      const dir = path.dirname(archiveFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.appendFileSync(archiveFile, JSON.stringify(entry) + '\n', 'utf8');

      const parsed = parseFilenameParts(path.basename(normPath), normPath, this.getOutputDir()) || {
        timeStr: ts.slice(11, 19).replace(/:/g, ''),
        charName: entry.character,
        topic: entry.topic,
        rating: entry.rating,
        styleCode: 'custom',
        seed: entry.seed,
        dateStr: ts.slice(0, 10)
      };

      const memRec = this._buildRecord({
        filePath: normPath,
        parsed,
        archiveMeta: entry
      });

      this._metaCache.set(normPath, {
        width: memRec.width,
        height: memRec.height,
        prompt: memRec.prompt,
        uc: memRec.uc,
        stylePrompt: memRec.stylePrompt,
        characterPrompts: memRec.characterPrompts,
        steps: memRec.steps,
        cfg: memRec.cfg,
        cfgRescale: memRec.cfgRescale,
        sampler: memRec.sampler,
        seed: memRec.seed,
        _metaHydrated: true
      });
      this._scheduleMetaCacheSave();

      if (this._fullIndex) {
        if (!this._pathMap.has(normPath)) {
          this._fullIndex.unshift(memRec);
          this._fullIndex.sort((a, b) => {
            if (b.date !== a.date) return b.date.localeCompare(a.date);
            return b.time.localeCompare(a.time);
          });
        } else {
          Object.assign(this._pathMap.get(normPath), memRec);
        }
        this._pathMap.set(normPath, memRec);
      } else {
        this._ensureIndex();
      }

      this._version++;
      this._cachedGalleryMeta = null;
      this._emit({
        type: 'image_added',
        version: this._version,
        total: this._fullIndex ? this._fullIndex.length : 0,
        record: memRec
      });
      return memRec;
    } catch (err) {
      console.error('[ArchiveManager] Failed to append archive:', err);
      return null;
    }
  }

  removeByPath(filePath) {
    const normPath = normalizePath(filePath);
    if (!normPath) return false;
    let removed = false;
    if (this._fullIndex) {
      const idx = this._fullIndex.findIndex(r => r.source_path === normPath);
      if (idx !== -1) {
        this._fullIndex.splice(idx, 1);
        removed = true;
      }
    }
    if (this._pathMap.delete(normPath)) removed = true;
    if (this._metaCache.delete(normPath)) this._scheduleMetaCacheSave();

    this._version++;
    this._cachedGalleryMeta = null;
    this._emit({
      type: 'image_deleted',
      version: this._version,
      total: this._fullIndex ? this._fullIndex.length : 0,
      path: normPath
    });
    return removed;
  }

  getAllRecords() {
    return this._ensureIndex();
  }

  batchMoveCharacter(paths = [], targetCharacter = '综合创作') {
    const outDir = path.resolve(this.getOutputDir());
    const cleanTarget = String(targetCharacter || '综合创作').replace(/[\\/:*?"<>|]+/g, '').trim() || '综合创作';
    const moved = [];
    const failed = [];

    for (const rawPath of (Array.isArray(paths) ? paths : [])) {
      try {
        const src = path.resolve(String(rawPath || ''));
        if (!src || !fs.existsSync(src)) {
          failed.push({ path: rawPath, error: 'not-found' });
          continue;
        }
        const rel = path.relative(outDir, src);
        if (rel.startsWith('..') || path.isAbsolute(rel)) {
          failed.push({ path: rawPath, error: 'outside-output-dir' });
          continue;
        }
        const segs = rel.split(path.sep);
        const dateDir = /^\d{4}-\d{2}-\d{2}$/.test(segs[0])
          ? segs[0]
          : fs.statSync(src).mtime.toISOString().slice(0, 10);
        const destDir = path.join(outDir, dateDir, cleanTarget);
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

        let dest = path.join(destDir, path.basename(src));
        if (path.resolve(dest).toLowerCase() === src.toLowerCase()) {
          continue;
        }
        if (fs.existsSync(dest)) {
          const ext = path.extname(dest);
          const base = path.basename(dest, ext);
          dest = path.join(destDir, `${base}_${Date.now()}${ext}`);
        }

        this.markInternalWrite(src);
        this.markInternalWrite(dest);
        fs.renameSync(src, dest);

        const favSet = this._loadFavorites();
        const oldFavKey = this._favoriteKey(src);
        if (favSet.has(oldFavKey)) {
          favSet.delete(oldFavKey);
          favSet.add(this._favoriteKey(dest));
          this._saveFavorites();
        }

        const oldNorm = normalizePath(src);
        const newNorm = normalizePath(dest);
        if (this._metaCache.has(oldNorm)) {
          this._metaCache.set(newNorm, this._metaCache.get(oldNorm));
          this._metaCache.delete(oldNorm);
          this._scheduleMetaCacheSave();
        }

        moved.push({ from: oldNorm, to: newNorm, character: cleanTarget });
      } catch (err) {
        failed.push({ path: rawPath, error: err?.message || String(err) });
      }
    }

    if (moved.length > 0) {
      this.refreshIndex('batch_move');
    }
    return { ok: true, targetCharacter: cleanTarget, movedCount: moved.length, moved, failed };
  }

  _hydratePageDimensions(records) {
    let updated = false;
    for (const rec of records) {
      if (rec._dimHydrated || !rec.source_path) continue;
      const dims = readPngDimensions(rec.source_path);
      if (dims) {
        rec.width = dims.width;
        rec.height = dims.height;
        rec._dimHydrated = true;
        const prev = this._metaCache.get(rec.source_path) || {};
        this._metaCache.set(rec.source_path, { ...prev, width: dims.width, height: dims.height });
        updated = true;
      } else {
        rec._dimHydrated = true;
      }
    }
    if (updated) this._scheduleMetaCacheSave();
  }

  hydrateRecord(filePath) {
    this._ensureIndex();
    const normPath = normalizePath(filePath);
    let rec = this._pathMap.get(normPath);
    if (!fs.existsSync(normPath)) return rec || null;

    if (rec && rec._metaHydrated) return rec;

    const extracted = extractNormalizedMeta(normPath);
    if (!rec) {
      const parsed = parseFilenameParts(path.basename(normPath), normPath, this.getOutputDir()) || {
        timeStr: '000000',
        charName: '综合创作',
        topic: '自定义',
        rating: 'Safe',
        styleCode: 'custom',
        seed: extracted.seed || 0,
        dateStr: ''
      };
      rec = this._buildRecord({ filePath: normPath, parsed, archiveMeta: extracted });
    } else {
      if (extracted.width) rec.width = extracted.width;
      if (extracted.height) rec.height = extracted.height;
      if (extracted.prompt) rec.prompt = extracted.prompt;
      if (extracted.uc) rec.uc = extracted.uc;
      if (extracted.stylePrompt) rec.stylePrompt = extracted.stylePrompt;
      if (extracted.characterPrompts) rec.characterPrompts = extracted.characterPrompts;
      if (extracted.steps) rec.steps = extracted.steps;
      if (extracted.cfg) rec.cfg = extracted.cfg;
      if (extracted.cfgRescale !== undefined) rec.cfgRescale = extracted.cfgRescale;
      if (extracted.sampler) rec.sampler = extracted.sampler;
      if (extracted.seed !== undefined) rec.seed = extracted.seed;
      rec._dimHydrated = true;
      rec._metaHydrated = true;
    }

    this._metaCache.set(normPath, {
      width: rec.width,
      height: rec.height,
      prompt: rec.prompt,
      uc: rec.uc,
      stylePrompt: rec.stylePrompt,
      characterPrompts: rec.characterPrompts,
      steps: rec.steps,
      cfg: rec.cfg,
      cfgRescale: rec.cfgRescale,
      sampler: rec.sampler,
      seed: rec.seed,
      _metaHydrated: true
    });
    this._scheduleMetaCacheSave();
    return rec;
  }

  startBackgroundBackfill({ batchSize = 30 } = {}) {
    if (this._backfillRunning) return { started: false, running: true };
    const all = this._ensureIndex();
    const pending = all.filter(r => !r._metaHydrated).map(r => r.source_path);
    if (pending.length === 0) {
      return { started: false, running: false, remaining: 0 };
    }

    this._backfillRunning = true;
    let idx = 0;
    const step = () => {
      this._backfillTimer = null;
      if (!this._backfillRunning) return;
      const end = Math.min(idx + batchSize, pending.length);
      for (; idx < end; idx++) {
        try {
          this.hydrateRecord(pending[idx]);
        } catch (err) {
          console.warn('[ArchiveManager] Backfill hydration failed:', pending[idx], err?.message || err);
        }
      }
      if (idx < pending.length) {
        this._backfillTimer = setTimeout(step, 40);
        if (typeof this._backfillTimer.unref === 'function') this._backfillTimer.unref();
      } else {
        this._flushMetaCache();
        this._backfillRunning = false;
        this._version++;
        this._emit({ type: 'backfill_done', version: this._version, total: all.length });
      }
    };

    this._backfillTimer = setTimeout(step, 20);
    if (typeof this._backfillTimer.unref === 'function') this._backfillTimer.unref();
    return { started: true, running: true, totalPending: pending.length };
  }

  getGalleryMeta() {
    const all = this._ensureIndex();
    if (this._cachedGalleryMeta && this._cachedGalleryMetaVersion === this._version) {
      return this._cachedGalleryMeta;
    }

    const charCounts = new Map();
    const monthCounts = new Map();
    const ratingCounts = new Map();
    const topicCounts = new Map();

    for (const item of all) {
      charCounts.set(item.character, (charCounts.get(item.character) || 0) + 1);
      if (item.month) monthCounts.set(item.month, (monthCounts.get(item.month) || 0) + 1);
      if (item.rating) ratingCounts.set(item.rating, (ratingCounts.get(item.rating) || 0) + 1);
      if (item.topic) topicCounts.set(item.topic, (topicCounts.get(item.topic) || 0) + 1);
    }

    const characters = [...charCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ id: name, label: name, count }));

    const months = [...monthCounts.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([m, count]) => ({ id: m, label: `${m.replace('-', '年')}月`, count }));

    const ratings = ['Safe', 'R18', 'X'].map(r => ({
      id: r,
      label: r === 'Safe' ? 'Safe (全年龄)' : r,
      count: ratingCounts.get(r) || 0
    }));

    const topics = [...topicCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([t, count]) => ({ id: t, label: t, count }));

    this._cachedGalleryMeta = {
      total: all.length,
      favoritesCount: this._loadFavorites().size,
      version: this._version,
      characters,
      months,
      ratings,
      topics
    };
    this._cachedGalleryMetaVersion = this._version;
    return this._cachedGalleryMeta;
  }

  queryGallery(filter = {}) {
    const all = this._ensureIndex();
    const { character, month, rating, topic, search, favorites } = filter;
    const onlyFavorites = favorites === true || favorites === '1' || favorites === 'true';
    const limit = Math.max(1, Math.min(200, Number(filter.limit) || 24));
    const offset = Math.max(0, Number(filter.offset) || 0);

    const qSearch = search ? String(search).trim().toLowerCase() : null;

    const filtered = all.filter(item => {
      if (onlyFavorites && !this.isFavorite(item.source_path)) {
        return false;
      }
      if (character && character !== 'all') {
        if (!item.character.includes(character)) return false;
      }
      if (month && month !== 'all') {
        if (item.month !== month && item.date !== month) return false;
      }
      if (rating && rating !== 'all') {
        if (item.rating !== rating) return false;
      }
      if (topic && topic !== 'all') {
        if (!item.topic.includes(topic)) return false;
      }
      if (qSearch) {
        const matchPrompt = item.prompt && item.prompt.toLowerCase().includes(qSearch);
        const matchSeed = String(item.seed).includes(qSearch);
        const matchFile = item.filename && item.filename.toLowerCase().includes(qSearch);
        const matchChar = item.character && item.character.toLowerCase().includes(qSearch);
        if (!matchPrompt && !matchSeed && !matchFile && !matchChar) return false;
      }
      return true;
    });

    const records = filtered.slice(offset, offset + limit).map((r) => ({
      ...r,
      isFavorite: this.isFavorite(r.source_path)
    }));
    this._hydratePageDimensions(records);
    const hasMore = offset + limit < filtered.length;

    return {
      records,
      total: all.length,
      favoritesCount: this._loadFavorites().size,
      filteredTotal: filtered.length,
      version: this._version,
      offset,
      limit,
      hasMore
    };
  }

  listRecent(limit = 24, offset = 0) {
    return this.queryGallery({ limit, offset });
  }
}

export const archiveManager = new ArchiveManager();
