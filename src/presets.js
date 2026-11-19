const TAB_ID = 'dsh-nai5-studio';
const TAB_KIND = 'novelai';
const BUILTIN_PRESET_VERSION = 'v1.0';

const DEFAULT_ARTIST_PRESETS = [];
const DEFAULT_OC_PRESETS = [];

const UC_PRESETS = {
  safe: 'worst quality, bad quality, lowres, artistic error, bad hands, mutated hands, bad anatomy, nsfw, nude, distorted architecture, warped background, crooked walls, warped perspective',
  standard: 'worst quality, bad quality, lowres, artistic error, bad hands, mutated hands, bad anatomy, distorted architecture, warped background, crooked walls, warped perspective',
  minimal: 'worst quality, bad quality, lowres, bad anatomy'
};

function normalizeImportedPresets(raw, defaultPrefix = 'custom') {
  const out = [];
  if (Array.isArray(raw)) {
    raw.forEach((item, idx) => {
      if (!item || typeof item !== 'object') return;
      const prompt = String(item.stylePrompt || item.prompt || '').trim();
      const name = String(item.name || item.title || '').trim();
      if (!name && !prompt) return;
      const codeRaw = item.code !== undefined ? String(item.code).trim() : '';
      const code = codeRaw || (defaultPrefix === 'artist' ? String(idx + 1).padStart(2, '0') : '');
      out.push({
        id: String(item.id || item.uiId || `${defaultPrefix}-${code || idx + 1}`).trim(),
        ...(code ? { code } : {}),
        name: name || `${defaultPrefix}-${idx + 1}`,
        group: String(item.group || item.category || '自定义分组').trim() || '自定义分组',
        prompt
      });
    });
    return out;
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
      const isNum = /^\d+$/.test(key);
      const code = isNum ? key.padStart(2, '0') : key;
      const displayName = (isNum && !cleanName.startsWith(`[${code}]`))
        ? `[${code}] ${cleanName}`
        : cleanName;
      out.push({
        id: String(entry.uiId || entry.id || `${defaultPrefix}-${code}`).trim(),
        code,
        name: displayName,
        group: String(entry.group || '导入分组').trim() || '导入分组',
        prompt
      });
    }
  }
  return out;
}

function mergePresetsWithBuiltins(storageKey, serverPresets = []) {
  const builtins = Array.isArray(serverPresets) ? serverPresets : [];
  let deletedIds = [];
  let customItems = [];
  try {
    const delRaw = localStorage.getItem(storageKey + '_deleted');
    if (delRaw) deletedIds = JSON.parse(delRaw);
    const savedRaw = localStorage.getItem(storageKey);
    if (savedRaw) {
      const parsed = JSON.parse(savedRaw);
      if (Array.isArray(parsed)) {
        const serverIds = new Set(builtins.map(b => b.id));
        customItems = parsed.filter(p => p && p.id && !serverIds.has(p.id));
      }
    }
  } catch (e) { warnSilent('presets.merge', e); }

  const delSet = new Set(Array.isArray(deletedIds) ? deletedIds : []);
  const customIds = new Set(customItems.map(c => c.id));
  const merged = [
    ...customItems,
    ...builtins.filter(b => b && b.id && !delSet.has(b.id) && !customIds.has(b.id))
  ];
  try {
    localStorage.setItem(storageKey, JSON.stringify(merged));
    localStorage.setItem(storageKey + '_ver', BUILTIN_PRESET_VERSION);
  } catch (e) { warnSilent('presets.ver', e); }
  return merged;
}

function persistPresetAdd(storageKey, created, prevList) {
  const next = [created, ...prevList.filter(p => p.id !== created.id)];
  try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch (e) { warnSilent('presets.add', e); }
  return next;
}

function persistPresetDelete(storageKey, id, prevList, serverPresets = []) {
  const next = prevList.filter(p => p.id !== id);
  try {
    localStorage.setItem(storageKey, JSON.stringify(next));
    if (Array.isArray(serverPresets) && serverPresets.some(b => b.id === id)) {
      const delKey = storageKey + '_deleted';
      const delArr = JSON.parse(localStorage.getItem(delKey) || '[]');
      if (!delArr.includes(id)) {
        delArr.push(id);
        localStorage.setItem(delKey, JSON.stringify(delArr));
      }
    }
  } catch (e) { warnSilent('presets.del', e); }
  return next;
}
