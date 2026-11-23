function GalleryView({
  history,
  totalCount,
  loadingHistory,
  loadingMore,
  hasMore,
  gridDensity,
  setGridDensity,
  galleryLayout,
  setGalleryLayout,
  filterChar,
  filterMonth,
  filterRating,
  filterTopic,
  filterFavorites,
  gallerySearch,
  setGallerySearch,
  galleryMeta,
  applyFilter,
  onRefreshGallery,
  onBackfillMetadata,
  onLoadMore,
  onToggleFavorite,
  onBatchMove,
  onBatchDelete,
  onSendToImg2Img,
  onSendToInpaint,
  onOpenPreview,
  onDragStart,
  onCopyImage,
  onRevealInExplorer,
  onForkToWorkbench,
  onSendToChat,
  onSetAsBackdrop,
  onCopyText
}) {
  const wrapRef = useRef(null);
  const hostRef = useRef(null);
  const [hostWidth, setHostWidth] = useState(960);
  const [scrollState, setScrollState] = useState({ top: 0, height: 720 });
  const scrollRafRef = useRef(false);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState([]);
  const [batchTargetChar, setBatchTargetChar] = useState('');
  const [expandChars, setExpandChars] = useState(false);
  const [showManageMenu, setShowManageMenu] = useState(false);
  const manageMenuRef = useRef(null);

  useEffect(() => {
    if (!showManageMenu) return;
    const onDown = (e) => {
      if (manageMenuRef.current && !manageMenuRef.current.contains(e.target)) {
        setShowManageMenu(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [showManageMenu]);

  const selectedSet = React.useMemo(() => new Set(selectedPaths), [selectedPaths]);
  const toggleSelectPath = useCallback((p) => {
    if (!p) return;
    setSelectedPaths(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  }, []);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (w > 80) setHostWidth(w);
      if (wrapRef.current) {
        setScrollState(prev => ({
          top: wrapRef.current.scrollTop || 0,
          height: wrapRef.current.clientHeight || prev.height
        }));
      }
    };
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [galleryLayout, gridDensity]);

  const handleScroll = useCallback((e) => {
    const target = e.currentTarget;
    if (scrollRafRef.current) return;
    scrollRafRef.current = true;
    requestAnimationFrame(() => {
      scrollRafRef.current = false;
      if (!target) return;
      const top = target.scrollTop;
      const clientH = target.clientHeight;
      const scrollH = target.scrollHeight;
      setScrollState({ top, height: clientH });
      if (scrollH - (top + clientH) < 520) {
        if (hasMore && !loadingHistory && !loadingMore) {
          onLoadMore();
        }
      }
    });
  }, [hasMore, loadingHistory, loadingMore, onLoadMore]);

  const renderCard = (item, idx, extraStyle = null, isMasonry = false) => {
    const imgPath = item.source_path || item.filePath || '';
    const charLabel = item.character || '综合创作';
    const w = Number(item.width) || 832;
    const hVal = Number(item.height) || 1216;
    const isNonPortrait = Math.abs(w / hVal - 832 / 1216) > 0.08;
    const isSelected = batchMode && selectedSet.has(imgPath);

    return h('div', {
      key: item.task_id || imgPath || idx,
      className: `nai5-gallery-card ${isMasonry ? 'masonry-item' : ''} ${isSelected ? 'is-selected' : ''}`,
      style: extraStyle || undefined,
      draggable: !batchMode,
      onDragStart: (e) => !batchMode && onDragStart(e, item),
      onClick: () => (batchMode ? toggleSelectPath(imgPath) : onOpenPreview(idx))
    },
      h('div', {
        className: `nai5-gallery-media ${isMasonry ? 'natural' : ''}`,
        style: isMasonry ? { aspectRatio: `${w} / ${hVal}` } : undefined
      },
        h('img', {
          src: getImageUrl(imgPath, true),
          className: 'nai5-gallery-thumb',
          loading: 'lazy',
          decoding: 'async',
          draggable: !batchMode,
          onDragStart: (e) => !batchMode && onDragStart(e, item)
        }),
        batchMode && h('span', { className: `nai5-gallery-check ${isSelected ? 'checked' : ''}` }, isSelected ? '✓' : ''),
        isNonPortrait && !batchMode && h('span', { className: 'nai5-gallery-ratio-tag' }, `${w}×${hVal}`),
        h('div', {
          className: 'nai5-gallery-top-tools',
          onClick: e => e.stopPropagation()
        },
          h('button', {
            type: 'button',
            className: `nai5-gallery-icon-btn nai5-fav-btn ${item.isFavorite ? 'is-fav' : ''}`,
            title: item.isFavorite ? '取消收藏' : '加入收藏夹',
            onClick: () => onToggleFavorite && onToggleFavorite(imgPath)
          }, item.isFavorite ? '★' : '☆'),
          onSetAsBackdrop && h('button', {
            type: 'button',
            className: 'nai5-gallery-icon-btn',
            title: '设为工坊背景画卷',
            onClick: () => onSetAsBackdrop(item)
          }, h(Icon, { name: 'image', size: 12 })),
          h('button', {
            type: 'button',
            className: 'nai5-gallery-icon-btn',
            title: '复制图像到剪贴板',
            onClick: () => onCopyImage(imgPath)
          }, h(Icon, { name: 'copy', size: 12 })),
          h('button', {
            type: 'button',
            className: 'nai5-gallery-icon-btn',
            title: '在文件管理器中定位原图',
            onClick: () => onRevealInExplorer(imgPath)
          }, h(Icon, { name: 'folder', size: 12 }))
        ),
        !batchMode && h('div', {
          className: 'nai5-gallery-hover-dock',
          onClick: e => e.stopPropagation()
        },
          h('button', {
            type: 'button',
            className: 'nai5-gallery-dock-btn primary',
            title: '一键回灌全部参数与多角色框到工作台精修',
            onClick: () => onForkToWorkbench(item)
          }, h(Icon, { name: 'zap', size: 11 }), '精修'),
          onSendToImg2Img && h('button', {
            type: 'button',
            className: 'nai5-gallery-dock-btn',
            title: '送入图生图模式微调',
            onClick: () => onSendToImg2Img(item)
          }, '图生图'),
          onSendToInpaint && h('button', {
            type: 'button',
            className: 'nai5-gallery-dock-btn',
            title: '送入局部重绘 (Inpaint) 涂抹修改',
            onClick: () => onSendToInpaint(item)
          }, '重绘'),
          h('button', {
            type: 'button',
            className: 'nai5-gallery-dock-btn',
            title: '推送此图片与配方到 DSH 对话输入框继续续写下一幕',
            onClick: () => onSendToChat(item)
          }, '💬')
        )
      ),
      h('div', { className: 'nai5-gallery-meta' },
        h('span', { className: 'nai5-gallery-char', title: charLabel }, charLabel),
        h('span', {
          className: 'nai5-gallery-seed',
          title: '点击复制 Seed',
          onClick: (e) => {
            e.stopPropagation();
            onCopyText(String(item.seed || ''), `Seed: ${item.seed}`);
          }
        }, `#${item.seed}`)
      )
    );
  };

  // Compute virtualized natural-aspect masonry geometry
  const masonryLayout = React.useMemo(() => {
    if (galleryLayout !== 'masonry') return null;
    const minCardW = gridDensity === 'large' ? 235 : (gridDensity === 'compact' ? 142 : 184);
    const gap = gridDensity === 'large' ? 16 : (gridDensity === 'compact' ? 10 : 13);
    const cols = Math.max(2, Math.floor((hostWidth + gap) / (minCardW + gap)));
    const colW = Math.max(110, (hostWidth - gap * (cols - 1)) / cols);
    const colHeights = new Array(cols).fill(0);
    const footerH = 36;
    const positions = new Array(history.length);

    for (let i = 0; i < history.length; i++) {
      const item = history[i];
      const w = Math.max(64, Number(item.width) || 832);
      const hVal = Math.max(64, Number(item.height) || 1216);
      const mediaH = Math.round(colW * (hVal / w));
      const cardH = mediaH + footerH;

      let shortestCol = 0;
      for (let c = 1; c < cols; c++) {
        if (colHeights[c] < colHeights[shortestCol]) shortestCol = c;
      }

      const x = shortestCol * (colW + gap);
      const y = colHeights[shortestCol];
      positions[i] = { x, y, w: colW, h: cardH };
      colHeights[shortestCol] = y + cardH + gap;
    }

    const totalHeight = Math.max(240, Math.max(...colHeights, 0));
    const viewTop = Math.max(0, scrollState.top - 700);
    const viewBottom = scrollState.top + scrollState.height + 900;

    const visibleIndices = [];
    for (let i = 0; i < positions.length; i++) {
      const p = positions[i];
      if (p.y + p.h >= viewTop && p.y <= viewBottom) {
        visibleIndices.push(i);
      }
    }
    return { totalHeight, positions, visibleIndices };
  }, [galleryLayout, gridDensity, hostWidth, history, scrollState.top, scrollState.height]);

  return h('div', { ref: wrapRef, className: 'nai5-gallery-wrap', onScroll: handleScroll },
    h('div', { className: 'nai5-card nai5-gallery-toolbar-card', style: { gap: '10px', flex: 'none' } },
      // Character Pills (no shrinking; collapsible full character list)
      h('div', { className: `nai5-char-pills-row ${expandChars ? 'is-expanded' : ''}` },
        h('button', {
          type: 'button',
          className: `nai5-btn xs ${filterChar === 'all' && !filterFavorites ? 'primary' : ''}`,
          onClick: () => applyFilter({ character: 'all', favorites: false })
        }, `全部角色 (${totalCount || 0})`),
        h('button', {
          type: 'button',
          className: `nai5-btn xs ${filterFavorites ? 'primary' : ''}`,
          title: '只显示已标星收藏的作品',
          onClick: () => applyFilter({ favorites: !filterFavorites })
        }, `★ 仅看收藏 (${galleryMeta.favoritesCount || 0})`),
        (expandChars ? (galleryMeta.characters || []) : (galleryMeta.characters || []).slice(0, 24)).map(c =>
          h('button', {
            key: c.id,
            type: 'button',
            className: `nai5-btn xs ${filterChar === c.id ? 'primary' : ''}`,
            onClick: () => applyFilter({ character: c.id })
          }, `${c.label} (${c.count})`)
        ),
        (galleryMeta.characters?.length || 0) > 24 && h('button', {
          type: 'button',
          className: 'nai5-btn xs',
          style: { borderStyle: 'dashed', color: 'var(--fx-crimson-soft)' },
          onClick: () => setExpandChars(v => !v)
        }, expandChars ? '收起角色 ▴' : `展开全部 (${galleryMeta.characters.length}) ▾`)
      ),
      // Secondary Filter Row + Layout Mode Switch
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } },
        h('select', {
          className: 'nai5-select',
          style: { width: '140px', padding: '5px 8px', fontSize: '11.5px' },
          value: filterMonth,
          onChange: e => applyFilter({ month: e.target.value })
        },
          h('option', { value: 'all' }, '全部月份'),
          galleryMeta.months?.map(m => h('option', { key: m.id, value: m.id }, `${m.label} (${m.count})`))
        ),
        h('div', { className: 'nai-seg-mini' },
          ['all', 'Safe', 'R18', 'X'].map(r =>
            h('button', {
              key: r,
              type: 'button',
              className: `nai-seg-mini-btn ${filterRating === r ? 'active' : ''}`,
              onClick: () => applyFilter({ rating: r })
            }, r === 'all' ? '全部分级' : r)
          )
        ),
        h('select', {
          className: 'nai5-select',
          style: { width: '150px', padding: '5px 8px', fontSize: '11.5px' },
          value: filterTopic,
          onChange: e => applyFilter({ topic: e.target.value })
        },
          h('option', { value: 'all' }, '全部主题'),
          galleryMeta.topics?.map(t => h('option', { key: t.id, value: t.id }, `${t.label} (${t.count})`))
        ),
        h('input', {
          type: 'text',
          className: 'nai5-input',
          style: { flex: 1, minWidth: '150px', padding: '5px 10px', fontSize: '11.5px' },
          placeholder: '搜索提示词 / 角色 / Seed...',
          value: gallerySearch,
          onChange: e => setGallerySearch(e.target.value),
          onKeyDown: e => e.key === 'Enter' && applyFilter({ search: gallerySearch, showToast: true })
        }),
        h('button', {
          type: 'button',
          className: 'nai5-btn primary xs',
          onClick: () => applyFilter({ search: gallerySearch, showToast: true })
        }, h(Icon, { name: 'search', size: 12 }), '筛选'),
        // Layout Toggle: Natural Masonry vs Uniform 2:3 Grid
        h('div', {
          className: 'nai-seg-mini',
          title: '切换画廊排布方式：原比例瀑布流不裁剪横图/方图；竖卡网格严格齐平'
        },
          h('button', {
            type: 'button',
            className: `nai-seg-mini-btn ${galleryLayout === 'masonry' ? 'active' : ''}`,
            onClick: () => setGalleryLayout('masonry')
          }, h(Icon, { name: 'masonry', size: 11 }), ' 瀑布流'),
          h('button', {
            type: 'button',
            className: `nai-seg-mini-btn ${galleryLayout === 'grid' ? 'active' : ''}`,
            onClick: () => setGalleryLayout('grid')
          }, h(Icon, { name: 'grid', size: 11 }), ' 竖卡')
        ),
        // Density Toggle
        h('div', { className: 'nai-seg-mini' },
          [
            { id: 'large', label: '大图' },
            { id: 'medium', label: '标配' },
            { id: 'compact', label: '紧凑' }
          ].map(d =>
            h('button', {
              key: d.id,
              type: 'button',
              className: `nai-seg-mini-btn ${gridDensity === d.id ? 'active' : ''}`,
              onClick: () => setGridDensity(d.id)
            }, d.label)
          )
        ),
        h('div', { style: { display: 'inline-flex', alignItems: 'center', gap: '5px', marginLeft: 'auto' } },
          h('button', {
            type: 'button',
            className: `nai5-btn xs ${batchMode ? 'primary' : ''}`,
            title: '批量勾选归类移动或删除图库作品',
            onClick: () => {
              setBatchMode(v => !v);
              setSelectedPaths([]);
            }
          }, batchMode ? `退出批量 (${selectedPaths.length})` : '☑ 批量'),
          h('div', { ref: manageMenuRef, className: 'nai-popover-anchor' },
            h('button', {
              type: 'button',
              className: `nai5-btn xs ${showManageMenu ? 'primary' : ''}`,
              onClick: () => setShowManageMenu(v => !v)
            }, '⚙ 库管理 ▾'),
            showManageMenu && h('div', { className: 'nai-popover-down' },
              h('button', {
                type: 'button',
                className: 'nai-menu-item',
                onClick: () => { setShowManageMenu(false); onBackfillMetadata(); }
              }, h('strong', null, '🪄 后台补全元数据'), h('span', null, '为存量历史 PNG 提取提示词与尺寸')),
              h('button', {
                type: 'button',
                className: 'nai-menu-item',
                onClick: () => { setShowManageMenu(false); onRefreshGallery(); }
              }, h('strong', null, '♻ 重扫磁盘目录'), h('span', null, '即时同步磁盘增删文件'))
            )
          )
        )
      ),
      batchMode && h('div', { className: 'nai5-batch-bar' },
        h('span', { style: { fontSize: '12px', fontWeight: 600, color: 'var(--fx-crimson-soft)' } }, `已选中 ${selectedPaths.length} 张`),
        h('button', {
          type: 'button',
          className: 'nai5-btn xs',
          onClick: () => setSelectedPaths(history.map(x => x.source_path || x.filePath).filter(Boolean))
        }, '全选当前页'),
        h('button', {
          type: 'button',
          className: 'nai5-btn xs',
          onClick: () => setSelectedPaths([])
        }, '清空选择'),
        h('input', {
          type: 'text',
          className: 'nai-input-mini',
          style: { width: '140px' },
          placeholder: '目标角色目录名...',
          value: batchTargetChar,
          onChange: e => setBatchTargetChar(e.target.value)
        }),
        h('button', {
          type: 'button',
          className: 'nai5-btn primary xs',
          disabled: selectedPaths.length === 0 || !batchTargetChar.trim(),
          onClick: async () => {
            const res = await onBatchMove(selectedPaths, batchTargetChar.trim());
            if (res?.ok) setSelectedPaths([]);
          }
        }, '批量归类移动'),
        h('button', {
          type: 'button',
          className: 'nai5-btn danger xs',
          disabled: selectedPaths.length === 0,
          onClick: async () => {
            if (!window.confirm(`确认永久删除选中的 ${selectedPaths.length} 张图像吗？此操作不可撤销！`)) return;
            const res = await onBatchDelete(selectedPaths);
            if (res?.ok) setSelectedPaths([]);
          }
        }, '批量物理删除')
      )
    ),

    // Virtualized Natural-Aspect Masonry Mode
    galleryLayout === 'masonry' && masonryLayout
      ? h('div', {
          ref: hostRef,
          className: 'nai5-gallery-masonry-host',
          style: { height: `${masonryLayout.totalHeight}px` }
        },
          masonryLayout.visibleIndices.map(idx => {
            const pos = masonryLayout.positions[idx];
            return renderCard(
              history[idx],
              idx,
              {
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                width: `${pos.w}px`,
                height: `${pos.h}px`
              },
              true
            );
          })
        )
      // Uniform 2:3 Grid Mode
      : h('div', { ref: hostRef, className: `nai5-gallery-grid density-${gridDensity}` },
          history.map((item, idx) => renderCard(item, idx, null, false))
        ),

    loadingMore && h('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '16px',
        color: 'var(--fx-crimson-soft)',
        fontSize: '12px'
      }
    },
      h(Icon, { name: 'sparkles', size: 14 }),
      '正在极速加载更多历史画卷...'
    ),
    !hasMore && history.length > 0 && h('div', {
      style: {
        textAlign: 'center',
        padding: '16px',
        color: 'var(--fx-text-secondary)',
        fontSize: '11px',
        opacity: 0.75
      }
    }, '🍁 已展示全部典藏画作')
  );
}
