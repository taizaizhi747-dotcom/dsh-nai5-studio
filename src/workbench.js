function StudioWorkbench({
  workbenchBodyRef,
  splitRowRef,
  dragRef,
  mainColSplitX,
  setMainColSplitX,
  styleSplitX,
  setStyleSplitX,
  vertSplitRatio,
  setVertSplitRatio,
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
  showStyleAndUc,
  setShowStyleAndUc,
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
  return h('div', { ref: workbenchBodyRef, className: 'nai5-workbench-body' },
    h('div', {
      className: 'nai5-col-left',
      style: { width: `${mainColSplitX}%`, flex: 'none' }
    },
      accountsLoaded && accountsCount === 0 && h('div', {
        className: 'nai5-card',
        style: {
          padding: '10px 12px',
          background: 'rgba(224, 40, 79, 0.12)',
          borderColor: 'rgba(224, 40, 79, 0.42)',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          flexWrap: 'wrap'
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

      h('div', { className: 'nai5-bridge-bar' },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' } },
          h('button', {
            type: 'button',
            className: `nai5-btn xs ${bridgeLocks.enabled ? 'primary' : ''}`,
            title: '开启后，DSH 对话里的 AI 调用生图时将继承下方勾选的工作台参数',
            onClick: () => toggleBridgeLock('enabled')
          }, bridgeLocks.enabled ? '🔗 参数锁已赋能对话' : '🔓 对话参数锁已关闭'),
          bridgeLocks.enabled && h(React.Fragment, null,
            h('span', {
              className: `nai5-lock-chip ${bridgeLocks.lockStyle ? 'active' : ''}`,
              title: '强制对话生图使用当前工作台画师风格串',
              onClick: () => toggleBridgeLock('lockStyle')
            }, bridgeLocks.lockStyle ? '✓ 锁画风' : '锁画风'),
            h('span', {
              className: `nai5-lock-chip ${bridgeLocks.lockAspect ? 'active' : ''}`,
              title: '强制对话生图使用当前工作台画幅宽高',
              onClick: () => toggleBridgeLock('lockAspect')
            }, bridgeLocks.lockAspect ? `✓ 锁画幅(${width}×${height})` : '锁画幅'),
            h('span', {
              className: `nai5-lock-chip ${bridgeLocks.lockSeed ? 'active' : ''}`,
              title: '当固定 Seed 时，强制对话生图使用该 Seed',
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
              title: '将工作台 2D 角色坐标自动注入给对话生图',
              onClick: () => toggleBridgeLock('lockChars2D')
            }, bridgeLocks.lockChars2D ? `✓ 锁2D站位(${characterPrompts.length}人)` : '锁2D站位'),
            h('span', {
              className: `nai5-lock-chip ${bridgeLocks.lockRatingUc ? 'active' : ''}`,
              title: '强制对话生图使用当前工作台的负向排他词 (UC)',
              onClick: () => toggleBridgeLock('lockRatingUc')
            }, bridgeLocks.lockRatingUc ? '✓ 锁负向UC' : '锁负向UC')
          )
        ),
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
          h('span', {
            className: `nai5-lock-chip ${autoMirrorAgent ? 'active' : ''}`,
            title: '当你在 DSH 对话生图时，自动将新图与提示词实时同步回工作台',
            onClick: () => setAutoMirrorAgent(m => !m)
          }, autoMirrorAgent ? '⚡ 自动镜像对话出图' : '○ 暂停镜像'),
          h('button', {
            type: 'button',
            className: 'nai5-btn primary xs',
            title: '将当前工作台调好的配方与 Seed 送入 DSH 聊天输入框继续演进',
            onClick: () => sendToChatComposer(null)
          }, '💬 送入对话继续演进')
        )
      ),

      h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' } },
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

      h('div', {
        className: 'nai5-card adaptive-flex',
        style: { flex: 1, minHeight: '145px' }
      },
        h('div', { className: 'nai5-label-bar', style: { flexWrap: 'wrap' } },
          h('span', { className: 'nai5-label-title' },
            h(Icon, { name: 'sparkles', size: 13, style: { color: 'var(--fx-crimson-soft)' } }),
            '正向提示词 (Positive Prompt)'
          ),
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' } },
            h('button', {
              type: 'button',
              className: 'nai5-btn xs',
              title: '选中标签或将光标放在词内，点击提升 +0.1 权重 (1.1::tag::)',
              onClick: () => setPositivePrompt(prev => adjustPromptWeight(prev, posTextareaRef.current, 0.1))
            }, '+权重 1.1::'),
            h('button', {
              type: 'button',
              className: 'nai5-btn xs',
              title: '选中标签或将光标放在词内，点击降低 -0.1 权重或添加负权重',
              onClick: () => setPositivePrompt(prev => adjustPromptWeight(prev, posTextareaRef.current, -0.1))
            }, '-权重 ::'),
            h('button', {
              type: 'button',
              className: 'nai5-btn xs',
              title: '自动清理中文逗号、多余空格与数字画师权重粘连',
              onClick: () => {
                setPositivePrompt(prev => formatPromptText(prev));
                showToast('已规范化提示词格式');
              }
            }, h(Icon, { name: 'wand', size: 11 }), '格式化'),
            h('button', {
              type: 'button',
              className: `nai5-btn xs ${showInlineSearch ? 'primary' : ''}`,
              title: '免切页内联检索同义词与已挂载的可选词库/法典',
              onClick: () => setShowInlineSearch(s => !s)
            }, h(Icon, { name: 'search', size: 11 }), '速查词库'),
            h('button', {
              type: 'button',
              className: 'nai5-btn xs',
              onClick: () => copyToClipboard(positivePrompt, '正向提示词')
            }, h(Icon, { name: 'copy', size: 11 })),
            h('button', {
              type: 'button',
              className: 'nai5-btn xs',
              title: '清空正向提示词',
              onClick: () => setPositivePrompt('')
            }, h(Icon, { name: 'trash', size: 11 }))
          )
        ),

        showInlineSearch && h('div', {
          style: {
            padding: '8px',
            borderRadius: '8px',
            background: 'var(--fx-glass-popover)',
            border: '1px solid rgba(99, 102, 241, 0.35)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }
        },
          h('div', { style: { display: 'flex', gap: '6px' } },
            h('input', {
              type: 'text',
              className: 'nai5-input',
              style: { flex: 1, fontSize: '11.5px', padding: '5px 8px' },
              placeholder: '输入中英文查询同义词或已导入法典（如：逆光、旗袍、仰视）...',
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
            style: {
              display: 'flex',
              flexWrap: 'wrap',
              gap: '5px',
              maxHeight: '130px',
              overflowY: 'auto'
            }
          },
            (inlineResults.danbooru?.results || []).map(r =>
              h('button', {
                key: r.tag,
                type: 'button',
                className: 'nai5-btn xs',
                style: { background: 'rgba(99, 102, 241, 0.12)', borderColor: 'rgba(99, 102, 241, 0.3)' },
                title: `点击插入标签: ${r.tag}`,
                onClick: () => {
                  setPositivePrompt(prev => prev.trim() ? `${prev.trim()}, ${r.tag}` : r.tag);
                  showToast(`已插入 ${r.tag}`);
                }
              },
                h('span', { style: { color: '#e0e7ff', fontWeight: 600 } }, r.tag),
                r.cn_name && h('span', { style: { color: 'var(--fx-text-secondary)', fontSize: '10px' } }, r.cn_name)
              )
            ),
            (inlineResults.codex?.results || []).map((c, idx) =>
              h('button', {
                key: 'cx_' + idx,
                type: 'button',
                className: 'nai5-btn xs',
                style: { background: 'rgba(16, 185, 129, 0.12)', borderColor: 'rgba(16, 185, 129, 0.3)' },
                title: `${c.codex}: ${c.prompt}`,
                onClick: () => {
                  setPositivePrompt(prev => prev.trim() ? `${prev.trim()}, ${c.prompt}` : c.prompt);
                  showToast(`已插入法典词串: ${c.name}`);
                }
              },
                h('span', { style: { color: '#6ee7b7', fontWeight: 600 } }, `[法典] ${c.name}`)
              )
            )
          )
        ),

        h('textarea', {
          ref: posTextareaRef,
          className: 'nai5-textarea',
          rows: 4,
          placeholder: '输入全局画面描述、人数、构图机位、环境光影与动作交互...',
          value: positivePrompt,
          onChange: e => setPositivePrompt(e.target.value)
        })
      ),

      h('div', { className: 'nai5-card' },
        h('div', { className: 'nai5-label-bar', style: { flexWrap: 'wrap' } },
          h('span', { className: 'nai5-label-title' },
            h(Icon, { name: 'users', size: 13, style: { color: 'var(--fx-crimson-soft)' } }),
            'V5 多角色 2D 站位画布与独立分框',
            h('span', {
              style: {
                fontSize: '10px',
                padding: '1px 7px',
                borderRadius: '999px',
                background: characterPrompts.length > 0 ? 'rgba(224, 40, 79, 0.18)' : 'rgba(255, 255, 255, 0.06)',
                color: characterPrompts.length > 0 ? 'var(--fx-crimson-soft)' : 'var(--fx-text-muted)'
              }
            }, `${characterPrompts.length} / ${MAX_V5_CHARACTERS} 角色`)
          ),
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' } },
            h('button', { type: 'button', className: 'nai5-btn xs', title: '2 人左右对称 (A:0.25 / B:0.75)', onClick: () => applyCharLayoutPreset('2lr') }, '双人左右'),
            h('button', { type: 'button', className: 'nai5-btn xs', title: '2 人上下/前后', onClick: () => applyCharLayoutPreset('2tb') }, '双人上下'),
            h('button', { type: 'button', className: 'nai5-btn xs', title: '3 人横向并排', onClick: () => applyCharLayoutPreset('3row') }, '三人并排'),
            h('button', { type: 'button', className: 'nai5-btn xs', title: '4 人 2×2 矩阵', onClick: () => applyCharLayoutPreset('4grid') }, '四人矩阵'),
            h('button', { type: 'button', className: 'nai5-btn xs', title: '6 人双排群像', onClick: () => applyCharLayoutPreset('6group') }, '六人群像'),
            h('button', { type: 'button', className: 'nai5-btn xs', title: '9 人 3×3 矩阵', onClick: () => applyCharLayoutPreset('9grid') }, '九人方阵'),
            h('button', { type: 'button', className: 'nai5-btn xs', title: '12 人三排群像', onClick: () => applyCharLayoutPreset('12group') }, '十二群像'),
            h('button', {
              type: 'button',
              className: 'nai5-btn primary xs',
              disabled: characterPrompts.length >= MAX_V5_CHARACTERS,
              title: characterPrompts.length >= MAX_V5_CHARACTERS ? `已达 NovelAI V5 ${MAX_V5_CHARACTERS} 角色上限` : `新增独立角色控制框 (最多 ${MAX_V5_CHARACTERS} 个)`,
              onClick: addCharacterBox
            }, h(Icon, { name: 'plus', size: 11 }), `添加角色 (${characterPrompts.length}/${MAX_V5_CHARACTERS})`),
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
          ? h('div', {
              style: {
                fontSize: '11px',
                color: 'var(--fx-text-muted)',
                padding: '8px 10px',
                borderRadius: '7px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px dashed rgba(255,255,255,0.08)'
              }
            }, `当前为单框模式。支持 NovelAI V5 最高 ${MAX_V5_CHARACTERS} 角色独立控制（A ~ V）：点击上方快捷排布或「+ 添加角色」即可在 2D 画布上拖拽设定各角色 (X, Y) 坐标并隔离特征词。`)
          : (showCharBoxes && h('div', { className: 'nai5-stage2d-wrap' },
              h(CharacterStage2D, {
                characterPrompts,
                width,
                height,
                onUpdateCoord: updateCharacterCoord2D
              }),
              h('div', { className: 'nai5-char-cards-grid' },
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
                        ocPresets.length > 0 && h('select', {
                          className: 'nai5-select',
                          style: { width: '132px', padding: '2px 6px', fontSize: '10.5px' },
                          value: '',
                          onChange: (e) => {
                            const oc = ocPresets.find(o => o.id === e.target.value);
                            if (oc) {
                              updateCharacterBox(idx, 'prompt', oc.prompt);
                              showToast(`角色 ${letter} 已载入 ${oc.name}`);
                            }
                          }
                        },
                          h('option', { value: '' }, '快速填入 OC...'),
                          ocPresets.map(o => h('option', { key: o.id, value: o.id }, o.name))
                        ),
                        h('button', {
                          type: 'button',
                          className: 'nai5-btn xs',
                          title: '提升选中词权重',
                          onClick: () => updateCharacterBox(idx, 'prompt', adjustPromptWeight(cp.prompt, charTextareaRefs.current[idx], 0.1))
                        }, '+权'),
                        h('button', {
                          type: 'button',
                          className: 'nai5-btn xs',
                          title: '降低选中词权重',
                          onClick: () => updateCharacterBox(idx, 'prompt', adjustPromptWeight(cp.prompt, charTextareaRefs.current[idx], -0.1))
                        }, '-权'),
                        h('button', {
                          type: 'button',
                          className: 'nai5-btn ghost xs',
                          title: '移除该角色分框',
                          onClick: () => removeCharacterBox(idx)
                        }, h(Icon, { name: 'trash', size: 11 }))
                      )
                    ),
                    h('textarea', {
                      ref: el => { charTextareaRefs.current[idx] = el; },
                      className: 'nai5-textarea',
                      rows: 2,
                      style: { minHeight: '42px', fontSize: '11px' },
                      placeholder: `角色 ${letter} 外观、发型、服装与专属动作 (如 source#hug / target#hug)...`,
                      value: cp.prompt,
                      onChange: e => updateCharacterBox(idx, 'prompt', e.target.value)
                    }),
                    h('input', {
                      type: 'text',
                      className: 'nai5-input',
                      style: { fontSize: '10.5px', padding: '4px 8px', color: 'var(--fx-text-secondary)' },
                      placeholder: `角色 ${letter} 专属排他负向 UC (填入对方发色/瞳色特征防止串色)...`,
                      value: cp.negativePrompt || '',
                      onChange: e => updateCharacterBox(idx, 'negativePrompt', e.target.value)
                    })
                  );
                })
              )
            ))
      ),

      showStyleAndUc && h('div', {
        className: 'nai5-v-splitter',
        title: '上下拖拽调节「正向提示词」与「风格串/负向排他」区域高度占比（双击重置比例）',
        onDoubleClick: () => setVertSplitRatio(1.05),
        onMouseDown: (e) => {
          e.preventDefault();
          dragRef.current = {
            mode: 'split_v',
            startX: e.clientX,
            startY: e.clientY,
            origRatio: vertSplitRatio
          };
        }
      }),

      h('div', {
        className: `nai5-card ${showStyleAndUc ? 'adaptive-flex' : ''}`,
        style: showStyleAndUc ? { flex: vertSplitRatio, minHeight: '155px' } : { flex: 'none' }
      },
        h('div', { className: 'nai5-label-bar', style: { flexWrap: 'wrap' } },
          h('span', { className: 'nai5-label-title' },
            h(Icon, { name: 'code', size: 13, style: { color: 'var(--fx-crimson-soft)' } }),
            '画风风格串 (stylePrompt) & 负向排他 (UC)',
            showStyleAndUc && h('span', {
              style: {
                fontSize: '10px',
                fontWeight: 500,
                color: 'var(--fx-text-muted)',
                marginLeft: '4px'
              }
            }, '· 可拖拽分栏 / 自适应拉伸')
          ),
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' } },
            h('button', {
              type: 'button',
              className: `nai5-btn xs ${ucMode === 'safe' ? 'primary' : ''}`,
              onClick: () => { setUcMode('safe'); setNegativePrompt(UC_PRESETS.safe); }
            }, 'Safe 全年龄'),
            h('button', {
              type: 'button',
              className: `nai5-btn xs ${ucMode === 'standard' ? 'primary' : ''}`,
              onClick: () => { setUcMode('standard'); setNegativePrompt(UC_PRESETS.standard); }
            }, '标准质量'),
            h('button', {
              type: 'button',
              className: `nai5-btn xs ${ucMode === 'minimal' ? 'primary' : ''}`,
              onClick: () => { setUcMode('minimal'); setNegativePrompt(UC_PRESETS.minimal); }
            }, '极简'),
            h('button', {
              type: 'button',
              className: 'nai5-btn xs',
              title: showStyleAndUc ? '折叠风格串与负向词面板' : '展开风格串与负向词面板',
              onClick: () => setShowStyleAndUc(s => !s)
            }, h(Icon, { name: showStyleAndUc ? 'chevronUp' : 'chevronDown', size: 11 }))
          )
        ),
        showStyleAndUc && h('div', {
          ref: splitRowRef,
          className: 'nai5-split-row'
        },
          h('div', {
            className: 'nai5-split-pane',
            style: { width: `${styleSplitX}%`, flex: 'none' }
          },
            h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
              h('span', { style: { fontSize: '10.5px', fontWeight: 600, color: 'var(--fx-text-secondary)' } }, '画风风格串 (Style Prompt)'),
              h('button', {
                type: 'button',
                className: 'nai5-btn ghost xs',
                style: { padding: '1px 5px', fontSize: '10px' },
                title: '复制画风风格串',
                onClick: () => copyToClipboard(stylePrompt, '画风风格串')
              }, h(Icon, { name: 'copy', size: 10 }))
            ),
            h('textarea', {
              className: 'nai5-textarea',
              rows: 3,
              style: { fontSize: '11px', flex: 1, minHeight: '90px' },
              placeholder: '可选画师标签与笔触质感词（例如 <style> clean lineart, cel shading </style>）...',
              value: stylePrompt,
              onChange: e => setStylePrompt(e.target.value)
            })
          ),

          h('div', {
            className: 'nai5-h-splitter',
            title: '左右拖拽调节「风格串」与「负向提示词」宽度占比（双击恢复 50:50）',
            onDoubleClick: () => setStyleSplitX(50),
            onMouseDown: (e) => {
              e.preventDefault();
              const rowW = splitRowRef.current ? splitRowRef.current.clientWidth : 520;
              dragRef.current = {
                mode: 'split_h',
                startX: e.clientX,
                startY: e.clientY,
                rowW,
                origPct: styleSplitX
              };
            }
          }),

          h('div', {
            className: 'nai5-split-pane',
            style: { flex: 1 }
          },
            h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
              h('span', { style: { fontSize: '10.5px', fontWeight: 600, color: 'var(--fx-text-secondary)' } }, '全局负向提示词 (Negative UC)'),
              h('button', {
                type: 'button',
                className: 'nai5-btn ghost xs',
                style: { padding: '1px 5px', fontSize: '10px' },
                title: '复制全局负向提示词',
                onClick: () => copyToClipboard(negativePrompt, '全局负向提示词')
              }, h(Icon, { name: 'copy', size: 10 }))
            ),
            h('textarea', {
              className: 'nai5-textarea',
              rows: 3,
              style: { fontSize: '11px', flex: 1, minHeight: '90px' },
              placeholder: '输入全局负向排他词 (Undesired Content)...',
              value: negativePrompt,
              onChange: e => setNegativePrompt(e.target.value)
            })
          )
        )
      )
    ),

    h('div', {
      className: 'nai5-main-col-splitter',
      title: '左右拖拽调节工作台左栏与右栏宽度比例（双击恢复 57:43）',
      onDoubleClick: () => setMainColSplitX(57),
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

    h('div', { className: 'nai5-col-right' },
      h('div', { className: 'nai5-card preview-card' },
        h('div', { className: 'nai5-label-bar', style: { flex: 'none' } },
          h('span', { className: 'nai5-label-title' },
            h(Icon, { name: 'eye', size: 13, style: { color: 'var(--fx-crimson-soft)' } }),
            '实时舞台预览'
          ),
          latestImage && h('span', { style: { fontSize: '10.5px', color: 'var(--fx-text-secondary)', fontFamily: 'monospace' } },
            `Seed: ${latestImage.seed}`
          )
        ),
        h('div', { className: 'nai5-preview-stage' },
          latestImage
            ? h('img', {
                src: latestFullUrl,
                className: 'nai5-preview-img',
                draggable: true,
                onDragStart: (e) => handleDragStart(e, latestImage),
                onClick: () => {
                  setPreviewIndex(null);
                  setPreviewCustomItem(latestImage);
                  resetZoom();
                }
              })
            : h('div', {
                style: {
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  color: 'var(--fx-text-muted)',
                  fontSize: '11.5px'
                }
              },
                h(Icon, { name: 'sparkles', size: 24, style: { opacity: 0.4 } }),
                h('span', null, `${width} × ${height} (${aspectRatio})`),
                h('span', { style: { fontSize: '10.5px' } }, '点击下方按钮生成作品')
              )
        ),
        latestImage && h('div', {
          style: {
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '5px',
            flex: 'none'
          }
        },
          h('button', {
            type: 'button',
            className: 'nai5-btn xs',
            onClick: () => {
              setPreviewIndex(null);
              setPreviewCustomItem(latestImage);
              resetZoom();
            }
          }, h(Icon, { name: 'maximize', size: 11 }), '灯箱大图'),
          h('button', {
            type: 'button',
            className: 'nai5-btn primary xs',
            title: '将此图配方与 Seed 送回 DSH 聊天框继续演进',
            onClick: () => sendToChatComposer(latestImage)
          }, '💬 送入对话'),
          h('button', {
            type: 'button',
            className: 'nai5-btn xs',
            onClick: () => handleForkToWorkbench(latestImage)
          }, h(Icon, { name: 'zap', size: 11 }), '回灌配方'),
          h('button', {
            type: 'button',
            className: 'nai5-btn xs',
            onClick: () => copyImageToClipboard(latestImage.source_path || latestImage.filePath)
          }, h(Icon, { name: 'copy', size: 11 }), '复制图片'),
          h('button', {
            type: 'button',
            className: 'nai5-btn xs',
            onClick: () => handleRevealInExplorer(latestImage.source_path || latestImage.filePath)
          }, h(Icon, { name: 'folder', size: 11 }), '定位')
        ),
        history.length > 0 && h('div', { className: 'nai5-filmstrip' },
          history.slice(0, 12).map((item, i) => {
            const p = item.source_path || item.filePath;
            const isCur = latestImage && (latestImage.source_path || latestImage.filePath) === p;
            return h('img', {
              key: p || i,
              src: getImageUrl(p, true),
              className: `nai5-film-thumb ${isCur ? 'active' : ''}`,
              title: `点击预览 · 双击打开大图 (Seed: ${item.seed})`,
              onClick: () => setLatestImage(item),
              onDoubleClick: () => {
                setPreviewCustomItem(null);
                setPreviewIndex(i);
                resetZoom();
              }
            });
          })
        )
      ),

      h('div', { className: 'nai5-params-grid' },
        h('div', { className: 'nai5-card' },
          h('div', { className: 'nai5-label-bar' },
            h('span', { className: 'nai5-label-title' }, '画幅比例与分辨率'),
            h('span', { style: { fontSize: '11px', color: 'var(--fx-crimson-soft)', fontFamily: 'monospace' } },
              `${width} × ${height} (${(width * height / (1024 * 1024)).toFixed(2)} MP)`
            )
          ),
          h('div', { className: 'nai5-ratio-grid' },
            [
              { r: '2:3', label: '2:3 竖', w: 10, h: 14 },
              { r: '3:2', label: '3:2 横', w: 14, h: 10 },
              { r: '1:1', label: '1:1 方', w: 12, h: 12 },
              { r: '9:16', label: '9:16 屏', w: 8, h: 14 },
              { r: '16:9', label: '16:9 宽', w: 15, h: 9 }
            ].map(item =>
              h('button', {
                key: item.r,
                type: 'button',
                className: `nai5-ratio-pill ${aspectRatio === item.r ? 'active' : ''}`,
                onClick: () => handleRatioChange(item.r)
              },
                h('span', {
                  style: {
                    width: `${item.w}px`,
                    height: `${item.h}px`,
                    border: '1.5px solid currentColor',
                    borderRadius: '2px',
                    display: 'inline-block'
                  }
                }),
                h('span', null, item.label)
              )
            )
          ),
          h('div', { style: { display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '6px', marginTop: '2px' } },
            h('select', {
              className: 'nai5-select',
              style: { padding: '5px 8px', fontSize: '11px' },
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
            h('input', {
              type: 'number',
              className: 'nai5-input',
              style: { fontSize: '11px', padding: '5px 8px' },
              step: 64, min: 64, max: 3072,
              value: width,
              title: '宽度 (W)',
              onChange: e => { setWidth(Number(e.target.value) || 832); setPixelTier('custom'); }
            }),
            h('input', {
              type: 'number',
              className: 'nai5-input',
              style: { fontSize: '11px', padding: '5px 8px' },
              step: 64, min: 64, max: 3072,
              value: height,
              title: '高度 (H)',
              onChange: e => { setHeight(Number(e.target.value) || 1216); setPixelTier('custom'); }
            })
          )
        ),

        h('div', { className: 'nai5-card' },
          h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' } },
            h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
              h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: 'var(--fx-text-secondary)' } },
                h('span', null, '步数 Steps'),
                h('strong', { style: { color: 'var(--fx-text-primary)' } }, steps)
              ),
              h('input', {
                type: 'range',
                className: 'nai5-slider',
                min: 1, max: 50, value: steps,
                onChange: e => setSteps(Number(e.target.value))
              })
            ),
            h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
              h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: 'var(--fx-text-secondary)' } },
                h('span', null, '引导 CFG'),
                h('strong', { style: { color: 'var(--fx-text-primary)' } }, cfgScale)
              ),
              h('input', {
                type: 'range',
                className: 'nai5-slider',
                min: 0, max: 10, step: 0.5, value: cfgScale,
                onChange: e => setCfgScale(Number(e.target.value))
              })
            )
          ),
          h('div', { style: { display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px', alignItems: 'center', marginTop: '2px' } },
            h('select', {
              className: 'nai5-select',
              style: { padding: '5px 8px', fontSize: '11px' },
              value: sampler,
              onChange: e => setSampler(e.target.value)
            },
              h('option', { value: 'k_euler_ancestral' }, 'Euler Ancestral (推荐)'),
              h('option', { value: 'k_euler' }, 'Euler (确定性)'),
              h('option', { value: 'k_dpmpp_2s_ancestral' }, 'DPM++ 2S Ancestral'),
              h('option', { value: 'k_dpmpp_2m' }, 'DPM++ 2M (平滑)'),
              h('option', { value: 'k_dpmpp_sde' }, 'DPM++ SDE'),
              h('option', { value: 'ddim' }, 'DDIM')
            ),
            h('div', { style: { display: 'flex', flexDirection: 'column', gap: '3px' } },
              h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--fx-text-secondary)' } },
                h('span', null, 'Rescale'),
                h('span', { style: { color: 'var(--fx-text-primary)' } }, Number(cfgRescale).toFixed(2))
              ),
              h('input', {
                type: 'range',
                className: 'nai5-slider',
                min: 0, max: 1, step: 0.05, value: cfgRescale,
                onChange: e => setCfgRescale(Number(e.target.value))
              })
            )
          ),
          h('div', { style: { display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' } },
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
              style: { flex: 1, padding: '4px 8px', fontSize: '11px', fontFamily: 'monospace' },
              placeholder: '输入固定 Seed...',
              value: seed,
              onChange: e => setSeed(e.target.value)
            }),
            latestImage?.seed && h('button', {
              type: 'button',
              className: 'nai5-btn xs',
              title: '锁定当前预览图的 Seed',
              onClick: () => {
                setSeedMode('fixed');
                setSeed(latestImage.seed);
                showToast(`已锁定 Seed: ${latestImage.seed}`);
              }
            }, '上张Seed')
          )
        )
      ),

      h('button', {
        type: 'button',
        className: 'nai5-btn primary',
        style: {
          width: '100%',
          padding: '11px 16px',
          fontSize: '13px',
          borderRadius: '10px',
          justifyContent: 'space-between'
        },
        disabled: isGenerating,
        onClick: handleGenerate
      },
        h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '7px' } },
          h(Icon, { name: 'sparkles', size: 15 }),
          isGenerating ? '正在直连渲染并归档...' : '立即生成图像'
        ),
        h('span', {
          style: {
            fontSize: '11px',
            padding: '2px 8px',
            borderRadius: '999px',
            background: costInfo.free ? 'rgba(16, 185, 129, 0.25)' : 'rgba(0, 0, 0, 0.28)',
            color: costInfo.free ? '#6ee7b7' : '#e0e7ff',
            fontWeight: 500
          }
        }, costInfo.label)
      )
    )
  );
}
