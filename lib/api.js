import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { archiveManager } from './archive.js';
import { danbooruEngine } from './danbooru.js';
import { thumbService } from './thumb.js';
import { repairV5Prompt } from './linter.js';
import { readPngMetadata, readPngDimensions, extractNormalizedMeta } from './png.js';
import {
  getArtistPresetsFile,
  getOcPresetsFile,
  getWallpaperFile
} from './paths.js';
import {
  loadArtistPresetsList,
  loadOcPresetsList,
  saveExternalPresets,
  decodeImageInputToBuffer,
  runImageHelper
} from './client.js';

const MIME_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

export function isAllowedOrigin(origin) {
  if (!origin) return true;
  const s = String(origin).trim();
  if (!s) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(s)) return true;
  if (/^app:\/\/-/i.test(s)) return true;
  if (/^file:\/\//i.test(s)) return true;
  return false;
}

export function getCorsHeaders(req) {
  const origin = req?.headers?.origin;
  if (origin && isAllowedOrigin(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Vary': 'Origin'
    };
  }
  return {};
}

function sendJson(res, status, data, req = null) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    ...getCorsHeaders(req)
  });
  res.end(JSON.stringify(data));
}

export function guardOrigin(req, res) {
  const origin = req?.headers?.origin;
  if (origin && !isAllowedOrigin(origin)) {
    sendJson(res, 403, { ok: false, error: 'Forbidden origin' }, req);
    return false;
  }
  return true;
}

function streamFile(filePath, res) {
  const stream = fs.createReadStream(filePath);
  stream.on('error', (err) => {
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    }
    if (!res.writableEnded && !res.destroyed) {
      res.end(err?.message || 'File stream error');
    }
  });
  res.on('close', () => {
    if (!stream.destroyed) stream.destroy();
  });
  stream.pipe(res);
}

function readJsonBody(req, maxBytes = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    let settled = false;

    req.on('data', (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > maxBytes) {
        settled = true;
        reject(new Error('Request body too large'));
        try { req.destroy(); } catch {}
        return;
      }
      body += chunk.toString('utf8');
    });
    req.on('end', () => {
      if (settled) return;
      settled = true;
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    });
  });
}

export function normalizeIncomingPath(rawPath) {
  let p = String(rawPath || '').replace(/\\/g, '/');
  if (p.includes('\u0082') || p.includes('\u201a')) {
    p = p.replace(/[\u0082\u201a]6/g, '/2026').replace(/[\u0082\u201a]/g, '/20');
  }
  return p;
}

function isRelativeSubpath(target, root, allowSame = false) {
  const resolvedTarget = path.resolve(target);
  const resolvedRoot = path.resolve(root);
  const cmpTarget = process.platform === 'win32' ? resolvedTarget.toLowerCase() : resolvedTarget;
  const cmpRoot = process.platform === 'win32' ? resolvedRoot.toLowerCase() : resolvedRoot;
  const rel = path.relative(cmpRoot, cmpTarget);
  if (rel === '') return allowSame;
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

export function isWithinOutputDir(targetPath, outputDir) {
  if (!targetPath || !outputDir) return false;
  const resolvedTarget = path.resolve(targetPath);
  const resolvedRoot = path.resolve(outputDir);
  if (!isRelativeSubpath(resolvedTarget, resolvedRoot, false)) return false;

  try {
    if (fs.existsSync(resolvedRoot)) {
      const realRoot = fs.realpathSync(resolvedRoot);
      if (fs.existsSync(resolvedTarget)) {
        const realTarget = fs.realpathSync(resolvedTarget);
        if (!isRelativeSubpath(realTarget, realRoot, false)) return false;
      } else {
        let cursor = path.dirname(resolvedTarget);
        while (cursor && !fs.existsSync(cursor)) {
          const parent = path.dirname(cursor);
          if (parent === cursor) break;
          cursor = parent;
        }
        if (cursor && fs.existsSync(cursor)) {
          const realParent = fs.realpathSync(cursor);
          if (!isRelativeSubpath(realParent, realRoot, true)) return false;
        }
      }
    }
  } catch {
    return false;
  }
  return true;
}

export function revealFileInOs(filePath) {
  const resolved = path.resolve(String(filePath || ''));
  if (!resolved) return;
  if (process.platform === 'win32') {
    execFile('explorer.exe', [`/select,${resolved}`], { windowsHide: false }, () => {});
  } else if (process.platform === 'darwin') {
    execFile('open', ['-R', resolved], () => {});
  } else {
    execFile('xdg-open', [path.dirname(resolved)], () => {});
  }
}

export function createNovelAiRouteTable(client) {
  return [
    {
      path: '/api/novelai/config',
      desc: 'novelai: GET /api/novelai/config',
      handler: async (req, res) => {
        if (!guardOrigin(req, res)) return;
        try {
          sendJson(res, 200, { ok: true, ...client.getPublicConfig() }, req);
        } catch (err) {
          sendJson(res, 500, { ok: false, error: err.message }, req);
        }
      }
    },
    {
      path: '/api/novelai/presets',
      desc: 'novelai: GET/POST /api/novelai/presets',
      handler: async (req, res) => {
        if (!guardOrigin(req, res)) return;
        try {
          if (req.method === 'GET') {
            sendJson(res, 200, {
              ok: true,
              artistPresets: loadArtistPresetsList(client.config),
              ocPresets: loadOcPresetsList(client.config),
              artistPresetsFile: getArtistPresetsFile(client.config),
              ocPresetsFile: getOcPresetsFile(client.config)
            }, req);
            return;
          }
          if (req.method === 'POST') {
            const body = await readJsonBody(req);
            const kind = body?.kind === 'oc' ? 'oc' : (body?.kind === 'artist' ? 'artist' : '');
            if (!kind) {
              sendJson(res, 400, { ok: false, error: 'kind must be "artist" or "oc"' }, req);
              return;
            }
            const rawItems = body?.items;
            if (!rawItems || (typeof rawItems !== 'object')) {
              sendJson(res, 400, { ok: false, error: 'items array or object map is required' }, req);
              return;
            }
            const saved = saveExternalPresets(kind, rawItems, client.config);
            sendJson(res, 200, {
              ok: true,
              kind,
              count: saved.items.length,
              items: saved.items,
              filePath: saved.filePath
            }, req);
            return;
          }
          sendJson(res, 405, { ok: false, error: 'Method Not Allowed' }, req);
        } catch (err) {
          sendJson(res, 400, { ok: false, error: err.message }, req);
        }
      }
    },
    {
      path: '/api/novelai/state',
      desc: 'novelai: GET /api/novelai/state',
      handler: async (req, res) => {
        if (!guardOrigin(req, res)) return;
        try {
          const data = await client.getUserData();
          sendJson(res, 200, { ok: true, ...data }, req);
        } catch (err) {
          sendJson(res, 500, { ok: false, error: err.message }, req);
        }
      }
    },
    {
      path: '/api/novelai/gallery/meta',
      desc: 'novelai: GET /api/novelai/gallery/meta',
      handler: async (req, res) => {
        if (!guardOrigin(req, res)) return;
        try {
          const meta = archiveManager.getGalleryMeta();
          sendJson(res, 200, { ok: true, ...meta }, req);
        } catch (err) {
          sendJson(res, 500, { ok: false, error: err.message }, req);
        }
      }
    },
    {
      path: '/api/novelai/gallery/refresh',
      desc: 'novelai: POST /api/novelai/gallery/refresh',
      handler: async (req, res) => {
        if (!guardOrigin(req, res)) return;
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'Method Not Allowed' }, req);
          return;
        }
        try {
          const all = archiveManager.refreshIndex('manual');
          const meta = archiveManager.getGalleryMeta();
          sendJson(res, 200, { ok: true, total: all.length, ...meta }, req);
        } catch (err) {
          sendJson(res, 500, { ok: false, error: err.message }, req);
        }
      }
    },
    {
      path: '/api/novelai/gallery/backfill',
      desc: 'novelai: POST /api/novelai/gallery/backfill',
      handler: async (req, res) => {
        if (!guardOrigin(req, res)) return;
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'Method Not Allowed' }, req);
          return;
        }
        try {
          const status = archiveManager.startBackgroundBackfill({ batchSize: 40 });
          sendJson(res, 200, { ok: true, ...status }, req);
        } catch (err) {
          sendJson(res, 500, { ok: false, error: err.message }, req);
        }
      }
    },
    {
      path: '/api/novelai/history',
      desc: 'novelai: GET /api/novelai/history',
      handler: async (req, res) => {
        if (!guardOrigin(req, res)) return;
        try {
          const url = new URL(req.url, 'http://localhost');
          const result = archiveManager.queryGallery({
            limit: parseInt(url.searchParams.get('limit') || '24', 10),
            offset: parseInt(url.searchParams.get('offset') || '0', 10),
            character: url.searchParams.get('character') || 'all',
            month: url.searchParams.get('month') || 'all',
            rating: url.searchParams.get('rating') || 'all',
            topic: url.searchParams.get('topic') || 'all',
            search: url.searchParams.get('search') || '',
            favorites: url.searchParams.get('favorites') || ''
          });
          sendJson(res, 200, { ok: true, ...result }, req);
        } catch (err) {
          sendJson(res, 500, { ok: false, error: err.message }, req);
        }
      }
    },
    {
      path: '/api/novelai/metadata',
      desc: 'novelai: GET /api/novelai/metadata',
      handler: async (req, res) => {
        if (!guardOrigin(req, res)) return;
        try {
          const url = new URL(req.url, 'http://localhost');
          const imgPath = normalizeIncomingPath(url.searchParams.get('path'));
          if (!imgPath) {
            sendJson(res, 400, { ok: false, error: 'Missing path' }, req);
            return;
          }
          const resolvedPath = path.resolve(imgPath);
          if (!isWithinOutputDir(resolvedPath, client.getOutputDir())) {
            sendJson(res, 403, { ok: false, error: 'Access denied: target outside outputs folder' }, req);
            return;
          }
          if (!fs.existsSync(resolvedPath)) {
            sendJson(res, 404, { ok: false, error: 'Image not found' }, req);
            return;
          }
          const record = archiveManager.hydrateRecord(resolvedPath);
          sendJson(res, 200, { ok: true, record }, req);
        } catch (err) {
          sendJson(res, 500, { ok: false, error: err.message }, req);
        }
      }
    },
    {
      path: '/api/novelai/events',
      desc: 'novelai: GET /api/novelai/events',
      handler: async (req, res) => {
        if (!guardOrigin(req, res)) return;
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          ...getCorsHeaders(req)
        });

        const writeEvent = (eventName, payload) => {
          try {
            if (res.writableEnded || res.destroyed) return;
            res.write(`event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`);
          } catch {}
        };

        try {
          const meta = archiveManager.getGalleryMeta();
          writeEvent('hello', {
            ok: true,
            bridge: client.getBridgeState(),
            indexVersion: meta.version,
            total: meta.total
          });
        } catch {}

        const unsubArchive = archiveManager.subscribe((ev) => writeEvent('archive', ev));
        const unsubClient = client.subscribeEvents((ev) => writeEvent('bridge', ev));
        const pingTimer = setInterval(() => {
          try {
            if (!res.writableEnded && !res.destroyed) res.write(': ping\n\n');
          } catch {}
        }, 25000);
        if (typeof pingTimer.unref === 'function') pingTimer.unref();

        const cleanup = () => {
          clearInterval(pingTimer);
          unsubArchive();
          unsubClient();
        };

        req.on('close', cleanup);
        res.on('close', cleanup);
      }
    },
    {
      path: '/api/novelai/image',
      desc: 'novelai: GET /api/novelai/image',
      handler: async (req, res) => {
        if (!guardOrigin(req, res)) return;
        try {
          const url = new URL(req.url, 'http://localhost');
          const imgPath = normalizeIncomingPath(url.searchParams.get('path'));
          if (!imgPath) {
            res.writeHead(400, { 'Content-Type': 'text/plain', ...getCorsHeaders(req) });
            res.end('Missing path');
            return;
          }

          const resolvedPath = path.resolve(imgPath);
          if (!isWithinOutputDir(resolvedPath, client.getOutputDir())) {
            sendJson(res, 403, { ok: false, error: 'Access denied: target outside outputs folder' }, req);
            return;
          }

          if (!fs.existsSync(resolvedPath)) {
            res.writeHead(404, { 'Content-Type': 'text/plain', ...getCorsHeaders(req) });
            res.end('Image not found');
            return;
          }

          const stat = fs.statSync(resolvedPath);
          const isThumb = url.searchParams.get('thumb') === '1' || url.searchParams.get('thumb') === 'true';
          if (isThumb) {
            try {
              const thumbPath = await thumbService.ensureThumbnail(resolvedPath, stat.mtimeMs, 320);
              if (thumbPath && fs.existsSync(thumbPath)) {
                const thumbStat = fs.statSync(thumbPath);
                res.writeHead(200, {
                  'Content-Type': 'image/webp',
                  'Content-Length': thumbStat.size,
                  'Cache-Control': 'public, max-age=31536000, immutable',
                  ...getCorsHeaders(req)
                });
                streamFile(thumbPath, res);
                return;
              }
            } catch (err) {
              console.warn('[NovelAIApi] Thumbnail generation failed, falling back to original:', err?.message || err);
            }
          }

          const filename = path.basename(resolvedPath) || 'novelai_image.png';
          const etag = `"${stat.size}-${stat.mtimeMs}"`;
          if (req.headers['if-none-match'] === etag) {
            res.writeHead(304, getCorsHeaders(req));
            res.end();
            return;
          }

          const ext = path.extname(resolvedPath).toLowerCase();
          res.writeHead(200, {
            'Content-Type': MIME_TYPES[ext] || 'image/png',
            'Content-Length': stat.size,
            'Content-Disposition': `inline; filename="${encodeURIComponent(filename)}"`,
            'Cache-Control': 'public, max-age=31536000, immutable',
            'ETag': etag,
            ...getCorsHeaders(req)
          });
          streamFile(resolvedPath, res);
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'text/plain', ...getCorsHeaders(req) });
          res.end(err.message);
        }
      }
    },
    {
      path: '/api/novelai/wallpaper',
      desc: 'novelai: GET /api/novelai/wallpaper',
      handler: async (req, res) => {
        if (!guardOrigin(req, res)) return;
        try {
          const wallpaperPath = getWallpaperFile(client.config);
          if (!wallpaperPath || !fs.existsSync(wallpaperPath)) {
            sendJson(res, 404, { ok: false, error: 'No optional wallpaper configured' }, req);
            return;
          }
          const stat = fs.statSync(wallpaperPath);
          const ext = path.extname(wallpaperPath).toLowerCase();
          res.writeHead(200, {
            'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
            'Content-Length': stat.size,
            'Cache-Control': 'public, max-age=3600',
            ...getCorsHeaders(req)
          });
          streamFile(wallpaperPath, res);
        } catch (err) {
          sendJson(res, 500, { ok: false, error: err.message }, req);
        }
      }
    },
    {
      path: '/api/novelai/generate',
      desc: 'novelai: POST /api/novelai/generate',
      handler: async (req, res) => {
        if (!guardOrigin(req, res)) return;
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'Method Not Allowed' }, req);
          return;
        }
        try {
          const params = await readJsonBody(req, 24 * 1024 * 1024);
          const result = await client.generateImage(params, { source: 'workbench' });
          sendJson(res, 200, result, req);
        } catch (err) {
          sendJson(res, 500, { ok: false, error: err.message }, req);
        }
      }
    },
    {
      path: '/api/novelai/search',
      desc: 'novelai: GET /api/novelai/search',
      handler: async (req, res) => {
        if (!guardOrigin(req, res)) return;
        try {
          const url = new URL(req.url, 'http://localhost');
          const q = url.searchParams.get('q') || '';
          const codexFilter = url.searchParams.get('codex') || '';
          const limit = parseInt(url.searchParams.get('limit') || '18', 10);
          danbooruEngine.configure(client.config);
          const danbooru = danbooruEngine.searchDanbooru(q, { limit: 14 });
          const codex = danbooruEngine.searchCodex(q, { codex: codexFilter, limit });
          sendJson(res, 200, { ok: true, danbooru, codex }, req);
        } catch (err) {
          sendJson(res, 500, { ok: false, error: err.message }, req);
        }
      }
    },
    {
      path: '/api/novelai/codexes',
      desc: 'novelai: GET /api/novelai/codexes',
      handler: async (req, res) => {
        if (!guardOrigin(req, res)) return;
        try {
          danbooruEngine.configure(client.config);
          const meta = danbooruEngine.getCodexMeta();
          sendJson(res, 200, { ok: true, ...meta }, req);
        } catch (err) {
          sendJson(res, 500, { ok: false, error: err.message }, req);
        }
      }
    },
    {
      path: '/api/novelai/reveal',
      desc: 'novelai: GET /api/novelai/reveal',
      handler: async (req, res) => {
        if (!guardOrigin(req, res)) return;
        try {
          const url = new URL(req.url, 'http://localhost');
          const rawPath = url.searchParams.get('path');
          if (!rawPath) {
            sendJson(res, 400, { ok: false, error: 'Missing path' }, req);
            return;
          }

          const imgPath = path.resolve(normalizeIncomingPath(rawPath));
          if (!isWithinOutputDir(imgPath, client.getOutputDir())) {
            sendJson(res, 403, { ok: false, error: 'Access denied: target outside outputs folder' }, req);
            return;
          }
          if (!fs.existsSync(imgPath)) {
            sendJson(res, 404, { ok: false, error: 'File not found on disk' }, req);
            return;
          }

          revealFileInOs(imgPath);
          sendJson(res, 200, { ok: true, path: imgPath }, req);
        } catch (err) {
          sendJson(res, 500, { ok: false, error: err.message }, req);
        }
      }
    },
    {
      path: '/api/novelai/delete',
      desc: 'novelai: POST /api/novelai/delete',
      handler: async (req, res) => {
        if (!guardOrigin(req, res)) return;
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'Method Not Allowed' }, req);
          return;
        }
        try {
          const { path: rawPath } = await readJsonBody(req);
          if (!rawPath) {
            sendJson(res, 400, { ok: false, error: 'Missing path' }, req);
            return;
          }
          const normPath = path.resolve(normalizeIncomingPath(rawPath));
          const outDir = client.getOutputDir();
          if (!isWithinOutputDir(normPath, outDir)) {
            sendJson(res, 403, { ok: false, error: 'Access denied: target outside outputs folder' }, req);
            return;
          }
          if (fs.existsSync(normPath)) {
            const stat = fs.statSync(normPath);
            fs.unlinkSync(normPath);
            const thumbsRemoved = thumbService.deleteThumbnailsForImage(normPath, stat);
            archiveManager.removeByPath(normPath);
            sendJson(res, 200, { ok: true, deleted: normPath, thumbsRemoved }, req);
          } else {
            sendJson(res, 404, { ok: false, error: 'File does not exist' }, req);
          }
        } catch (err) {
          sendJson(res, 500, { ok: false, error: err.message }, req);
        }
      }
    },
    {
      path: '/api/novelai/bridge',
      desc: 'novelai: GET/POST /api/novelai/bridge',
      handler: async (req, res) => {
        if (!guardOrigin(req, res)) return;
        try {
          if (req.method === 'GET') {
            sendJson(res, 200, { ok: true, bridge: client.getBridgeState() }, req);
            return;
          }
          if (req.method === 'POST') {
            const patch = await readJsonBody(req);
            const updated = client.updateBridgeState(patch);
            sendJson(res, 200, { ok: true, bridge: updated }, req);
            return;
          }
          sendJson(res, 405, { ok: false, error: 'Method Not Allowed' }, req);
        } catch (err) {
          sendJson(res, 500, { ok: false, error: err.message }, req);
        }
      }
    },
    {
      path: '/api/novelai/accounts',
      desc: 'novelai: GET/POST /api/novelai/accounts',
      handler: async (req, res) => {
        if (!guardOrigin(req, res)) return;
        try {
          if (req.method === 'GET') {
            const data = client.listAccounts();
            sendJson(res, 200, { ok: true, ...data }, req);
            return;
          }
          if (req.method === 'POST') {
            const body = await readJsonBody(req);
            const result = client.addOrUpdateAccount(body || {});
            sendJson(res, 200, { ok: true, ...result }, req);
            return;
          }
          sendJson(res, 405, { ok: false, error: 'Method Not Allowed' }, req);
        } catch (err) {
          sendJson(res, 400, { ok: false, error: err.message }, req);
        }
      }
    },
    {
      path: '/api/novelai/accounts/switch',
      desc: 'novelai: POST /api/novelai/accounts/switch',
      handler: async (req, res) => {
        if (!guardOrigin(req, res)) return;
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'Method Not Allowed' }, req);
          return;
        }
        try {
          const body = await readJsonBody(req);
          const result = client.switchAccount(body?.id || body?.account || body?.name);
          sendJson(res, 200, { ok: true, ...result }, req);
        } catch (err) {
          sendJson(res, 400, { ok: false, error: err.message }, req);
        }
      }
    },
    {
      path: '/api/novelai/accounts/delete',
      desc: 'novelai: POST /api/novelai/accounts/delete',
      handler: async (req, res) => {
        if (!guardOrigin(req, res)) return;
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'Method Not Allowed' }, req);
          return;
        }
        try {
          const body = await readJsonBody(req);
          const result = client.deleteAccount(body?.id);
          sendJson(res, 200, { ok: true, ...result }, req);
        } catch (err) {
          sendJson(res, 400, { ok: false, error: err.message }, req);
        }
      }
    },
    {
      path: '/api/novelai/accounts/test',
      desc: 'novelai: POST /api/novelai/accounts/test',
      handler: async (req, res) => {
        if (!guardOrigin(req, res)) return;
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'Method Not Allowed' }, req);
          return;
        }
        try {
          const body = await readJsonBody(req);
          const result = await client.testAccount(body || {});
          sendJson(res, 200, { ok: true, ...result }, req);
        } catch (err) {
          sendJson(res, 400, { ok: false, error: err.message }, req);
        }
      }
    },
    {
      path: '/api/novelai/img2img',
      desc: 'novelai: POST /api/novelai/img2img',
      handler: async (req, res) => {
        if (!guardOrigin(req, res)) return;
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'Method Not Allowed' }, req);
          return;
        }
        try {
          const params = await readJsonBody(req, 24 * 1024 * 1024);
          const result = await client.img2img(params || {}, { source: 'workbench' });
          sendJson(res, 200, result, req);
        } catch (err) {
          sendJson(res, 500, { ok: false, error: err.message }, req);
        }
      }
    },
    {
      path: '/api/novelai/inpaint',
      desc: 'novelai: POST /api/novelai/inpaint',
      handler: async (req, res) => {
        if (!guardOrigin(req, res)) return;
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'Method Not Allowed' }, req);
          return;
        }
        try {
          const params = await readJsonBody(req, 24 * 1024 * 1024);
          const result = await client.inpaint(params || {}, { source: 'workbench' });
          sendJson(res, 200, result, req);
        } catch (err) {
          sendJson(res, 500, { ok: false, error: err.message }, req);
        }
      }
    },
    {
      path: '/api/novelai/upscale',
      desc: 'novelai: POST /api/novelai/upscale',
      handler: async (req, res) => {
        if (!guardOrigin(req, res)) return;
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'Method Not Allowed' }, req);
          return;
        }
        try {
          const params = await readJsonBody(req, 24 * 1024 * 1024);
          const result = await client.upscaleImage(params || {}, { source: 'workbench' });
          sendJson(res, 200, result, req);
        } catch (err) {
          sendJson(res, 500, { ok: false, error: err.message }, req);
        }
      }
    },
    {
      path: '/api/novelai/director',
      desc: 'novelai: POST /api/novelai/director',
      handler: async (req, res) => {
        if (!guardOrigin(req, res)) return;
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'Method Not Allowed' }, req);
          return;
        }
        try {
          const params = await readJsonBody(req, 24 * 1024 * 1024);
          const result = await client.directorTool(params || {}, { source: 'workbench' });
          sendJson(res, 200, result, req);
        } catch (err) {
          sendJson(res, 500, { ok: false, error: err.message }, req);
        }
      }
    },
    {
      path: '/api/novelai/repair-prompt',
      desc: 'novelai: POST /api/novelai/repair-prompt',
      handler: async (req, res) => {
        if (!guardOrigin(req, res)) return;
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'Method Not Allowed' }, req);
          return;
        }
        try {
          const body = await readJsonBody(req);
          const text = body?.prompt ?? body?.text ?? '';
          sendJson(res, 200, { ok: true, repaired: repairV5Prompt(text) }, req);
        } catch (err) {
          sendJson(res, 400, { ok: false, error: err.message }, req);
        }
      }
    },
    {
      path: '/api/novelai/inspect-upload',
      desc: 'novelai: POST /api/novelai/inspect-upload',
      handler: async (req, res) => {
        if (!guardOrigin(req, res)) return;
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'Method Not Allowed' }, req);
          return;
        }
        try {
          const body = await readJsonBody(req, 24 * 1024 * 1024);
          const rawInput = body?.image || body?.dataUrl || '';
          const buf = decodeImageInputToBuffer(rawInput);
          let parsed = null;
          let dims = null;
          try {
            const rawMeta = readPngMetadata(buf);
            if (rawMeta && (rawMeta.Comment || rawMeta.Description)) {
              parsed = extractNormalizedMeta(rawMeta);
            }
            if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50) {
              dims = { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
            }
          } catch {}
          let info = null;
          try {
            info = await runImageHelper(['inspect'], buf);
          } catch {
            // Python + Pillow optional fallback: pure JS PNG inspection already parsed metadata
          }
          sendJson(res, 200, {
            ok: true,
            width: info?.width || parsed?.width || dims?.width || 832,
            height: info?.height || parsed?.height || dims?.height || 1216,
            meta: parsed || (info?.comment ? extractNormalizedMeta({ Comment: JSON.stringify(info.comment) }) : {}),
            text: info?.text || {}
          }, req);
        } catch (err) {
          sendJson(res, 400, { ok: false, error: err.message }, req);
        }
      }
    },
    {
      path: '/api/novelai/favorites/toggle',
      desc: 'novelai: POST /api/novelai/favorites/toggle',
      handler: async (req, res) => {
        if (!guardOrigin(req, res)) return;
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'Method Not Allowed' }, req);
          return;
        }
        try {
          const body = await readJsonBody(req);
          const imgPath = normalizeIncomingPath(body?.path);
          const resolved = path.resolve(imgPath);
          if (!isWithinOutputDir(resolved, client.getOutputDir())) {
            sendJson(res, 403, { ok: false, error: 'Access denied: target outside outputs folder' }, req);
            return;
          }
          const out = archiveManager.toggleFavorite(resolved);
          sendJson(res, 200, out, req);
        } catch (err) {
          sendJson(res, 400, { ok: false, error: err.message }, req);
        }
      }
    },
    {
      path: '/api/novelai/favorites',
      desc: 'novelai: GET /api/novelai/favorites',
      handler: async (req, res) => {
        if (!guardOrigin(req, res)) return;
        try {
          sendJson(res, 200, { ok: true, records: archiveManager.listFavorites() }, req);
        } catch (err) {
          sendJson(res, 500, { ok: false, error: err.message }, req);
        }
      }
    },
    {
      path: '/api/novelai/gallery/batch-move',
      desc: 'novelai: POST /api/novelai/gallery/batch-move',
      handler: async (req, res) => {
        if (!guardOrigin(req, res)) return;
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'Method Not Allowed' }, req);
          return;
        }
        try {
          const body = await readJsonBody(req);
          const rawPaths = Array.isArray(body?.paths) ? body.paths : [];
          const outDir = client.getOutputDir();
          const validPaths = rawPaths
            .map((p) => path.resolve(normalizeIncomingPath(p)))
            .filter((p) => isWithinOutputDir(p, outDir));
          const resMove = archiveManager.batchMoveCharacter(validPaths, body?.targetCharacter || '综合创作');
          sendJson(res, 200, resMove, req);
        } catch (err) {
          sendJson(res, 500, { ok: false, error: err.message }, req);
        }
      }
    },
    {
      path: '/api/novelai/gallery/batch-delete',
      desc: 'novelai: POST /api/novelai/gallery/batch-delete',
      handler: async (req, res) => {
        if (!guardOrigin(req, res)) return;
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'Method Not Allowed' }, req);
          return;
        }
        try {
          const body = await readJsonBody(req);
          const rawPaths = Array.isArray(body?.paths) ? body.paths : [];
          const outDir = client.getOutputDir();
          const deleted = [];
          for (const p of rawPaths) {
            const resolved = path.resolve(normalizeIncomingPath(p));
            if (!isWithinOutputDir(resolved, outDir)) continue;
            if (fs.existsSync(resolved)) {
              const stat = fs.statSync(resolved);
              fs.unlinkSync(resolved);
              thumbService.deleteThumbnailsForImage(resolved, stat);
              archiveManager.removeByPath(resolved);
              deleted.push(resolved);
            }
          }
          sendJson(res, 200, { ok: true, deletedCount: deleted.length, deleted }, req);
        } catch (err) {
          sendJson(res, 500, { ok: false, error: err.message }, req);
        }
      }
    }
  ];
}

export function createApiHandler(client) {
  const routes = new Map(createNovelAiRouteTable(client).map(r => [r.path, r.handler]));
  return async function handleApiRequest(req, res) {
    const pathname = new URL(req.url || '/', 'http://localhost').pathname;
    const handler = routes.get(pathname);
    if (!handler) {
      sendJson(res, 404, { ok: false, error: 'Not Found' }, req);
      return;
    }
    return await handler(req, res);
  };
}

export function registerNovelAiRoutes(ctx, client) {
  if (!ctx?.webServer) return;

  try {
    const outDir = client.getOutputDir();
    archiveManager.setConfig(client.config);
    archiveManager.setOutputDir(outDir);
    thumbService.setOutputDir(outDir);
  } catch (err) {
    console.warn('[NovelAIApi] Startup dir sync failed:', err?.message || err);
  }

  for (const route of createNovelAiRouteTable(client)) {
    ctx.effect(() => ctx.webServer.register({
      kind: 'exact',
      path: route.path,
      handler: route.handler
    }), route.desc);
  }
}
