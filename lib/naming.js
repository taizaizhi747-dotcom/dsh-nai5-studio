import fs from 'node:fs';
import { getCharacterRulesFile } from './paths.js';

const TOPIC_RULES = [
  { slug: '窗边', match: /(windowsill|window.*sunlight|by the window|lattice.*window|窗边|倚窗)/i },
  { slug: '旗袍', match: /\b(cheongsam|qipao|china dress)\b|旗袍/i },
  { slug: '汉服', match: /\bhanfu\b|汉服|襦裙/i },
  { slug: '和服', match: /\b(kimono|yukata|furisode)\b|和服|浴衣/i },
  { slug: '女仆装', match: /\b(maid outfit|maid apron|french maid|maid headdress)\b|女仆/i },
  { slug: '兔女郎', match: /\b(bunny girl|bunny suit|playboy bunny)\b|兔女郎/i },
  { slug: '校园', match: /\b(school uniform|serafuku|sailor uniform|classroom|rooftop)\b|校服|校园/i },
  { slug: '泳装', match: /\b(bikini|swimsuit|school swimsuit|sukumizu)\b|泳装|比基尼/i },
  { slug: '夜景', match: /\b(night sky|city lights|neon lights|moonlight)\b|夜景|夜色|月夜/i },
  { slug: '樱花', match: /\b(cherry blossoms|sakura)\b|樱花/i },
  { slug: '奇幻', match: /\b(magic circle|fantasy|witch|knight|dragon|elf)\b|魔法|奇幻/i },
  { slug: '立绘', match: /\b(cowboy shot|upper body|full body|standing|solo|portrait)\b/i }
];

const rulesCache = new Map();

export function loadUserCharacterRules(config = {}) {
  const filePath = getCharacterRulesFile(config);
  try {
    if (!fs.existsSync(filePath)) return [];
    const stat = fs.statSync(filePath);
    const cached = rulesCache.get(filePath);
    if (cached && cached.mtimeMs === stat.mtimeMs) {
      return cached.rules;
    }

    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!Array.isArray(parsed)) return [];

    const rules = [];
    for (const item of parsed) {
      if (!item || !item.name || !item.pattern) continue;
      try {
        rules.push({
          name: String(item.name).trim(),
          match: new RegExp(String(item.pattern), 'i')
        });
      } catch (err) {
        console.warn(`[Naming] Invalid regex pattern for rule "${item.name}":`, err?.message || err);
      }
    }
    rulesCache.set(filePath, { mtimeMs: stat.mtimeMs, rules });
    return rules;
  } catch (err) {
    console.warn('[Naming] Failed loading optional character_rules.json:', err?.message || err);
    return [];
  }
}

/**
 * Generates structured, self-documenting filenames and character folders:
 * <outputDir>/YYYY-MM-DD/[character]/[HHMMSS]_[character]_[topic]_[rating]_[styleCode]_[sSeed].png
 */
export function resolveImageNaming(params = {}, seed, now = new Date(), config = {}) {
  const charPositives = Array.isArray(params.characterPrompts)
    ? params.characterPrompts.map(c => c?.prompt || c?.char_caption || '').filter(Boolean).join(' ')
    : '';
  const positive = `${params.stylePrompt || ''} ${params.positivePrompt || params.prompt || ''} ${charPositives}`.trim();

  // 1. Detect character folder from explicit parameter or optional user rules
  let charName = params.character || params.char || '';
  if (!charName) {
    const userRules = loadUserCharacterRules(config);
    const matchedChars = [];
    for (const rule of userRules) {
      if (rule.match.test(positive)) {
        matchedChars.push(rule.name);
      }
    }
    if (matchedChars.length === 1) {
      charName = matchedChars[0];
    } else if (matchedChars.length >= 2) {
      charName = matchedChars.slice(0, 2).join('x');
    } else if (params.fileNamePrefix) {
      charName = String(params.fileNamePrefix).split('_')[0];
    } else {
      charName = '综合创作';
    }
  }
  charName = String(charName).replace(/[\\/:*?"<>|,\s_]+/g, '').replace(/\.+/g, '').slice(0, 24) || '综合创作';

  // 2. Detect topic / scene slug
  let topic = params.topic || params.title || '';
  if (!topic) {
    if (params.fileNamePrefix && params.fileNamePrefix !== charName) {
      topic = String(params.fileNamePrefix).replace(/^[^_]+_/, '');
    } else {
      for (const rule of TOPIC_RULES) {
        if (rule.match.test(positive)) {
          topic = rule.slug;
          break;
        }
      }
      if (!topic) topic = '立绘';
    }
  }
  topic = String(topic).replace(/[\\/:*?"<>|,\s_]+/g, '').slice(0, 10) || '立绘';

  // 3. Neutral rating classification
  let rating = params.rating || '';
  if (!rating) {
    const isMildMature = /\b(bikini|lingerie|swimsuit|underwear)\b/i.test(positive);
    rating = isMildMature ? 'R18' : 'Safe';
  }

  // 4. Style code (explicit only, neutral default 'custom')
  let styleCode = 'custom';
  if (params.style !== undefined && params.style !== null && String(params.style).trim() !== '') {
    const s = String(params.style).trim().replace(/^s/i, '');
    styleCode = `S${/^\d+$/.test(s) ? s.padStart(2, '0') : s.slice(0, 8)}`;
  }

  // 5. Date & time components
  const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  const dateDir = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const rawSuffix = params.suffix ? String(params.suffix).replace(/[^a-zA-Z0-9-]+/g, '') : '';
  const suffixPart = rawSuffix ? `_${rawSuffix}` : '';
  const filename = `${timeStr}_${charName}_${topic}_${rating}_${styleCode}_s${seed}${suffixPart}.png`;

  return {
    dateDir,
    charDir: charName,
    filename,
    character: charName,
    topic,
    rating,
    styleCode
  };
}
