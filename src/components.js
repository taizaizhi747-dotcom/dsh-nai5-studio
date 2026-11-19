// Folder Preset Popover Component with optional JSON Import
function FolderPresetPicker({
  label,
  iconName,
  presets,
  selectedId,
  onSelect,
  onAdd,
  onDelete,
  onImportJson,
  currentValue,
  emptyHint = '暂无预设，点击右上角「新建」或「导入」JSON 文件',
  placeholder = '选择预设...'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState(() => {
    const sel = presets.find(p => p.id === selectedId);
    const init = {};
    if (sel && sel.group) init[sel.group] = true;
    if (presets[0] && presets[0].group) init[presets[0].group] = true;
    return init;
  });
  const [isAdding, setIsAdding] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetGroup, setNewPresetGroup] = useState('');
  const [newPresetPrompt, setNewPresetPrompt] = useState('');
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setIsAdding(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const selectedPreset = presets.find(p => p.id === selectedId);

  const handleOpenAdd = (e) => {
    e.stopPropagation();
    setNewPresetPrompt(currentValue || '');
    setNewPresetName('');
    setNewPresetGroup(selectedPreset?.group || '自定义分组');
    setIsAdding(true);
  };

  const handleSaveNew = (e) => {
    e.stopPropagation();
    if (!newPresetName.trim() || !newPresetPrompt.trim()) return;
    const created = {
      id: 'custom-' + Date.now(),
      name: newPresetName.trim(),
      group: newPresetGroup.trim() || '自定义分组',
      prompt: newPresetPrompt.trim()
    };
    onAdd(created);
    setExpandedGroups(prev => ({ ...prev, [created.group]: true }));
    setIsAdding(false);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || typeof onImportJson !== 'function') return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        onImportJson(parsed);
      } catch (err) {
        warnSilent('presets.import', err);
        onImportJson(null, err);
      }
    };
    reader.readAsText(file, 'utf8');
  };

  const filtered = presets.filter(p => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (p.name && p.name.toLowerCase().includes(q)) ||
           (p.group && p.group.toLowerCase().includes(q));
  });

  const grouped = {};
  filtered.forEach(p => {
    const g = p.group || '默认分组';
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(p);
  });

  return h('div', { className: 'nai5-popover-container', ref: containerRef },
    typeof onImportJson === 'function' && h('input', {
      ref: fileInputRef,
      type: 'file',
      accept: '.json,application/json',
      style: { display: 'none' },
      onClick: e => e.stopPropagation(),
      onChange: handleFileChange
    }),
    h('div', { className: 'nai5-label-bar', style: { marginBottom: '5px' } },
      h('span', { className: 'nai5-label-title' },
        h(Icon, { name: iconName || 'palette', size: 13, style: { color: 'var(--fx-crimson-soft)' } }),
        label
      ),
      h('span', { style: { fontSize: '10.5px', color: 'var(--fx-text-muted)' } }, `${presets.length} 套`)
    ),
    h('div', {
      className: `nai5-popover-trigger ${isOpen ? 'active' : ''}`,
      onClick: () => { setIsOpen(!isOpen); setIsAdding(false); }
    },
      h('span', {
        style: {
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontWeight: selectedPreset ? 500 : 400,
          color: selectedPreset ? 'var(--fx-text-primary)' : 'var(--fx-text-muted)'
        }
      }, selectedPreset ? selectedPreset.name : placeholder),
      h(Icon, {
        name: 'chevronDown',
        size: 13,
        style: {
          color: 'var(--fx-text-secondary)',
          transform: isOpen ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.16s ease'
        }
      })
    ),
    isOpen && h('div', { className: 'nai5-popover-menu' },
      h('div', { style: { display: 'flex', gap: '5px', marginBottom: '8px' } },
        h('input', {
          type: 'text',
          className: 'nai5-input',
          style: { flex: 1, fontSize: '11.5px', padding: '5px 8px' },
          placeholder: '搜索预设或分组...',
          value: searchQuery,
          onChange: e => setSearchQuery(e.target.value),
          onClick: e => e.stopPropagation()
        }),
        typeof onImportJson === 'function' && h('button', {
          type: 'button',
          className: 'nai5-btn xs',
          title: '导入本地 JSON 预设文件',
          onClick: (e) => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }
        }, h(Icon, { name: 'upload', size: 11 }), '导入'),
        h('button', {
          type: 'button',
          className: 'nai5-btn primary xs',
          onClick: handleOpenAdd
        }, h(Icon, { name: 'plus', size: 12 }), '新建')
      ),
      isAdding && h('div', {
        style: {
          background: 'var(--fx-glass-card)',
          border: '1px solid var(--fx-border-card)',
          borderRadius: '8px',
          padding: '8px',
          marginBottom: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        },
        onClick: e => e.stopPropagation()
      },
        h('input', {
          type: 'text',
          className: 'nai5-input',
          placeholder: '预设名称...',
          value: newPresetName,
          onChange: e => setNewPresetName(e.target.value)
        }),
        h('input', {
          type: 'text',
          className: 'nai5-input',
          placeholder: '所属分组...',
          value: newPresetGroup,
          onChange: e => setNewPresetGroup(e.target.value)
        }),
        h('textarea', {
          className: 'nai5-textarea',
          rows: 2,
          style: { minHeight: '46px', fontSize: '11px' },
          placeholder: '提示词内容...',
          value: newPresetPrompt,
          onChange: e => setNewPresetPrompt(e.target.value)
        }),
        h('div', { style: { display: 'flex', gap: '6px', justifyContent: 'flex-end' } },
          h('button', { type: 'button', className: 'nai5-btn primary xs', onClick: handleSaveNew }, '保存'),
          h('button', { type: 'button', className: 'nai5-btn xs', onClick: (e) => { e.stopPropagation(); setIsAdding(false); } }, '取消')
        )
      ),
      h('div', { className: 'nai5-popover-scroll' },
        Object.keys(grouped).length === 0
          ? h('div', { style: { textAlign: 'center', color: 'var(--fx-text-muted)', padding: '14px 8px', fontSize: '11px', lineHeight: 1.5 } },
              (!searchQuery && presets.length === 0) ? emptyHint : '无匹配的预设'
            )
          : Object.entries(grouped).map(([grpName, items]) => {
              const isExpanded = !!expandedGroups[grpName] || !!searchQuery;
              return h('div', { key: grpName, style: { marginBottom: '4px' } },
                h('div', {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '5px 8px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    color: 'var(--fx-text-secondary)',
                    background: 'rgba(224, 40, 79, 0.05)'
                  },
                  onClick: (e) => {
                    e.stopPropagation();
                    setExpandedGroups(prev => ({ ...prev, [grpName]: !prev[grpName] }));
                  }
                },
                  h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--fx-text-primary)' } },
                    h(Icon, { name: 'folder', size: 12, style: { color: 'var(--fx-crimson-soft)' } }),
                    grpName
                  ),
                  h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10px' } },
                    h('span', { style: { padding: '0 5px', borderRadius: '999px', background: 'rgba(224,40,79,0.12)' } }, items.length),
                    h(Icon, { name: isExpanded ? 'chevronDown' : 'chevronRight', size: 11 })
                  )
                ),
                isExpanded && h('div', {
                  style: {
                    marginLeft: '7px',
                    paddingLeft: '7px',
                    borderLeft: '1px solid rgba(224, 40, 79, 0.25)',
                    marginTop: '3px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px'
                  }
                },
                  items.map(p => {
                    const isSel = p.id === selectedId;
                    return h('div', {
                      key: p.id,
                      style: {
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '5px 8px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        background: isSel ? 'rgba(224, 40, 79, 0.18)' : 'transparent',
                        color: isSel ? 'var(--fx-text-primary)' : 'var(--fx-text-secondary)',
                        fontWeight: isSel ? 600 : 400,
                        border: isSel ? '1px solid rgba(224, 40, 79, 0.45)' : '1px solid transparent'
                      },
                      onClick: (e) => {
                        e.stopPropagation();
                        onSelect(p);
                        setIsOpen(false);
                      }
                    },
                      h('span', {
                        style: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '6px' }
                      }, p.name),
                      h('div', { style: { display: 'flex', alignItems: 'center', gap: '4px' } },
                        isSel && h(Icon, { name: 'check', size: 12, style: { color: 'var(--fx-crimson-soft)' } }),
                        h('button', {
                          type: 'button',
                          className: 'nai5-btn ghost xs',
                          style: { padding: '2px', color: 'var(--fx-text-muted)' },
                          title: '删除此预设',
                          onClick: (e) => {
                            e.stopPropagation();
                            if (window.confirm(`确定删除预设「${p.name}」吗？`)) {
                              onDelete(p.id);
                            }
                          }
                        }, h(Icon, { name: 'trash', size: 11 }))
                      )
                    );
                  })
                )
              );
            })
      )
    )
  );
}

const MAX_V5_CHARACTERS = 22;
const CHAR_COLORS = [
  '#e0284f', '#6366f1', '#10b981', '#d97706', '#a855f7', '#06b6d4',
  '#ec4899', '#3b82f6', '#84cc16', '#f97316', '#8b5cf6', '#14b8a6',
  '#f43f5e', '#0ea5e9', '#22c55e', '#eab308', '#c026d3', '#64748b',
  '#fb7185', '#38bdf8', '#4ade80', '#facc15'
];
const DEFAULT_CHAR_SLOTS = [
  { x: 0.25, y: 0.50 },
  { x: 0.75, y: 0.50 },
  { x: 0.50, y: 0.50 },
  { x: 0.22, y: 0.32 },
  { x: 0.78, y: 0.32 },
  { x: 0.50, y: 0.75 },
  { x: 0.20, y: 0.75 },
  { x: 0.80, y: 0.75 },
  { x: 0.50, y: 0.25 },
  { x: 0.14, y: 0.50 },
  { x: 0.86, y: 0.50 },
  { x: 0.35, y: 0.25 },
  { x: 0.65, y: 0.25 },
  { x: 0.35, y: 0.75 },
  { x: 0.65, y: 0.75 },
  { x: 0.35, y: 0.50 },
  { x: 0.65, y: 0.50 },
  { x: 0.14, y: 0.22 },
  { x: 0.86, y: 0.22 },
  { x: 0.14, y: 0.82 },
  { x: 0.86, y: 0.82 },
  { x: 0.50, y: 0.86 }
];

function CharacterStage2D({ characterPrompts, width, height, onUpdateCoord }) {
  const stageRef = useRef(null);
  const [draggingIdx, setDraggingIdx] = useState(null);

  const handlePointerMove = useCallback((e) => {
    if (draggingIdx === null || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const rawX = (e.clientX - rect.left) / Math.max(1, rect.width);
    const rawY = (e.clientY - rect.top) / Math.max(1, rect.height);
    const clampedX = Math.round(Math.max(0.05, Math.min(0.95, rawX)) * 20) / 20;
    const clampedY = Math.round(Math.max(0.05, Math.min(0.95, rawY)) * 20) / 20;
    onUpdateCoord(draggingIdx, clampedX, clampedY);
  }, [draggingIdx, onUpdateCoord]);

  useEffect(() => {
    if (draggingIdx === null) return;
    const onUp = () => setDraggingIdx(null);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [draggingIdx, handlePointerMove]);

  const wNum = Number(width) || 832;
  const hNum = Number(height) || 1216;
  const isDense = characterPrompts.length > 8;

  return h('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '6px',
      flex: 'none'
    }
  },
    h('div', {
      ref: stageRef,
      className: 'nai5-stage2d-canvas',
      style: { aspectRatio: `${wNum} / ${hNum}`, maxHeight: '220px' },
      title: `按住 A~V 圆点拖拽，自由设定最多 ${MAX_V5_CHARACTERS} 名角色在画布中的 2D (X, Y) 坐标`
    },
      h('div', { style: { position: 'absolute', left: '50%', top: 0, bottom: 0, width: '1px', background: 'rgba(224,40,79,0.25)', pointerEvents: 'none' } }),
      h('div', { style: { position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'rgba(224,40,79,0.25)', pointerEvents: 'none' } }),
      characterPrompts.map((cp, idx) => {
        const color = CHAR_COLORS[idx % CHAR_COLORS.length];
        const letter = String.fromCharCode(65 + idx);
        return h('div', {
          key: cp.id || idx,
          className: `nai5-stage2d-node ${draggingIdx === idx ? 'dragging' : ''}`,
          title: `角色 ${letter} (${Number(cp.x ?? 0.5).toFixed(2)}, ${Number(cp.y ?? 0.5).toFixed(2)})`,
          style: {
            left: `${(cp.x ?? 0.5) * 100}%`,
            top: `${(cp.y ?? 0.5) * 100}%`,
            background: color,
            ...(isDense ? { width: '19px', height: '19px', marginLeft: '-9.5px', marginTop: '-9.5px', fontSize: '9.5px' } : {})
          },
          onMouseDown: (e) => {
            e.preventDefault();
            e.stopPropagation();
            setDraggingIdx(idx);
          }
        }, letter);
      })
    ),
    h('span', { style: { fontSize: '10px', color: 'var(--fx-text-muted)' } }, '拖拽圆点调 2D 站位')
  );
}
