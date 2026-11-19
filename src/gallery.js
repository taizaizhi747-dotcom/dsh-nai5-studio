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
  gallerySearch,
  setGallerySearch,
  galleryMeta,
  applyFilter,
  onRefreshGallery,
  onBackfillMetadata,
  onLoadMore,
  onOpenPreview,
  onDragStart,
  onCopyImage,
  onRevealInExplorer,
  onForkToWorkbench,
  onSendToChat,
  onCopyText
}) {
  const wrapRef = useRef(null);
  const hostRef = useRef(null);
  const [hostWidth, setHostWidth] = useState(960);
  const [scrollState, setScrollState] = useState({ top: 0, height: 720 });
  const scrollRafRef = useRef(false);

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

    return h('div', {
      key: item.task_id || imgPath || idx,
      className: `nai5-gallery-card ${isMasonry ? 'masonry-item' : ''}`,
      style: extraStyle || undefined,
      draggable: true,
      onDragStart: (e) => onDragStart(e, item),
      onClick: () => onOpenPreview(idx)
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
          draggable: true,
          onDragStart: (e) => onDragStart(e, item)
        }),
        isNonPortrait && h('span', { className: 'nai5-gallery-ratio-tag' }, `${w}×${hVal}`),
        h('div', {
          className: 'nai5-gallery-top-tools',
          onClick: e => e.stopPropagation()
        },
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
        h('div', {
          className: 'nai5-gallery-hover-dock',
          onClick: e => e.stopPropagation()
        },
          h('button', {
            type: 'button',
            className: 'nai5-gallery-dock-btn primary',
            title: '一键回灌全部参数与多角色框到工作台精修',
            onClick: () => onForkToWorkbench(item)
          }, h(Icon, { name: 'zap', size: 11 }), '精修'),
          h('button', {
            type: 'button',
            className: 'nai5-gallery-dock-btn',
            title: '推送此图片与配方到 DSH 对话输入框继续续写',
            onClick: () => onSendToChat(item)
          }, '💬 续写')
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
    h('div', { className: 'nai5-card', style: { gap: '10px', flex: 'none' } },
      h('div', { style: { display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' } },
        h('button', {
          type: 'button',
          className: `nai5-btn xs ${filterChar === 'all' ? 'primary' : ''}`,
          onClick: () => applyFilter({ character: 'all' })
        }, `全部角色 (${totalCount || 0})`),
        galleryMeta.characters?.slice(0, 28).map(c =>
          h('button', {
            key: c.id,
            type: 'button',
            className: `nai5-btn xs ${filterChar === c.id ? 'primary' : ''}`,
            onClick: () => applyFilter({ character: c.id })
          }, `${c.label} (${c.count})`)
        )
      ),
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
        h('div', { style: { display: 'inline-flex', gap: '3px', background: 'rgba(0,0,0,0.35)', padding: '3px', borderRadius: '7px' } },
          ['all', 'Safe', 'R18', 'X'].map(r =>
            h('button', {
              key: r,
              type: 'button',
              className: `nai5-btn xs ${filterRating === r ? 'primary' : 'ghost'}`,
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
        h('div', {
          style: { display: 'inline-flex', gap: '2px', background: 'rgba(0,0,0,0.35)', padding: '2px', borderRadius: '7px' },
          title: '切换画廊排布方式：原比例瀑布流或等高竖卡网格'
        },
          h('button', {
            type: 'button',
            className: `nai5-btn xs ${galleryLayout === 'masonry' ? 'primary' : 'ghost'}`,
            onClick: () => setGalleryLayout('masonry')
          }, h(Icon, { name: 'masonry', size: 11 }), '瀑布流'),
          h('button', {
            type: 'button',
            className: `nai5-btn xs ${galleryLayout === 'grid' ? 'primary' : 'ghost'}`,
            onClick: () => setGalleryLayout('grid')
          }, h(Icon, { name: 'grid', size: 11 }), '竖卡')
        ),
        h('div', { style: { display: 'inline-flex', gap: '2px', background: 'rgba(0,0,0,0.35)', padding: '2px', borderRadius: '7px' } },
          [
            { id: 'large', label: '大图' },
            { id: 'medium', label: '标配' },
            { id: 'compact', label: '紧凑' }
          ].map(d =>
            h('button', {
              key: d.id,
              type: 'button',
              className: `nai5-btn xs ${gridDensity === d.id ? 'primary' : 'ghost'}`,
              onClick: () => setGridDensity(d.id)
            }, d.label)
          )
        ),
        h('button', {
          type: 'button',
          className: 'nai5-btn xs',
          title: '后台按需补全历史存量 PNG 提示词与分辨率索引',
          onClick: onBackfillMetadata
        }, h(Icon, { name: 'wand', size: 12 }), '补全索引'),
        h('button', {
          type: 'button',
          className: 'nai5-btn xs',
          title: '重新扫描磁盘并刷新画廊',
          onClick: onRefreshGallery
        }, h(Icon, { name: 'refresh', size: 12 }))
      )
    ),

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
      '正在加载更多历史画卷...'
    ),
    !hasMore && history.length > 0 && h('div', {
      style: {
        textAlign: 'center',
        padding: '16px',
        color: 'var(--fx-text-secondary)',
        fontSize: '11px',
        opacity: 0.75
      }
    }, '已展示全部典藏画作')
  );
}
