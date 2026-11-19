function OrbCompanionHud({
  themeClass,
  orbPos,
  openOrbHud,
  scheduleCloseOrbHud,
  showOrbHud,
  bridgeLocks,
  toggleBridgeLock,
  latestImage,
  latestThumbUrl,
  handleDragStart,
  setPreviewIndex,
  setPreviewCustomItem,
  resetZoom,
  handleForkToWorkbench,
  seedMode,
  seed,
  setSeedMode,
  setSeed,
  setBridgeLocks,
  showToast,
  sendToChatComposer,
  selectedArtistId,
  artistPresets,
  setSelectedArtistId,
  setStylePrompt,
  width,
  height,
  aspectRatio,
  handleRatioChange,
  setActiveTab,
  updateWinMode,
  totalCount,
  isBusyGenerating,
  dragRef,
  balance,
  accountInfo
}) {
  return h('div', {
    className: `nai5-orb-wrapper ${themeClass}`,
    style: { right: `${orbPos.right}px`, bottom: `${orbPos.bottom}px` },
    onMouseEnter: openOrbHud,
    onMouseLeave: scheduleCloseOrbHud
  },
    showOrbHud && h('div', {
      className: 'nai5-orb-hud',
      onClick: e => e.stopPropagation()
    },
      h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' } },
        h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 700 } },
          h(Icon, { name: 'sakura', size: 13, style: { color: 'var(--fx-crimson-soft)' } }),
          'NAI5 Studio · 对话伴侣 HUD'
        ),
        h('button', {
          type: 'button',
          className: `nai5-btn xs ${bridgeLocks.enabled ? 'primary' : ''}`,
          title: '开启后，在工作台选定的画风、画幅或 Seed 将自动注入 DSH 对话生图',
          onClick: () => toggleBridgeLock('enabled')
        }, bridgeLocks.enabled ? '🔗 已锁参数同步' : '🔓 未锁对话参数')
      ),

      latestImage && h('div', {
        style: {
          display: 'flex',
          gap: '10px',
          padding: '8px',
          borderRadius: '10px',
          background: 'var(--fx-glass-card)',
          border: '1px solid var(--fx-border-card)',
          alignItems: 'center'
        }
      },
        h('img', {
          src: latestThumbUrl,
          style: {
            width: '62px',
            height: '84px',
            objectFit: 'cover',
            borderRadius: '7px',
            border: '1px solid var(--fx-crimson-soft)',
            cursor: 'zoom-in',
            flex: 'none'
          },
          title: '点击打开全屏暗房看大图 · 按住可拖出原图',
          draggable: true,
          onDragStart: e => handleDragStart(e, latestImage),
          onClick: () => {
            setPreviewIndex(null);
            setPreviewCustomItem(latestImage);
            resetZoom();
          }
        }),
        h('div', { style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '5px' } },
          h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
            h('strong', { style: { fontSize: '11.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
              latestImage.character || '最新生图'
            ),
            h('span', { style: { fontSize: '10px', fontFamily: 'monospace', color: 'var(--fx-crimson-soft)' } },
              `s:${latestImage.seed}`
            )
          ),
          h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' } },
            h('button', {
              type: 'button',
              className: 'nai5-btn xs',
              onClick: () => {
                setPreviewIndex(null);
                setPreviewCustomItem(latestImage);
                resetZoom();
              }
            }, h(Icon, { name: 'maximize', size: 10 }), '暗房大图'),
            h('button', {
              type: 'button',
              className: 'nai5-btn primary xs',
              title: '展开工作台并载入该图全部参数，快速微调重抽',
              onClick: () => handleForkToWorkbench(latestImage, false)
            }, h(Icon, { name: 'zap', size: 10 }), '接管精修'),
            h('button', {
              type: 'button',
              className: `nai5-btn xs ${bridgeLocks.lockSeed && seedMode === 'fixed' && String(seed) === String(latestImage.seed) ? 'primary' : ''}`,
              title: '锁定这张图的 Seed 给下一轮对话生图使用',
              onClick: () => {
                setSeedMode('fixed');
                setSeed(latestImage.seed);
                setBridgeLocks(prev => {
                  const next = { ...prev, enabled: true, lockSeed: true };
                  try {
                    localStorage.setItem('dsh_nai5_bridge_locks_v1', JSON.stringify(next));
                  } catch (err) {
                    warnSilent('hud.lockSeed', err);
                  }
                  return next;
                });
                showToast(`已为对话锁定 Seed: ${latestImage.seed}`);
              }
            }, h(Icon, { name: 'lock', size: 10 }), '锁此Seed'),
            h('button', {
              type: 'button',
              className: 'nai5-btn xs',
              title: '将此图的配方送入 DSH 聊天输入框继续演进',
              onClick: () => sendToChatComposer(latestImage)
            }, '💬 续写此图')
          )
        )
      ),

      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: 'var(--fx-text-secondary)' } },
          h('span', null, '对话生图画风预设'),
          h('span', {
            style: { cursor: 'pointer', color: bridgeLocks.lockStyle ? 'var(--fx-crimson-soft)' : 'var(--fx-text-muted)', fontWeight: 600 },
            onClick: () => toggleBridgeLock('lockStyle')
          }, bridgeLocks.lockStyle ? '● 已锁定画风' : '○ 跟随AI默认')
        ),
        h('select', {
          className: 'nai5-select',
          style: { fontSize: '11px', padding: '5px 8px' },
          value: selectedArtistId,
          disabled: artistPresets.length === 0,
          onChange: e => {
            const p = artistPresets.find(a => a.id === e.target.value);
            if (p) {
              setSelectedArtistId(p.id);
              setStylePrompt(p.prompt);
              setBridgeLocks(prev => ({ ...prev, enabled: true, lockStyle: true }));
              showToast(`对话画风已切至: ${p.name}`);
            }
          }
        },
          artistPresets.length === 0
            ? h('option', { value: '' }, '未配置画师预设（工作台可导入）')
            : artistPresets.map(p => h('option', { key: p.id, value: p.id }, p.name))
        )
      ),

      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: 'var(--fx-text-secondary)' } },
          h('span', null, `对话画幅 (${width}×${height})`),
          h('span', {
            style: { cursor: 'pointer', color: bridgeLocks.lockAspect ? 'var(--fx-crimson-soft)' : 'var(--fx-text-muted)', fontWeight: 600 },
            onClick: () => toggleBridgeLock('lockAspect')
          }, bridgeLocks.lockAspect ? '● 已锁定画幅' : '○ 跟随AI默认')
        ),
        h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px' } },
          ['2:3', '3:2', '1:1', '9:16', '16:9'].map(r =>
            h('button', {
              key: r,
              type: 'button',
              className: `nai5-btn xs ${aspectRatio === r ? 'primary' : ''}`,
              onClick: () => {
                handleRatioChange(r);
                setBridgeLocks(prev => ({ ...prev, enabled: true, lockAspect: true }));
              }
            }, r)
          )
        )
      ),

      h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '5px', paddingTop: '2px', borderTop: '1px solid var(--fx-border-subtle)' } },
        h('button', {
          type: 'button',
          className: 'nai5-btn xs',
          onClick: () => { setActiveTab('studio'); updateWinMode('open'); }
        }, h(Icon, { name: 'sakura', size: 11 }), '绘卷工坊'),
        h('button', {
          type: 'button',
          className: 'nai5-btn xs',
          onClick: () => { setActiveTab('gallery'); updateWinMode('open'); }
        }, h(Icon, { name: 'grid', size: 11 }), `画廊(${totalCount || 0})`),
        h('button', {
          type: 'button',
          className: 'nai5-btn xs',
          onClick: () => { setActiveTab('codex'); updateWinMode('open'); }
        }, h(Icon, { name: 'book', size: 11 }), '查词库')
      )
    ),

    h('div', {
      className: `nai5-floating-orb ${isBusyGenerating ? 'agent-generating' : ''}`,
      title: '悬停呼出对话伴侣 HUD · 点击展开工作台 (Alt+N) · 按住可拖拽位置',
      onMouseDown: (e) => {
        if (e.button !== 0) return;
        dragRef.current = {
          mode: 'orb',
          startX: e.clientX,
          startY: e.clientY,
          origRight: orbPos.right,
          origBottom: orbPos.bottom,
          moved: false
        };
      },
      onClick: () => {
        if (dragRef.current && dragRef.current.moved) return;
        updateWinMode('open');
      }
    },
      h('div', {
        className: 'nai5-orb-avatar',
        style: latestThumbUrl ? {
          backgroundImage: `url("${latestThumbUrl}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center top'
        } : undefined
      }),
      h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 700, color: 'var(--fx-text-primary)', letterSpacing: '0.02em' } },
        h(Icon, { name: 'sakura', size: 13, style: { color: 'var(--fx-crimson-soft)' } }),
        isBusyGenerating ? 'AI 绘卷渲染中...' : (bridgeLocks.enabled ? 'NAI5 · 已锁同步' : 'NAI5 Studio')
      ),
      (accountInfo.configured === false
        ? h('span', {
            style: {
              fontSize: '10.5px',
              padding: '1px 7px',
              borderRadius: '999px',
              background: 'rgba(224, 40, 79, 0.14)',
              border: '1px solid rgba(224, 40, 79, 0.3)',
              color: 'var(--fx-crimson-soft)',
              fontWeight: 600
            }
          }, '未配置')
        : (balance !== null || !accountInfo.balanceSupported) && h('span', {
            style: {
              fontSize: '10.5px',
              padding: '1px 7px',
              borderRadius: '999px',
              background: 'rgba(224, 40, 79, 0.14)',
              border: '1px solid rgba(224, 40, 79, 0.3)',
              color: 'var(--fx-crimson-soft)',
              fontWeight: 600
            }
          }, accountInfo.balanceSupported === false ? '中转' : `${balance}`))
    )
  );
}
