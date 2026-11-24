import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {
  getDataDir,
  getDataAssetsDir,
  getCodexDir,
  getDanbooruCsvFile,
  getArtistPresetsFile
} from './paths.js';

const COMMON_ALIASES = {
  '逆光': ['backlighting', 'rim light', 'lens flare', 'sunlight'],
  '俯视': ['from above', 'overhead shot', 'bird eye view', 'looking down'],
  '仰视': ['from below', 'low angle', 'worm eye view', 'looking up'],
  '特写': ['close-up', 'face focus', 'portrait'],
  '半身': ['cowboy shot', 'upper body', 'half body'],
  '全身': ['full body', 'wide shot', 'standing'],
  '景深': ['depth of field', 'bokeh', 'blurry background'],
  '旗袍': ['cheongsam', 'qipao', 'china dress'],
  '汉服': ['hanfu', 'chinese clothes'],
  '和服': ['kimono', 'yukata', 'furisode'],
  '校服': ['school uniform', 'sailor uniform', 'serafuku'],
  '女仆': ['maid', 'maid headdress', 'maid apron'],
  '樱花': ['cherry blossoms', 'sakura', 'falling petals'],
  '雨夜': ['rain', 'night', 'wet', 'reflection'],
  '黄昏': ['sunset', 'golden hour', 'dusk'],
  '赛璐珞': ['cel shading', 'clean lineart', 'anime coloring'],
  '厚涂': ['painterly', 'oil painting', 'impasto'],
  '水彩': ['watercolor', 'watercolor medium']
};

const CAT_CODE_TO_NAME = ['general', 'artist', 'other', 'copyright', 'character', 'meta'];

const utf8FatalDecoder = new TextDecoder('utf-8', { fatal: true });

function isBufferValidUtf8(buf) {
  if (!Buffer.isBuffer(buf) || buf.length === 0) return true;
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return true;
  const CHUNK = 256 * 1024;
  let pos = 0;
  try {
    while (pos < buf.length) {
      let end = Math.min(buf.length, pos + CHUNK);
      if (end < buf.length) {
        const nl = buf.indexOf(0x0a, end);
        if (nl !== -1 && nl - end < 65536) {
          end = nl + 1;
        } else {
          while (end > pos && (buf[end] & 0xc0) === 0x80) end--;
        }
      }
      utf8FatalDecoder.decode(buf.subarray(pos, end));
      pos = end;
    }
    return true;
  } catch {
    return false;
  }
}

function decodeCsvBuffer(buf) {
  if (isBufferValidUtf8(buf)) {
    return new TextDecoder('utf-8').decode(buf).replace(/^\uFEFF/, '');
  }
  try {
    return new TextDecoder('gbk').decode(buf).replace(/^\uFEFF/, '');
  } catch {
    return buf.toString('utf8').replace(/^\uFEFF/, '');
  }
}

function countQuotes(str) {
  let n = 0;
  for (let i = 0; i < str.length; i++) {
    if (str.charCodeAt(i) === 34) n++;
  }
  return n;
}

function* iterateBufferLines(buf, isUtf8) {
  const decoder = new TextDecoder(isUtf8 ? 'utf-8' : 'gbk');
  let start = 0;
  if (isUtf8 && buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    start = 3;
  }
  const len = buf.length;
  let pending = '';
  while (start < len) {
    let end = buf.indexOf(0x0a, start);
    if (end === -1) end = len;
    const sliceEnd = end > start && buf[end - 1] === 0x0d ? end - 1 : end;
    if (sliceEnd > start) {
      const piece = decoder.decode(buf.subarray(start, sliceEnd));
      if (pending) {
        pending += ' ' + piece;
        if ((countQuotes(pending) & 1) === 0) {
          yield pending;
          pending = '';
        }
      } else if ((countQuotes(piece) & 1) === 1 && end < len) {
        pending = piece;
      } else {
        yield piece;
      }
    } else if (pending) {
      pending += ' ';
    }
    start = end + 1;
  }
  if (pending) yield pending;
}

function parseCsvLineFast(line) {
  if (!line.includes('"')) return line.split(',');
  const fields = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQ = true;
      } else if (ch === ',') {
        fields.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
  }
  fields.push(cur);
  return fields;
}

function normCatNum(rawCode) {
  const n = parseInt(String(rawCode || '0').trim(), 10);
  if (n === 0 || n === 1 || n === 3 || n === 4 || n === 5) return n;
  return 2;
}

function inferChineseCsvCatNum(cat1, cat2, lowerTag) {
  if (cat1.includes('角色人物')) return 4;
  if (cat1.includes('作品与IP') || cat1.includes('动漫游戏作品')) return 3;
  if (
    cat2.includes('元信息') ||
    /^(highres|absurdres|very_absurdres|commentary|commentary_request|english_commentary|chinese_commentary|untranslatable_commentary|bad_id|bad_pixiv_id|bad_twitter_id|translated|translation_request|commission|official_art|variant_set)$/.test(lowerTag) ||
    lowerTag.startsWith('rating:')
  ) {
    return 5;
  }
  return 0;
}

function stripParen(s) {
  const i1 = s.indexOf('（');
  const i2 = s.indexOf('(');
  const cut = i1 >= 0 && i2 >= 0 ? Math.min(i1, i2) : Math.max(i1, i2);
  return cut > 0 ? s.slice(0, cut).trim() : s;
}

function isTokenBoundary(ch) {
  return ch === ' ' || ch === '|' || ch === '/' || ch === ',' || ch === '，' || ch === '（' || ch === '(' || ch === '）' || ch === ')';
}

function hasExactToken(haystack, needle) {
  let pos = haystack.indexOf(needle);
  while (pos !== -1) {
    const beforeOk = pos === 0 || isTokenBoundary(haystack[pos - 1]);
    const endPos = pos + needle.length;
    const afterOk = endPos >= haystack.length || isTokenBoundary(haystack[endPos]);
    if (beforeOk && afterOk) return true;
    pos = haystack.indexOf(needle, pos + 1);
  }
  return false;
}

function isLowerAsciiString(s) {
  return s === s.toLowerCase();
}

class DanbooruEngine {
  constructor() {
    this._config = {};
    this._tagCount = 0;
    this._tagNames = [];
    this._tagLowerNames = [];
    this._tagCns = [];
    this._tagLowerCns = [];
    this._tagWikis = [];
    this._tagExtras = [];
    this._tagCounts = new Uint32Array(0);
    this._tagMeta = new Uint8Array(0);
    this._tagGroupIds = new Uint16Array(0);
    this._groupTable = [''];
    this._groupMap = new Map([['', 0]]);
    this._tagIndex = new Map();
    this._loaded = false;
    this._loadedSig = '';
    this._codexEntries = [];
    this._codexMeta = [];
    this._synonyms = [];
    this._synonymMap = new Map();
  }

  _computeSignature(config = this._config) {
    return JSON.stringify([
      getDataDir(config),
      getCodexDir(config),
      getDanbooruCsvFile(config),
      getArtistPresetsFile(config)
    ]);
  }

  configure(config = {}) {
    const nextConfig = config && typeof config === 'object' ? { ...config } : {};
    const nextSig = this._computeSignature(nextConfig);
    this._config = nextConfig;
    if (this._loaded && nextSig !== this._loadedSig) {
      this.reset();
    }
  }

  reset() {
    this._tagCount = 0;
    this._tagNames = [];
    this._tagLowerNames = [];
    this._tagCns = [];
    this._tagLowerCns = [];
    this._tagWikis = [];
    this._tagExtras = [];
    this._tagCounts = new Uint32Array(0);
    this._tagMeta = new Uint8Array(0);
    this._tagGroupIds = new Uint16Array(0);
    this._groupTable = [''];
    this._groupMap = new Map([['', 0]]);
    this._tagIndex.clear();
    this._codexEntries = [];
    this._codexMeta = [];
    this._synonyms = [];
    this._synonymMap.clear();
    this._loaded = false;
    this._loadedSig = '';
  }

  ensureLoaded() {
    const sig = this._computeSignature(this._config);
    if (this._loaded && this._loadedSig === sig) return;
    if (this._loaded && this._loadedSig !== sig) {
      this.reset();
    }

    const tempCounts = [];
    const tempMeta = [];
    const tempGroupIds = [];

    this._loadDanbooruCsv(tempCounts, tempMeta, tempGroupIds);
    this._loadZhCoreTranslations(tempCounts, tempMeta, tempGroupIds);
    this._finalizeTagStorage(tempCounts, tempMeta, tempGroupIds);

    this._loadSynonyms();
    this._loadCodexes();
    this._loaded = true;
    this._loadedSig = sig;
  }

  _getPaths() {
    const dataDir = getDataDir(this._config);
    return {
      dataDir,
      codexDir: getCodexDir(this._config),
      danbooruCsv: getDanbooruCsvFile(this._config),
      synonymsBuiltin: path.join(getDataAssetsDir(), 'synonyms.json'),
      synonymsCustom: path.join(dataDir, 'synonyms.json'),
      artistPresetsFile: getArtistPresetsFile(this._config)
    };
  }

  _internGroup(groupStr) {
    if (!groupStr) return 0;
    let id = this._groupMap.get(groupStr);
    if (id === undefined) {
      id = this._groupTable.length;
      if (id >= 65535) return 0;
      this._groupTable.push(groupStr);
      this._groupMap.set(groupStr, id);
    }
    return id;
  }

  _pushTag(tag, cn, wiki, postCount, catNum, nsfw, extraLower, groupStr, tempCounts, tempMeta, tempGroupIds) {
    const lowerName = isLowerAsciiString(tag) ? tag : tag.toLowerCase();
    const existingIdx = this._tagIndex.get(lowerName);
    if (existingIdx !== undefined) {
      if (cn && (!this._tagCns[existingIdx] || this._tagCns[existingIdx].length < cn.length)) {
        this._tagCns[existingIdx] = cn;
        this._tagLowerCns[existingIdx] = isLowerAsciiString(cn) ? cn : cn.toLowerCase();
      }
      if (wiki && !this._tagWikis[existingIdx]) {
        this._tagWikis[existingIdx] = wiki;
      }
      if (nsfw) {
        tempMeta[existingIdx] |= 0x10;
      }
      if (postCount > tempCounts[existingIdx]) {
        tempCounts[existingIdx] = postCount;
      }
      if (extraLower) {
        const prev = this._tagExtras[existingIdx];
        if (!prev) this._tagExtras[existingIdx] = extraLower;
        else if (!prev.includes(extraLower)) this._tagExtras[existingIdx] = `${prev} | ${extraLower}`;
      }
      return existingIdx;
    }

    const idx = this._tagCount++;
    const lowerCn = cn ? (isLowerAsciiString(cn) ? cn : cn.toLowerCase()) : '';
    this._tagNames.push(tag);
    this._tagLowerNames.push(lowerName);
    this._tagCns.push(cn);
    this._tagLowerCns.push(lowerCn);
    this._tagWikis.push(wiki);
    this._tagExtras.push(extraLower);
    tempCounts.push(postCount >>> 0);
    tempMeta.push((catNum & 0x0f) | (nsfw ? 0x10 : 0));
    tempGroupIds.push(this._internGroup(groupStr));
    this._tagIndex.set(lowerName, idx);
    return idx;
  }

  _finalizeTagStorage(tempCounts, tempMeta, tempGroupIds) {
    const n = this._tagCount;
    let sortedDesc = true;
    for (let i = 1; i < n; i++) {
      if (tempCounts[i] > tempCounts[i - 1]) {
        sortedDesc = false;
        break;
      }
    }

    if (sortedDesc) {
      this._tagCounts = Uint32Array.from(tempCounts);
      this._tagMeta = Uint8Array.from(tempMeta);
      this._tagGroupIds = Uint16Array.from(tempGroupIds);
      this._groupMap.clear();
      return;
    }

    const perm = new Int32Array(n);
    for (let i = 0; i < n; i++) perm[i] = i;
    const names = this._tagNames;
    perm.sort((a, b) => {
      const diff = tempCounts[b] - tempCounts[a];
      if (diff !== 0) return diff;
      return names[a] < names[b] ? -1 : (names[a] > names[b] ? 1 : 0);
    });

    const nextNames = new Array(n);
    const nextLowerNames = new Array(n);
    const nextCns = new Array(n);
    const nextLowerCns = new Array(n);
    const nextWikis = new Array(n);
    const nextExtras = new Array(n);
    const nextCounts = new Uint32Array(n);
    const nextMeta = new Uint8Array(n);
    const nextGroupIds = new Uint16Array(n);
    const nextIndex = new Map();

    for (let i = 0; i < n; i++) {
      const src = perm[i];
      const lName = this._tagLowerNames[src];
      nextNames[i] = this._tagNames[src];
      nextLowerNames[i] = lName;
      nextCns[i] = this._tagCns[src];
      nextLowerCns[i] = this._tagLowerCns[src];
      nextWikis[i] = this._tagWikis[src];
      nextExtras[i] = this._tagExtras[src];
      nextCounts[i] = tempCounts[src];
      nextMeta[i] = tempMeta[src];
      nextGroupIds[i] = tempGroupIds[src];
      nextIndex.set(lName, i);
    }

    this._tagNames = nextNames;
    this._tagLowerNames = nextLowerNames;
    this._tagCns = nextCns;
    this._tagLowerCns = nextLowerCns;
    this._tagWikis = nextWikis;
    this._tagExtras = nextExtras;
    this._tagCounts = nextCounts;
    this._tagMeta = nextMeta;
    this._tagGroupIds = nextGroupIds;
    this._tagIndex = nextIndex;
    this._groupMap.clear();
  }

  _materializeTag(idx, includeWiki = true, compactWiki = false) {
    const meta = this._tagMeta[idx];
    const catName = CAT_CODE_TO_NAME[meta & 0x0f] || 'other';
    const entry = {
      tag: this._tagNames[idx],
      cn_name: this._tagCns[idx],
      category: catName,
      post_count: this._tagCounts[idx]
    };
    const gid = this._tagGroupIds[idx];
    if (gid > 0) {
      const g = this._groupTable[gid];
      if (g) entry.group = g;
    }
    const wiki = this._tagWikis[idx];
    if (includeWiki && wiki) {
      entry.wiki = compactWiki && wiki.length > 80 ? wiki.slice(0, 80) + '...' : wiki;
    }
    return entry;
  }

  _loadDanbooruCsv(tempCounts, tempMeta, tempGroupIds) {
    const { danbooruCsv } = this._getPaths();
    if (!danbooruCsv || !fs.existsSync(danbooruCsv)) return;

    try {
      const buf = fs.readFileSync(danbooruCsv);
      const isUtf8 = isBufferValidUtf8(buf);

      let format = '';
      let isFirstLine = true;

      for (const rawLine of iterateBufferLines(buf, isUtf8)) {
        const line = rawLine.trim();
        if (!line) continue;
        const f = parseCsvLineFast(line);

        if (isFirstLine) {
          isFirstLine = false;
          const f0 = (f[0] || '').trim();
          const f1 = (f[1] || '').trim();
          const f3 = (f[3] || '').trim();

          if (f0 === '全站使用量排名' || f1 === 'D站英文标签') {
            format = 'cn12';
            continue;
          }
          if (
            (f0 === 'name' || f0 === 'tag') &&
            (f1 === 'cn_name' || f3 === 'post_count')
          ) {
            format = 'std';
            continue;
          }
          if (f.length === 4 && /^\d+$/.test(f1) && /^\d+$/.test((f[2] || '').trim())) {
            format = 'sd4';
            // first line IS data row! fall through
          } else {
            format = 'std';
            // first line IS headerless data row! fall through
          }
        }

        if (format === 'cn12') {
          const tag = (f[1] || '').trim();
          if (!tag) continue;
          const postCount = parseInt(f[2] || '0', 10) || 0;
          const cat1 = (f[4] || '').trim();
          const cat2 = (f[5] || '').trim();
          const group = cat1 && cat2 ? `${cat1}/${cat2}` : cat1;
          const cn = (f[6] || '').trim();
          const langParts = [];
          const cnLow = cn.toLowerCase();
          for (const lf of [f[7], f[8], f[9]]) {
            const v = (lf || '').trim();
            if (v && v.toLowerCase() !== cnLow) langParts.push(v);
          }
          const wiki = (f[10] || '').trim();
          const aliases = (f[11] || '').trim();
          const extra = [langParts.join(' | '), aliases].filter(Boolean).join(' | ').toLowerCase();
          const catNum = inferChineseCsvCatNum(cat1, cat2, tag.toLowerCase());
          this._pushTag(tag, cn, wiki, postCount, catNum, false, extra, group, tempCounts, tempMeta, tempGroupIds);
        } else if (format === 'sd4') {
          const tag = (f[0] || '').trim();
          if (!tag) continue;
          const catNum = normCatNum(f[1]);
          const postCount = parseInt(f[2] || '0', 10) || 0;
          const rawDesc = (f[3] || '').trim();
          let cn = '';
          let extra = '';
          if (rawDesc) {
            const parts = rawDesc.split(',');
            const first = (parts[0] || '').trim();
            if (first.includes(' | ')) {
              const langSegs = first.split(' | ').map(s => s.trim()).filter(Boolean);
              cn = langSegs[0] || '';
              extra = [...langSegs.slice(1), ...parts.slice(1).map(s => s.trim())].filter(Boolean).join(' | ').toLowerCase();
            } else {
              cn = first;
              extra = parts.slice(1).map(s => s.trim()).filter(Boolean).join(' | ').toLowerCase();
            }
          }
          this._pushTag(tag, cn, '', postCount, catNum, false, extra, '', tempCounts, tempMeta, tempGroupIds);
        } else {
          const tag = (f[0] || '').trim();
          if (!tag) continue;
          const cn = (f[1] || '').trim();
          const wiki = (f[2] || '').trim();
          const postCount = parseInt(f[3] || '0', 10) || 0;
          const catNum = normCatNum(f[4]);
          const nsfw = (f[5] || '').trim() === '1';
          const langs = (f[6] || '').trim();
          const aliases = (f[7] || '').trim();
          const group = (f[8] || '').trim();
          const extraRaw = langs && aliases ? `${langs} | ${aliases}` : (langs || aliases);
          const extra = extraRaw ? extraRaw.toLowerCase() : '';
          this._pushTag(tag, cn, wiki, postCount, catNum, nsfw, extra, group, tempCounts, tempMeta, tempGroupIds);
        }
      }
    } catch (err) {
      console.error('[DanbooruEngine] Failed to load optional CSV:', err?.message || err);
    }
  }

  _loadZhCoreTranslations(tempCounts, tempMeta, tempGroupIds) {
    const { codexDir, dataDir } = this._getPaths();
    const candidates = [
      path.join(codexDir, 'tag_zh', 'core.json'),
      path.join(dataDir, 'tag_zh', 'core.json')
    ];
    const zhCorePath = candidates.find(p => fs.existsSync(p));
    if (!zhCorePath) return;

    try {
      const zhData = JSON.parse(fs.readFileSync(zhCorePath, 'utf8'));
      const dicts = [
        { dict: zhData.d || {}, catNum: 0 },
        { dict: zhData.a || {}, catNum: 1 }
      ];

      for (const { dict, catNum } of dicts) {
        for (const [rawTag, rawCn] of Object.entries(dict)) {
          if (!rawTag || !rawCn) continue;
          const cleanTag = rawTag.trim();
          if (
            !cleanTag ||
            /[^\x20-\x7e]/.test(cleanTag) ||
            cleanTag.startsWith('//') ||
            cleanTag.startsWith('##') ||
            cleanTag.includes('/*')
          ) {
            continue;
          }
          const lowerExact = cleanTag.toLowerCase();
          const lowerUnder = lowerExact.includes(' ') ? lowerExact.replace(/\s+/g, '_') : lowerExact;
          const cleanCn = String(rawCn).trim();
          if (!lowerUnder || !cleanCn) continue;

          let existingIdx = this._tagIndex.get(lowerExact);
          if (existingIdx === undefined && lowerUnder !== lowerExact) {
            existingIdx = this._tagIndex.get(lowerUnder);
          }

          if (existingIdx !== undefined) {
            const curCn = this._tagCns[existingIdx];
            const curLow = this._tagLowerCns[existingIdx];
            const cleanLow = cleanCn.toLowerCase();
            if (!curCn) {
              this._tagCns[existingIdx] = cleanCn;
              this._tagLowerCns[existingIdx] = isLowerAsciiString(cleanCn) ? cleanCn : cleanLow;
            } else if (cleanLow !== curLow && !curLow.includes(cleanLow)) {
              const prevExtra = this._tagExtras[existingIdx];
              if (!prevExtra) {
                this._tagExtras[existingIdx] = cleanLow;
              } else if (!prevExtra.includes(cleanLow)) {
                this._tagExtras[existingIdx] = `${prevExtra} | ${cleanLow}`;
              }
            }
          } else {
            const canonical = cleanTag.includes(' ') ? cleanTag.replace(/\s+/g, '_') : cleanTag;
            this._pushTag(
              canonical,
              cleanCn,
              '',
              catNum === 1 ? 100 : 50,
              catNum,
              false,
              '',
              '',
              tempCounts,
              tempMeta,
              tempGroupIds
            );
          }
        }
      }
    } catch (err) {
      console.error('[DanbooruEngine] Failed loading optional tag_zh/core.json:', err?.message || err);
    }
  }

  _ingestSynonymsFile(filePath) {
    if (!filePath || !fs.existsSync(filePath)) return;
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      for (const groupList of Object.values(data.categories || {})) {
        if (!Array.isArray(groupList)) continue;
        for (const cluster of groupList) {
          if (!Array.isArray(cluster)) continue;
          const cleanCluster = cluster.map(x => String(x).toLowerCase().trim()).filter(Boolean);
          if (cleanCluster.length === 0) continue;
          this._synonyms.push(cleanCluster);
          for (const item of cleanCluster) {
            this._synonymMap.set(item, cleanCluster);
          }
        }
      }
    } catch (err) {
      console.error(`[DanbooruEngine] Failed loading synonyms file ${filePath}:`, err?.message || err);
    }
  }

  _loadSynonyms() {
    for (const [k, cluster] of Object.entries(COMMON_ALIASES)) {
      const full = [k.toLowerCase(), ...cluster.map(x => x.toLowerCase())];
      this._synonyms.push(full);
      for (const item of full) {
        this._synonymMap.set(item, full);
      }
    }

    const { synonymsBuiltin, synonymsCustom } = this._getPaths();
    this._ingestSynonymsFile(synonymsBuiltin);
    if (synonymsCustom !== synonymsBuiltin) {
      this._ingestSynonymsFile(synonymsCustom);
    }
  }

  _loadCodexes() {
    const { codexDir, dataDir } = this._getPaths();
    if (!codexDir || !fs.existsSync(codexDir)) return;

    let customTitles = {};
    for (const titleFile of [path.join(codexDir, 'codex_titles.json'), path.join(dataDir, 'codex_titles.json')]) {
      if (fs.existsSync(titleFile)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(titleFile, 'utf8'));
          if (parsed && typeof parsed === 'object') {
            customTitles = { ...customTitles, ...parsed };
          }
        } catch {}
      }
    }

    const self = this;

    function loadSingleFile(fullPath, codexKey) {
      try {
        const content = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        const friendlyName = String(customTitles[codexKey] || content?.title || content?.name || codexKey).trim();
        let items = content.entries || (Array.isArray(content) ? content : (content.items || content.data || content.slides || []));

        if (content.sheets && Array.isArray(content.sheets)) {
          if (!Array.isArray(items)) items = [];
          for (const s of content.sheets) {
            const sheetTitle = s.title || '';
            const copyCol = s.copyColumn !== undefined && s.copyColumn !== null ? s.copyColumn : 0;
            let currentGroup = '';
            for (const r of (s.rows || [])) {
              if (r.type === 'group') {
                currentGroup = r.label || '';
                continue;
              }
              if (r.type === 'row' && Array.isArray(r.cells)) {
                const tag = String(r.cells[copyCol] || r.cells[0] || '').trim();
                const meaning = String(r.cells[1] || '').trim();
                const desc = r.cells.slice(2).filter(Boolean).map(c => String(c).trim()).join(' | ');
                if (tag) {
                  items.push({
                    title: meaning ? `${meaning} (${tag})` : tag,
                    prompt: tag,
                    chapter: `${sheetTitle}${currentGroup ? ' · ' + currentGroup : ''}`,
                    description: desc
                  });
                }
              }
            }
          }
        }

        if (!Array.isArray(items)) return;

        let count = 0;
        for (const item of items) {
          if (!item || typeof item !== 'object') continue;
          const title = String(item.title || item.name || item.navTitle || '').trim();
          let rawGlobalPrompt = item.tags || item.prompt || (Array.isArray(item.prompts) ? item.prompts.join(', ') : '') || '';
          if (!String(rawGlobalPrompt).trim() && Array.isArray(item.strings) && item.strings.length > 0) {
            rawGlobalPrompt = item.strings.map(s => String(s || '').trim()).filter(Boolean).join(' | ');
          }
          if (!String(rawGlobalPrompt).trim() && Array.isArray(item.examples) && item.examples.length > 0) {
            rawGlobalPrompt = item.examples.map(ex => {
              if (typeof ex === 'string') return ex.trim();
              if (ex && typeof ex === 'object') return String(ex.prompt || ex.tags || ex.text || '').trim();
              return '';
            }).filter(Boolean).join(' | ');
          }

          const rawCharPrompts = Array.isArray(item.characterPrompts) ? item.characterPrompts : [];
          const characterPrompts = [];
          for (let ci = 0; ci < rawCharPrompts.length; ci++) {
            const cp = rawCharPrompts[ci];
            if (!cp || typeof cp !== 'object') continue;
            const cpPrompt = String(cp.prompt || cp.tags || cp.char_caption || '').trim();
            const cpNeg = String(cp.negative || cp.uc || cp.negativePrompt || '').trim();
            if (!cpPrompt && !cpNeg) continue;
            characterPrompts.push({
              label: String(cp.label || `char${ci + 1}`).trim(),
              prompt: cpPrompt,
              ...(cpNeg ? { negative: cpNeg } : {})
            });
          }

          const cleanGlobal = String(rawGlobalPrompt || '').trim();
          const cleanNegative = String(item.negative || item.uc || '').trim();
          if (!cleanGlobal && characterPrompts.length === 0 && !cleanNegative) continue;

          const charSummary = characterPrompts.length > 0
            ? characterPrompts.map(cp => `[${cp.label}] ${cp.prompt}${cp.negative ? ` (UC: ${cp.negative})` : ''}`).join('\n')
            : '';
          const displayPrompt = cleanGlobal || charSummary;
          const searchText = [cleanGlobal, ...characterPrompts.map(cp => cp.prompt)].filter(Boolean).join(' ');
          const pathInfo = Array.isArray(item.path) ? item.path.join(' / ') : (item.chapter || item.description || '');
          const cleanTitle = title || friendlyName;

          self._codexEntries.push({
            codexKey,
            codex: friendlyName,
            name: cleanTitle,
            globalPrompt: cleanGlobal,
            prompt: displayPrompt,
            characterPrompts,
            negative: cleanNegative,
            category: String(pathInfo || ''),
            _lowerCodexKey: String(codexKey).toLowerCase(),
            _lowerCodex: friendlyName.toLowerCase(),
            _lowerName: cleanTitle.toLowerCase(),
            _lowerCat: String(pathInfo || '').toLowerCase(),
            _lowerPrompt: searchText.toLowerCase(),
            _isWildcard: displayPrompt.includes('||') || cleanTitle.includes('随机') || /random/i.test(cleanTitle)
          });
          count++;
        }

        if (count > 0) {
          self._codexMeta.push({
            key: codexKey,
            name: friendlyName,
            count
          });
        }
      } catch (err) {
        console.error(`[DanbooruEngine] Failed loading optional codex ${fullPath}:`, err?.message || err);
      }
    }

    const IGNORED_META_FILES = new Set([
      'codex_titles.json',
      'meta.json',
      'about.json',
      'announcements.json',
      'artist_index.json',
      'artist_strings.json',
      'artist_styles.json',
      'media.json',
      'release_meta.json',
      'share-index.json',
      'strings.json',
      'strings_index.json',
      'pack.json',
      'codexes.json'
    ]);
    const isCodexJsonFile = (filename) => {
      const lower = filename.toLowerCase();
      return lower.endsWith('.json') &&
        !IGNORED_META_FILES.has(lower) &&
        !lower.includes('.draft.') &&
        !lower.includes('.meta.');
    };

    try {
      const rootFiles = fs.readdirSync(codexDir);
      for (const f of rootFiles) {
        const full = path.join(codexDir, f);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          if (f === 'tag_zh') continue;
          for (const sf of fs.readdirSync(full)) {
            if (isCodexJsonFile(sf)) {
              loadSingleFile(path.join(full, sf), sf.replace('.json', ''));
            }
          }
        } else if (isCodexJsonFile(f)) {
          loadSingleFile(full, f.replace('.json', ''));
        }
      }
    } catch (err) {
      console.error('[DanbooruEngine] Failed scanning optional codexDir:', err?.message || err);
    }
  }

  getCodexMeta() {
    this.ensureLoaded();
    const { codexDir, danbooruCsv } = this._getPaths();
    return {
      totalEntries: this._codexEntries.length,
      totalTags: this._tagCount,
      codexes: this._codexMeta,
      configured: {
        codexDir,
        codexDirExists: fs.existsSync(codexDir),
        danbooruCsv,
        danbooruCsvExists: fs.existsSync(danbooruCsv)
      }
    };
  }

  _compressCodexPrompt(prompt, searchTerms, maxChars = 360) {
    let text = String(prompt || '').replace(/\r?\n+/g, ', ').replace(/\s+/g, ' ').replace(/,\s*,+/g, ', ').trim();
    if (!text) return '';

    if (text.includes('||')) {
      text = text.replace(/\|\|([\s\S]*?)\|\|/g, (_m, inner) => {
        const opts = inner.split('|').map(s => s.trim().replace(/^,+|,+$/g, '')).filter(Boolean);
        if (!opts.length) return '';
        const matched = [];
        for (const o of opts) {
          const low = o.toLowerCase();
          if ([...searchTerms].some(t => t.length >= 2 && low.includes(t))) {
            if (!matched.includes(o)) matched.push(o);
            if (matched.length >= 2) break;
          }
        }
        if (matched.length > 0) return matched.join(' / ');
        const shortest = [...opts].sort((a, b) => a.length - b.length)[0];
        return shortest || opts[0];
      });
      text = text.replace(/,\s*,+/g, ', ').trim();
    }

    if (text.length <= maxChars) return text;

    let cutIdx = text.lastIndexOf(',', maxChars);
    if (cutIdx < Math.floor(maxChars * 0.55)) cutIdx = text.lastIndexOf(' ', maxChars);
    if (cutIdx < Math.floor(maxChars * 0.4)) cutIdx = maxChars;
    const head = text.slice(0, cutIdx).trim().replace(/,+$/, '');

    const headLower = head.toLowerCase();
    const extraSegments = [];
    const missingTerms = [...searchTerms].filter(t => t.length >= 2 && !headLower.includes(t));
    if (missingTerms.length > 0) {
      const tailParts = text.slice(cutIdx).split(',').map(s => s.trim()).filter(Boolean);
      for (const part of tailParts) {
        const low = part.toLowerCase();
        if (missingTerms.some(t => low.includes(t))) {
          extraSegments.push(part);
          if (extraSegments.join(', ').length >= 120 || extraSegments.length >= 4) break;
        }
      }
    }

    const extra = extraSegments.length > 0 ? `, ... ${extraSegments.join(', ')}` : '';
    return `${head}${extra} ...[+${text.length - cutIdx}c]`;
  }

  _compactNegative(negative, maxChars = 180) {
    const text = String(negative || '').replace(/\r?\n+/g, ', ').replace(/\s+/g, ' ').trim();
    if (!text || text.length <= maxChars) return text;
    let cutIdx = text.lastIndexOf(',', maxChars);
    if (cutIdx < Math.floor(maxChars * 0.5)) cutIdx = maxChars;
    return `${text.slice(0, cutIdx).trim().replace(/,+$/, '')} ...[+${text.length - cutIdx}c]`;
  }

  searchDanbooru(query, options = {}) {
    this.ensureLoaded();
    const compact = Boolean(options.compact);
    const includeWiki = Boolean(options.include_wiki);
    const category = options.category || 'all';
    const targetCatNum = category === 'all' ? -1 : CAT_CODE_TO_NAME.indexOf(category);
    const maxLimit = compact ? 15 : 100;
    const defaultLimit = compact ? 10 : 15;
    const limit = Math.min(maxLimit, Math.max(1, Number(options.limit) || defaultLimit));
    const showNsfw = options.show_nsfw !== false;

    if (!this._tagCount) {
      return {
        prompt: '',
        results: [],
        source: 'unconfigured_optional_csv',
        query
      };
    }

    const qClean = String(query || '').trim().toLowerCase();
    const qUnder = qClean.includes(' ') ? qClean.replace(/\s+/g, '_') : qClean;
    const keywords = qClean ? qClean.split(/[\s,，、/]+/).filter(Boolean) : [];
    const kwUnder = keywords.map(k => (k.includes(' ') ? k.replace(/\s+/g, '_') : k));
    const qHasNonAscii = /[^\x00-\x7f]/.test(qClean);
    const kwNonAscii = keywords.map(k => /[^\x00-\x7f]/.test(k));

    // Resolve synonym expansions in O(1) via _tagIndex + preserve any non-indexed terms (CN/JA aliases)
    const synBoostMap = new Map();
    const extraNonIdxSyns = [];
    for (const k of keywords) {
      const cluster = this._synonymMap.get(k);
      if (!cluster) continue;
      for (const syn of cluster) {
        const synUnder = syn.includes(' ') ? syn.replace(/\s+/g, '_') : syn;
        const hitIdx = this._tagIndex.get(syn) ?? this._tagIndex.get(synUnder);
        if (hitIdx !== undefined) {
          const prev = synBoostMap.get(hitIdx) || 0;
          synBoostMap.set(hitIdx, prev + 260);
        } else if (syn !== qClean && !keywords.includes(syn)) {
          extraNonIdxSyns.push(syn);
        }
      }
    }

    const n = this._tagCount;
    const lowerNames = this._tagLowerNames;
    const lowerCns = this._tagLowerCns;
    const extras = this._tagExtras;
    const counts = this._tagCounts;
    const metaArr = this._tagMeta;

    const matches = [];
    const seenIdx = new Set();

    // Seed direct O(1) synonym hits first so they rank cleanly even if main query doesn't substring-match them
    for (const [idx, bonus] of synBoostMap) {
      const meta = metaArr[idx];
      if (!showNsfw && (meta & 0x10)) continue;
      if (targetCatNum >= 0 && (meta & 0x0f) !== targetCatNum) continue;
      seenIdx.add(idx);
      let score = bonus;
      const name = lowerNames[idx];
      const cn = lowerCns[idx];
      const extra = extras[idx];
      if (qClean) {
        if (name === qClean || name === qUnder || (cn && (cn === qClean || stripParen(cn) === qClean))) {
          score += 220;
        } else if (
          (!qHasNonAscii && (name.includes(qClean) || (qUnder !== qClean && name.includes(qUnder)))) ||
          (cn && cn.includes(qClean)) ||
          (extra && extra.includes(qClean))
        ) {
          score += 120;
        }
      }
      matches.push({ score, post_count: counts[idx], idx });
    }

    if (!qClean) {
      if (category !== 'all') {
        for (let i = 0; i < n && matches.length < limit; i++) {
          const meta = metaArr[i];
          if (!showNsfw && (meta & 0x10)) continue;
          if (targetCatNum >= 0 && (meta & 0x0f) !== targetCatNum) continue;
          if (!seenIdx.has(i)) {
            matches.push({ score: 1, post_count: counts[i], idx: i });
          }
        }
      }
    } else if (keywords.length <= 1) {
      for (let i = 0; i < n; i++) {
        const meta = metaArr[i];
        if (!showNsfw && (meta & 0x10)) continue;
        if (targetCatNum >= 0 && (meta & 0x0f) !== targetCatNum) continue;
        if (seenIdx.has(i)) continue;

        const name = lowerNames[i];
        const cn = lowerCns[i];
        const extra = extras[i];
        let score = 0;

        if (!qHasNonAscii && name.includes(qClean)) {
          score += name === qClean ? 350 : 140;
        }
        if (cn && cn.includes(qClean)) {
          if (cn === qClean || stripParen(cn) === qClean) score += 320;
          else score += 120;
        }
        if (extra && extra.includes(qClean)) {
          score += hasExactToken(extra, qClean) ? 260 : 75;
        }

        if (score > 0) {
          matches.push({ score, post_count: counts[i], idx: i });
        }
      }
    } else {
      if (!qHasNonAscii) {
        const phraseIdx = this._tagIndex.get(qUnder);
        if (phraseIdx !== undefined && !seenIdx.has(phraseIdx)) {
          const meta = metaArr[phraseIdx];
          if ((showNsfw || !(meta & 0x10)) && (targetCatNum < 0 || (meta & 0x0f) === targetCatNum)) {
            seenIdx.add(phraseIdx);
            matches.push({ score: 350, post_count: counts[phraseIdx], idx: phraseIdx });
          }
        }
      }

      const kwLen = keywords.length;
      for (let i = 0; i < n; i++) {
        const meta = metaArr[i];
        if (!showNsfw && (meta & 0x10)) continue;
        if (targetCatNum >= 0 && (meta & 0x0f) !== targetCatNum) continue;
        if (seenIdx.has(i)) continue;

        const name = lowerNames[i];
        const cn = lowerCns[i];
        const extra = extras[i];
        let hits = 0;
        let exactBonus = 0;

        for (let j = 0; j < kwLen; j++) {
          const k = keywords[j];
          const ku = kwUnder[j];
          const nonAscii = kwNonAscii[j];
          let matched = false;
          if (!nonAscii && name.includes(ku)) {
            matched = true;
            if (name === ku) exactBonus += 80;
          } else if (cn && cn.includes(k)) {
            matched = true;
            if (cn === k || stripParen(cn) === k) exactBonus += 70;
          } else if (extra && extra.includes(k)) {
            matched = true;
            if (hasExactToken(extra, k)) exactBonus += 50;
          }
          if (matched) hits++;
        }

        if (hits > 0) {
          const score = (hits === kwLen ? 220 : hits * 45) + exactBonus;
          matches.push({ score, post_count: counts[i], idx: i });
        }
      }
    }

    // Secondary pass for non-indexed synonyms only when direct matches are scarce
    if (qClean && matches.length < limit && extraNonIdxSyns.length > 0) {
      const synLimit = Math.min(extraNonIdxSyns.length, 6);
      for (let i = 0; i < n; i++) {
        const meta = metaArr[i];
        if (!showNsfw && (meta & 0x10)) continue;
        if (targetCatNum >= 0 && (meta & 0x0f) !== targetCatNum) continue;
        if (seenIdx.has(i)) continue;
        const name = lowerNames[i];
        const cn = lowerCns[i];
        let synHits = 0;
        for (let j = 0; j < synLimit; j++) {
          const s = extraNonIdxSyns[j];
          if (name.includes(s) || (cn && cn.includes(s))) synHits++;
        }
        if (synHits > 0) {
          matches.push({ score: synHits * 45, post_count: counts[i], idx: i });
        }
      }
    }

    matches.sort((a, b) => (b.score !== a.score ? b.score - a.score : b.post_count - a.post_count));
    const top = matches.slice(0, limit).map(m => this._materializeTag(m.idx, !compact || includeWiki, compact));
    const prompt = top.map(t => t.tag).join(', ');

    if (compact) {
      return { query, prompt, results: top };
    }

    return {
      prompt,
      results: top,
      source: `local_optional_db (${this._tagCount} tags)`,
      query
    };
  }

  _collectChineseToEnglishTerms(keywords, maxTotal = 18) {
    const searchTerms = new Set(keywords);
    const n = this._tagCount;
    const lowerCns = this._tagLowerCns;
    const extras = this._tagExtras;
    const lowerNames = this._tagLowerNames;

    for (const k of keywords) {
      const cluster = this._synonymMap.get(k);
      if (cluster) {
        for (const alias of cluster) searchTerms.add(alias.toLowerCase());
      }
      if (k.length >= 2 && searchTerms.size < maxTotal) {
        let added = 0;
        for (let i = 0; i < n; i++) {
          const cn = lowerCns[i];
          const ex = extras[i];
          if ((cn && (cn === k || cn.includes(k))) || (ex && hasExactToken(ex, k))) {
            const lName = lowerNames[i];
            searchTerms.add(lName.replace(/_/g, ' '));
            searchTerms.add(lName);
            added++;
            if (added >= 4 || searchTerms.size >= maxTotal) break;
          }
        }
      }
    }
    return searchTerms;
  }

  searchCodex(query, options = {}) {
    this.ensureLoaded();
    const compact = Boolean(options.compact);
    const includeNegative = Boolean(options.include_negative);
    const targetCodex = options.codex ? String(options.codex).toLowerCase() : null;
    const maxLimit = compact ? 6 : 100;
    const defaultLimit = compact ? 4 : 12;
    const limit = Math.min(maxLimit, Math.max(1, Number(options.limit) || defaultLimit));
    const maxPromptChars = Math.min(600, Math.max(120, Number(options.max_chars) || 360));
    const maxTotalChars = Math.min(3200, Math.max(600, Number(options.max_total_chars) || 2000));

    const qClean = String(query || '').trim().toLowerCase();
    const wantsRandom = qClean.includes('随机') || qClean.includes('random');
    const keywords = qClean.split(/[\s,，、/]+/).filter(Boolean);
    const searchTerms = this._collectChineseToEnglishTerms(keywords, 18);

    const matches = [];
    for (const entry of this._codexEntries) {
      if (targetCodex && targetCodex !== 'all') {
        const kMatch = entry._lowerCodexKey.includes(targetCodex);
        const nMatch = entry._lowerCodex.includes(targetCodex);
        if (!kMatch && !nMatch) continue;
      }

      if (!qClean) {
        const baseScore = !wantsRandom && entry._isWildcard ? 1 : 10;
        matches.push({ score: baseScore, entry });
        continue;
      }

      const lowerName = entry._lowerName;
      const lowerCat = entry._lowerCat;
      const lowerPrompt = entry._lowerPrompt;
      let score = 0;

      if (lowerName.includes(qClean)) score += 220;
      if (lowerCat.includes(qClean)) score += 80;
      if (lowerPrompt.includes(qClean)) score += 100;

      for (const k of searchTerms) {
        if (lowerName.includes(k)) score += 65;
        else if (lowerPrompt.includes(k)) score += 30;
      }

      if (score > 0) {
        if (!wantsRandom && entry._isWildcard) score -= 180;
        if (entry.prompt.length > 2500) score -= 90;
        else if (entry.prompt.length > 1000) score -= 30;
        else if (entry.prompt.length > 15 && entry.prompt.length <= 450) score += 25;
        matches.push({ score, entry });
      }
    }

    matches.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.entry.prompt.length - b.entry.prompt.length));
    const sliced = matches.slice(0, limit).map(m => m.entry);

    if (!compact) {
      return {
        query,
        results: sliced,
        count: sliced.length,
        totalEntries: this._codexEntries.length
      };
    }

    const compactResults = [];
    let totalChars = 0;
    for (const e of sliced) {
      const p = this._compressCodexPrompt(e.prompt, searchTerms, maxPromptChars);
      const n = includeNegative && e.negative ? this._compactNegative(e.negative, 180) : '';
      const itemCost = e.codex.length + e.name.length + (e.category || '').length + p.length + n.length;
      if (compactResults.length > 0 && totalChars + itemCost > maxTotalChars) break;
      const compactItem = { codex: e.codex, name: e.name, prompt: p };
      if (e.category) compactItem.category = e.category;
      if (n) compactItem.negative = n;
      compactResults.push(compactItem);
      totalChars += itemCost;
    }

    return {
      query,
      results: compactResults,
      count: compactResults.length,
      totalMatched: matches.length,
      totalEntries: this._codexEntries.length
    };
  }

  getRelatedTags(tags, options = {}) {
    this.ensureLoaded();
    const compact = Boolean(options.compact);
    const limit = Math.min(compact ? 20 : 50, Math.max(1, Number(options.limit) || (compact ? 12 : 15)));
    const tagList = Array.isArray(tags) ? tags : [tags];
    const suggestions = [];
    const seen = new Set();

    for (const t of tagList) {
      const lower = String(t).toLowerCase().trim();
      const cluster = this._synonymMap.get(lower);
      if (!cluster) continue;
      for (const syn of cluster) {
        if (syn === lower) continue;
        const synUnder = syn.includes(' ') ? syn.replace(/\s+/g, '_') : syn;
        let idx = this._tagIndex.get(syn) ?? this._tagIndex.get(synUnder);
        if (idx === undefined && this._tagCount > 0) {
          // Bounded fallback scan on CN/extras (sorted descending by post_count)
          const limitScan = Math.min(this._tagCount, 50000);
          for (let i = 0; i < limitScan; i++) {
            const cn = this._tagLowerCns[i];
            if (cn && cn.includes(syn)) {
              idx = i;
              break;
            }
          }
        }

        if (idx !== undefined) {
          const item = this._materializeTag(idx, false);
          if (!seen.has(item.tag)) {
            seen.add(item.tag);
            suggestions.push(item);
          }
        } else if (/^[a-z0-9_.\s-]+$/i.test(syn) && !seen.has(syn)) {
          seen.add(syn);
          suggestions.push({ tag: syn, cn_name: '', category: 'general', post_count: 0 });
        }
      }
    }

    const top = suggestions.slice(0, limit);
    return {
      input_tags: tagList,
      related_tags: top.map(s => s.tag),
      ...(compact ? { items: top.map(s => (s.cn_name ? `${s.tag} (${s.cn_name})` : s.tag)) } : { results: top })
    };
  }

  _loadArtistPresetCorpus() {
    const out = [];
    const { artistPresetsFile } = this._getPaths();
    try {
      if (!artistPresetsFile || !fs.existsSync(artistPresetsFile)) return out;
      const raw = JSON.parse(fs.readFileSync(artistPresetsFile, 'utf8'));
      const list = Array.isArray(raw) ? raw : (raw && typeof raw === 'object' ? Object.values(raw) : []);
      for (const entry of list) {
        if (!entry || typeof entry !== 'object') continue;
        const prompt = String(entry.stylePrompt || entry.prompt || '').trim();
        if (!prompt) continue;
        const name = String(entry.name || entry.group || '').trim();
        out.push({
          name,
          prompt,
          _lowerName: name.toLowerCase(),
          _lowerPrompt: prompt.toLowerCase()
        });
      }
    } catch {}
    return out;
  }

  _extractArtistTags(text) {
    const found = [];
    const tagRe = /artist:([a-zA-Z0-9_.\-&'+()/]+)/gi;
    let m;
    while ((m = tagRe.exec(text)) !== null) {
      const name = m[1].replace(/[.,;:]+$/, '');
      if (name && name.length > 1) {
        found.push(`artist:${name}`);
      }
    }
    return found;
  }

  recommendArtists(tags, options = {}) {
    this.ensureLoaded();
    const compact = Boolean(options.compact);
    const limit = Math.min(compact ? 15 : 30, Math.max(1, Number(options.limit) || 10));
    const tagList = (Array.isArray(tags) ? tags : [tags])
      .map(t => String(t || '').trim())
      .filter(Boolean);

    const baseTerms = [];
    for (const raw of tagList) {
      const lower = raw.toLowerCase();
      baseTerms.push(lower);
      if (lower.includes('_')) baseTerms.push(lower.replace(/_/g, ' '));
    }
    const searchTerms = this._collectChineseToEnglishTerms(baseTerms, 24);
    for (const t of [...searchTerms]) {
      if (t.includes(' ')) searchTerms.add(t.replace(/\s+/g, '_'));
    }

    const artistScores = new Map();
    const addScore = (artistTag, delta, sourceLabel) => {
      const prev = artistScores.get(artistTag) || { tag: artistTag, score: 0, hits: 0, sources: new Set() };
      prev.score += delta;
      prev.hits += 1;
      if (sourceLabel) prev.sources.add(sourceLabel);
      artistScores.set(artistTag, prev);
    };

    const presetCorpus = this._loadArtistPresetCorpus();
    const n = this._tagCount;
    const metaArr = this._tagMeta;
    const names = this._tagNames;
    const lowerNames = this._tagLowerNames;
    const lowerCns = this._tagLowerCns;
    const extras = this._tagExtras;

    if (searchTerms.size > 0) {
      for (const preset of presetCorpus) {
        let s = 0;
        for (const term of searchTerms) {
          if (preset._lowerName.includes(term)) s += 90;
          else if (preset._lowerPrompt.includes(term)) s += 55;
        }
        if (s > 0) {
          for (const aTag of this._extractArtistTags(preset.prompt)) {
            addScore(aTag, s, preset.name);
          }
        }
      }

      for (const entry of this._codexEntries) {
        if (!entry._lowerPrompt.includes('artist:')) continue;
        let s = 0;
        for (const term of searchTerms) {
          if (entry._lowerName.includes(term)) s += 60;
          else if (entry._lowerCat.includes(term)) s += 35;
          else if (entry._lowerPrompt.includes(term)) s += 40;
        }
        if (s > 0) {
          for (const aTag of this._extractArtistTags(entry.prompt)) {
            addScore(aTag, s, entry.codex);
          }
        }
      }

      for (let i = 0; i < n; i++) {
        if ((metaArr[i] & 0x0f) !== 1) continue;
        const lName = lowerNames[i];
        const lCn = lowerCns[i];
        const ex = extras[i];
        let s = 0;
        for (const term of searchTerms) {
          if (lName.includes(term) || (lCn && lCn.includes(term)) || (ex && ex.includes(term))) {
            s += 35;
          }
        }
        if (s > 0) {
          const rawName = names[i];
          const normalized = rawName.startsWith('artist:') ? rawName : `artist:${rawName}`;
          addScore(normalized, s, 'danbooru-csv');
        }
      }
    }

    let usedFallback = false;
    if (artistScores.size === 0) {
      usedFallback = true;
      for (const preset of presetCorpus.slice(0, 10)) {
        for (const aTag of this._extractArtistTags(preset.prompt)) {
          addScore(aTag, 10, preset.name);
        }
      }
      if (artistScores.size === 0) {
        let added = 0;
        for (let i = 0; i < n && added < limit; i++) {
          if ((metaArr[i] & 0x0f) !== 1) continue;
          const rawName = names[i];
          const normalized = rawName.startsWith('artist:') ? rawName : `artist:${rawName}`;
          addScore(normalized, 10, 'danbooru-csv');
          added++;
        }
      }
    }

    if (artistScores.size === 0) {
      return {
        query_tags: tagList,
        recommended_artists: [],
        fallback: true,
        note: 'No optional artist presets or Danbooru artist database configured.'
      };
    }

    const counts = this._tagCounts;
    const ranked = [...artistScores.values()]
      .map(item => {
        const bare = item.tag.replace(/^artist:/i, '').toLowerCase();
        const idx = this._tagIndex.get(item.tag.toLowerCase()) ?? this._tagIndex.get(bare);
        const postCount = idx !== undefined ? counts[idx] : 0;
        const totalScore = item.score + Math.log10(postCount + 10) * 5;
        return {
          tag: item.tag,
          score: Math.round(totalScore * 10) / 10,
          hits: item.hits,
          post_count: postCount,
          sources: [...item.sources].slice(0, 3)
        };
      })
      .sort((a, b) => (b.score !== a.score ? b.score - a.score : b.hits - a.hits))
      .slice(0, limit);

    return {
      query_tags: tagList,
      recommended_artists: ranked.map(a => a.tag),
      fallback: usedFallback,
      ...(compact ? {} : { details: ranked })
    };
  }

  importPackageBuffer(rawInput, filename = '') {
    let buf = Buffer.isBuffer(rawInput) ? rawInput : Buffer.from(String(rawInput || ''), 'utf8');
    if (buf.length === 0) {
      throw new Error('导入文件内容为空');
    }

    // Auto-decompress gzip (.gz / .nai5pack.gz)
    if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
      buf = zlib.gunzipSync(buf, { maxOutputLength: 256 * 1024 * 1024 });
    }

    const { dataDir, codexDir, danbooruCsv } = this._getPaths();
    fs.mkdirSync(dataDir, { recursive: true });
    fs.mkdirSync(codexDir, { recursive: true });

    const sanitizeKey = (name, fallback = 'custom_codex') => {
      const base = path.basename(String(name || ''))
        .replace(/\.(gz|nai5pack|json|csv)$/gi, '')
        .replace(/\.nai5pack$/i, '')
        .replace(/[^a-zA-Z0-9_\u4e00-\u9fa5-]+/g, '_')
        .replace(/^_+|_+$/g, '');
      return base || fallback;
    };

    const lowerName = String(filename || '').toLowerCase();
    const headSample = buf.subarray(0, 256).toString('utf8').replace(/^\uFEFF/, '').trimStart();
    const looksLikeJson = headSample.startsWith('{') || headSample.startsWith('[');
    const importedFiles = [];
    let mode = '';

    if (lowerName.endsWith('.csv') || !looksLikeJson) {
      const csvText = decodeCsvBuffer(buf);
      if (!csvText.trim()) throw new Error('CSV 词表内容为空');
      fs.mkdirSync(path.dirname(danbooruCsv), { recursive: true });
      fs.writeFileSync(danbooruCsv, csvText, 'utf8');
      importedFiles.push(danbooruCsv);
      mode = 'danbooru_csv';
    } else {
      const jsonText = buf.toString('utf8').replace(/^\uFEFF/, '');
      const parsed = JSON.parse(jsonText);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('JSON 格式无效');
      }

      if (!Array.isArray(parsed) && parsed.format === 'dsh-nai5-codex-bundle') {
        mode = 'codex_bundle';
        if (typeof parsed.danbooruCsv === 'string' && parsed.danbooruCsv.trim()) {
          fs.mkdirSync(path.dirname(danbooruCsv), { recursive: true });
          fs.writeFileSync(danbooruCsv, parsed.danbooruCsv, 'utf8');
          importedFiles.push(danbooruCsv);
        }
        if (parsed.tagZhCore && typeof parsed.tagZhCore === 'object') {
          const zhPath = path.join(codexDir, 'tag_zh', 'core.json');
          fs.mkdirSync(path.dirname(zhPath), { recursive: true });
          fs.writeFileSync(zhPath, JSON.stringify(parsed.tagZhCore), 'utf8');
          importedFiles.push(zhPath);
        }
        if (parsed.synonyms && typeof parsed.synonyms === 'object') {
          const synPath = path.join(dataDir, 'synonyms.json');
          fs.writeFileSync(synPath, JSON.stringify(parsed.synonyms, null, 2), 'utf8');
          importedFiles.push(synPath);
        }
        const titlesOut = {};
        const titlesFile = path.join(codexDir, 'codex_titles.json');
        if (fs.existsSync(titlesFile)) {
          try {
            Object.assign(titlesOut, JSON.parse(fs.readFileSync(titlesFile, 'utf8')));
          } catch {}
        }
        if (parsed.codexTitles && typeof parsed.codexTitles === 'object') {
          Object.assign(titlesOut, parsed.codexTitles);
        }
        if (Array.isArray(parsed.codexes)) {
          for (const pack of parsed.codexes) {
            if (!pack || typeof pack !== 'object') continue;
            const key = sanitizeKey(pack.key || pack.title, 'codex');
            if (pack.title) titlesOut[key] = String(pack.title);
            const dest = path.join(codexDir, `${key}.json`);
            const outObj = {
              ...(pack.title ? { title: String(pack.title) } : {}),
              ...(Array.isArray(pack.entries) ? { entries: pack.entries } : {}),
              ...(Array.isArray(pack.sheets) ? { sheets: pack.sheets } : {})
            };
            fs.writeFileSync(dest, JSON.stringify(outObj), 'utf8');
            importedFiles.push(dest);
          }
        }
        if (Object.keys(titlesOut).length > 0) {
          fs.writeFileSync(titlesFile, JSON.stringify(titlesOut, null, 2), 'utf8');
          importedFiles.push(titlesFile);
        }
      } else if (!Array.isArray(parsed) && (parsed.d || parsed.a)) {
        mode = 'tag_zh_core';
        const zhPath = path.join(codexDir, 'tag_zh', 'core.json');
        fs.mkdirSync(path.dirname(zhPath), { recursive: true });
        fs.writeFileSync(zhPath, JSON.stringify(parsed), 'utf8');
        importedFiles.push(zhPath);
      } else if (!Array.isArray(parsed) && parsed.categories && typeof parsed.categories === 'object') {
        mode = 'synonyms';
        const synPath = path.join(dataDir, 'synonyms.json');
        fs.writeFileSync(synPath, JSON.stringify(parsed, null, 2), 'utf8');
        importedFiles.push(synPath);
      } else if (Array.isArray(parsed) || parsed.entries || parsed.items || parsed.data || parsed.slides || parsed.sheets) {
        mode = 'single_codex';
        const key = sanitizeKey(filename || parsed.id || parsed.title, 'custom_codex');
        const dest = path.join(codexDir, `${key}.json`);
        fs.writeFileSync(dest, JSON.stringify(parsed), 'utf8');
        importedFiles.push(dest);
      } else {
        throw new Error('未识别的词库或法典 JSON 结构（支持 .nai5pack.gz 整合包、单本法典 JSON、core.json、synonyms.json 或 CSV）');
      }
    }

    this.reset();
    this.ensureLoaded();
    return {
      ok: true,
      mode,
      importedFilesCount: importedFiles.length,
      ...this.getCodexMeta()
    };
  }
}

export const danbooruEngine = new DanbooruEngine();
