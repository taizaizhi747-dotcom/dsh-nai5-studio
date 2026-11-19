// Crisp Linear & Japanese Sakura Vector SVG Icon System
const ICON_PATHS = {
  sakura: [
    ['path', { d: 'M12 2c1.3 2.1 2 4.2 1.4 6.2 1.9-.9 4-.6 5.9.5-1.4 1.9-3.2 3.1-5.2 3.1 1.4 1.6 1.7 3.7 1.1 5.9-2.1-.8-3.7-2.2-4.3-4.1-.6 1.9-2.2 3.3-4.3 4.1-.6-2.2-.3-4.3 1.1-5.9-2 0-3.8-1.2-5.2-3.1 1.9-1.1 4-1.4 5.9-.5-.6-2 .1-4.1 1.6-6.2z' }],
    ['circle', { cx: 12, cy: 12, r: 1.4 }]
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

const SAKURA_PETALS = [
  { left: '14%', delay: '0s', dur: '14s', size: 13 },
  { left: '34%', delay: '3.5s', dur: '17s', size: 10 },
  { left: '56%', delay: '1.8s', dur: '15s', size: 14 },
  { left: '74%', delay: '5.2s', dur: '18s', size: 11 },
  { left: '88%', delay: '2.4s', dur: '13s', size: 15 },
  { left: '95%', delay: '7.0s', dur: '16s', size: 12 }
];

function StudioBackdrop() {
  return h(React.Fragment, null,
    h('div', { className: 'nai5-studio-bg-art' }),
    h('div', { className: 'nai5-studio-bg-veil' }),
    h('div', { className: 'nai5-studio-ukiyo-pattern' }),
    h('svg', {
      viewBox: '0 0 400 140',
      style: {
        position: 'absolute',
        right: '-10px',
        bottom: '-8px',
        width: '340px',
        height: '120px',
        zIndex: 1,
        opacity: 0.16,
        pointerEvents: 'none',
        color: 'var(--fx-crimson-soft)'
      }
    },
      h('path', { d: 'M20 120 Q80 60 150 105 T280 85 T390 110', fill: 'none', stroke: 'currentColor', strokeWidth: 2 }),
      h('path', { d: 'M60 135 Q130 75 200 115 T340 95 T410 125', fill: 'none', stroke: 'currentColor', strokeWidth: 1.2 })
    ),
    h('div', { className: 'nai5-sakura-layer' },
      SAKURA_PETALS.map((p, i) =>
        h('div', {
          key: i,
          className: 'nai5-petal',
          style: { left: p.left, animationDelay: p.delay, animationDuration: p.dur }
        }, h(Icon, { name: 'sakura', size: p.size }))
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
