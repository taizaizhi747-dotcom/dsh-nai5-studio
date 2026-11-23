// Crisp Linear & Frost-Maple Vector SVG Icon System
const ICON_PATHS = {
  sakura: [
    ['path', { d: 'M12 2c1.3 2.1 2 4.2 1.4 6.2 1.9-.9 4-.6 5.9.5-1.4 1.9-3.2 3.1-5.2 3.1 1.4 1.6 1.7 3.7 1.1 5.9-2.1-.8-3.7-2.2-4.3-4.1-.6 1.9-2.2 3.3-4.3 4.1-.6-2.2-.3-4.3 1.1-5.9-2 0-3.8-1.2-5.2-3.1 1.9-1.1 4-1.4 5.9-.5-.6-2 .1-4.1 1.6-6.2z' }],
    ['circle', { cx: 12, cy: 12, r: 1.4 }]
  ],
  maple: [
    ['path', { d: 'M12 2L14 7.2L19.2 5.2L16.2 10L21.8 11.2L16.8 14.2L18.5 17.6L13.2 16.4L12 18.2L10.8 16.4L5.5 17.6L7.2 14.2L2.2 11.2L7.8 10L4.8 5.2L10 7.2Z' }],
    ['path', { d: 'M12 8.5v13.5' }]
  ],
  snowflake: [
    ['path', { d: 'M12 2v20M4.93 7l14.14 10M19.07 7L4.93 17' }],
    ['path', { d: 'M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5M5.5 10.5L8 11.5L6.5 14M18.5 10.5L16 11.5l1.5 2.5' }]
  ],
  image: [
    ['rect', { x: 3, y: 3, width: 18, height: 18, rx: 2 }],
    ['circle', { cx: 8.5, cy: 8.5, r: 1.5 }],
    ['path', { d: 'M21 15l-5-5L5 21' }]
  ],
  sun: [
    ['circle', { cx: 12, cy: 12, r: 4 }],
    ['path', { d: 'M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41' }]
  ],
  moon: [
    ['path', { d: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z' }]
  ],
  sparkles: [
    ['path', { d: 'M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z' }],
    ['path', { d: 'M5 3v4M3 5h4M19 17v4M17 19h4' }]
  ],
  grid: [
    ['rect', { x: 3, y: 3, width: 7, height: 7, rx: 1.5 }],
    ['rect', { x: 14, y: 3, width: 7, height: 7, rx: 1.5 }],
    ['rect', { x: 14, y: 14, width: 7, height: 7, rx: 1.5 }],
    ['rect', { x: 3, y: 14, width: 7, height: 7, rx: 1.5 }]
  ],
  masonry: [
    ['rect', { x: 3, y: 3, width: 7, height: 10, rx: 1.5 }],
    ['rect', { x: 14, y: 3, width: 7, height: 6, rx: 1.5 }],
    ['rect', { x: 14, y: 13, width: 7, height: 8, rx: 1.5 }],
    ['rect', { x: 3, y: 16, width: 7, height: 5, rx: 1.5 }]
  ],
  message: [
    ['path', { d: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' }]
  ],
  book: [
    ['path', { d: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20' }],
    ['path', { d: 'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z' }]
  ],
  search: [
    ['circle', { cx: 11, cy: 11, r: 7 }],
    ['path', { d: 'M20 20l-4-4' }]
  ],
  sliders: [
    ['line', { x1: 4, y1: 21, x2: 4, y2: 14 }],
    ['line', { x1: 4, y1: 10, x2: 4, y2: 3 }],
    ['line', { x1: 12, y1: 21, x2: 12, y2: 12 }],
    ['line', { x1: 12, y1: 8, x2: 12, y2: 3 }],
    ['line', { x1: 20, y1: 21, x2: 20, y2: 16 }],
    ['line', { x1: 20, y1: 12, x2: 20, y2: 3 }],
    ['line', { x1: 2, y1: 14, x2: 6, y2: 14 }],
    ['line', { x1: 10, y1: 8, x2: 14, y2: 8 }],
    ['line', { x1: 18, y1: 16, x2: 22, y2: 16 }]
  ],
  users: [
    ['path', { d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' }],
    ['circle', { cx: 9, cy: 7, r: 4 }],
    ['path', { d: 'M22 21v-2a4 4 0 0 0-3-3.87' }],
    ['path', { d: 'M16 3.13a4 4 0 0 1 0 7.75' }]
  ],
  user: [
    ['path', { d: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2' }],
    ['circle', { cx: 12, cy: 7, r: 4 }]
  ],
  palette: [
    ['circle', { cx: 13.5, cy: 6.5, r: 0.8 }],
    ['circle', { cx: 17.5, cy: 10.5, r: 0.8 }],
    ['circle', { cx: 8.5, cy: 7.5, r: 0.8 }],
    ['circle', { cx: 6.5, cy: 12.5, r: 0.8 }],
    ['path', { d: 'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.6-.7 1.6-1.6 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.7-1.6 1.6-1.6H16c3.3 0 6-2.7 6-6 0-5-4.5-9.6-10-9.6z' }]
  ],
  plus: [['path', { d: 'M12 5v14M5 12h14' }]],
  minus: [['path', { d: 'M5 12h14' }]],
  upload: [
    ['path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }],
    ['polyline', { points: '17 8 12 3 7 8' }],
    ['line', { x1: 12, y1: 3, x2: 12, y2: 15 }]
  ],
  trash: [
    ['path', { d: 'M3 6h18' }],
    ['path', { d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' }]
  ],
  copy: [
    ['rect', { x: 9, y: 9, width: 13, height: 13, rx: 2 }],
    ['path', { d: 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' }]
  ],
  folder: [
    ['path', { d: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z' }]
  ],
  chevronDown: [['path', { d: 'M6 9l6 6 6-6' }]],
  chevronUp: [['path', { d: 'M18 15l-6-6-6 6' }]],
  chevronRight: [['path', { d: 'M9 18l6-6-6-6' }]],
  chevronLeft: [['path', { d: 'M15 18l-6-6 6-6' }]],
  maximize: [['path', { d: 'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7' }]],
  minimize: [['path', { d: 'M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7' }]],
  close: [['path', { d: 'M18 6L6 18M6 6l12 12' }]],
  zap: [['polygon', { points: '13 2 3 14 12 14 11 22 21 10 12 10 13 2' }]],
  dice: [
    ['rect', { x: 3, y: 3, width: 18, height: 18, rx: 3 }],
    ['circle', { cx: 8.5, cy: 8.5, r: 1 }],
    ['circle', { cx: 15.5, cy: 8.5, r: 1 }],
    ['circle', { cx: 12, cy: 12, r: 1 }],
    ['circle', { cx: 8.5, cy: 15.5, r: 1 }],
    ['circle', { cx: 15.5, cy: 15.5, r: 1 }]
  ],
  lock: [
    ['rect', { x: 3, y: 11, width: 18, height: 11, rx: 2 }],
    ['path', { d: 'M7 11V7a5 5 0 0 1 10 0v4' }]
  ],
  eye: [
    ['path', { d: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' }],
    ['circle', { cx: 12, cy: 12, r: 3 }]
  ],
  refresh: [
    ['path', { d: 'M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8' }],
    ['path', { d: 'M3 3v5h5' }],
    ['path', { d: 'M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16' }],
    ['path', { d: 'M16 16h5v5' }]
  ],
  wand: [
    ['path', { d: 'M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8L19 13M15 9h0M17.8 6.2L19 5M3 21l9-9M12.2 6.2L11 5' }]
  ],
  code: [
    ['polyline', { points: '16 18 22 12 16 6' }],
    ['polyline', { points: '8 6 2 12 8 18' }]
  ],
  external: [
    ['path', { d: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' }],
    ['polyline', { points: '15 3 21 3 21 9' }],
    ['line', { x1: 10, y1: 14, x2: 21, y2: 3 }]
  ],
  check: [['polyline', { points: '20 6 9 17 4 12' }]],
  info: [
    ['circle', { cx: 12, cy: 12, r: 10 }],
    ['line', { x1: 12, y1: 16, x2: 12, y2: 12 }],
    ['line', { x1: 12, y1: 8, x2: 12.01, y2: 8 }]
  ]
};

function Icon({ name, size = 14, style = {} }) {
  const shapes = ICON_PATHS[name] || ICON_PATHS.sparkles;
  return h('svg', {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.85,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    style: { flex: 'none', display: 'inline-block', verticalAlign: 'middle', ...style }
  }, shapes.map(([tag, attrs], i) => h(tag, { key: i, ...attrs })));
}

const STUDIO_SCENES = [
  {
    id: 'moonblade',
    title: '朔月寒霜',
    subtitle: '玄冰冷月 · 绯枫映夜',
    tone: 'dark',
    pos: '52% 28%',
    gradient: 'radial-gradient(ellipse 90% 65% at 72% 24%, rgba(164, 212, 240, 0.22) 0%, rgba(212, 54, 72, 0.14) 36%, transparent 72%), radial-gradient(ellipse 65% 55% at 22% 78%, rgba(212, 54, 72, 0.18) 0%, rgba(28, 38, 66, 0.28) 52%, transparent 80%), linear-gradient(135deg, #0d111a 0%, #161826 48%, #1d141b 100%)'
  },
  {
    id: 'dawn-snow',
    title: '霜晓素雪',
    subtitle: '素雪朱檐 · 晨曦微明',
    tone: 'light',
    pos: '54% 24%',
    gradient: 'radial-gradient(ellipse 85% 60% at 74% 22%, rgba(212, 54, 72, 0.14) 0%, rgba(186, 152, 82, 0.10) 40%, transparent 74%), radial-gradient(ellipse 70% 55% at 20% 80%, rgba(132, 184, 214, 0.18) 0%, transparent 72%), linear-gradient(145deg, #f8f6f7 0%, #eef2f7 52%, #f9f1f2 100%)'
  },
  {
    id: 'maple-ink',
    title: '孤枫水墨',
    subtitle: '极简素韵 · 一叶惊绯',
    tone: 'both',
    pos: '60% 22%',
    gradient: 'radial-gradient(ellipse 75% 58% at 68% 28%, rgba(208, 42, 62, 0.18) 0%, rgba(155, 29, 44, 0.08) 44%, transparent 75%), radial-gradient(ellipse 80% 60% at 32% 72%, rgba(92, 112, 138, 0.14) 0%, transparent 70%), linear-gradient(150deg, rgba(160, 170, 188, 0.16) 0%, rgba(212, 54, 72, 0.08) 100%)'
  },
  {
    id: 'lantern-dusk',
    title: '雪暮金灯',
    subtitle: '金灯暖雪 · 绯袖流影',
    tone: 'both',
    pos: '56% 24%',
    gradient: 'radial-gradient(ellipse 70% 55% at 70% 26%, rgba(226, 180, 92, 0.24) 0%, rgba(212, 54, 72, 0.14) 42%, transparent 74%), radial-gradient(ellipse 75% 60% at 25% 75%, rgba(132, 178, 212, 0.14) 0%, transparent 72%), linear-gradient(135deg, rgba(44, 30, 32, 0.35) 0%, rgba(196, 136, 74, 0.12) 100%)'
  }
];

const STUDIO_PARTICLES = [
  { kind: 'maple', left: '16%', delay: '0s', dur: '16s', size: 13 },
  { kind: 'snow', left: '26%', delay: '2.2s', dur: '13s', size: 9 },
  { kind: 'maple', left: '44%', delay: '4.1s', dur: '18s', size: 11 },
  { kind: 'snow', left: '53%', delay: '1.1s', dur: '12s', size: 8 },
  { kind: 'maple', left: '66%', delay: '6.3s', dur: '15s', size: 14 },
  { kind: 'snow', left: '72%', delay: '3.6s', dur: '14s', size: 10 },
  { kind: 'maple', left: '84%', delay: '2.7s', dur: '17s', size: 12 },
  { kind: 'snow', left: '89%', delay: '5.5s', dur: '11s', size: 8 },
  { kind: 'maple', left: '94%', delay: '7.4s', dur: '16s', size: 11 },
  { kind: 'snow', left: '38%', delay: '6.8s', dur: '15s', size: 9 },
  { kind: 'snow', left: '61%', delay: '8.2s', dur: '13s', size: 7 }
];

function StudioBackdrop({ bgUrl, bgPos, bgGradient } = {}) {
  const resolvedBg = bgUrl ? `url("${bgUrl}")` : (bgGradient || '');
  const artStyle = (resolvedBg || bgPos)
    ? {
        ...(resolvedBg ? { backgroundImage: resolvedBg } : {}),
        ...(bgPos ? { backgroundPosition: bgPos } : {})
      }
    : undefined;

  return h(React.Fragment, null,
    h('div', { className: 'nai5-studio-bg-art', style: artStyle }),
    h('div', { className: 'nai5-studio-bg-veil' }),
    h('div', { className: 'nai5-studio-ukiyo-pattern' }),
    h('svg', {
      viewBox: '0 0 420 140',
      style: {
        position: 'absolute',
        right: '-6px',
        bottom: '-6px',
        width: '360px',
        height: '120px',
        zIndex: 1,
        opacity: 0.22,
        pointerEvents: 'none'
      }
    },
      h('path', { d: 'M18 122 L152 94 L274 72 L408 44', fill: 'none', stroke: 'var(--fx-gold)', strokeWidth: 1.2, strokeDasharray: '5 4' }),
      h('path', { d: 'M72 136 Q212 96 414 68', fill: 'none', stroke: 'var(--fx-ice-soft)', strokeWidth: 1.1 }),
      h('path', { d: 'M140 138 Q276 112 418 96', fill: 'none', stroke: 'var(--fx-crimson-soft)', strokeWidth: 0.9, opacity: 0.7 })
    ),
    h('div', { className: 'nai5-sakura-layer' },
      STUDIO_PARTICLES.map((p, i) =>
        h('div', {
          key: i,
          className: `nai5-petal ${p.kind === 'snow' ? 'is-snow' : 'is-maple'}`,
          style: { left: p.left, animationDelay: p.delay, animationDuration: p.dur }
        }, h(Icon, { name: p.kind === 'snow' ? 'snowflake' : 'maple', size: p.size }))
      )
    )
  );
}

function detectHostIsLight() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  const html = document.documentElement;
  const body = document.body;
  if (html) {
    const dt = (html.getAttribute('data-theme') || html.getAttribute('data-color-mode') || '').toLowerCase();
    if (dt.includes('light')) return true;
    if (dt.includes('dark')) return false;
    if (html.classList.contains('light') || html.classList.contains('theme-light')) return true;
    if (html.classList.contains('dark') || html.classList.contains('theme-dark')) return false;
  }
  if (body) {
    if (body.classList.contains('light')) return true;
    if (body.classList.contains('dark')) return false;
    try {
      const bg = window.getComputedStyle(body).backgroundColor;
      const m = bg && bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (m) {
        const lum = (Number(m[1]) * 299 + Number(m[2]) * 587 + Number(m[3]) * 114) / 1000;
        if (lum > 170) return true;
        if (lum < 85) return false;
      }
    } catch {}
  }
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
}
