function LightboxOverlay({
  lightboxRef,
  activeItem,
  previewIndex,
  displayedRecords,
  zoomScale,
  setZoomScale,
  panOffset,
  isPanning,
  isFullscreen,
  showInspector,
  setShowInspector,
  fullLoaded,
  setFullLoaded,
  closeLightbox,
  handlePrev,
  handleNext,
  resetZoom,
  toggleFullscreen,
  handleWheel,
  handleMouseDown,
  handleDragStart,
  sendToChatComposer,
  handleForkToWorkbench,
  copyFullParams,
  copyImageToClipboard,
  handleRevealInExplorer,
  handleDeleteImage
}) {
  if (!activeItem) return null;
  const imgPath = activeItem.source_path || activeItem.filePath || '';

  return h('div', {
    ref: lightboxRef,
    className: 'nai5-lightbox-overlay nai5-theme-dark',
    tabIndex: -1,
    onClick: (e) => { if (e.target === e.currentTarget) closeLightbox(); }
  },
    h('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 18px',
        background: 'rgba(13, 15, 22, 0.94)',
        borderBottom: '1px solid rgba(255,255,255,0.12)'
      },
      onClick: e => e.stopPropagation()
    },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
        previewIndex !== null && h('span', {
          style: {
            fontSize: '11px',
            fontWeight: 600,
            color: '#fda4af',
            background: 'rgba(209, 43, 74, 0.24)',
            border: '1px solid rgba(251, 113, 133, 0.4)',
            padding: '2px 9px',
            borderRadius: '999px'
          }
        }, `${previewIndex + 1} / ${displayedRecords.length}`),
        h('strong', { style: { fontSize: '13.5px', color: '#ffffff' } }, activeItem.character || 'NovelAI 图像'),
        h('span', { style: { fontSize: '11.5px', color: '#cbd5e1', fontFamily: 'monospace' } },
          `${activeItem.width || 832} × ${activeItem.height || 1216} · ${activeItem.steps || 28} steps · CFG ${activeItem.cfg || 5.5}`
        )
      ),
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
        h('button', {
          type: 'button',
          className: 'nai5-btn xs',
          title: '缩小画面',
          onClick: () => setZoomScale(z => Math.max(0.15, Number((z * 0.8).toFixed(2))))
        }, '−'),
        h('span', {
          style: {
            fontSize: '11.5px',
            fontWeight: 600,
            color: '#f8fafc',
            minWidth: '52px',
            textAlign: 'center',
            cursor: 'pointer',
            padding: '3px 6px',
            borderRadius: '6px',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.16)'
          },
          title: '点击重置为 100% 视图',
          onClick: resetZoom
        }, `${Math.round(zoomScale * 100)}%`),
        h('button', {
          type: 'button',
          className: 'nai5-btn xs',
          title: '放大画面',
          onClick: () => setZoomScale(z => Math.min(8, Number((z * 1.25).toFixed(2))))
        }, '+'),
        h('button', {
          type: 'button',
          className: 'nai5-btn xs',
          title: '重置缩放与平移 (1:1)',
          onClick: resetZoom
        }, '适应窗口'),
        h('button', {
          type: 'button',
          className: 'nai5-btn xs',
          title: '切换浏览器全屏 (F)',
          onClick: toggleFullscreen
        }, h(Icon, { name: 'maximize', size: 12 }), isFullscreen ? '退出全屏' : '全屏'),
        h('button', {
          type: 'button',
          className: `nai5-btn xs ${showInspector ? 'primary' : ''}`,
          onClick: () => setShowInspector(s => !s)
        },
          h(Icon, { name: 'info', size: 12 }), '参数详情 (I)'
        ),
        h('button', {
          type: 'button',
          className: 'nai5-btn danger xs',
          onClick: closeLightbox
        },
          h(Icon, { name: 'close', size: 13 }), '关闭 (Esc)'
        )
      )
    ),

    h('div', {
      style: {
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: isPanning ? 'grabbing' : 'grab'
      },
      onWheel: handleWheel,
      onMouseDown: handleMouseDown,
      onClick: e => e.stopPropagation()
    },
      previewIndex !== null && displayedRecords.length > 1 && h('button', {
        type: 'button',
        className: 'nai5-lightbox-nav-arrow prev',
        title: '上一张 (←)',
        onClick: (e) => { e.stopPropagation(); handlePrev(); }
      }, h(Icon, { name: 'chevronLeft', size: 22 })),

      h('div', {
        style: {
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          aspectRatio: `${activeItem.width || 832} / ${activeItem.height || 1216}`,
          height: (Number(activeItem.width) || 832) > (Number(activeItem.height) || 1216) ? 'auto' : 'min(82vh, 1180px)',
          width: (Number(activeItem.width) || 832) > (Number(activeItem.height) || 1216) ? 'min(82vw, 1360px)' : 'auto',
          maxHeight: '82vh',
          maxWidth: '84vw',
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`,
          transition: isPanning ? 'none' : 'transform 0.05s ease-out'
        }
      },
        h('img', {
          key: 'thumb_' + imgPath,
          src: getImageUrl(imgPath, true),
          style: {
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            borderRadius: '8px',
            boxShadow: '0 24px 64px rgba(0,0,0,0.85)',
            filter: fullLoaded ? 'none' : 'blur(1.5px)',
            opacity: fullLoaded ? 0 : 1,
            transition: 'opacity 0.22s ease-out',
            display: 'block'
          },
          draggable: false
        }),
        h('img', {
          key: 'full_' + imgPath,
          src: getImageUrl(imgPath, false),
          style: {
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            borderRadius: '8px',
            boxShadow: fullLoaded ? '0 24px 64px rgba(0,0,0,0.85)' : 'none',
            opacity: fullLoaded ? 1 : 0,
            transition: 'opacity 0.2s ease-out',
            display: 'block'
          },
          draggable: false,
          decoding: 'async',
          onLoad: () => setFullLoaded(true),
          onDoubleClick: () => (zoomScale > 1.1 ? resetZoom() : setZoomScale(2.0))
        }),
        !fullLoaded && h('div', {
          style: {
            position: 'absolute',
            bottom: '12px',
            right: '12px',
            padding: '3px 8px',
            borderRadius: '6px',
            background: 'rgba(0,0,0,0.65)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: 'var(--fx-text-primary)',
            fontSize: '10.5px',
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }
        },
          h(Icon, { name: 'sparkles', size: 10, style: { color: 'var(--fx-crimson-soft)' } }),
          '高清原图载入中...'
        )
      ),

      previewIndex !== null && displayedRecords.length > 1 && h('button', {
        type: 'button',
        className: 'nai5-lightbox-nav-arrow next',
        title: '下一张 (→)',
        onClick: (e) => { e.stopPropagation(); handleNext(); }
      }, h(Icon, { name: 'chevronRight', size: 22 })),

      showInspector && h('div', {
        style: {
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: '360px',
          background: 'rgba(14, 17, 24, 0.96)',
          borderLeft: '1px solid rgba(255,255,255,0.14)',
          padding: '16px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          zIndex: 20,
          color: '#f8fafc'
        },
        onClick: e => e.stopPropagation()
      },
        h('strong', { style: { fontSize: '13px', color: '#ffffff' } }, '完整画面生成元数据'),
        h('div', { style: { fontSize: '11px', color: '#cbd5e1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' } },
          h('span', null, `尺寸: ${activeItem.width || 832}×${activeItem.height || 1216}`),
          h('span', null, `步数: ${activeItem.steps || 28}`),
          h('span', null, `CFG: ${activeItem.cfg || 5.5}`),
          h('span', null, `Seed: ${activeItem.seed}`),
          h('span', null, `采样: ${activeItem.sampler || 'k_euler_ancestral'}`),
          h('span', null, `分框: ${(activeItem.characterPrompts || []).length} 个`)
        ),
        h('div', { className: 'nai5-card', style: { padding: '8px', background: 'rgba(24, 18, 28, 0.85)', borderColor: 'rgba(255,255,255,0.12)' } },
          h('span', { style: { fontSize: '10.5px', color: '#fb7185', fontWeight: 600 } }, '正向提示词'),
          h('div', { style: { fontSize: '11px', fontFamily: 'monospace', color: '#f8fafc', maxHeight: '140px', overflowY: 'auto' } }, activeItem.prompt)
        ),
        activeItem.uc && h('div', { className: 'nai5-card', style: { padding: '8px', background: 'rgba(24, 18, 28, 0.85)', borderColor: 'rgba(255,255,255,0.12)' } },
          h('span', { style: { fontSize: '10.5px', color: '#fca5a5', fontWeight: 600 } }, '负向排他词 (UC)'),
          h('div', { style: { fontSize: '11px', fontFamily: 'monospace', color: '#cbd5e1', maxHeight: '90px', overflowY: 'auto' } }, activeItem.uc)
        ),
        activeItem.stylePrompt && h('div', { className: 'nai5-card', style: { padding: '8px', background: 'rgba(24, 18, 28, 0.85)', borderColor: 'rgba(255,255,255,0.12)' } },
          h('span', { style: { fontSize: '10.5px', color: '#fb7185', fontWeight: 600 } }, '画风风格串'),
          h('div', { style: { fontSize: '11px', fontFamily: 'monospace', color: '#cbd5e1', maxHeight: '90px', overflowY: 'auto' } }, activeItem.stylePrompt)
        )
      )
    ),

    h('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 18px',
        background: 'rgba(13, 15, 22, 0.94)',
        borderTop: '1px solid rgba(255,255,255,0.12)'
      },
      onClick: e => e.stopPropagation()
    },
      h('span', { style: { fontSize: '11.5px', color: '#cbd5e1' } }, '滚轮无级缩放 · 按住左键平移 · 双击放大 · 键盘 ← / → 切换图像'),
      h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
        h('span', {
          className: 'nai5-btn',
          style: { cursor: 'grab' },
          draggable: true,
          onDragStart: (e) => handleDragStart(e, activeItem)
        }, h(Icon, { name: 'external', size: 12 }), '拖拽原图'),
        h('button', { type: 'button', className: 'nai5-btn primary', onClick: () => sendToChatComposer(activeItem) },
          '💬 送入对话继续演进'
        ),
        h('button', { type: 'button', className: 'nai5-btn', onClick: () => handleForkToWorkbench(activeItem) },
          h(Icon, { name: 'zap', size: 12 }), '接管至工作台 (Fork)'
        ),
        h('button', { type: 'button', className: 'nai5-btn', onClick: () => copyFullParams(activeItem) },
          h(Icon, { name: 'code', size: 12 }), '复制参数 JSON'
        ),
        h('button', { type: 'button', className: 'nai5-btn', onClick: () => copyImageToClipboard(imgPath) },
          h(Icon, { name: 'copy', size: 12 }), '复制图片'
        ),
        h('button', { type: 'button', className: 'nai5-btn', onClick: () => handleRevealInExplorer(imgPath) },
          h(Icon, { name: 'folder', size: 12 }), '本地定位'
        ),
        h('button', {
          type: 'button',
          className: 'nai5-btn danger',
          onClick: () => handleDeleteImage(activeItem)
        }, h(Icon, { name: 'trash', size: 12 }), '磁盘删除')
      )
    )
  );
}
