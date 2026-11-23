// ============================================================
// Post-Process Single-Row Glass Dock, Reference Panel & Prompt Chunks Drawer
// Zero-JSX h(...) matching NAI5 Studio Canvas-First Atelier v4.0
// ============================================================

function PostProcessToolbar(props) {
  const {
    hasImage,
    isFavorite,
    busyAction,
    onUpscale,
    onDirector,
    onSendToChat,
    onForkToWorkbench,
    onSendToImg2Img,
    onSendToInpaint,
    onToggleFavorite,
    onCopyImage,
    onReveal,
    onOpenLightbox
  } = props || {};

  const [openMenu, setOpenMenu] = useState(null); // null | 'upscale' | 'director'
  const [defry, setDefry] = useState(0);
  const [colorizePrompt, setColorizePrompt] = useState('');
  const [emotion, setEmotion] = useState('happy');
  const [emotionLevel, setEmotionLevel] = useState('normal');
  const dockRef = useRef(null);

  useEffect(() => {
    if (!openMenu) return;
    const onDocDown = (e) => {
      if (dockRef.current && !dockRef.current.contains(e.target)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [openMenu]);

  if (!hasImage) return null;

  const isBusy = Boolean(busyAction);
  const isUpscaling = busyAction && busyAction.startsWith('upscale');
  const isDirectorBusy = busyAction && busyAction.startsWith('director:');

  const runUpscale = (scale) => {
    setOpenMenu(null);
    onUpscale && onUpscale(scale);
  };

  const runDirector = (opts) => {
    setOpenMenu(null);
    onDirector && onDirector(opts);
  };

  return h('div', { ref: dockRef, className: 'nai-action-dock' },
    // Primary workflow group
    h('div', { className: 'nai-dock-group' },
      onSendToChat ? h('button', {
        type: 'button',
        className: 'nai5-btn primary xs',
        title: '将此图配方与 Seed 推送至 DSH 对话继续创作',
        onClick: onSendToChat
      }, '💬 送入对话') : null,
      onForkToWorkbench ? h('button', {
        type: 'button',
        className: 'nai5-btn xs',
        title: '接管当前成图的完整提示词与参数至左侧面板',
        onClick: onForkToWorkbench
      }, h(Icon, { name: 'zap', size: 11 }), '回灌配方') : null,
      h('button', {
        type: 'button',
        className: 'nai5-btn xs',
        disabled: isBusy,
        title: '以此作为底图进入图生图微调',
        onClick: () => onSendToImg2Img && onSendToImg2Img()
      }, '图生图'),
      h('button', {
        type: 'button',
        className: 'nai5-btn xs',
        disabled: isBusy,
        title: '涂抹蒙版进行局部重绘',
        onClick: () => onSendToInpaint && onSendToInpaint()
      }, '局部重绘')
    ),

    // Post-process popovers group (upward overlays)
    h('div', { className: 'nai-dock-group' },
      h('div', { className: 'nai-popover-anchor' },
        h('button', {
          type: 'button',
          className: 'nai5-btn xs' + (openMenu === 'upscale' ? ' primary' : ''),
          disabled: isBusy,
          onClick: () => setOpenMenu(m => (m === 'upscale' ? null : 'upscale'))
        }, isUpscaling ? '超分中…' : '✨ 超分 ▾'),
        openMenu === 'upscale' && h('div', { className: 'nai-popover-up is-narrow' },
          h('div', { className: 'nai-popover-up-title' }, 'NovelAI 无损超分'),
          h('button', {
            type: 'button',
            className: 'nai-menu-item',
            onClick: () => runUpscale(2)
          },
            h('strong', null, '2× 清晰放大'),
            h('span', null, '快速倍增分辨率并自动归档')
          ),
          h('button', {
            type: 'button',
            className: 'nai-menu-item',
            onClick: () => runUpscale(4)
          },
            h('strong', null, '4× 极清输出'),
            h('span', null, '双轮精炼，适合超高清海报壁纸')
          )
        )
      ),
      h('div', { className: 'nai-popover-anchor' },
        h('button', {
          type: 'button',
          className: 'nai5-btn xs' + (openMenu === 'director' ? ' primary' : ''),
          disabled: isBusy,
          onClick: () => setOpenMenu(m => (m === 'director' ? null : 'director'))
        }, isDirectorBusy ? '处理中…' : '🎨 导演工具 ▾'),
        openMenu === 'director' && h('div', { className: 'nai-popover-up is-wide' },
          h('div', { className: 'nai-popover-up-head' },
            h('span', { className: 'nai-popover-up-title' }, 'NovelAI 导演辅助引擎'),
            h('label', { className: 'nai-defry-inline' },
              h('span', null, 'Defry ' + defry),
              h('input', {
                type: 'range',
                className: 'nai5-slider',
                min: 0,
                max: 5,
                step: 1,
                value: defry,
                onChange: (e) => setDefry(Number(e.target.value) || 0)
              })
            )
          ),
          h('div', { className: 'nai-director-grid' },
            h('button', { type: 'button', className: 'nai-menu-chip', onClick: () => runDirector({ tool: 'bg-removal', defry }) }, '✂ 一键去背景'),
            h('button', { type: 'button', className: 'nai-menu-chip', onClick: () => runDirector({ tool: 'lineart', defry }) }, '✒ 提取线稿'),
            h('button', { type: 'button', className: 'nai-menu-chip', onClick: () => runDirector({ tool: 'sketch', defry }) }, '✏ 素描草图'),
            h('button', { type: 'button', className: 'nai-menu-chip', onClick: () => runDirector({ tool: 'declutter', defry }) }, '🧹 净屏去字')
          ),
          h('div', { className: 'nai-director-row' },
            h('input', {
              type: 'text',
              className: 'nai-input-mini',
              style: { flex: 1 },
              placeholder: '上色光线/氛围 (如 warm sunset light)...',
              value: colorizePrompt,
              onChange: (e) => setColorizePrompt(e.target.value)
            }),
            h('button', {
              type: 'button',
              className: 'nai5-btn primary xs',
              onClick: () => runDirector({ tool: 'colorize', defry, prompt: colorizePrompt })
            }, 'AI 上色')
          ),
          h('div', { className: 'nai-director-row' },
            h('select', {
              className: 'nai-select-mini',
              value: emotion,
              onChange: (e) => setEmotion(e.target.value)
            },
              ['happy', 'sad', 'angry', 'blush', 'surprised', 'shy', 'smug', 'tears'].map((em) =>
                h('option', { key: em, value: em }, em)
              )
            ),
            h('select', {
              className: 'nai-select-mini',
              value: emotionLevel,
              onChange: (e) => setEmotionLevel(e.target.value)
            },
              ['normal', 'strong', 'slightly_weak', 'weak'].map((lv) =>
                h('option', { key: lv, value: lv }, lv)
              )
            ),
            h('button', {
              type: 'button',
              className: 'nai5-btn xs',
              onClick: () => runDirector({ tool: 'emotion', defry, emotion, emotionLevel })
            }, '😊 微调表情')
          )
        )
      )
    ),

    // Utility icon group
    h('div', { className: 'nai-dock-group' },
      onToggleFavorite ? h('button', {
        type: 'button',
        className: 'nai5-btn xs' + (isFavorite ? ' is-fav-active' : ''),
        title: isFavorite ? '取消收藏' : '标星收藏此作品',
        onClick: onToggleFavorite
      }, isFavorite ? '★' : '☆') : null,
      onCopyImage ? h('button', {
        type: 'button',
        className: 'nai5-btn xs',
        title: '复制原图到剪贴板',
        onClick: onCopyImage
      }, h(Icon, { name: 'copy', size: 11 })) : null,
      onReveal ? h('button', {
        type: 'button',
        className: 'nai5-btn xs',
        title: '在资源管理器中定位原图',
        onClick: onReveal
      }, h(Icon, { name: 'folder', size: 11 })) : null,
      onOpenLightbox ? h('button', {
        type: 'button',
        className: 'nai5-btn xs',
        title: '打开高清灯箱视图',
        onClick: onOpenLightbox
      }, h(Icon, { name: 'maximize', size: 11 })) : null
    )
  );
}

function ReferencePanel(props) {
  const {
    refTab,
    setRefTab,
    vibeReferences = [],
    setVibeReferences,
    preciseReferences = [],
    setPreciseReferences,
    onUseCurrentCanvas
  } = props || {};

  const fileInputRef = useRef(null);
  const isPrecise = refTab === 'precise';
  const activeList = isPrecise ? preciseReferences : vibeReferences;

  const updateItem = (idx, patch) => {
    const updater = isPrecise ? setPreciseReferences : setVibeReferences;
    updater((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const removeItem = (idx) => {
    const updater = isPrecise ? setPreciseReferences : setVibeReferences;
    updater((prev) => prev.filter((_, i) => i !== idx));
  };

  const addFiles = (files) => {
    Array.from(files || []).slice(0, isPrecise ? 4 : 6).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== 'string') return;
        const item = isPrecise
          ? { image: reader.result, name: file.name, type: 'character&style', strength: 1.0, fidelity: 1.0 }
          : { image: reader.result, name: file.name, strength: 0.6, infoExtracted: 1.0 };
        const updater = isPrecise ? setPreciseReferences : setVibeReferences;
        updater((prev) => [...prev, item].slice(0, isPrecise ? 4 : 6));
      };
      reader.readAsDataURL(file);
    });
  };

  return h('div', { className: 'nai-ref-panel' },
    h('div', { className: 'nai-ref-tabs' },
      h('button', {
        type: 'button',
        className: 'nai-pill-btn' + (!isPrecise ? ' is-active' : ''),
        onClick: () => setRefTab('vibe')
      }, '氛围迁移 Vibe (' + vibeReferences.length + ')'),
      h('button', {
        type: 'button',
        className: 'nai-pill-btn' + (isPrecise ? ' is-active' : ''),
        onClick: () => setRefTab('precise')
      }, '精准参考 V4.5 (' + preciseReferences.length + ')'),
      h('div', { style: { flex: 1 } }),
      h('button', {
        type: 'button',
        className: 'nai-pill-btn',
        onClick: () => fileInputRef.current && fileInputRef.current.click()
      }, '+ 传参考图'),
      onUseCurrentCanvas ? h('button', {
        type: 'button',
        className: 'nai-pill-btn',
        onClick: () => onUseCurrentCanvas(isPrecise ? 'precise' : 'vibe')
      }, '抓当前成图') : null,
      h('input', {
        ref: fileInputRef,
        type: 'file',
        multiple: true,
        accept: 'image/png,image/jpeg,image/webp',
        style: { display: 'none' },
        onChange: (e) => { addFiles(e.target.files); e.target.value = ''; }
      })
    ),
    isPrecise ? h('div', { className: 'nai-ref-hint' }, '启用 V4.5 精准参考时将自动切换至 nai-diffusion-4-5-full 多段流上传，并与氛围迁移互斥。') : null,
    activeList.length === 0
      ? h('div', { className: 'nai-ref-empty' }, '暂无参考图。上传本地参考图或点击「抓当前成图」，即可微调迁移强度与提取率。')
      : h('div', { className: 'nai-ref-list' },
          activeList.map((ref, idx) =>
            h('div', { key: idx, className: 'nai-ref-card' },
              h('img', { src: ref.image, className: 'nai-ref-thumb', alt: ref.name || 'ref' }),
              h('div', { className: 'nai-ref-controls' },
                isPrecise
                  ? h('select', {
                      className: 'nai-select-mini',
                      value: ref.type || 'character&style',
                      onChange: (e) => updateItem(idx, { type: e.target.value })
                    },
                      h('option', { value: 'character&style' }, '角色 + 画风'),
                      h('option', { value: 'character' }, '仅角色'),
                      h('option', { value: 'style' }, '仅画风')
                    )
                  : null,
                h('label', { className: 'nai-ref-slider' },
                  h('span', null, '参考强度 ' + Number(ref.strength ?? 0.6).toFixed(2)),
                  h('input', {
                    type: 'range',
                    min: 0.05,
                    max: 1.0,
                    step: 0.05,
                    value: ref.strength ?? (isPrecise ? 1.0 : 0.6),
                    onChange: (e) => updateItem(idx, { strength: Number(e.target.value) })
                  })
                ),
                h('label', { className: 'nai-ref-slider' },
                  h('span', null, (isPrecise ? '还原度 ' : '信息提取 ') + Number(isPrecise ? (ref.fidelity ?? 1) : (ref.infoExtracted ?? 1)).toFixed(2)),
                  h('input', {
                    type: 'range',
                    min: 0.05,
                    max: 1.0,
                    step: 0.05,
                    value: isPrecise ? (ref.fidelity ?? 1.0) : (ref.infoExtracted ?? 1.0),
                    onChange: (e) => updateItem(
                      idx,
                      isPrecise ? { fidelity: Number(e.target.value) } : { infoExtracted: Number(e.target.value) }
                    )
                  })
                )
              ),
              h('button', {
                type: 'button',
                className: 'nai-ref-del',
                onClick: () => removeItem(idx),
                title: '移除参考图'
              }, '✕')
            )
          )
        )
  );
}

function PromptChunksDrawer(props) {
  const {
    prompt = '',
    onChangePrompt,
    onRepairSyntax
  } = props || {};

  const chunks = React.useMemo(() => {
    return String(prompt || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }, [prompt]);

  const bumpChunk = (idx, delta) => {
    const next = [...chunks];
    const current = next[idx];
    const m = current.match(/^(-?\d+(?:\.\d+)?)::(.*?)\s*::$/);
    if (m) {
      const nextWeight = Math.max(-3, Math.min(3, +(parseFloat(m[1]) + delta).toFixed(2)));
      if (Math.abs(nextWeight - 1) < 0.01) {
        next[idx] = m[2].trim();
      } else {
        next[idx] = nextWeight + '::' + m[2].trim() + ' ::';
      }
    } else {
      const nextWeight = delta > 0 ? 1.15 : 0.85;
      next[idx] = nextWeight + '::' + current + ' ::';
    }
    onChangePrompt && onChangePrompt(next.join(', '));
  };

  const removeChunk = (idx) => {
    const next = chunks.filter((_, i) => i !== idx);
    onChangePrompt && onChangePrompt(next.join(', '));
  };

  return h('div', { className: 'nai-chunks-drawer' },
    h('div', { className: 'nai-chunks-head' },
      h('span', { className: 'nai-chunks-title' }, '分段权重滑块 (' + chunks.length + ' 词组)'),
      onRepairSyntax ? h('button', {
        type: 'button',
        className: 'nai-pill-btn',
        onClick: onRepairSyntax
      }, '✨ V5 语法一键修复') : null
    ),
    h('div', { className: 'nai-chunks-list' },
      chunks.map((chunk, idx) =>
        h('div', { key: idx + '_' + chunk.slice(0, 12), className: 'nai-chunk-pill' },
          h('span', { className: 'nai-chunk-text', title: chunk }, chunk),
          h('button', { type: 'button', className: 'nai-chunk-op', onClick: () => bumpChunk(idx, -0.1), title: '降权 -0.1' }, '−'),
          h('button', { type: 'button', className: 'nai-chunk-op', onClick: () => bumpChunk(idx, 0.1), title: '加权 +0.1' }, '+'),
          h('button', { type: 'button', className: 'nai-chunk-op is-del', onClick: () => removeChunk(idx), title: '删除词条' }, '×')
        )
      )
    )
  );
}
