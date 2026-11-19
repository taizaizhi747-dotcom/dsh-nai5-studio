import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { execFile, spawn } from 'node:child_process';
import { getDefaultOutputDir, getWorkersDir, resolvePythonCommand } from './paths.js';

export const DEFAULT_OUTPUT_DIR = getDefaultOutputDir();
const WORKER_SCRIPT = path.join(getWorkersDir(), 'thumb_worker.py');
const FALLBACK_SCRIPT = path.join(getWorkersDir(), 'make_thumbnail.py');

class ThumbnailService {
  constructor() {
    this.outputDir = DEFAULT_OUTPUT_DIR;
    this.inFlight = new Map();
    this._worker = null;
    this._rl = null;
    this._pending = new Map();
    this._reqSeq = 0;
    this._lastStderrWarnAt = 0;
    this._pythonDisabled = false;
  }

  setOutputDir(dir) {
    if (dir && typeof dir === 'string') {
      this.outputDir = dir.replace(/\\/g, '/').replace(/\/+$/, '');
    }
  }

  getOutputDir() {
    return this.outputDir || getDefaultOutputDir();
  }

  getCacheDir() {
    return path.resolve(this.getOutputDir(), '.cache/thumbnails');
  }

  getThumbPath(imgPath, mtimeMs) {
    const norm = String(imgPath).replace(/\\/g, '/');
    const hash = crypto.createHash('md5').update(`${norm}_${mtimeMs}`).digest('hex');
    return {
      hash,
      thumbPath: path.join(this.getCacheDir(), `${hash}.webp`)
    };
  }

  _ensureWorker() {
    if (this._pythonDisabled) return null;
    if (this._worker && !this._worker.killed && this._worker.exitCode === null) {
      return this._worker;
    }
    const pythonCmd = resolvePythonCommand();
    if (!pythonCmd || !fs.existsSync(WORKER_SCRIPT)) {
      this._pythonDisabled = true;
      return null;
    }

    const proc = spawn(pythonCmd, ['-B', '-u', WORKER_SCRIPT], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });
    if (typeof proc.unref === 'function') proc.unref();

    if (proc.stderr) {
      proc.stderr.on('data', (chunk) => {
        const msg = String(chunk || '').trim();
        if (!msg) return;
        if (/ModuleNotFoundError:\s*No module named ['"]PIL['"]/i.test(msg)) {
          this._pythonDisabled = true;
        }
        const now = Date.now();
        if (now - this._lastStderrWarnAt < 3000) return;
        this._lastStderrWarnAt = now;
        console.warn('[ThumbnailService worker stderr]', msg.slice(0, 400));
      });
    }

    const rl = readline.createInterface({ input: proc.stdout, crlfDelay: Infinity });
    rl.on('line', (line) => {
      try {
        const msg = JSON.parse(line);
        const resolver = this._pending.get(msg.id);
        if (resolver) {
          this._pending.delete(msg.id);
          resolver(Boolean(msg.ok));
        }
      } catch {}
    });

    const cleanup = (code, signal) => {
      const wasActive = this._worker === proc;
      if (wasActive) {
        if (code !== 0 && code !== null) {
          console.warn(`[ThumbnailService] Worker exited (code=${code}, signal=${signal || 'none'})`);
          if (code === 1) {
            this._pythonDisabled = true;
          }
        }
        this._worker = null;
        this._rl = null;
      }
      for (const [, resolve] of this._pending.entries()) {
        resolve(false);
      }
      this._pending.clear();
      try { rl.close(); } catch {}
    };

    proc.on('exit', cleanup);
    proc.on('error', (err) => {
      console.warn('[ThumbnailService] Worker spawn error:', err?.message || err);
      this._pythonDisabled = true;
      cleanup(null, null);
    });
    this._worker = proc;
    this._rl = rl;
    return proc;
  }

  dispose() {
    for (const [, resolve] of this._pending.entries()) {
      resolve(false);
    }
    this._pending.clear();
    if (this._rl) {
      try { this._rl.close(); } catch {}
      this._rl = null;
    }
    if (this._worker) {
      const proc = this._worker;
      this._worker = null;
      try {
        if (!proc.killed && proc.exitCode === null) proc.kill();
      } catch {}
    }
  }

  _runViaWorker(src, dst, maxW = 320, timeoutMs = 12000) {
    if (this._pythonDisabled) return Promise.resolve(false);
    const worker = this._ensureWorker();
    if (!worker || !worker.stdin || worker.stdin.destroyed) {
      return this._runFallbackScript(src, dst, maxW, timeoutMs);
    }

    return new Promise((resolve) => {
      const id = ++this._reqSeq;
      const timer = setTimeout(() => {
        if (this._pending.has(id)) {
          this._pending.delete(id);
          resolve(false);
        }
      }, timeoutMs);

      this._pending.set(id, (ok) => {
        clearTimeout(timer);
        resolve(ok);
      });

      try {
        worker.stdin.write(JSON.stringify({ id, src, dst, maxW }) + '\n');
      } catch {
        clearTimeout(timer);
        this._pending.delete(id);
        this._runFallbackScript(src, dst, maxW, timeoutMs).then(resolve);
      }
    });
  }

  _runFallbackScript(src, dst, maxW = 320, timeoutMs = 12000) {
    if (this._pythonDisabled) return Promise.resolve(false);
    const pythonCmd = resolvePythonCommand();
    if (!pythonCmd || !fs.existsSync(FALLBACK_SCRIPT)) return Promise.resolve(false);

    return new Promise((resolve) => {
      execFile(pythonCmd, ['-B', FALLBACK_SCRIPT, src, dst, String(maxW)], { timeout: timeoutMs, windowsHide: true }, (err, _stdout, stderr) => {
        if (stderr && /No module named ['"]PIL['"]/i.test(stderr)) {
          this._pythonDisabled = true;
        }
        resolve(!err && fs.existsSync(dst));
      });
    });
  }

  async ensureThumbnail(imgPath, mtimeMs, maxW = 320) {
    if (this._pythonDisabled) return null;
    const { hash, thumbPath } = this.getThumbPath(imgPath, mtimeMs);
    if (fs.existsSync(thumbPath)) {
      return thumbPath;
    }

    const cacheDir = this.getCacheDir();
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    let genPromise = this.inFlight.get(hash);
    if (!genPromise) {
      genPromise = this._runViaWorker(imgPath, thumbPath, maxW, 12000).finally(() => {
        this.inFlight.delete(hash);
      });
      this.inFlight.set(hash, genPromise);
    }
    await genPromise;
    return fs.existsSync(thumbPath) ? thumbPath : null;
  }

  deleteThumbnailsForImage(imgPath, stat) {
    const cacheDir = this.getCacheDir();
    if (!fs.existsSync(cacheDir)) return 0;
    let removed = 0;
    const norm = String(imgPath).replace(/\\/g, '/');
    const candidates = new Set();
    if (stat) {
      candidates.add(crypto.createHash('md5').update(`${norm}_${stat.mtimeMs}`).digest('hex'));
      const sec = stat.mtimeMs / 1000;
      candidates.add(crypto.createHash('md5').update(`${norm}_${sec}`).digest('hex'));
      candidates.add(crypto.createHash('md5').update(`${norm}_${Math.floor(sec)}`).digest('hex'));
    }
    for (const h of candidates) {
      const tp = path.join(cacheDir, `${h}.webp`);
      try {
        if (fs.existsSync(tp)) {
          fs.unlinkSync(tp);
          removed++;
        }
      } catch (err) {
        console.warn('[ThumbnailService] Failed removing stale thumbnail:', tp, err?.message || err);
      }
    }
    return removed;
  }
}

export const thumbService = new ThumbnailService();
