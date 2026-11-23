// Singleton Host to ensure only one Floating Window / Floating Orb renders globally
const hostRegistry = new Set();
let activePortalHostId = null;

function GlobalFloatingHost({ CSS_STYLES }) {
  const instanceId = useRef('host_' + Math.random().toString(36).slice(2)).current;
  const [isPrimary, setIsPrimary] = useState(false);

  useEffect(() => {
    const entry = { id: instanceId, setIsPrimary };
    hostRegistry.add(entry);
    if (!activePortalHostId) {
      activePortalHostId = instanceId;
      setIsPrimary(true);
    }
    return () => {
      hostRegistry.delete(entry);
      if (activePortalHostId === instanceId) {
        activePortalHostId = null;
        const next = hostRegistry.values().next().value;
        if (next) {
          activePortalHostId = next.id;
          next.setIsPrimary(true);
        }
      }
    };
  }, [instanceId]);

  if (!isPrimary) return null;
  return renderPortal(h(NovelAiFloatingStudio, { CSS_STYLES }));
}

function NovelAiSidebarBody({ CSS_STYLES }) {
  const isLight = detectHostIsLight();
  return h('div', {
    className: `nai5-sidebar-launchpad ${isLight ? 'nai5-theme-light' : 'nai5-theme-dark'}`,
    style: {
      height: '100%',
      padding: '20px 16px',
      background: 'transparent',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px'
    }
  },
    h(GlobalFloatingHost, { CSS_STYLES }),
    h('div', { className: 'nai5-card', style: { padding: '16px', gap: '12px' } },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
        h('div', { className: 'nai5-hanko-seal' }, 'N5'),
        h('div', null,
          h('div', { style: { fontSize: '13px', fontWeight: 700, color: 'var(--fx-text-primary)' } }, 'NAI5 Studio · 枫霜工坊'),
          h('div', { style: { fontSize: '11px', color: 'var(--fx-text-muted)' } }, '独立毛玻璃悬浮窗 · 枫霜金石美学 · 随系统自适应')
        )
      ),
      h('div', { style: { fontSize: '11.5px', color: 'var(--fx-text-secondary)', lineHeight: 1.6 } },
        '点击屏幕右下角「NAI5 Studio」悬浮球或按快捷键 Alt + N 即可展开工作台。'
      ),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' } },
        h('button', {
          type: 'button',
          className: 'nai5-btn primary',
          style: { padding: '9px', justifyContent: 'center' },
          onClick: () => studioBus.emit({ type: 'OPEN', tab: 'studio' })
        }, h(Icon, { name: 'maple', size: 13 }), '展开 NAI5 Studio 工坊 (Alt+N)'),
        h('button', {
          type: 'button',
          className: 'nai5-btn',
          style: { padding: '8px', justifyContent: 'center' },
          onClick: () => studioBus.emit({ type: 'OPEN', tab: 'gallery' })
        }, h(Icon, { name: 'grid', size: 13 }), '打开宽屏典藏画廊'),
        h('button', {
          type: 'button',
          className: 'nai5-btn',
          style: { padding: '8px', justifyContent: 'center' },
          onClick: () => studioBus.emit({ type: 'CENTER' })
        }, h(Icon, { name: 'maximize', size: 13 }), '居中重置悬浮窗位置')
      )
    )
  );
}

function NovelAiSidebarTitle({ CSS_STYLES }) {
  return h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '6px' } },
    h(GlobalFloatingHost, { CSS_STYLES }),
    h(Icon, { name: 'maple', size: 13, style: { color: '#D4243D' } }),
    h('span', null, 'NAI5 Studio')
  );
}

function InvisibleFloatingMount(props) {
  const { CSS_STYLES } = props || {};
  useEffect(() => {
    dshComposerBridge.bindSlotProps(props);
  }, [props]);
  return h(GlobalFloatingHost, { CSS_STYLES });
}

return {
  name: 'dsh-nai5-studio',
  apply(ctx) {
    try {
      if (typeof ctx.inject === 'function') {
        ctx.inject(['slots'], (uiCtx) => {
          try {
            uiCtx.slots.inject('shell.overlay', () => uiCtx.slots.register({
              name: 'shell.overlay',
              id: 'nai5-floating-studio-host',
              order: 45
            }, () => h(GlobalFloatingHost, { CSS_STYLES })));

            uiCtx.slots.inject('conversation.composer.dock', () => uiCtx.slots.register({
              name: 'conversation.composer.dock',
              id: 'nai5-composer-dock',
              order: 5
            }, (slotProps) => h(InvisibleFloatingMount, { ...slotProps, CSS_STYLES })));
          } catch (e) {
            console.warn('[NAI5] slots mount error:', e);
          }
        });

        ctx.inject(['sidebarRightTabs', 'slots'], (uiCtx) => {
          try {
            uiCtx.sidebarRightTabs.register({
              id: TAB_ID,
              kind: TAB_KIND,
              priority: 'user',
              title: () => 'NAI5 Studio',
              guide: [{
                id: 'novelai-workbench',
                commandId: 'novelai.workbench',
                order: 5,
                title: () => 'NAI5 Studio · 枫霜工作台',
                description: () => '枫霜浮世绘毛玻璃背景、金线菱格纹纱、2D 角色站位与高清画廊',
                icon: () => h(Icon, { name: 'maple', size: 22, style: { color: '#D4243D' } })
              }]
            });
            uiCtx.slots.inject('sidebar.right.pane.tab', () => uiCtx.slots.register({
              name: 'sidebar.right.pane.tab',
              key: TAB_ID
            }, () => h(NovelAiSidebarBody, { CSS_STYLES })));
            uiCtx.slots.inject('sidebar.right.pane.tab.title', () => uiCtx.slots.register({
              name: 'sidebar.right.pane.tab.title',
              key: TAB_ID
            }, () => h(NovelAiSidebarTitle, { CSS_STYLES })));
          } catch (e) {
            console.warn('[NAI5] sidebar tab registration error:', e);
          }
        });

        try {
          ctx.inject(['sessions', 'uiWorkspace', 'conversation'], (hostCtx) => {
            dshComposerBridge.bindHost(hostCtx);
          });
        } catch {
          try {
            ctx.inject(['sessions', 'conversation'], (hostCtx) => {
              dshComposerBridge.bindHost(hostCtx);
            });
          } catch (e2) {
            warnSilent('entry.bindHost', e2);
          }
        }
      }
    } catch (err) {
      console.warn('[NAI5] plugin apply error:', err);
    }
  }
};
