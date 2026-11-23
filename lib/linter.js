/**
 * NovelAI Diffusion V5 Tag Linter & Sanitizer.
 * Provides defensive guards against known API syntax rejections and bounds violations.
 */

const APOSTROPHE_RE = /['’`]/g;

// Artist tags ending in digits can misparse if immediately followed by :: without separator
const ARTIST_DIGIT_RE = /artist:([a-zA-Z0-9_]+[0-9])\s*::/g;

// Multi-character indicator tokens (supports 2..22 characters in NAI V5)
const MULTI_CHAR_RE = /\b(([2-9]|1\d|2[0-2])\+?girls|([2-9]|1\d|2[0-2])\+?boys|1girl,\s*1boy|1boy,\s*1girl|multiple girls|multiple boys|group|trio|duo|everyone)\b/i;
const MULTI_GIRLS_RE = /\b(([2-9]|1\d|2[0-2])\+?girls|multiple girls)\b/i;
const MULTI_BOYS_RE = /\b(([2-9]|1\d|2[0-2])\+?boys|multiple boys)\b/i;
const MAX_PIXELS_3MP = 3145728;

const CLOTHING_TOKENS = [
  'dress', 'skirt', 'shirt', 'blouse', 'hoodie', 'sweater', 'jeans', 'pants',
  'trousers', 'shorts', 'jacket', 'coat', 'vest', 'cardigan', 'suit', 'uniform',
  'socks', 'stockings', 'pantyhose', 'shoes', 'boots', 'sneakers', 'sandals',
  'bra', 'panties', 'underwear', 'swimsuit', 'bikini', 'apron', 'leotard'
];

export function sanitizePrompt(text) {
  if (typeof text !== 'string') return '';
  let cleaned = text.replace(APOSTROPHE_RE, '');
  cleaned = cleaned.replace(ARTIST_DIGIT_RE, 'artist:$1, ::');
  cleaned = cleaned.replace(/\s+/g, ' ').replace(/,\s*,+/g, ', ').trim();
  return cleaned;
}

export function sanitizeNegativePrompt(text) {
  if (typeof text !== 'string') return '';
  let cleaned = text.replace(APOSTROPHE_RE, '');
  cleaned = cleaned.replace(ARTIST_DIGIT_RE, 'artist:$1, ::');
  cleaned = cleaned.replace(/\s+/g, ' ').replace(/,\s*,+/g, ', ').trim();
  return cleaned;
}

const ALLOWED_NOISE_SCHEDULES = new Set(['karras', 'exponential', 'polyexponential', 'native']);

export function repairV5Prompt(input = '') {
  let text = String(input || '');
  if (!text.trim()) return '';

  text = text
    .replace(/：：/g, '::')
    .replace(/，/g, ', ')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/【/g, '[')
    .replace(/】/g, ']')
    .replace(/(-?\d+(?:\.\d+)?)\s*[:：]{2}\s*([^:]*?)\s*[:：]{2}/g, (_, w, body) => {
      const cleanedBody = body.trim();
      return cleanedBody ? `${w}::${cleanedBody} ::` : '';
    });

  text = text.replace(/(-?\d+(?:\.\d+)?::[^:\n]+?)(?<!\s)::/g, '$1 ::');
  text = text.replace(/\(([a-zA-Z0-9_\s\-]+):([0-9]+(?:\.[0-9]+)?)\)/g, (_, tag, w) => `${w}::${tag.trim()} ::`);

  text = text
    .split('\n')
    .map((line) =>
      line
        .replace(/\s*,\s*/g, ', ')
        .replace(/(?:,\s*){2,}/g, ', ')
        .replace(/^\s*,\s*|\s*,\s*$/g, '')
        .trim()
    )
    .filter(Boolean)
    .join(', ');

  return text;
}

export function sanitizeParams(params = {}) {
  const p = { ...params };

  p.positivePrompt = sanitizePrompt(p.positivePrompt || p.prompt || '');
  p.negativePrompt = sanitizeNegativePrompt(p.negativePrompt || p.uc || '');
  p.stylePrompt = sanitizePrompt(p.stylePrompt || '');

  const combinedPositive = `${p.stylePrompt}, ${p.positivePrompt}`;
  const isMultiChar = MULTI_CHAR_RE.test(combinedPositive) || (Array.isArray(p.characterPrompts) && p.characterPrompts.length > 1);

  if (isMultiChar) {
    p.positivePrompt = p.positivePrompt.replace(/\bsolo\b/gi, '');
    if (MULTI_GIRLS_RE.test(combinedPositive)) {
      p.positivePrompt = p.positivePrompt.replace(/\b1girl\b/gi, '');
    }
    if (MULTI_BOYS_RE.test(combinedPositive)) {
      p.positivePrompt = p.positivePrompt.replace(/\b1boy\b/gi, '');
    }
    p.positivePrompt = p.positivePrompt.replace(/\s+/g, ' ').replace(/,\s*,+/g, ', ').replace(/^,\s*|\s*,\s*$/g, '').trim();

    const antiFusionTags = 'identical faces, merged bodies, fused limbs, conjoined twins, identical characters';
    if (!p.negativePrompt.includes('identical faces') && !p.negativePrompt.includes('conjoined twins')) {
      p.negativePrompt = p.negativePrompt ? `${p.negativePrompt}, ${antiFusionTags}` : antiFusionTags;
    }
  }

  if (/\b(completely nude|full nude)\b/i.test(combinedPositive)) {
    const clothingSet = new RegExp(`\\b(${CLOTHING_TOKENS.join('|')})\\b`, 'i');
    const cleanSegments = p.positivePrompt
      .split(',')
      .map(s => s.trim())
      .filter(seg => {
        if (!seg) return false;
        const inner = seg.replace(/^-?\d+(?:\.\d+)?::/, '').replace(/::$/, '').trim();
        return !clothingSet.test(inner);
      });
    p.positivePrompt = cleanSegments.join(', ');
  }

  if (Array.isArray(p.characterPrompts)) {
    p.characterPrompts = p.characterPrompts.slice(0, 22).map(cp => {
      const charPrompt = sanitizePrompt(cp.prompt || cp.char_caption || '');
      const charUc = sanitizeNegativePrompt(cp.uc || cp.negativePrompt || '');
      return {
        prompt: charPrompt,
        negativePrompt: charUc,
        uc: charUc,
        x: typeof cp.x === 'number' ? Math.max(0, Math.min(1, cp.x)) : 0.5,
        y: typeof cp.y === 'number' ? Math.max(0, Math.min(1, cp.y)) : 0.5,
        useCoords: cp.useCoords !== false
      };
    });
  } else {
    p.characterPrompts = [];
  }

  p.width = Math.min(3072, Math.max(64, Math.round((Number(p.width) || 832) / 64) * 64));
  p.height = Math.min(3072, Math.max(64, Math.round((Number(p.height) || 1216) / 64) * 64));
  if (p.width * p.height > MAX_PIXELS_3MP) {
    const scaleRatio = Math.sqrt(MAX_PIXELS_3MP / (p.width * p.height));
    p.width = Math.max(64, Math.floor((p.width * scaleRatio) / 64) * 64);
    p.height = Math.max(64, Math.floor((p.height * scaleRatio) / 64) * 64);
  }
  p.steps = Math.min(50, Math.max(1, Math.round(Number(p.steps) || 28)));

  const rawCfg = (p.cfgScale !== undefined && p.cfgScale !== null && p.cfgScale !== '')
    ? p.cfgScale
    : p.scale;
  const parsedCfg = Number(rawCfg);
  p.cfgScale = (rawCfg === undefined || rawCfg === null || rawCfg === '' || Number.isNaN(parsedCfg))
    ? 5.5
    : Math.min(10, Math.max(0, parsedCfg));

  const rawRescale = p.cfgRescale;
  const parsedRescale = Number(rawRescale);
  p.cfgRescale = (rawRescale === undefined || rawRescale === null || rawRescale === '' || Number.isNaN(parsedRescale))
    ? 0
    : Math.min(1, Math.max(0, parsedRescale));

  p.sampler = p.sampler || 'k_euler_ancestral';
  p.model = p.model || 'nai-diffusion-5-full';

  const rawEffort = String(p.effort || '').toLowerCase();
  p.effort = rawEffort === 'medium' || String(p.model).toLowerCase().includes('-medium') ? 'medium' : 'high';

  const rawSchedule = String(p.noiseSchedule || 'karras').toLowerCase();
  p.noiseSchedule = ALLOWED_NOISE_SCHEDULES.has(rawSchedule) ? rawSchedule : 'karras';

  p.variety = Boolean(p.variety);
  p.transparentBackground = Boolean(p.transparentBackground);

  const rawUcPreset = p.ucPreset !== undefined && p.ucPreset !== null && p.ucPreset !== '' ? Number(p.ucPreset) : 3;
  p.ucPreset = Number.isNaN(rawUcPreset) ? 3 : Math.min(4, Math.max(0, Math.round(rawUcPreset)));
  p.qualityPreset = typeof p.qualityPreset === 'string' && p.qualityPreset.trim() ? p.qualityPreset.trim() : 'none';

  const rawCount = p.count !== undefined && p.count !== null ? Number(p.count) : 1;
  p.count = Number.isNaN(rawCount) ? 1 : Math.min(8, Math.max(1, Math.round(rawCount)));

  if (p.seed === undefined || p.seed === null || p.seed === '' || Number.isNaN(Number(p.seed)) || Number(p.seed) < 0) {
    p.seed = Math.floor(Math.random() * 4294967295);
  } else {
    p.seed = Math.min(4294967295, Math.max(0, Math.round(Number(p.seed))));
  }

  return p;
}
