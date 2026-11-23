const _warnHistory = new Map();

function warnSilent(scope, err) {
  try {
    const now = Date.now();
    const last = _warnHistory.get(scope) || 0;
    if (now - last < 3000) return;
    _warnHistory.set(scope, now);
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
      console.warn(`[NAI5:${scope}]`, err?.message || err);
    }
  } catch {
    // Console unavailable
  }
}

function getImageUrl(imgPath, thumb = false) {
  if (!imgPath) return '';
  return `/api/novelai/image?path=${encodeURIComponent(imgPath)}${thumb ? '&thumb=1' : ''}`;
}

function calculateDimensions(tier, ratioStr) {
  if (tier === 'custom') return null;
  const lr = [0.4, 1, 1.5, 2, 3];
  if (!lr.includes(tier)) return null;
  const parts = ratioStr.split(':').map(Number);
  const r = parts[0] / parts[1];
  if (parts.length !== 2 || !Number.isFinite(r) || r < 1 / 768 || r > 768) return null;
  const maxPixels = Math.min(3145728, tier === 0.4 ? 409600 : Math.round(tier * 1024 * 1024));
  let best = { width: 832, height: 1216 };
  let minScore = Infinity;
  for (let w = 64; w <= maxPixels / 64; w += 64) {
    const hApprox = w / r;
    for (const h of [
      Math.floor(hApprox / 64) * 64,
      Math.ceil(hApprox / 64) * 64,
      Math.floor(maxPixels / w / 64) * 64,
      Math.floor(hApprox * Math.exp(0.079) / 64) * 64,
      Math.ceil(hApprox * Math.exp(-0.079) / 64) * 64
    ]) {
      if (h < 64 || w * h > maxPixels) continue;
      const ratioDiff = Math.abs(Math.log(w / h / r));
      const score = (w * h >= maxPixels * 0.8 && ratioDiff < 0.08 ? 0 : 100) + 4 * ratioDiff + Math.abs(Math.log(w * h / maxPixels));
      if (score < minScore) {
        minScore = score;
        best = { width: w, height: h };
      }
    }
  }
  return best;
}

function estimateAnlasCost(w, h, steps) {
  const pixels = (Number(w) || 832) * (Number(h) || 1216);
  const st = Number(steps) || 28;
  if (pixels <= 1048576 && st <= 28) {
    return { cost: 0, free: true, label: '0 Anlas · Opus 免费' };
  }
  const ratio = Math.max(1, pixels / (832 * 1216));
  const est = Math.max(2, Math.round(20 * ratio * (st / 28)));
  return { cost: est, free: false, label: `约 ${est} Anlas` };
}

function adjustPromptWeight(text, textareaEl, delta) {
  if (!text) return text;
  let start = textareaEl ? textareaEl.selectionStart : 0;
  let end = textareaEl ? textareaEl.selectionEnd : 0;

  if (start === end) {
    const leftComma = text.lastIndexOf(',', start - 1);
    const rightComma = text.indexOf(',', start);
    start = leftComma === -1 ? 0 : leftComma + 1;
    end = rightComma === -1 ? text.length : rightComma;
  }

  const before = text.slice(0, start);
  const rawSeg = text.slice(start, end);
  const after = text.slice(end);
  const trimmed = rawSeg.trim();
  if (!trimmed) return text;

  const leadSpace = rawSeg.match(/^\s*/)[0];
  const trailSpace = rawSeg.match(/\s*$/)[0];

  const weightMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)::(.*)::$/s);
  let nextStr;
  if (weightMatch) {
    const curW = parseFloat(weightMatch[1]);
    const inner = weightMatch[2];
    const nextW = Math.round((curW + delta) * 10) / 10;
    if (Math.abs(nextW - 1.0) < 0.01 || Math.abs(nextW) < 0.01) {
      nextStr = inner;
    } else {
      nextStr = `${nextW}::${inner}::`;
    }
  } else {
    const initW = delta > 0 ? 1.1 : (delta < -0.5 ? -1 : 0.9);
    nextStr = `${initW}::${trimmed}::`;
  }

  return `${before}${leadSpace}${nextStr}${trailSpace}${after}`;
}

function formatPromptText(text) {
  if (!text) return '';
  return text
    .replace(/，/g, ', ')
    .replace(/['’`]/g, '')
    .replace(/artist:([a-zA-Z0-9_]+[0-9])\s*::/g, 'artist:$1, ::')
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/(,\s*)+/g, ', ')
    .replace(/^,\s*|\s*,\s*$/g, '')
    .trim();
}

function formatCodexFullText(entry) {
  if (!entry || typeof entry !== 'object') return '';
  const globalText = String(entry.globalPrompt !== undefined ? entry.globalPrompt : (entry.prompt || '')).trim();
  const chars = Array.isArray(entry.characterPrompts) ? entry.characterPrompts : [];
  if (!chars.length) return globalText || String(entry.prompt || '').trim();
  const charLines = chars
    .map((cp, idx) => {
      const lbl = String(cp?.label || `char${idx + 1}`).trim();
      const pr = String(cp?.prompt || cp?.char_caption || '').trim();
      const uc = String(cp?.negative || cp?.uc || cp?.negativePrompt || '').trim();
      if (!pr && !uc) return '';
      return `[${lbl}] ${pr}${uc ? ` (UC: ${uc})` : ''}`;
    })
    .filter(Boolean);
  if (!charLines.length) return globalText || String(entry.prompt || '').trim();
  return globalText ? `${globalText}\n${charLines.join('\n')}` : charLines.join('\n');
}
