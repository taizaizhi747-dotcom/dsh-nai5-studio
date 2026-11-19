import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PACKAGE_ROOT = path.resolve(__dirname, '..');
export const DEFAULT_ENDPOINT = 'https://image.novelai.net';

let cachedPython = { envKey: null, resolved: undefined };

export function getDataDir(config = {}) {
  return path.resolve(
    String(
      process.env.NAI5_DATA_DIR ||
      config.dataDir ||
      path.join(os.homedir(), '.dsh', 'nai5-studio')
    )
  );
}

export function getDefaultOutputDir(config = {}) {
  return path.resolve(
    String(
      process.env.NAI5_OUTPUT_DIR ||
      config.outputDir ||
      path.join(os.homedir(), 'Pictures', 'NAI5-Studio')
    )
  );
}

export function getCredentialsFile(config = {}) {
  const override = process.env.NAI5_CREDENTIALS_FILE || config.credentialsFile;
  return override ? path.resolve(String(override)) : path.join(getDataDir(config), 'credentials.json');
}

export function getArtistPresetsFile(config = {}) {
  const override = process.env.NAI5_ARTIST_PRESETS_FILE || config.artistPresetsFile;
  return override ? path.resolve(String(override)) : path.join(getDataDir(config), 'artist_presets.json');
}

export function getOcPresetsFile(config = {}) {
  const override = process.env.NAI5_OC_PRESETS_FILE || config.ocPresetsFile;
  return override ? path.resolve(String(override)) : path.join(getDataDir(config), 'oc_presets.json');
}

export function getCharacterRulesFile(config = {}) {
  const override = process.env.NAI5_CHARACTER_RULES_FILE || config.characterRulesFile;
  return override ? path.resolve(String(override)) : path.join(getDataDir(config), 'character_rules.json');
}

export function getCodexDir(config = {}) {
  const override = process.env.NAI5_CODEX_DIR || config.codexDir;
  return override ? path.resolve(String(override)) : path.join(getDataDir(config), 'codexes');
}

export function getDanbooruCsvFile(config = {}) {
  const override = process.env.DANBOORU_CSV_PATH || config.danbooruCsv;
  return override ? path.resolve(String(override)) : path.join(getDataDir(config), 'danbooru-cn.csv');
}

export function getWallpaperFile(config = {}) {
  const explicit = process.env.NAI5_WALLPAPER_FILE || config.wallpaperFile;
  if (explicit) {
    const resolved = path.resolve(String(explicit));
    try {
      if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
        return resolved;
      }
    } catch {
      return '';
    }
    return '';
  }

  const dataDir = getDataDir(config);
  for (const ext of ['.webp', '.png', '.jpg', '.jpeg']) {
    const candidate = path.join(dataDir, `wallpaper${ext}`);
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    } catch {}
  }
  return '';
}

export function getArchiveFile(outputDir, config = {}) {
  const override = process.env.NAI5_ARCHIVE_FILE || config.archiveFile;
  if (override) return path.resolve(String(override));
  const baseOut = outputDir ? path.resolve(String(outputDir)) : getDefaultOutputDir(config);
  return path.join(baseOut, '.nai5-archive.jsonl');
}

export function getWorkersDir() {
  return path.join(PACKAGE_ROOT, 'workers');
}

export function getDataAssetsDir() {
  return path.join(PACKAGE_ROOT, 'data');
}

export function resolvePythonCommand() {
  const envKey = `${process.env.NAI5_PYTHON || ''}|${process.env.PYTHON || ''}`;
  if (cachedPython.resolved !== undefined && cachedPython.envKey === envKey) {
    return cachedPython.resolved;
  }

  const candidates = [
    process.env.NAI5_PYTHON,
    process.env.PYTHON,
    ...(process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python'])
  ].filter(Boolean);

  let found = null;
  for (const cmd of candidates) {
    try {
      const res = spawnSync(cmd, ['--version'], {
        encoding: 'utf8',
        timeout: 4000,
        windowsHide: true
      });
      const out = `${res.stdout || ''}\n${res.stderr || ''}`;
      if (res.status === 0 && /Python\s+\d/i.test(out)) {
        found = cmd;
        break;
      }
    } catch {
      // Try next candidate
    }
  }

  cachedPython = { envKey, resolved: found };
  return found;
}
