import fs from 'node:fs';
import path from 'node:path';
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

const utf8Decoder = new TextDecoder('utf-8', { fatal: true });

function decodeCsvBuffer(buf) {
  try {
    return utf8Decoder.decode(buf).replace(/^\uFEFF/, '');
  } catch {
    try {
      return new TextDecoder('gbk').decode(buf);
    } catch {
      return buf.toString('utf8');
    }
  }
}

class DanbooruEngine {
  constructor() {
    this._config = {};
    this._tags = [];
    this._tagMap = new Map();
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
    this._tags = [];
    this._tagMap.clear();
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
    this._loadDanbooruCsv();
    this._loadZhCoreTranslations();
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

  _loadDanbooruCsv() {
    const { danbooruCsv } = this._getPaths();
    if (!danbooruCsv || !fs.existsSync(danbooruCsv)) return;

    try {
      const buf = fs.readFileSync(danbooruCsv);
      const text = decodeCsvBuffer(buf);
      const lines = text.split(/\r?\n/);
      const catMap = { '0': 'general', '1': 'artist', '3': 'copyright', '4': 'character' };

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        let name = '';
        let cn = '';
        let rest = [];

        if (line.includes('"')) {
          const q1 = line.indexOf('"');
          const q2 = line.indexOf('"', q1 + 1);
          if (q1 > 0 && q2 > q1) {
            name = line.substring(0, q1 - 1).trim();
            cn = line.substring(q1 + 1, q2).trim();
            rest = line.substring(q2 + 1).replace(/^,/, '').split(',');
          }
        }
        if (!name) {
          const parts = line.split(',');
          name = parts[0]?.trim() || '';
          cn = parts[1]?.trim() || '';
          rest = parts.slice(2);
        }

        if (!name) continue;

        const wiki = rest[0]?.trim() || '';
        const postCount = parseInt(rest[1] || '0', 10) || 0;
        const catCode = rest[2]?.trim() || '0';
        const category = catMap[catCode] || 'other';
        const nsfw = (rest[3]?.trim() || '0') === '1';

        const entry = {
          tag: name,
          cn_name: cn,
          category,
          post_count: postCount,
          nsfw,
          wiki,
          _lowerName: name.toLowerCase(),
          _lowerCn: cn.toLowerCase()
        };
        this._tags.push(entry);
        this._tagMap.set(entry._lowerName, entry);
      }
    } catch (err) {
      console.error('[DanbooruEngine] Failed to load optional CSV:', err?.message || err);
    }
  }

  _loadZhCoreTranslations() {
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
        { dict: zhData.d || {}, cat: 'general' },
        { dict: zhData.a || {}, cat: 'artist' }
      ];

      for (const { dict, cat } of dicts) {
        for (const [tag, cn] of Object.entries(dict)) {
          if (!tag || !cn) continue;
          const lowerTag = tag.toLowerCase().trim();
          const cleanCn = String(cn).trim();
          const existing = this._tagMap.get(lowerTag);
          if (existing) {
            if (!existing.cn_name || existing.cn_name.length < cleanCn.length) {
              existing.cn_name = cleanCn;
              existing._lowerCn = cleanCn.toLowerCase();
            }
          } else {
            const newEntry = {
              tag: tag.trim(),
              cn_name: cleanCn,
              category: cat,
              post_count: 50,
              nsfw: false,
              wiki: '',
              _lowerName: lowerTag,
              _lowerCn: cleanCn.toLowerCase()
            };
            this._tags.push(newEntry);
            this._tagMap.set(lowerTag, newEntry);
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
          const title = item.title || item.name || item.navTitle || '';
          const prompt = item.tags || item.prompt || (Array.isArray(item.prompts) ? item.prompts.join(', ') : '') || '';
          const negative = item.negative || item.uc || '';
          const pathInfo = Array.isArray(item.path) ? item.path.join(' / ') : (item.chapter || item.description || '');

          if (title || prompt) {
            const cleanPrompt = String(prompt).trim();
            const cleanTitle = String(title || friendlyName).trim();
            self._codexEntries.push({
              codexKey,
              codex: friendlyName,
              name: cleanTitle,
              prompt: cleanPrompt,
              negative: String(negative).trim(),
              category: String(pathInfo || ''),
              _lowerCodexKey: String(codexKey).toLowerCase(),
              _lowerCodex: friendlyName.toLowerCase(),
              _lowerName: cleanTitle.toLowerCase(),
              _lowerCat: String(pathInfo || '').toLowerCase(),
              _lowerPrompt: cleanPrompt.toLowerCase(),
              _isWildcard: cleanPrompt.includes('||') || cleanTitle.includes('随机') || /random/i.test(cleanTitle)
            });
            count++;
          }
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
      'strings.json',
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
      totalTags: this._tags.length,
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
    const maxLimit = compact ? 15 : 100;
    const defaultLimit = compact ? 10 : 15;
    const limit = Math.min(maxLimit, Math.max(1, Number(options.limit) || defaultLimit));
    const showNsfw = options.show_nsfw !== false;

    if (!this._tags.length) {
      return {
        prompt: '',
        results: [],
        source: 'unconfigured_optional_csv',
        query
      };
    }

    const qClean = String(query || '').trim().toLowerCase();
    const keywords = qClean.split(/[\s,，、/]+/).filter(Boolean);
    if (!keywords.length && qClean) keywords.push(qClean);

    const expandedKeywords = new Set(keywords);
    for (const k of keywords) {
      const cluster = this._synonymMap.get(k);
      if (cluster) {
        for (const syn of cluster) expandedKeywords.add(syn);
      }
    }

    const matches = [];
    for (const item of this._tags) {
      if (!showNsfw && item.nsfw) continue;
      if (category !== 'all' && item.category !== category) continue;

      const name = item._lowerName;
      const cn = item._lowerCn;
      let score = 0;

      if (qClean && (qClean === name || qClean === cn)) score += 300;
      else if (qClean && (name.includes(qClean) || cn.includes(qClean))) score += 120;

      let hits = 0;
      for (const k of expandedKeywords) {
        if (name.includes(k) || cn.includes(k)) hits++;
      }
      if (hits > 0) score += hits * 50;

      if (score > 0 || (!qClean && category !== 'all')) {
        const entry = {
          tag: item.tag,
          cn_name: item.cn_name,
          category: item.category,
          post_count: item.post_count
        };
        if ((!compact || includeWiki) && item.wiki) {
          entry.wiki = compact && item.wiki.length > 80 ? item.wiki.slice(0, 80) + '...' : item.wiki;
        }
        matches.push({ score: score || 1, post_count: item.post_count, data: entry });
      }
    }

    matches.sort((a, b) => b.score !== a.score ? b.score - a.score : b.post_count - a.post_count);
    const top = matches.slice(0, limit).map(m => m.data);
    const prompt = top.map(t => t.tag).join(', ');

    if (compact) {
      return { query, prompt, results: top };
    }

    return {
      prompt,
      results: top,
      source: `local_optional_db (${this._tags.length} tags)`,
      query
    };
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
    const searchTerms = new Set(keywords);
    for (const k of keywords) {
      const cluster = this._synonymMap.get(k);
      if (cluster) {
        for (const alias of cluster) searchTerms.add(alias.toLowerCase());
      }
      if (k.length >= 2) {
        let added = 0;
        for (const t of this._tags) {
          if (t._lowerCn && (t._lowerCn === k || t._lowerCn.includes(k))) {
            searchTerms.add(t._lowerName.replace(/_/g, ' '));
            searchTerms.add(t._lowerName);
            added++;
            if (added >= 4 || searchTerms.size >= 18) break;
          }
        }
      }
    }

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

    matches.sort((a, b) => b.score !== a.score ? b.score - a.score : a.entry.prompt.length - b.entry.prompt.length);
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

    for (const t of tagList) {
      const lower = String(t).toLowerCase().trim();
      const cluster = this._synonymMap.get(lower);
      if (cluster) {
        for (const syn of cluster) {
          if (syn === lower) continue;
          const found = this._tags.find(item => item._lowerName === syn || item._lowerCn.includes(syn));
          if (found) {
            if (!suggestions.some(s => s.tag === found.tag)) {
              suggestions.push({
                tag: found.tag,
                cn_name: found.cn_name,
                category: found.category,
                post_count: found.post_count
              });
            }
          } else if (/^[a-z0-9_.\s-]+$/i.test(syn) && !suggestions.some(s => s.tag === syn)) {
            suggestions.push({ tag: syn, cn_name: '', category: 'general', post_count: 0 });
          }
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

    const searchTerms = new Set();
    for (const raw of tagList) {
      const lower = raw.toLowerCase();
      searchTerms.add(lower);
      searchTerms.add(lower.replace(/_/g, ' '));
      const cluster = this._synonymMap.get(lower);
      if (cluster) {
        for (const syn of cluster) {
          searchTerms.add(syn);
          searchTerms.add(syn.replace(/_/g, ' '));
        }
      }
      if (lower.length >= 2) {
        let added = 0;
        for (const item of this._tags) {
          if (item._lowerCn && (item._lowerCn === lower || item._lowerCn.includes(lower))) {
            searchTerms.add(item._lowerName);
            searchTerms.add(item._lowerName.replace(/_/g, ' '));
            added++;
            if (added >= 4) break;
          }
        }
      }
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

      // Also match optional Danbooru CSV artist entries directly
      for (const item of this._tags) {
        if (item.category !== 'artist') continue;
        let s = 0;
        for (const term of searchTerms) {
          if (item._lowerName.includes(term) || item._lowerCn.includes(term)) s += 35;
        }
        if (s > 0) {
          const normalized = item.tag.startsWith('artist:') ? item.tag : `artist:${item.tag}`;
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
        const csvArtists = this._tags
          .filter(t => t.category === 'artist')
          .sort((a, b) => b.post_count - a.post_count)
          .slice(0, limit);
        for (const item of csvArtists) {
          const normalized = item.tag.startsWith('artist:') ? item.tag : `artist:${item.tag}`;
          addScore(normalized, 10, 'danbooru-csv');
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

    const ranked = [...artistScores.values()]
      .map(item => {
        const bare = item.tag.replace(/^artist:/i, '').toLowerCase();
        const tagMeta = this._tagMap.get(item.tag.toLowerCase()) || this._tagMap.get(bare);
        const postCount = tagMeta?.post_count || 0;
        const totalScore = item.score + Math.log10(postCount + 10) * 5;
        return {
          tag: item.tag,
          score: Math.round(totalScore * 10) / 10,
          hits: item.hits,
          post_count: postCount,
          sources: [...item.sources].slice(0, 3)
        };
      })
      .sort((a, b) => b.score !== a.score ? b.score - a.score : b.hits - a.hits)
      .slice(0, limit);

    return {
      query_tags: tagList,
      recommended_artists: ranked.map(a => a.tag),
      fallback: usedFallback,
      ...(compact ? {} : { details: ranked })
    };
  }
}

export const danbooruEngine = new DanbooruEngine();
