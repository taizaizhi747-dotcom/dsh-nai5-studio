// ============================================================
// NAI5 Studio Workbench v4.0 — Canvas-First Frost & Maple Architecture
// Left 3-Layer Creation Inspector + Right Hero Canvas Stage
// Zero-JSX h(...) matching Frost & Maple Glassmorphism Dark & Light themes
// ============================================================

function StudioWorkbench({
  workbenchBodyRef,
  dragRef,
  mainColSplitX,
  setMainColSplitX,
  bridgeLocks,
  toggleBridgeLock,
  autoMirrorAgent,
  setAutoMirrorAgent,
  sendToChatComposer,
  accountsCount,
  accountsLoaded,
  onOpenAccountSetup,
  studioConfig,
  width,
  height,
  setWidth,
  setHeight,
  aspectRatio,
  pixelTier,
  setPixelTier,
  handleTierChange,
  handleRatioChange,
  seedMode,
  setSeedMode,
  seed,
  setSeed,
  steps,
  setSteps,
  cfgScale,
  setCfgScale,
  sampler,
  setSampler,
  cfgRescale,
  setCfgRescale,
  model,
  setModel,
  effort,
  setEffort,
  noiseSchedule,
  setNoiseSchedule,
  variety,
  setVariety,
  transparentBackground,
  setTransparentBackground,
  batchCount,
  setBatchCount,
  genMode,
  setGenMode,
  sourceImage,
  setSourceImage,
  sourceImagePreviewUrl,
  setSourceImagePreviewUrl,
  i2iStrength,
  setI2iStrength,
  i2iNoise,
  setI2iNoise,
  setInpaintMask,
  inpaintStrength,
  setInpaintStrength,
  colorCorrect,
  setColorCorrect,
  refTab,
  setRefTab,
  vibeReferences,
  setVibeReferences,
  preciseReferences,
  setPreciseReferences,
  showChunksDrawer,
  setShowChunksDrawer,
  compareBeforeItem,
  compareActive,
  setCompareActive,
  busyPostAction,
  handleUpscale,
  handleDirector,
  handleSendToImg2Img,
  handleSendToInpaint,
  handleUploadSourceImage,
  handleRepairPrompt,
  handleInspectDroppedFile,
  handleUseCurrentCanvasAsRef,
  onToggleFavorite,
  latestImage,
  latestFullUrl,
  characterPrompts,
  setCharacterPrompts,
  showCharBoxes,
  setShowCharBoxes,
  addCharacterBox,
  applyCharLayoutPreset,
  updateCharacterBox,
  updateCharacterCoord2D,
  removeCharacterBox,
  artistPresets,
  serverArtistPresets,
  setArtistPresets,
  selectedArtistId,
  setSelectedArtistId,
  ocPresets,
  serverOcPresets,
  setOcPresets,
  selectedOcId,
  setSelectedOcId,
  onImportPresetsJson,
  positivePrompt,
  setPositivePrompt,
  negativePrompt,
  setNegativePrompt,
  ucMode,
  setUcMode,
  stylePrompt,
  setStylePrompt,
  posTextareaRef,
  charTextareaRefs,
  showInlineSearch,
  setShowInlineSearch,
  inlineQuery,
  setInlineQuery,
  inlineResults,
  inlineSearching,
  runTagSearch,
  copyToClipboard,
  copyImageToClipboard,
  handleDragStart,
  handleForkToWorkbench,
  handleRevealInExplorer,
  setPreviewIndex,
  setPreviewCustomItem,
  resetZoom,
  history,
  setLatestImage,
  costInfo,
  isGenerating,
  handleGenerate,
  showToast
}) {
  const [inspectorTab, setInspectorTab] = useState('prompt'); // 'prompt' | 'chars' | 'params'
  const [styleUcTab, setStyleUcTab] = useState('uc'); // 'uc' | 'style'
  const [showPromptMenu, setShowPromptMenu] = useState(false);
  const [showFilmstrip, setShowFilmstrip] = useState(true);
  const promptMenuRef = useRef(null);
  const modeFileRef = useRef(null);

  useEffect(() => {
    if (!showPromptMenu) return;
    const closeOnOutside = (e) => {
      if (promptMenuRef.current && !promptMenuRef.current.contains(e.target)) {
        setShowPromptMenu(false);
      }
    };
    document.addEventListener('mousedown', closeOnOutside);
    return () => document.removeEventListener('mousedown', closeOnOutside);
  }, [showPromptMenu]);

  const totalCharAndRefs = (characterPrompts?.length || 0) + (vibeReferences?.length || 0) + (preciseReferences?.length || 0);
  const isBusyAny = Boolean(isGenerating || busyPostAction);

  const swapDimensions = () => {
    const curW = Number(width) || 832;
    const curH = Number(height) || 1216;
    setWidth(curH);
    setHeight(curW);
    setPixelTier('custom');
  };

  const toggleQuickEffort = () => {
    if (effort === 'medium') {
      setEffort('high');
      if (model.includes('-medium')) setModel('nai-diffusion-5-full');
      setSteps(28);
    } else if (Number(steps) < 45) {
      setEffort('high');
      if (model.includes('-medium')) setModel('nai-diffusion-5-full');
      setSteps(50);
    } else {
      setEffort('medium');
      setSteps(14);
      setModel('nai-diffusion-5-full-medium');
    }
  };

  const cycleBatchCount = () => {
    const next = batchCount === 1 ? 2 : (batchCount === 2 ? 4 : 1);
    setBatchCount(next);
  };

  const handleDropImage = (e) => {
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f && f.type && f.type.startsWith('image/') && handleInspectDroppedFile) {
      e.preventDefault();
      handleInspectDroppedFile(f);
    }
  };

  const handleDragOverImage = (e) => {
    if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) {
      e.preventDefault();
    }
  };

  // ---------- Left Inspector Tab 1: Prompt & Quick Aspect ----------
  const renderPromptTab = () => h(React.Fragment, null,
    accountsLoaded && accountsCount === 0 && h('div', {
      className: 'nai5-card',
      style: {
        padding: '10px 12px',
        background: 'rgba(200, 35, 55, 0.12)',
        borderColor: 'rgba(200, 35, 55, 0.42)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px',
        flexWrap: 'wrap',
        flex: 'none'
      }
    },
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 } },
        h('strong', { style: { fontSize: '12px', color: 'var(--fx-text-primary)' } }, '尚未配置 NovelAI API 账号'),
        h('span', { style: { fontSize: '11px', color: 'var(--fx-text-secondary)' } },
          '请添加官方 API (https://image.novelai.net) 或兼容中转站 Key，密钥仅存放在本机配置目录。'
        )
      ),
      h('button', {
        type: 'button',
        className: 'nai5-btn primary xs',
        onClick: onOpenAccountSetup
      }, h(Icon, { name: 'user', size: 11 }), '立即配置 API Key')
    ),
    h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', flex: 'none' } },
      h(FolderPresetPicker, {
        label: '画师风格预设（可选）',
        iconName: 'palette',
        presets: artistPresets,
        selectedId: selectedArtistId,
        currentValue: stylePrompt,
        emptyHint: `未配置画师预设。点击右上角「新建」或「导入」JSON（也可放到 ${studioConfig?.artistPresetsFile || '~/.dsh/nai5-studio/artist_presets.json'}）。`,
        onSelect: (preset) => {
          setSelectedArtistId(preset.id);
          setStylePrompt(preset.prompt);
          showToast(`已切换画风: ${preset.name}`);
        },
        onAdd: (np) => {
          setArtistPresets(prev => persistPresetAdd('dsh_nai5_artist_presets_v1', np, prev));
          setSelectedArtistId(np.id);
          showToast(`已保存画风预设: ${np.name}`);
        },
        onDelete: (id) => {
          setArtistPresets(prev => persistPresetDelete('dsh_nai5_artist_presets_v1', id, prev, serverArtistPresets));
        },
        onImportJson: (raw, err) => onImportPresetsJson('artist', raw, err),
        placeholder: '选择或导入画师预设...'
      }),
      h(FolderPresetPicker, {
        label: 'OC 角色档案库（可选）',
        iconName: 'user',
        presets: ocPresets,
        selectedId: selectedOcId,
        currentValue: positivePrompt,
        emptyHint: `未配置角色档案。点击右上角「新建」或「导入」JSON（也可放到 ${studioConfig?.ocPresetsFile || '~/.dsh/nai5-studio/oc_presets.json'}）。`,
        onSelect: (preset) => {
          setSelectedOcId(preset.id);
          setPositivePrompt(prev => {
            const trimmed = prev.trim();
            return trimmed ? `${preset.prompt}, ${trimmed}` : preset.prompt;
          });
          showToast(`已载入角色: ${preset.name}`);
        },
        onAdd: (np) => {
          setOcPresets(prev => persistPresetAdd('dsh_nai5_oc_presets_v1', np, prev));
          setSelectedOcId(np.id);
          showToast(`已保存角色预设: ${np.name}`);
        },
        onDelete: (id) => {
          setOcPresets(prev => persistPresetDelete('dsh_nai5_oc_presets_v1', id, prev, serverOcPresets));
        },
        onImportJson: (raw, err) => onImportPresetsJson('oc', raw, err),
        placeholder: '选择或导入 OC 角色...'
      })
    ),

    // Positive Prompt Card (4 crisp header actions + overflow popover)
    h('div', { className: 'nai5-card', style: { flex: 'none' } },
      h('div', { className: 'nai5-label-bar' },
        h('span', { className: 'nai5-label-title' },
          h(Icon, { name: 'sparkles', size: 13, style: { color: 'var(--fx-crimson-soft)' } }),
          '正向提示词'
        ),
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '4px', flex: 'none' } },
          h('button', {
            type: 'button',
            className: 'nai5-btn xs',
            title: '选中标签或将光标放在词内，提升 +0.1 权重',
            onClick: () => setPositivePrompt(prev => adjustPromptWeight(prev, posTextareaRef.current, 0.1))
          }, '+权'),
          h('button', {
            type: 'button',
            className: 'nai5-btn xs',
            title: '选中标签或将光标放在词内，降低 -0.1 权重',
            onClick: () => setPositivePrompt(prev => adjustPromptWeight(prev, posTextareaRef.current, -0.1))
          }, '-权'),
          h('button', {
            type: 'button',
            className: `nai5-btn xs ${showInlineSearch ? 'primary' : ''}`,
            title: '内联速查 Danbooru 标签与已挂载的可选词库/法典',
            onClick: () => setShowInlineSearch(s => !s)
          }, h(Icon, { name: 'search', size: 11 }), '速查'),
          h('div', { ref: promptMenuRef, className: 'nai-popover-anchor' },
            h('button', {
              type: 'button',
              className: `nai5-btn xs ${showPromptMenu || showChunksDrawer ? 'primary' : ''}`,
              onClick: () => setShowPromptMenu(v => !v)
            }, '更多 ▾'),
            showPromptMenu && h('div', { className: 'nai-popover-down' },
              h('button', {
                type: 'button',
                className: 'nai-menu-item',
                onClick: () => { setShowPromptMenu(false); handleRepairPrompt(); }
              }, h('strong', null, '✨ V5 语法一键修复'), h('span', null, '修复全角符号与权重分隔符')),
              h('button', {
                type: 'button',
                className: 'nai-menu-item',
                onClick: () => {
                  setPositivePrompt(prev => formatPromptText(prev));
                  setShowPromptMenu(false);
                  showToast('已规范化提示词格式');
                }
              }, h('strong', null, '🪄 格式化排版'), h('span', null, '清理中文逗号与冗余空白')),
              h('button', {
                type: 'button',
                className: 'nai-menu-item',
                onClick: () => { setShowChunksDrawer(s => !s); setShowPromptMenu(false); }
              }, h('strong', null, showChunksDrawer ? '🧩 收起词组权重面板' : '🧩 展开词组权重面板'), h('span', null, '逐词条可视加减权重或删除')),
              h('button', {
                type: 'button',
                className: 'nai-menu-item',
                onClick: () => { copyToClipboard(positivePrompt, '正向提示词'); setShowPromptMenu(false); }
              }, h('strong', null, '📋 复制全部提示词')),
              h('button', {
                type: 'button',
                className: 'nai-menu-item is-danger',
                onClick: () => { setPositivePrompt(''); setShowPromptMenu(false); }
              }, h('strong', null, '🗑 清空提示词'))
            )
          )
        )
      ),

      showInlineSearch && h('div', {
        style: {
          padding: '8px',
          borderRadius: '8px',
          background: 'var(--fx-glass-popover)',
          border: '1px solid rgba(224, 40, 79, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          gap: '7px'
        }
      },
        h('div', { style: { display: 'flex', gap: '6px' } },
          h('input', {
            type: 'text',
            className: 'nai5-input',
            style: { flex: 1, fontSize: '11.5px', padding: '5px 8px' },
            placeholder: '搜索中英文 Tag 或法典（如：白丝、旗袍、仰视）...',
            value: inlineQuery,
            onChange: e => setInlineQuery(e.target.value),
            onKeyDown: e => e.key === 'Enter' && runTagSearch(inlineQuery, true)
          }),
          h('button', {
            type: 'button',
            className: 'nai5-btn primary xs',
            onClick: () => runTagSearch(inlineQuery, true)
          }, inlineSearching ? '...' : '检索'),
          h('button', {
            type: 'button',
            className: 'nai5-btn xs',
            onClick: () => setShowInlineSearch(false)
          }, h(Icon, { name: 'close', size: 11 }))
        ),
        inlineResults && h('div', {
          style: { display: 'flex', flexWrap: 'wrap', gap: '5px', maxHeight: '125px', overflowY: 'auto' }
        },
          (inlineResults.danbooru?.results || []).map(r =>
            h('button', {
              key: r.tag,
              type: 'button',
              className: 'nai5-btn xs',
              title: `点击插入标签: ${r.tag}`,
              onClick: () => {
                setPositivePrompt(prev => prev.trim() ? `${prev.trim()}, ${r.tag}` : r.tag);
                showToast(`已插入 ${r.tag}`);
              }
            },
              h('span', { style: { fontWeight: 600 } }, r.tag),
              r.cn_name && h('span', { style: { color: 'var(--fx-text-secondary)', fontSize: '10px' } }, r.cn_name)
            )
          ),
          (inlineResults.codex?.results || []).map((c, idx) =>
            h('button', {
              key: 'cx_' + idx,
              type: 'button',
              className: 'nai5-btn xs',
              style: { borderColor: 'var(--fx-border-gold)' },
              title: `${c.codex}: ${c.prompt}`,
              onClick: () => {
                setPositivePrompt(prev => prev.trim() ? `${prev.trim()}, ${c.prompt}` : c.prompt);
                showToast(`已插入法典词串: ${c.name}`);
              }
            }, h('span', { style: { fontWeight: 600 } }, `[法典] ${c.name}`))
          )
        )
      ),

      h('textarea', {
        ref: posTextareaRef,
        className: 'nai5-textarea',
        rows: 6,
        style: { minHeight: '132px', resize: 'vertical' },
        placeholder: '输入全局画面描述、人数、构图机位、环境光影与动作交互...',
        value: positivePrompt,
        onChange: e => setPositivePrompt(e.target.value)
      }),

      showChunksDrawer && h(PromptChunksDrawer, {
        prompt: positivePrompt,
        onChangePrompt: setPositivePrompt,
        onRepairSyntax: handleRepairPrompt
      })
    ),

    // Unified Switchable Style / Negative UC Card
    h('div', { className: 'nai5-card', style: { flex: 'none' } },
      h('div', { className: 'nai5-label-bar' },
        h('div', { className: 'nai-seg-mini' },
          h('button', {
            type: 'button',
            className: `nai-seg-mini-btn ${styleUcTab === 'uc' ? 'active' : ''}`,
            onClick: () => setStyleUcTab('uc')
          }, '负向排他 UC'),
          h('button', {
            type: 'button',
            className: `nai-seg-mini-btn ${styleUcTab === 'style' ? 'active' : ''}`,
            onClick: () => setStyleUcTab('style')
          }, '画师风格串 Style')
        ),
        styleUcTab === 'uc'
          ? h('div', { style: { display: 'flex', alignItems: 'center', gap: '4px' } },
              [
                { id: 'safe', label: 'Safe' },
                { id: 'standard', label: '标准' },
                { id: 'minimal', label: '极简' }
              ].map(u =>
                h('button', {
                  key: u.id,
                  type: 'button',
                  className: `nai5-btn xs ${ucMode === u.id ? 'primary' : ''}`,
                  onClick: () => { setUcMode(u.id); setNegativePrompt(UC_PRESETS[u.id]); }
                }, u.label)
              ),
              h('button', {
                type: 'button',
                className: 'nai5-btn ghost xs',
                title: '复制负向排他词',
                onClick: () => copyToClipboard(negativePrompt, '负向排他词')
              }, h(Icon, { name: 'copy', size: 11 }))
            )
          : h('button', {
              type: 'button',
              className: 'nai5-btn ghost xs',
              title: '复制画师风格串',
              onClick: () => copyToClipboard(stylePrompt, '画师风格串')
            }, h(Icon, { name: 'copy', size: 11 }), '复制画风')
      ),
      styleUcTab === 'uc'
        ? h('textarea', {
            className: 'nai5-textarea',
            rows: 3,
            style: { minHeight: '72px', fontSize: '11px', resize: 'vertical' },
            placeholder: '输入全局负向排他词 (Undesired Content)...',
            value: negativePrompt,
            onChange: e => setNegativePrompt(e.target.value)
          })
        : h('textarea', {
            className: 'nai5-textarea',
            rows: 3,
            style: { minHeight: '72px', fontSize: '11px', resize: 'vertical' },
            placeholder: '画师串与笔触质感词（由上方预设带出，可自由微调）...',
            value: stylePrompt,
            onChange: e => setStylePrompt(e.target.value)
          })
    ),

    // Quick Aspect Strip Card
    h('div', { className: 'nai5-card', style: { flex: 'none', gap: '7px' } },
      h('div', { className: 'nai5-label-bar' },
        h('span', { className: 'nai5-label-title' }, '画幅比例与档位'),
        h('span', { style: { fontSize: '11px', color: 'var(--fx-crimson-soft)', fontFamily: 'monospace' } },
          `${width}×${height} · ${((width * height) / 1048576).toFixed(2)}MP`
        )
      ),
      h('div', { className: 'nai5-ratio-grid' },
        [
          { r: '2:3', label: '2:3 竖', w: 9, h: 13 },
          { r: '3:2', label: '3:2 横', w: 13, h: 9 },
          { r: '1:1', label: '1:1 方', w: 11, h: 11 },
          { r: '9:16', label: '9:16', w: 8, h: 13 },
          { r: '16:9', label: '16:9', w: 14, h: 8 }
        ].map(item =>
          h('button', {
            key: item.r,
            type: 'button',
            className: `nai5-ratio-pill ${aspectRatio === item.r ? 'active' : ''}`,
            style: { flexDirection: 'row', padding: '5px 4px', gap: '5px' },
            onClick: () => handleRatioChange(item.r)
          },
            h('span', {
              style: {
                width: `${item.w}px`,
                height: `${item.h}px`,
                border: '1.5px solid currentColor',
                borderRadius: '2px',
                display: 'inline-block',
                flex: 'none'
              }
            }),
            h('span', null, item.label)
          )
        )
      ),
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
        h('select', {
          className: 'nai5-select',
          style: { flex: 1, padding: '4px 8px', fontSize: '11px' },
          value: pixelTier,
          onChange: e => handleTierChange(e.target.value === 'custom' ? 'custom' : Number(e.target.value))
        },
          h('option', { value: 0.4 }, '0.4 MP 小图'),
          h('option', { value: 1 }, '1.0 MP 标准'),
          h('option', { value: 1.5 }, '1.5 MP 大图'),
          h('option', { value: 2 }, '2.0 MP 超清'),
          h('option', { value: 3 }, '3.0 MP 极限'),
          h('option', { value: 'custom' }, '自定义尺寸')
        ),
        h('button', {
          type: 'button',
          className: 'nai5-btn xs',
          title: '一键互换宽与高 (竖屏 ⇄ 横屏)',
          onClick: swapDimensions
        }, '⇄ 互换宽高')
      )
    )
  );

  // ---------- Left Inspector Tab 2: Characters (22) & References ----------
  const renderCharsAndRefsTab = () => h(React.Fragment, null,
    h('div', { className: 'nai5-card', style: { flex: 'none' } },
      h('div', { className: 'nai5-label-bar' },
        h('span', { className: 'nai5-label-title' },
          h(Icon, { name: 'users', size: 13, style: { color: 'var(--fx-crimson-soft)' } }),
          'V5 多角色 2D 站位画布',
          h('span', {
            style: {
              fontSize: '10px',
              padding: '1px 7px',
              borderRadius: '999px',
              background: characterPrompts.length > 0 ? 'rgba(224, 40, 79, 0.18)' : 'rgba(255, 255, 255, 0.06)',
              color: characterPrompts.length > 0 ? 'var(--fx-crimson-soft)' : 'var(--fx-text-muted)'
            }
          }, `${characterPrompts.length}/${MAX_V5_CHARACTERS}`)
        ),
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '4px' } },
          h('select', {
            className: 'nai5-select',
            style: { width: '104px', padding: '3px 6px', fontSize: '10.5px' },
            value: '',
            title: '一键生成多角色 2D 队列坐标',
            onChange: (e) => {
              if (e.target.value) applyCharLayoutPreset(e.target.value);
            }
          },
            h('option', { value: '' }, '快捷排布...'),
            h('option', { value: '2lr' }, '双人左右'),
            h('option', { value: '2tb' }, '双人上下'),
            h('option', { value: '3row' }, '三人并排'),
            h('option', { value: '4grid' }, '四人矩阵'),
            h('option', { value: '6group' }, '六人群像'),
            h('option', { value: '9grid' }, '九人方阵'),
            h('option', { value: '12group' }, '十二群像')
          ),
          h('button', {
            type: 'button',
            className: 'nai5-btn primary xs',
            disabled: characterPrompts.length >= MAX_V5_CHARACTERS,
            onClick: addCharacterBox
          }, h(Icon, { name: 'plus', size: 11 }), '添加'),
          characterPrompts.length > 0 && h('button', {
            type: 'button',
            className: 'nai5-btn ghost xs',
            title: '清空所有角色框，恢复单框模式',
            onClick: () => setCharacterPrompts([])
          }, h(Icon, { name: 'trash', size: 11 })),
          characterPrompts.length > 0 && h('button', {
            type: 'button',
            className: 'nai5-btn xs',
            onClick: () => setShowCharBoxes(s => !s)
          }, h(Icon, { name: showCharBoxes ? 'chevronUp' : 'chevronDown', size: 11 }))
        )
      ),

      characterPrompts.length === 0
        ? h('div', { className: 'nai-ref-empty' },
            `当前为单框模式。支持 NovelAI V5 最高 ${MAX_V5_CHARACTERS} 角色独立控制：选择上方快捷排布或点击「+ 添加」，即可在 2D 舞台拖拽坐标。`
          )
        : (showCharBoxes && h('div', { className: 'nai5-stage2d-wrap is-stacked' },
            h('div', { style: { display: 'flex', justifyContent: 'center' } },
              h(CharacterStage2D, {
                characterPrompts,
                width,
                height,
                onUpdateCoord: updateCharacterCoord2D
              })
            ),
            h('div', { className: 'nai5-char-cards-stack' },
              characterPrompts.map((cp, idx) => {
                const color = CHAR_COLORS[idx % CHAR_COLORS.length];
                const letter = String.fromCharCode(65 + idx);
                return h('div', {
                  key: cp.id || idx,
                  style: {
                    padding: '8px 10px',
                    borderRadius: '8px',
                    background: 'var(--fx-glass-input)',
                    border: `1px solid ${color}55`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }
                },
                  h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', flexWrap: 'wrap' } },
                    h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
                      h('span', {
                        style: {
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          background: color,
                          color: '#fff',
                          fontSize: '10.5px',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }
                      }, letter),
                      h('span', { style: { fontSize: '11.5px', fontWeight: 600, color: 'var(--fx-text-primary)' } }, `角色 ${letter}`),
                      h('span', { style: { fontSize: '10.5px', color: 'var(--fx-text-secondary)', fontFamily: 'monospace' } },
                        `X:${Number(cp.x).toFixed(2)} Y:${Number(cp.y).toFixed(2)}`
                      )
                    ),
                    h('div', { style: { display: 'flex', alignItems: 'center', gap: '4px' } },
                      h('select', {
                        className: 'nai5-select',
                        style: { width: '126px', padding: '2px 6px', fontSize: '10.5px' },
                        value: '',
                        onChange: (e) => {
                          const oc = ocPresets.find(o => o.id === e.target.value);
                          if (oc) {
                            updateCharacterBox(idx, 'prompt', oc.prompt);
                            showToast(`角色 ${letter} 已载入 ${oc.name}`);
                          }
                        }
                      },
                        h('option', { value: '' }, ocPresets.length > 0 ? '填入 OC 预设...' : '未导入 OC 预设'),
                        ocPresets.map(o => h('option', { key: o.id, value: o.id }, o.name))
                      ),
                      h('button', {
                        type: 'button',
                        className: 'nai5-btn xs',
                        onClick: () => updateCharacterBox(idx, 'prompt', adjustPromptWeight(cp.prompt, charTextareaRefs.current[idx], 0.1))
                      }, '+权'),
                      h('button', {
                        type: 'button',
                        className: 'nai5-btn xs',
                        onClick: () => updateCharacterBox(idx, 'prompt', adjustPromptWeight(cp.prompt, charTextareaRefs.current[idx], -0.1))
                      }, '-权'),
                      h('button', {
                        type: 'button',
                        className: 'nai5-btn ghost xs',
                        onClick: () => removeCharacterBox(idx)
                      }, h(Icon, { name: 'trash', size: 11 }))
                    )
                  ),
                  h('textarea', {
                    ref: el => { charTextareaRefs.current[idx] = el; },
                    className: 'nai5-textarea',
                    rows: 3,
                    style: { minHeight: '54px', fontSize: '11.5px' },
                    placeholder: `角色 ${letter} 外观、发型、服装与专属动作 (如 source#hug / target#hug)...`,
                    value: cp.prompt,
                    onChange: e => updateCharacterBox(idx, 'prompt', e.target.value)
                  }),
                  h('input', {
                    type: 'text',
                    className: 'nai5-input',
                    style: { fontSize: '10.5px', padding: '4px 8px', color: 'var(--fx-text-secondary)' },
                    placeholder: `角色 ${letter} 专属负向 UC (填入对方发色/特征防同构串色)...`,
                    value: cp.negativePrompt || '',
                    onChange: e => updateCharacterBox(idx, 'negativePrompt', e.target.value)
                  })
                );
              })
            )
          ))
    ),

    h('div', { className: 'nai5-card', style: { flex: 'none' } },
      h('div', { className: 'nai5-label-bar' },
        h('span', { className: 'nai5-label-title' },
          h(Icon, { name: 'palette', size: 13, style: { color: 'var(--fx-crimson-soft)' } }),
          '参考图系统 (Vibe / V4.5 Precise)'
        )
      ),
      h(ReferencePanel, {
        refTab,
        setRefTab,
        vibeReferences,
        setVibeReferences,
        preciseReferences,
        setPreciseReferences,
        onUseCurrentCanvas: handleUseCurrentCanvasAsRef
      })
    )
  );

  // ---------- Left Inspector Tab 3: Params & DSH Bridge Locks ----------
  const renderParamsAndBridgeTab = () => h(React.Fragment, null,
    h('div', { className: 'nai5-card', style: { flex: 'none' } },
      h('div', { className: 'nai5-label-bar' },
        h('span', { className: 'nai5-label-title' }, '模型 · 生成档位 · 高级特性')
      ),
      h('div', { style: { display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: '8px' } },
        h('select', {
          className: 'nai5-select',
          style: { padding: '5px 8px', fontSize: '11px' },
          value: model,
          onChange: (e) => {
            const nextM = e.target.value;
            setModel(nextM);
            if (nextM.includes('-medium')) {
              setEffort('medium');
              setSteps(14);
            } else if (effort === 'medium') {
              setEffort('high');
              setSteps(28);
            }
          }
        },
          h('option', { value: 'nai-diffusion-5-full' }, 'NAI V5 Full (主力旗舰)'),
          h('option', { value: 'nai-diffusion-5-full-medium' }, 'NAI V5 Medium (轻量快出)'),
          h('option', { value: 'nai-diffusion-4-5-full' }, 'NAI V4.5 Full')
        ),
        h('div', { style: { display: 'inline-flex', gap: '4px' } },
          h('button', {
            type: 'button',
            className: `nai5-btn xs ${effort === 'medium' ? 'primary' : ''}`,
            style: { flex: 1 },
            title: '14 步极速生成（轻量无负向）',
            onClick: () => {
              setEffort('medium');
              setSteps(14);
              setModel('nai-diffusion-5-full-medium');
            }
          }, '极速 14'),
          h('button', {
            type: 'button',
            className: `nai5-btn xs ${effort !== 'medium' && Number(steps) < 45 ? 'primary' : ''}`,
            style: { flex: 1 },
            title: '28 步标准高质（Opus 小图免费额度适用）',
            onClick: () => {
              setEffort('high');
              if (model.includes('-medium')) setModel('nai-diffusion-5-full');
              setSteps(28);
            }
          }, '高质 28'),
          h('button', {
            type: 'button',
            className: `nai5-btn xs ${effort !== 'medium' && Number(steps) >= 45 ? 'primary' : ''}`,
            style: { flex: 1 },
            title: '50 步超高精细度渲染（复杂结构/光影极致打磨）',
            onClick: () => {
              setEffort('high');
              if (model.includes('-medium')) setModel('nai-diffusion-5-full');
              setSteps(50);
            }
          }, '超高 50')
        )
      ),
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '2px' } },
        h('button', {
          type: 'button',
          className: `nai5-btn xs ${variety ? 'primary' : ''}`,
          title: 'Variety+ 多样性增强 (skip_cfg_above_sigma=58)',
          onClick: () => setVariety(v => !v)
        }, 'Variety+ 多样性'),
        h('button', {
          type: 'button',
          className: `nai5-btn xs ${transparentBackground ? 'primary' : ''}`,
          title: 'NAI V5 直出透明背景 (Straight Alpha)',
          onClick: () => setTransparentBackground(v => !v)
        }, '透明 Alpha 背景'),
        h('div', { style: { flex: 1 } }),
        h('span', { style: { fontSize: '10.5px', color: 'var(--fx-text-secondary)' } }, '批量'),
        [1, 2, 4].map(cnt =>
          h('button', {
            key: cnt,
            type: 'button',
            className: `nai5-btn xs ${batchCount === cnt ? 'primary' : ''}`,
            onClick: () => setBatchCount(cnt)
          }, `${cnt}×`)
        )
      )
    ),

    h('div', { className: 'nai5-card', style: { flex: 'none' } },
      h('div', { className: 'nai5-label-bar' },
        h('span', { className: 'nai5-label-title' }, '采样精度 · 分辨率微调 · Seed')
      ),
      h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '6px', alignItems: 'center' } },
        h('label', { style: { display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10.5px', color: 'var(--fx-text-secondary)' } },
          'W',
          h('input', {
            type: 'number',
            className: 'nai5-input',
            style: { flex: 1, fontSize: '11px', padding: '4px 7px' },
            step: 64, min: 64, max: 2048,
            value: width,
            onChange: e => { setWidth(Number(e.target.value) || 832); setPixelTier('custom'); }
          })
        ),
        h('label', { style: { display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10.5px', color: 'var(--fx-text-secondary)' } },
          'H',
          h('input', {
            type: 'number',
            className: 'nai5-input',
            style: { flex: 1, fontSize: '11px', padding: '4px 7px' },
            step: 64, min: 64, max: 2048,
            value: height,
            onChange: e => { setHeight(Number(e.target.value) || 1216); setPixelTier('custom'); }
          })
        ),
        h('button', { type: 'button', className: 'nai5-btn xs', onClick: swapDimensions }, '⇄')
      ),

      h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '4px' } },
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
          h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10.5px', color: 'var(--fx-text-secondary)' } },
            h('span', null, '步数 Steps'),
            h('div', { style: { display: 'inline-flex', alignItems: 'center', gap: '4px' } },
              [14, 28, 50].map(st =>
                h('button', {
                  key: st,
                  type: 'button',
                  className: `nai5-btn xs ${Number(steps) === st ? 'primary' : 'ghost'}`,
                  style: { padding: '1px 5px', fontSize: '10px' },
                  onClick: () => {
                    setSteps(st);
                    if (st === 14) {
                      setEffort('medium');
                      setModel('nai-diffusion-5-full-medium');
                    } else {
                      setEffort('high');
                      if (model.includes('-medium')) setModel('nai-diffusion-5-full');
                    }
                  }
                }, st)
              ),
              h('strong', { style: { color: 'var(--fx-text-primary)', marginLeft: '2px' } }, steps)
            )
          ),
          h('input', { type: 'range', className: 'nai5-slider', min: 1, max: 50, value: steps, onChange: e => setSteps(Number(e.target.value)) })
        ),
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
          h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: 'var(--fx-text-secondary)' } },
            h('span', null, '引导 CFG'),
            h('strong', { style: { color: 'var(--fx-text-primary)' } }, cfgScale)
          ),
          h('input', { type: 'range', className: 'nai5-slider', min: 1, max: 10, step: 0.5, value: cfgScale, onChange: e => setCfgScale(Number(e.target.value)) })
        )
      ),

      h('div', { style: { display: 'grid', gridTemplateColumns: '1.1fr 0.9fr 1fr', gap: '6px', alignItems: 'center', marginTop: '4px' } },
        h('select', {
          className: 'nai5-select',
          style: { padding: '4px 7px', fontSize: '11px' },
          value: sampler,
          onChange: e => setSampler(e.target.value)
        },
          h('option', { value: 'k_euler_ancestral' }, 'Euler Ancestral'),
          h('option', { value: 'k_euler' }, 'Euler'),
          h('option', { value: 'k_dpmpp_2s_ancestral' }, 'DPM++ 2S A'),
          h('option', { value: 'k_dpmpp_2m' }, 'DPM++ 2M'),
          h('option', { value: 'k_dpmpp_sde' }, 'DPM++ SDE'),
          h('option', { value: 'ddim' }, 'DDIM')
        ),
        h('select', {
          className: 'nai5-select',
          style: { padding: '4px 7px', fontSize: '11px' },
          value: noiseSchedule,
          onChange: e => setNoiseSchedule(e.target.value)
        },
          h('option', { value: 'karras' }, 'Karras'),
          h('option', { value: 'exponential' }, 'Exponential'),
          h('option', { value: 'polyexponential' }, 'Polyexp'),
          h('option', { value: 'native' }, 'Native')
        ),
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: '3px' } },
          h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--fx-text-secondary)' } },
            h('span', null, 'Rescale'),
            h('span', { style: { color: 'var(--fx-text-primary)' } }, Number(cfgRescale).toFixed(2))
          ),
          h('input', { type: 'range', className: 'nai5-slider', min: 0, max: 1, step: 0.05, value: cfgRescale, onChange: e => setCfgRescale(Number(e.target.value)) })
        )
      ),

      h('div', { style: { display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px', flexWrap: 'wrap' } },
        h('button', {
          type: 'button',
          className: `nai5-btn xs ${seedMode === 'random' ? 'primary' : ''}`,
          onClick: () => { setSeedMode('random'); setSeed(''); }
        }, h(Icon, { name: 'dice', size: 12 }), '随机'),
        h('button', {
          type: 'button',
          className: `nai5-btn xs ${seedMode === 'fixed' ? 'primary' : ''}`,
          onClick: () => {
            setSeedMode('fixed');
            if (!seed) setSeed(latestImage?.seed || Math.floor(Math.random() * 4294967295));
          }
        }, h(Icon, { name: 'lock', size: 12 }), '固定'),
        seedMode === 'fixed' && h('input', {
          type: 'number',
          className: 'nai5-input',
          style: { flex: 1, minWidth: '100px', padding: '4px 8px', fontSize: '11px', fontFamily: 'monospace' },
          placeholder: '输入固定 Seed...',
          value: seed,
          onChange: e => setSeed(e.target.value)
        }),
        latestImage?.seed && h('button', {
          type: 'button',
          className: 'nai5-btn xs',
          onClick: () => {
            setSeedMode('fixed');
            setSeed(latestImage.seed);
            showToast(`已锁定 Seed: ${latestImage.seed}`);
          }
        }, '锁定上张 Seed')
      )
    ),

    // DSH Bridge Controls (Cleanly housed inside Settings tab!)
    h('div', { className: 'nai5-card', style: { flex: 'none' } },
      h('div', { className: 'nai5-label-bar' },
        h('span', { className: 'nai5-label-title' },
          h(Icon, { name: bridgeLocks.enabled ? 'lock' : 'unlock', size: 13, style: { color: 'var(--fx-crimson-soft)' } }),
          'DSH 对话双向硬件协同'
        ),
        h('button', {
          type: 'button',
          className: `nai5-btn xs ${bridgeLocks.enabled ? 'primary' : ''}`,
          onClick: () => toggleBridgeLock('enabled')
        }, bridgeLocks.enabled ? '🔗 硬件锁已开启' : '🔓 硬件锁已关闭')
      ),
      bridgeLocks.enabled && h('div', { style: { display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' } },
        h('span', {
          className: `nai5-lock-chip ${bridgeLocks.lockStyle ? 'active' : ''}`,
          onClick: () => toggleBridgeLock('lockStyle')
        }, bridgeLocks.lockStyle ? '✓ 锁画风' : '锁画风'),
        h('span', {
          className: `nai5-lock-chip ${bridgeLocks.lockAspect ? 'active' : ''}`,
          onClick: () => toggleBridgeLock('lockAspect')
        }, bridgeLocks.lockAspect ? `✓ 锁画幅(${width}×${height})` : '锁画幅'),
        h('span', {
          className: `nai5-lock-chip ${bridgeLocks.lockSeed ? 'active' : ''}`,
          onClick: () => {
            if (!bridgeLocks.lockSeed && seedMode !== 'fixed') {
              setSeedMode('fixed');
              if (!seed && latestImage?.seed) setSeed(latestImage.seed);
            }
            toggleBridgeLock('lockSeed');
          }
        }, bridgeLocks.lockSeed ? '✓ 锁Seed' : '锁Seed'),
        h('span', {
          className: `nai5-lock-chip ${bridgeLocks.lockChars2D ? 'active' : ''}`,
          onClick: () => toggleBridgeLock('lockChars2D')
        }, bridgeLocks.lockChars2D ? `✓ 锁2D站位(${characterPrompts.length}人)` : '锁2D站位'),
        h('span', {
          className: `nai5-lock-chip ${bridgeLocks.lockRatingUc ? 'active' : ''}`,
          onClick: () => toggleBridgeLock('lockRatingUc')
        }, bridgeLocks.lockRatingUc ? '✓ 锁负向UC' : '锁负向UC')
      ),
      h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', marginTop: '4px' } },
        h('span', {
          className: `nai5-lock-chip ${autoMirrorAgent ? 'active' : ''}`,
          onClick: () => setAutoMirrorAgent(m => !m)
        }, autoMirrorAgent ? '⚡ 自动镜像对话出图' : '○ 暂停自动镜像'),
        h('button', {
          type: 'button',
          className: 'nai5-btn primary xs',
          onClick: () => sendToChatComposer(null)
        }, '💬 推送当前配方至对话')
      )
    )
  );

  // ---------- Main Split Return: Left Inspector + Resizer + Right Hero Stage ----------
  return h('div', {
    ref: workbenchBodyRef,
    className: 'nai5-workbench-body',
    onDragOver: handleDragOverImage,
    onDrop: handleDropImage
  },
    // LEFT COLUMN: 3-Layer Creation Inspector
    h('aside', {
      className: 'nai5-inspector',
      style: { width: `${mainColSplitX}%`, flex: 'none' }
    },
      // Layer 1: Pinned Sub-Tab Bar
      h('div', { className: 'nai5-inspector-tabs' },
        h('button', {
          type: 'button',
          className: `nai5-insp-tab ${inspectorTab === 'prompt' ? 'active' : ''}`,
          onClick: () => setInspectorTab('prompt')
        }, '✦ 提示词'),
        h('button', {
          type: 'button',
          className: `nai5-insp-tab ${inspectorTab === 'chars' ? 'active' : ''}`,
          onClick: () => setInspectorTab('chars')
        },
          '◎ 角色与参考',
          totalCharAndRefs > 0 && h('span', { className: 'nai5-tab-badge' }, totalCharAndRefs)
        ),
        h('button', {
          type: 'button',
          className: `nai5-insp-tab ${inspectorTab === 'params' ? 'active' : ''}`,
          onClick: () => setInspectorTab('params')
        },
          '⚙ 参数与协同',
          bridgeLocks.enabled && h('span', { className: 'nai5-tab-dot', title: 'DSH 对话硬件锁已启用' })
        )
      ),

      // Layer 2: Scrollable Content Area (flex: 1, zero overlap)
      h('div', { className: 'nai5-inspector-scroll' },
        inspectorTab === 'prompt' && renderPromptTab(),
        inspectorTab === 'chars' && renderCharsAndRefsTab(),
        inspectorTab === 'params' && renderParamsAndBridgeTab()
      ),

      // Layer 3: Pinned Sticky Footer (Quick Status Chips + Generate CTA)
      h('div', { className: 'nai5-inspector-footer' },
        h('div', { className: 'nai5-quick-chips' },
          h('button', {
            type: 'button',
            className: `nai5-status-chip ${effort !== 'medium' && Number(steps) >= 45 ? 'is-accent' : ''}`,
            title: '点击循环切换：极速 14 → 高质 28 → 超高 50',
            onClick: toggleQuickEffort
          }, effort === 'medium' ? '🐇 极速 14' : (Number(steps) >= 45 ? `💎 超高 ${steps}` : `⚡ 高质 ${steps}`)),
          h('button', {
            type: 'button',
            className: 'nai5-status-chip',
            title: '点击在 参数与协同 标签精确调整分辨率',
            onClick: () => setInspectorTab('params')
          }, `${width}×${height}`),
          h('button', {
            type: 'button',
            className: `nai5-status-chip ${seedMode === 'fixed' ? 'is-accent' : ''}`,
            title: '点击快速切换 随机 / 固定 Seed',
            onClick: () => {
              if (seedMode === 'random') {
                setSeedMode('fixed');
                if (!seed) setSeed(latestImage?.seed || Math.floor(Math.random() * 4294967295));
              } else {
                setSeedMode('random');
              }
            }
          }, seedMode === 'fixed' ? `🔒 #${seed || '固定'}` : '🎲 随机'),
          genMode === 'txt2img' && h('button', {
            type: 'button',
            className: `nai5-status-chip ${batchCount > 1 ? 'is-accent' : ''}`,
            title: '点击循环切换生成张数 (1× / 2× / 4×)',
            onClick: cycleBatchCount
          }, `${batchCount}× 连出`),
          (vibeReferences.length + preciseReferences.length > 0) && h('button', {
            type: 'button',
            className: 'nai5-status-chip is-accent',
            onClick: () => setInspectorTab('chars')
          }, `参考×${vibeReferences.length + preciseReferences.length}`)
        ),
        h('button', {
          type: 'button',
          className: 'nai5-btn primary nai5-generate-cta',
          disabled: isGenerating,
          onClick: handleGenerate
        },
          h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '7px' } },
            h(Icon, { name: 'sparkles', size: 15 }),
            isGenerating
              ? '正在直连渲染并归档...'
              : (genMode === 'inpaint'
                  ? '立即局部重绘 (Inpaint)'
                  : genMode === 'img2img'
                    ? '立即图生图 (Img2Img)'
                    : (batchCount > 1 ? `立即连续生成 ${batchCount} 张` : '立即生成图像'))
          ),
          h('span', {
            className: `nai5-cta-cost ${costInfo.free ? 'free' : ''}`
          }, costInfo.label)
        )
      )
    ),

    // SPLITTER
    h('div', {
      className: 'nai5-main-col-splitter',
      title: '左右拖拽调节工作台分栏宽度（双击恢复 41:59）',
      onDoubleClick: () => setMainColSplitX(41),
      onMouseDown: (e) => {
        e.preventDefault();
        const bodyW = workbenchBodyRef.current ? workbenchBodyRef.current.clientWidth : 1160;
        dragRef.current = {
          mode: 'split_main_col',
          startX: e.clientX,
          startY: e.clientY,
          bodyW,
          origPct: mainColSplitX
        };
      }
    }),

    // RIGHT COLUMN: Expansive Hero Canvas Stage
    h('main', { className: 'nai5-stage-col' },
      // Row 1: Top Mode HUD + Seed / Compare HUD
      h('div', { className: 'nai5-stage-hud' },
        h('div', { className: 'nai-seg-mini' },
          [
            { id: 'txt2img', label: '文生图' },
            { id: 'img2img', label: '图生图' },
            { id: 'inpaint', label: '局部重绘' }
          ].map(m =>
            h('button', {
              key: m.id,
              type: 'button',
              className: `nai-seg-mini-btn ${genMode === m.id ? 'active' : ''}`,
              onClick: () => setGenMode(m.id)
            }, m.label)
          )
        ),
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 } },
          compareBeforeItem && latestImage && genMode !== 'inpaint' && h('button', {
            type: 'button',
            className: `nai5-btn xs ${compareActive ? 'primary' : ''}`,
            onClick: () => setCompareActive(v => !v)
          }, compareActive ? '退出 A/B 对比' : 'A/B 对比'),
          latestImage
            ? h('button', {
                type: 'button',
                className: 'nai5-btn xs',
                title: '点击锁定并复制此成品 Seed',
                onClick: () => {
                  setSeedMode('fixed');
                  setSeed(latestImage.seed);
                  copyToClipboard(String(latestImage.seed || ''), `Seed: ${latestImage.seed}`);
                }
              }, `${latestImage.width || width}×${latestImage.height || height} · #${latestImage.seed}`)
            : h('span', { className: 'nai-drop-hint' }, '📥 支持直接拖入 PNG 读取配方')
        )
      ),

      // Row 2: Contextual Sub-Bar (ONLY shown when img2img or inpaint is active)
      (genMode === 'img2img' || genMode === 'inpaint') && h('div', { className: 'nai5-stage-subbar' },
        sourceImagePreviewUrl && h('img', {
          src: sourceImagePreviewUrl,
          style: { width: '32px', height: '32px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--fx-border-card)', flex: 'none' }
        }),
        h('button', {
          type: 'button',
          className: 'nai5-btn xs',
          onClick: () => modeFileRef.current && modeFileRef.current.click()
        }, sourceImage ? '换底图' : '选择底图'),
        latestImage && h('button', {
          type: 'button',
          className: 'nai5-btn xs',
          onClick: () => {
            const p = latestImage.source_path || latestImage.filePath;
            if (p) {
              setSourceImage(p);
              setSourceImagePreviewUrl(getImageUrl(p, false));
            }
          }
        }, '用当前图'),
        h('input', {
          ref: modeFileRef,
          type: 'file',
          accept: 'image/png,image/jpeg,image/webp',
          style: { display: 'none' },
          onChange: (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            const r = new FileReader();
            r.onload = () => typeof r.result === 'string' && handleUploadSourceImage(r.result);
            r.readAsDataURL(file);
            e.target.value = '';
          }
        }),
        genMode === 'img2img'
          ? h(React.Fragment, null,
              h('label', { className: 'nai-subbar-slider' },
                h('span', null, `强度 ${Number(i2iStrength).toFixed(2)}`),
                h('input', { type: 'range', className: 'nai5-slider', min: 0.05, max: 0.95, step: 0.05, value: i2iStrength, onChange: e => setI2iStrength(Number(e.target.value)) })
              ),
              h('label', { className: 'nai-subbar-slider' },
                h('span', null, `噪点 ${Number(i2iNoise).toFixed(2)}`),
                h('input', { type: 'range', className: 'nai5-slider', min: 0, max: 0.5, step: 0.05, value: i2iNoise, onChange: e => setI2iNoise(Number(e.target.value)) })
              )
            )
          : h(React.Fragment, null,
              h('label', { className: 'nai-subbar-slider' },
                h('span', null, `融合强度 ${Number(inpaintStrength).toFixed(2)}`),
                h('input', { type: 'range', className: 'nai5-slider', min: 0.1, max: 1, step: 0.05, value: inpaintStrength, onChange: e => setInpaintStrength(Number(e.target.value)) })
              ),
              h('label', { style: { display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--fx-text-secondary)', cursor: 'pointer' } },
                h('input', { type: 'checkbox', checked: Boolean(colorCorrect), onChange: e => setColorCorrect(e.target.checked) }),
                '色彩校正'
              )
            )
      ),

      // Row 3: Expansive Hero Canvas Viewport
      h('div', { className: 'nai5-stage-viewport' },
        genMode === 'inpaint'
          ? h(InpaintMaskEditor, {
              sourceImageUrl: sourceImagePreviewUrl,
              width,
              height,
              onChangeMask: setInpaintMask,
              onUploadSource: handleUploadSourceImage,
              onClearSource: () => {
                setSourceImage('');
                setSourceImagePreviewUrl('');
                setInpaintMask('');
                setGenMode('txt2img');
              }
            })
          : (compareActive && compareBeforeItem && latestFullUrl
              ? h(CompareSlider, {
                  beforeUrl: getImageUrl(compareBeforeItem.source_path || compareBeforeItem.filePath, false),
                  afterUrl: latestFullUrl,
                  beforeLabel: '处理前',
                  afterLabel: '成图'
                })
              : (latestImage
                  ? h('img', {
                      src: latestFullUrl,
                      className: 'nai5-stage-img',
                      draggable: true,
                      onDragStart: (e) => handleDragStart(e, latestImage),
                      onClick: () => {
                        setPreviewIndex(null);
                        setPreviewCustomItem(latestImage);
                        resetZoom();
                      }
                    })
                  : h('div', { className: 'nai5-stage-empty' },
                      h(Icon, { name: 'maple', size: 30, style: { color: 'var(--fx-crimson-soft)', opacity: 0.72 } }),
                      h('div', { style: { fontSize: '13.5px', fontWeight: 700, color: 'var(--fx-text-primary)', letterSpacing: '0.02em' } }, `${width} × ${height} (${aspectRatio})`),
                      h('div', { style: { fontSize: '11.5px', color: 'var(--fx-text-secondary)', maxWidth: '300px', lineHeight: 1.55 } }, '在左侧编织提示词后点击下方「立即生成图像」，或直接拖入 PNG 自动解析配方')
                    ))),

        isBusyAny && h('div', { className: 'nai5-stage-loading' },
          h(Icon, { name: 'sparkles', size: 14, style: { color: 'var(--fx-crimson-soft)' } }),
          h('span', null, busyPostAction ? '正在执行后处理引擎...' : 'NovelAI 极速渲染与归档中...')
        )
      ),

      // Row 4: Single-Row Glass Action Dock (Upward Popovers)
      latestImage && h(PostProcessToolbar, {
        hasImage: Boolean(latestImage),
        isFavorite: Boolean(latestImage?.isFavorite),
        busyAction: busyPostAction,
        onUpscale: (scale) => handleUpscale(latestImage, scale),
        onDirector: (opts) => handleDirector(latestImage, opts),
        onSendToChat: () => sendToChatComposer(latestImage),
        onForkToWorkbench: () => handleForkToWorkbench(latestImage),
        onSendToImg2Img: () => handleSendToImg2Img(latestImage),
        onSendToInpaint: () => handleSendToInpaint(latestImage),
        onToggleFavorite: onToggleFavorite ? () => onToggleFavorite(latestImage.source_path || latestImage.filePath) : null,
        onCopyImage: () => copyImageToClipboard(latestImage.source_path || latestImage.filePath),
        onReveal: () => handleRevealInExplorer(latestImage.source_path || latestImage.filePath),
        onOpenLightbox: () => {
          setPreviewIndex(null);
          setPreviewCustomItem(latestImage);
          resetZoom();
        }
      }),

      // Row 5: Collapsible Bottom Filmstrip
      history.length > 0 && h('div', { className: 'nai5-filmstrip-wrap' },
        h('button', {
          type: 'button',
          className: 'nai5-film-toggle',
          title: showFilmstrip ? '收起底部历史缩略图以获得最大画布视野' : '展开最近生成历史',
          onClick: () => setShowFilmstrip(v => !v)
        }, showFilmstrip ? '▾' : `▸ 近期 (${Math.min(16, history.length)})`),
        showFilmstrip && h('div', { className: 'nai5-filmstrip' },
          history.slice(0, 16).map((item, i) => {
            const p = item.source_path || item.filePath;
            const isCur = latestImage && (latestImage.source_path || latestImage.filePath) === p;
            return h('img', {
              key: p || i,
              src: getImageUrl(p, true),
              className: `nai5-film-thumb ${isCur ? 'active' : ''}`,
              title: `点击切换画布预览 · 双击灯箱看大图 (Seed: ${item.seed})`,
              onClick: () => { setCompareActive(false); setLatestImage(item); },
              onDoubleClick: () => {
                setPreviewCustomItem(null);
                setPreviewIndex(i);
                resetZoom();
              }
            });
          })
        )
      )
    )
  );
}
