const CODEX_BADGE_COLORS = ['cyan', 'purple', 'emerald', 'amber', 'crimson'];

function CodexView({
  codexMeta,
  codexCategory,
  setCodexCategory,
  searchQuery,
  setSearchQuery,
  searchResults,
  searching,
  runTagSearch,
  onAppendPositive,
  onAppendNegative,
  onOverwriteStudio,
  onCopyText,
  onSendToChat
}) {
  const dynamicCategories = React.useMemo(() => {
    const list = [{ key: 'all', name: '全部典籍', count: codexMeta?.totalEntries || 0, badge: null }];
    if (Array.isArray(codexMeta?.codexes)) {
      codexMeta.codexes.forEach((cx, idx) => {
        if (!cx?.key) return;
        list.push({
          key: cx.key,
          name: cx.name || cx.key,
          count: cx.count || 0,
          badge: CODEX_BADGE_COLORS[idx % CODEX_BADGE_COLORS.length]
        });
      });
    }
    return list;
  }, [codexMeta]);

  const codexConfiguredCount = codexMeta?.totalEntries || 0;
  const tagConfiguredCount = codexMeta?.totalTags || 0;
  const cfgPaths = codexMeta?.configured || {};

  return h('div', {
    className: 'nai5-gallery-wrap',
    style: { display: 'flex', flexDirection: 'column', gap: '12px' }
  },
    h('div', { className: 'nai5-card', style: { padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' } },
      h('div', { className: 'nai5-codex-categories' },
        dynamicCategories.map(cat =>
          h('button', {
            key: cat.key,
            type: 'button',
            className: `nai5-codex-cat-pill ${codexCategory === cat.key ? 'active' : ''}`,
            onClick: () => {
              setCodexCategory(cat.key);
              runTagSearch(searchQuery, false, cat.key);
            }
          },
            cat.badge ? h('span', { className: `nai5-codex-badge ${cat.badge}`, style: { padding: '1px 5px', fontSize: '9px' } }, '●') : null,
            h('span', null, cat.name),
            h('span', { className: 'nai5-codex-cat-count' }, cat.count > 999 ? (cat.count / 1000).toFixed(1) + 'k' : cat.count)
          )
        )
      ),
      h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
        h('div', { style: { position: 'relative', flex: 1 } },
          h('input', {
            type: 'text',
            className: 'nai5-input',
            style: { width: '100%', paddingLeft: '32px', fontSize: '12px' },
            placeholder: '搜索内置同义词、可选 Danbooru CSV 词表或外部法典 JSON（如：逆光、旗袍、仰视、景深）...',
            value: searchQuery,
            onChange: e => setSearchQuery(e.target.value),
            onKeyDown: e => e.key === 'Enter' && runTagSearch(searchQuery, false, codexCategory)
          }),
          h('span', {
            style: { position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5, pointerEvents: 'none' }
          }, h(Icon, { name: 'search', size: 13 }))
        ),
        h('button', {
          type: 'button',
          className: 'nai5-btn primary',
          onClick: () => runTagSearch(searchQuery, false, codexCategory)
        }, h(Icon, { name: 'search', size: 13 }), searching ? '检索中...' : '搜索'),
        searchQuery && h('button', {
          type: 'button',
          className: 'nai5-btn',
          title: '清空关键词（返回浏览模式）',
          onClick: () => {
            setSearchQuery('');
            runTagSearch('', false, codexCategory);
          }
        }, h(Icon, { name: 'close', size: 12 }))
      )
    ),

    searchResults?.danbooru?.results?.length > 0 && h('div', { className: 'nai5-card', style: { padding: '10px 14px' } },
      h('div', { className: 'nai5-label-bar', style: { marginBottom: '8px' } },
        h('span', { className: 'nai5-label-title', style: { color: 'var(--fx-text-primary)' } },
          h(Icon, { name: 'sparkles', size: 12, style: { color: 'var(--fx-crimson-soft)', marginRight: '6px' } }),
          `Danbooru 双语标签 (${searchResults.danbooru.results.length})`
        ),
        h('span', { style: { fontSize: '11px', color: 'var(--fx-text-secondary)' } }, '点击「+」快速追加至正向提示词')
      ),
      h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px' } },
        searchResults.danbooru.results.map(r =>
          h('button', {
            key: r.tag,
            type: 'button',
            className: 'nai5-btn xs nai5-danbooru-chip',
            title: `点击追加: ${r.tag} (${r.cn_name || ''})`,
            onClick: () => onAppendPositive(r.tag, `标签: ${r.tag}`)
          },
            h('strong', { className: 'nai5-danbooru-tag' }, r.tag),
            r.cn_name && h('span', { style: { color: 'var(--fx-text-secondary)', fontSize: '10px' } }, r.cn_name),
            h(Icon, { name: 'plus', size: 10, style: { opacity: 0.75 } })
          )
        )
      )
    ),

    h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
      h('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '2px 4px'
        }
      },
        h('span', { style: { fontSize: '12px', fontWeight: 600, color: 'var(--fx-text-primary)' } },
          `可选提示词法典条目 (${searchResults?.codex?.results?.length || 0} 条 · 共 ${codexConfiguredCount} 条 / 标签 ${tagConfiguredCount} 条)`
        ),
        h('span', { style: { fontSize: '11px', color: 'var(--fx-text-secondary)' } },
          '支持一键追加、负向导入、覆盖工作台，或送入对话联动生图'
        )
      ),
      (searchResults?.codex?.results?.length > 0) ? h('div', { className: 'nai5-codex-grid' },
        searchResults.codex.results.map((c, idx) => {
          const isR18 = /r18|官能|涩涩|性|乳|交|nsfw/i.test((c.codex || '') + (c.name || '') + (c.category || ''));
          const isComp = /构图|视角|镜头|景深|光影|composition|lighting/i.test((c.codex || '') + (c.name || '') + (c.category || ''));
          const isFashion = /人偶|穿搭|衣柜|衣|服|outfit|dress|costume/i.test((c.codex || '') + (c.name || '') + (c.category || ''));
          const badgeColor = isR18 ? 'crimson' : isFashion ? 'emerald' : isComp ? 'cyan' : 'purple';
          const charList = Array.isArray(c.characterPrompts) ? c.characterPrompts : [];
          const hasChars = charList.length > 0;
          const globalText = String(c.globalPrompt !== undefined ? c.globalPrompt : (!hasChars ? (c.prompt || '') : '')).trim();
          const fullCopyText = formatCodexFullText(c);
          const appendText = globalText || charList.map(cp => cp.prompt).filter(Boolean).join(', ') || fullCopyText;

          return h('div', { key: (c.id || '') + idx, className: 'nai5-codex-card' },
            h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' } },
              h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' } },
                h('span', { className: `nai5-codex-badge ${badgeColor}` }, c.codex || '法典'),
                hasChars && h('span', { className: 'nai5-codex-badge purple', title: '包含 NovelAI V5 独立角色分框提示词' }, `${charList.length} 角色分框`),
                h('strong', {
                  style: {
                    fontSize: '12px',
                    color: 'var(--fx-text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  },
                  title: c.name
                }, c.name)
              ),
              c.category && h('span', {
                style: {
                  fontSize: '10px',
                  color: 'var(--fx-text-secondary)',
                  whiteSpace: 'nowrap',
                  maxWidth: '120px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                },
                title: c.category
              }, c.category)
            ),
            globalText ? h('div', { className: 'nai5-codex-snippet', title: globalText }, globalText) : null,
            hasChars ? h('div', { className: 'nai5-codex-char-list' },
              charList.map((cp, ci) =>
                h('div', { key: (cp.label || 'char') + ci, className: 'nai5-codex-char-item' },
                  h('span', { className: 'nai5-codex-char-label' }, cp.label || `char${ci + 1}`),
                  cp.prompt && h('div', { title: cp.prompt }, cp.prompt),
                  cp.negative && h('div', { style: { fontSize: '10px', color: 'var(--fx-crimson-soft)' } }, `UC: ${cp.negative}`)
                )
              )
            ) : (!globalText ? h('div', { className: 'nai5-codex-snippet', style: { opacity: 0.6 } }, c.prompt || '（暂无正向标签）') : null),
            c.negative ? h('div', {
              style: {
                fontSize: '10px',
                color: 'var(--fx-crimson-soft)',
                background: 'rgba(224, 40, 79, 0.08)',
                padding: '4px 7px',
                borderRadius: '5px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              },
              title: `包含负向排他: ${c.negative}`
            }, `负向: ${c.negative}`) : null,
            h('div', {
              style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '6px',
                marginTop: '2px'
              }
            },
              h('button', {
                type: 'button',
                className: 'nai5-btn xs',
                title: '复制完整提示词到剪贴板',
                onClick: () => onCopyText(fullCopyText, `法典配方: ${c.name}`)
              }, h(Icon, { name: 'copy', size: 10 })),
              h('button', {
                type: 'button',
                className: 'nai5-btn xs',
                title: '追加此配方到当前正向提示词末尾',
                onClick: () => onAppendPositive(appendText, `配方: ${c.name}`)
              }, h(Icon, { name: 'plus', size: 10 }), '追加正向'),
              c.negative ? h('button', {
                type: 'button',
                className: 'nai5-btn xs',
                title: '将配方的排他词追加到全局负向 (UC)',
                onClick: () => onAppendNegative(c.negative, `负向: ${c.name}`)
              }, '填入负向') : null,
              h('button', {
                type: 'button',
                className: 'nai5-btn xs',
                style: { borderColor: 'rgba(224, 40, 79, 0.4)' },
                title: '以当前配方覆盖工作台提示词并切回工坊',
                onClick: () => onOverwriteStudio(c)
              }, h(Icon, { name: 'sparkles', size: 10, style: { color: 'var(--fx-crimson-soft)' } }), '覆盖工坊'),
              h('button', {
                type: 'button',
                className: 'nai5-btn primary xs',
                title: '将此配方送入 DSH 对话输入框',
                onClick: () => onSendToChat(c, true)
              }, h(Icon, { name: 'message', size: 10 }), '送入对话')
            )
          );
        })
      ) : h('div', {
        className: 'nai5-card',
        style: {
          padding: '28px 20px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px'
        }
      },
        h(Icon, { name: 'book', size: 28, style: { opacity: 0.4, color: 'var(--fx-crimson-soft)' } }),
        h('div', { style: { fontSize: '13px', fontWeight: 600, color: 'var(--fx-text-primary)' } },
          searching
            ? '正在检索本地词库与法典...'
            : (codexConfiguredCount === 0 ? '可选词库与法典导入指南（当前未加载外置数据包）' : '未找到匹配的法典配方')
        ),
        codexConfiguredCount === 0
          ? h('div', { style: { fontSize: '11.5px', color: 'var(--fx-text-secondary)', lineHeight: 1.7, maxWidth: '640px', textAlign: 'left' } },
              h('div', null, '本插件公开版默认轻量化发布，不捆绑第三方法典或大型 CSV 词库。如需启用离线检索，可按以下目录自行导入：'),
              h('div', { style: { fontFamily: 'monospace', marginTop: '6px', padding: '8px 10px', borderRadius: '8px', background: 'var(--fx-glass-input)', border: '1px solid var(--fx-border-card)' } },
                h('div', null, `• 自定义法典 JSON 目录: ${cfgPaths.codexDir || '~/.dsh/nai5-studio/codexes'}`),
                h('div', null, `• 双语 Danbooru CSV: ${cfgPaths.danbooruCsv || '~/.dsh/nai5-studio/danbooru-cn.csv'}`)
              ),
              h('div', { style: { marginTop: '6px', color: 'var(--fx-text-muted)' } }, '格式示例可参考仓库内的 examples/codex_pack.example.json；环境变量 NAI5_CODEX_DIR 与 DANBOORU_CSV_PATH 也可随时指定自定义位置。')
            )
          : h('div', { style: { fontSize: '11px', color: 'var(--fx-text-secondary)' } },
              '尝试切换上方分类或输入更宽泛的中英文关键词'
            )
      )
    )
  );
}
