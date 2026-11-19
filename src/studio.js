function NovelAiFloatingStudio({ CSS_STYLES }) {
  const [activeTab, setActiveTab] = useState('studio');
  const [peekArt, setPeekArt] = useState(false);
  const [studioConfig, setStudioConfig] = useState(null);

  const { toast, showToast } = useToast();
  const { themePref, isLightTheme, themeClass, cycleThemePref } = useHostTheme(showToast);
  const geo = useWindowGeometry(setActiveTab);
  const accounts = useAccounts(showToast);
  const chars = useCharacterBoxes(showToast);

  // Optional Artist & OC Presets (loaded from user config/localStorage, empty by default)
  const [serverArtistPresets, setServerArtistPresets] = useState(DEFAULT_ARTIST_PRESETS);
  const [serverOcPresets, setServerOcPresets] = useState(DEFAULT_OC_PRESETS);
  const [artistPresets, setArtistPresets] = useState(() =>
    mergePresetsWithBuiltins('dsh_nai5_artist_presets_v1', DEFAULT_ARTIST_PRESETS)
  );
  const [selectedArtistId, setSelectedArtistId] = useState('');
  const [ocPresets, setOcPresets] = useState(() =>
    mergePresetsWithBuiltins('dsh_nai5_oc_presets_v1', DEFAULT_OC_PRESETS)
  );
  const [selectedOcId, setSelectedOcId] = useState('');

  // Studio Prompt & Parameter State
  const [positivePrompt, setPositivePrompt] = useState('1girl, solo, cute, looking at viewer, very aesthetic, masterpiece');
  const [negativePrompt, setNegativePrompt] = useState(UC_PRESETS.safe);
  const [ucMode, setUcMode] = useState('safe');
  const [stylePrompt, setStylePrompt] = useState('');
  const [showStyleAndUc, setShowStyleAndUc] = useState(true);

  const [pixelTier, setPixelTier] = useState(1);
  const [aspectRatio, setAspectRatio] = useState('2:3');
  const [width, setWidth] = useState(832);
  const [height, setHeight] = useState(1216);
  const [seedMode, setSeedMode] = useState('random');
  const [seed, setSeed] = useState('');
  const [steps, setSteps] = useState(28);
  const [cfgScale, setCfgScale] = useState(5.5);
  const [sampler, setSampler] = useState('k_euler_ancestral');
  const [cfgRescale, setCfgRescale] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [latestImage, setLatestImage] = useState(null);

  const posTextareaRef = useRef(null);
  const charTextareaRefs = useRef({});

  // Gallery, Lightbox & Codex Search
  const gallery = useGalleryState(showToast, setLatestImage);
  const lightbox = useLightboxState(gallery.history);
  const codex = useCodexSearch(activeTab);

  const fetchStudioMetaAndPresets = useCallback(async () => {
    try {
      const [cfgRes, preRes] = await Promise.all([
        fetch('/api/novelai/config').catch(() => null),
        fetch('/api/novelai/presets').catch(() => null)
      ]);
      if (cfgRes && cfgRes.ok) {
        const cfgData = await cfgRes.json();
        if (cfgData.ok) setStudioConfig(cfgData);
      }
      if (preRes && preRes.ok) {
        const preData = await preRes.json();
        if (preData.ok) {
          const srvArtists = Array.isArray(preData.artistPresets) ? preData.artistPresets : [];
          const srvOcs = Array.isArray(preData.ocPresets) ? preData.ocPresets : [];
          setServerArtistPresets(srvArtists);
          setServerOcPresets(srvOcs);
          const mergedArtists = mergePresetsWithBuiltins('dsh_nai5_artist_presets_v1', srvArtists);
          const mergedOcs = mergePresetsWithBuiltins('dsh_nai5_oc_presets_v1', srvOcs);
          setArtistPresets(mergedArtists);
          setOcPresets(mergedOcs);
        }
      }
    } catch (err) {
      warnSilent('studio.initMeta', err);
    }
  }, []);

  const handleImportPresetsJson = useCallback(async (kind, raw, parseErr) => {
    if (parseErr || !raw) {
      showToast(`导入失败：JSON 格式无效 (${parseErr?.message || '空文件'})`);
      return;
    }
    const normalized = normalizeImportedPresets(raw, kind === 'oc' ? 'oc' : 'artist');
    if (normalized.length === 0) {
      showToast('未在 JSON 中识别到有效的预设条目');
      return;
    }
    const storageKey = kind === 'oc' ? 'dsh_nai5_oc_presets_v1' : 'dsh_nai5_artist_presets_v1';
    try {
      const res = await fetch('/api/novelai/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, items: normalized })
      });
      const data = await res.json();
      const savedItems = (data.ok && Array.isArray(data.items)) ? data.items : normalized;
      if (kind === 'oc') {
        setServerOcPresets(savedItems);
        setOcPresets(mergePresetsWithBuiltins(storageKey, savedItems));
      } else {
        setServerArtistPresets(savedItems);
        setArtistPresets(mergePresetsWithBuiltins(storageKey, savedItems));
      }
      showToast(`已导入并保存 ${savedItems.length} 条${kind === 'oc' ? '角色' : '画风'}预设`);
    } catch (err) {
      warnSilent('presets.saveExternal', err);
      if (kind === 'oc') {
        setOcPresets(mergePresetsWithBuiltins(storageKey, normalized));
      } else {
        setArtistPresets(mergePresetsWithBuiltins(storageKey, normalized));
      }
      showToast(`已在浏览器载入 ${normalized.length} 条预设`);
    }
  }, [showToast]);

  const ensureRecordMetadata = useCallback(async (item) => {
    if (!item) return item;
    const imgPath = item.source_path || item.filePath;
    if (!imgPath || item._metaHydrated) return item;
    try {
      const res = await fetch(`/api/novelai/metadata?path=${encodeURIComponent(imgPath)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.record) {
          const hydrated = { ...item, ...data.record, _metaHydrated: true };
          gallery.setHistory(prev => prev.map(x => ((x.source_path || x.filePath) === imgPath ? { ...x, ...hydrated } : x)));
          setLatestImage(prev => (prev && (prev.source_path || prev.filePath) === imgPath ? { ...prev, ...hydrated } : prev));
          lightbox.setPreviewCustomItem(prev => (prev && (prev.source_path || prev.filePath) === imgPath ? { ...prev, ...hydrated } : prev));
          return hydrated;
        }
      }
    } catch (err) {
      warnSilent('metadata.hydrate', err);
    }
    return item;
  }, [gallery.setHistory, lightbox.setPreviewCustomItem]);

  useEffect(() => {
    fetchStudioMetaAndPresets();
    accounts.fetchBalance();
    accounts.fetchAccounts();
    gallery.fetchGalleryMeta();
    gallery.fetchHistoryWithParams({ isReset: true });
  }, []);

  const handleTierChange = (newTier) => {
    setPixelTier(newTier);
    if (newTier !== 'custom') {
      const dim = calculateDimensions(Number(newTier), aspectRatio);
      if (dim) {
        setWidth(dim.width);
        setHeight(dim.height);
      }
    }
  };

  const handleRatioChange = (newRatio) => {
    setAspectRatio(newRatio);
    const tier = pixelTier === 'custom' ? 1 : Number(pixelTier);
    const dim = calculateDimensions(tier, newRatio);
    if (dim) {
      setWidth(dim.width);
      setHeight(dim.height);
    }
  };

  const handleGenerate = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      const activeCharBoxes = chars.characterPrompts
        .filter(c => c && c.prompt && c.prompt.trim().length > 0)
        .map(c => ({
          prompt: c.prompt.trim(),
          negativePrompt: (c.negativePrompt || '').trim(),
          x: Number(c.x) ?? 0.5,
          y: Number(c.y) ?? 0.5,
          useCoords: c.useCoords !== false
        }));

      const payload = {
        positivePrompt,
        negativePrompt,
        stylePrompt,
        width: Number(width),
        height: Number(height),
        steps: Number(steps),
        cfgScale: Number(cfgScale),
        cfgRescale: Number(cfgRescale),
        sampler,
        characterPrompts: activeCharBoxes,
        seed: (seedMode === 'fixed' && seed !== '') ? Number(seed) : undefined
      };
      const res = await fetch('/api/novelai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.ok) {
        const enriched = {
          ...data,
          source_path: data.filePath,
          prompt: positivePrompt,
          uc: negativePrompt,
          stylePrompt,
          cfg: cfgScale,
          cfgRescale,
          sampler,
          characterPrompts: activeCharBoxes,
          _metaHydrated: true
        };
        setLatestImage(enriched);
        gallery.setHistory(prev => {
          const p = enriched.source_path;
          return prev.some(x => (x.source_path || x.filePath) === p) ? prev : [enriched, ...prev];
        });
        showToast(`生成完成 · Seed: ${data.seed}`);
        accounts.fetchBalance();
        gallery.fetchGalleryMeta();
      } else {
        showToast(`生成失败: ${data.error || '未知错误'}`);
      }
    } catch (err) {
      showToast(`请求异常: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = useCallback((text, label) => {
    if (navigator.clipboard && text !== undefined && text !== null) {
      navigator.clipboard.writeText(String(text));
      showToast(`已复制 ${label}`);
    }
  }, [showToast]);

  const copyImageToClipboard = useCallback(async (imgPath) => {
    if (!imgPath) return;
    try {
      showToast('正在写入剪贴板...');
      const res = await fetch(getImageUrl(imgPath, false));
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type || 'image/png']: blob })]);
      showToast('图像已复制，可直接 Ctrl+V 粘贴发送');
    } catch (err) {
      showToast(`复制失败: ${err.message}`);
    }
  }, [showToast]);

  const handleDragStart = useCallback((e, item) => {
    if (!item) return;
    const imgPath = item.source_path || item.filePath || '';
    const filename = imgPath.split(/[/\\]/).pop() || `novelai_${item.seed || Date.now()}.png`;
    const fullUrl = `${window.location.origin}${getImageUrl(imgPath, false)}`;
    e.dataTransfer.effectAllowed = 'copy';
    try { e.dataTransfer.setData('DownloadURL', `image/png:${filename}:${fullUrl}`); } catch (err) { warnSilent('drag.url', err); }
    try {
      e.dataTransfer.setData('text/uri-list', fullUrl);
      e.dataTransfer.setData('text/plain', fullUrl);
    } catch (err) { warnSilent('drag.text', err); }
  }, []);

  const handleForkToWorkbench = useCallback(async (rawItem, silent = false) => {
    if (!rawItem) return;
    const item = !rawItem._metaHydrated ? await ensureRecordMetadata(rawItem) : rawItem;

    let cleanPos = item.prompt || '';
    if (item.stylePrompt && cleanPos.startsWith(item.stylePrompt)) {
      cleanPos = cleanPos.slice(item.stylePrompt.length).replace(/^,\s*/, '');
    } else if (cleanPos.includes('</style>')) {
      cleanPos = cleanPos.replace(/^<artist>[\s\S]*?<\/style>\s*,?\s*/i, '');
    }
    if (cleanPos) setPositivePrompt(cleanPos);
    if (item.uc) setNegativePrompt(item.uc);
    if (item.stylePrompt) setStylePrompt(item.stylePrompt);
    if (item.width) setWidth(Number(item.width));
    if (item.height) setHeight(Number(item.height));
    if (item.steps) setSteps(Number(item.steps));
    if (item.cfg) setCfgScale(Number(item.cfg));
    if (item.cfgRescale !== undefined) setCfgRescale(Number(item.cfgRescale));
    if (item.sampler) setSampler(item.sampler);
    if (item.seed !== undefined && item.seed !== null) {
      setSeedMode('fixed');
      setSeed(item.seed);
    }
    if (Array.isArray(item.characterPrompts)) {
      chars.setCharacterPrompts(item.characterPrompts.map((cp, i) => ({
        id: 'fork_' + Date.now() + '_' + i,
        prompt: cp.prompt || cp.char_caption || '',
        negativePrompt: cp.negativePrompt || cp.uc || '',
        x: typeof cp.x === 'number' ? cp.x : 0.5,
        y: typeof cp.y === 'number' ? cp.y : 0.5,
        useCoords: cp.useCoords !== false
      })));
      if (item.characterPrompts.length > 0) chars.setShowCharBoxes(true);
    }
    setLatestImage(item);
    if (!silent) {
      geo.updateWinMode('open');
      setActiveTab('studio');
      lightbox.setPreviewIndex(null);
      lightbox.setPreviewCustomItem(null);
      showToast(`已接管完整配方参数 (Seed: ${item.seed})`);
    }
  }, [ensureRecordMetadata, chars.setCharacterPrompts, chars.setShowCharBoxes, geo.updateWinMode, lightbox.setPreviewIndex, lightbox.setPreviewCustomItem, showToast]);

  const bridgeCallbackRef = useRef({});
  const bridge = useBridgeSync({
    characterPrompts: chars.characterPrompts,
    artistPresets,
    selectedArtistId,
    stylePrompt,
    aspectRatio,
    width,
    height,
    ucMode,
    negativePrompt,
    seedMode,
    seed,
    callbackRef: bridgeCallbackRef
  });
  bridgeCallbackRef.current = {
    autoMirrorAgent: bridge.autoMirrorAgent,
    isGenerating,
    handleForkToWorkbench,
    setLatestImage,
    setHistory: gallery.setHistory,
    setTotalCount: gallery.setTotalCount,
    setFilteredTotal: gallery.setFilteredTotal,
    fetchGalleryMeta: gallery.fetchGalleryMeta,
    fetchBalance: accounts.fetchBalance,
    fetchAccounts: accounts.fetchAccounts,
    setAccountsData: accounts.setAccountsData,
    showToast
  };

  useEffect(() => {
    if (geo.winMode === 'open' && gallery.history.length === 0) {
      gallery.fetchGalleryMeta();
      gallery.fetchHistoryWithParams({ isReset: true });
    }
  }, [geo.winMode, gallery.history.length, gallery.fetchGalleryMeta, gallery.fetchHistoryWithParams]);

  const sendToChatComposer = useCallback(async (rawItem = null, isCodex = false) => {
    let target = rawItem || latestImage || {};
    if (!isCodex && target && !target.codex && !target.codexKey && !target._metaHydrated && (target.source_path || target.filePath)) {
      target = await ensureRecordMetadata(target);
    }

    let chatText = '';
    if (isCodex || target.codex || target.codexKey) {
      const pos = (target.prompt || '').trim();
      const neg = target.negative ? `\n负向排他：${target.negative.trim()}` : '';
      chatText = `请以《${target.codex || '词库配方'}》【${target.name || '参考条目'}】为基准出图：\n${pos}${neg}\n请以此配方为骨架进行组装，并调用 generate_image 出图：`;
      setPositivePrompt(pos);
      if (target.negative) setNegativePrompt(target.negative.trim());
    } else {
      const targetSeed = target.seed || (seedMode === 'fixed' && seed ? seed : '随机');
      const targetW = target.width || width || 832;
      const targetH = target.height || height || 1216;
      const imgPath = target.source_path || target.filePath || '';
      let cleanPos = (target.prompt || positivePrompt || '').trim();
      if (target.stylePrompt && cleanPos.startsWith(target.stylePrompt)) {
        cleanPos = cleanPos.slice(target.stylePrompt.length).replace(/^,\s*/, '');
      } else if (cleanPos.includes('</style>')) {
        cleanPos = cleanPos.replace(/^<artist>[\s\S]*?<\/style>\s*,?\s*/i, '');
      }
      if (rawItem) handleForkToWorkbench(target, true);

      const nextLocks = { ...bridge.bridgeLocks, enabled: true, lockStyle: true, lockAspect: true };
      bridge.setBridgeLocks(nextLocks);
      try { localStorage.setItem('dsh_nai5_bridge_locks_v1', JSON.stringify(nextLocks)); } catch (err) { warnSilent('sendChat.locks', err); }
      fetch('/api/novelai/bridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locks: nextLocks,
          overrides: {
            stylePrompt: target.stylePrompt || stylePrompt,
            width: Number(targetW) || 832,
            height: Number(targetH) || 1216,
            negativePrompt: target.uc || negativePrompt,
            seed: targetSeed !== '随机' ? String(targetSeed) : '',
            characterPrompts: Array.isArray(target.characterPrompts) ? target.characterPrompts : chars.characterPrompts
          }
        })
      }).catch(err => warnSilent('sendChat.bridge', err));

      const charCoordsInfo = Array.isArray(target.characterPrompts) && target.characterPrompts.length > 0
        ? `\n分框站位：${target.characterPrompts.map((c, idx) => `角色${String.fromCharCode(65 + idx)}(${c.x ?? 0.5},${c.y ?? 0.5}): ${c.prompt || ''}`).join(' | ')}`
        : '';
      const pathLine = imgPath ? `\n参考路径：${imgPath}` : '';
      chatText = `[NAI5 Studio 续写底模 · 角色: ${target.character || '当前角色'} | Seed: ${targetSeed} | 画幅: ${targetW}×${targetH} (已锁定同画风/同画幅)]${pathLine}\n基底提示词：${cleanPos}${charCoordsInfo}\n请保持上述角色外观与画风一致，在此基础上继续演进下一幕并调用 generate_image 出图：`;
    }

    geo.updateWinMode('minimized');
    bridge.setShowOrbHud(false);
    lightbox.setPreviewIndex(null);
    lightbox.setPreviewCustomItem(null);

    showToast(dshComposerBridge.injectIntoChat(chatText)
      ? '已推送至 DSH 对话输入框（已同步画风/画幅硬锁），输入下一幕即可回车生图'
      : '续写指令已复制到剪贴板，在对话框 Ctrl+V 粘贴即可继续生图');
  }, [latestImage, ensureRecordMetadata, seedMode, seed, width, height, positivePrompt, stylePrompt, negativePrompt, chars.characterPrompts, bridge.bridgeLocks, bridge.setBridgeLocks, bridge.setShowOrbHud, handleForkToWorkbench, geo.updateWinMode, lightbox.setPreviewIndex, lightbox.setPreviewCustomItem, showToast]);

  useEffect(() => {
    if (lightbox.activeItem && !lightbox.activeItem._metaHydrated) {
      ensureRecordMetadata(lightbox.activeItem);
    }
  }, [lightbox.activeItem?.source_path || lightbox.activeItem?.filePath, lightbox.activeItem?._metaHydrated, ensureRecordMetadata]);

  const handleRevealInExplorer = useCallback(async (imgPath) => {
    if (!imgPath) return;
    try {
      const res = await fetch(`/api/novelai/reveal?path=${encodeURIComponent(imgPath)}`);
      showToast(res.ok ? '已在文件管理器中高亮定位' : '定位失败，文件可能不存在');
    } catch (err) {
      showToast(`定位异常: ${err.message}`);
    }
  }, [showToast]);

  const copyFullParams = useCallback(async (rawItem) => {
    if (!rawItem) return;
    const item = !rawItem._metaHydrated ? await ensureRecordMetadata(rawItem) : rawItem;
    copyToClipboard(JSON.stringify({
      prompt: item.prompt,
      uc: item.uc,
      stylePrompt: item.stylePrompt,
      characterPrompts: item.characterPrompts || [],
      seed: item.seed,
      steps: item.steps || 28,
      cfg: item.cfg || 5.5,
      cfgRescale: item.cfgRescale || 0,
      sampler: item.sampler || 'k_euler_ancestral',
      width: item.width || 832,
      height: item.height || 1216,
      rating: item.rating
    }, null, 2), '生成参数 JSON');
  }, [ensureRecordMetadata, copyToClipboard]);

  const handleDeleteImage = useCallback(async (item) => {
    if (!item) return;
    const imgPath = item.source_path || item.filePath;
    if (!imgPath) return;
    if (!window.confirm(`确定从磁盘永久删除此图片吗？\n${item.filename || imgPath}`)) return;
    try {
      const res = await fetch('/api/novelai/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: imgPath })
      });
      const data = await res.json();
      if (data.ok) {
        showToast('已从磁盘物理删除');
        gallery.setHistory(prev => {
          const next = prev.filter(x => (x.source_path || x.filePath) !== imgPath);
          setLatestImage(cur => (cur && (cur.source_path || cur.filePath) === imgPath ? (next[0] || null) : cur));
          return next;
        });
        gallery.setTotalCount(prev => Math.max(0, prev - 1));
        gallery.setFilteredTotal(prev => Math.max(0, prev - 1));
        lightbox.closeLightbox();
      } else {
        showToast(`删除失败: ${data.error || '未知错误'}`);
      }
    } catch (err) {
      showToast(`请求异常: ${err.message}`);
    }
  }, [gallery.setHistory, gallery.setTotalCount, gallery.setFilteredTotal, lightbox.closeLightbox, showToast]);

  const handleAppendPositive = useCallback((text) => {
    setPositivePrompt(prev => prev.trim() ? `${prev.trim()}, ${text}` : text);
    showToast('已追加词串到正向提示词');
  }, [showToast]);

  const handleAppendNegative = useCallback((text) => {
    setNegativePrompt(prev => prev.trim() ? `${prev.trim()}, ${text}` : text);
    showToast('已追加排他词到负向 UC');
  }, [showToast]);

  const handleOverwriteStudio = useCallback((c) => {
    setPositivePrompt((c.prompt || '').trim());
    if (c.negative) setNegativePrompt(c.negative.trim());
    setActiveTab('studio');
    showToast(`已载入《${c.codex || '词库'}》配方至绘卷工坊`);
  }, [showToast]);

  const costInfo = estimateAnlasCost(width, height, steps);
  const winStyleBase = geo.isMaximized
    ? { top: 'calc(var(--dsh-frame-chrome-top, var(--dsh-windows-titlebar-height, 36px)) + 8px)', left: '12px', right: '12px', bottom: '12px' }
    : { left: `${geo.winRect.x}px`, top: `${geo.winRect.y}px`, width: `${geo.winRect.w}px`, height: `${geo.winRect.h}px` };
  const winStyle = studioConfig?.hasWallpaper
    ? { ...winStyleBase, '--nai5-wallpaper': 'url("/api/novelai/wallpaper")' }
    : winStyleBase;

  const isBusyGenerating = isGenerating || bridge.agentGenStatus === 'generating';
  const latestThumbUrl = latestImage ? getImageUrl(latestImage.source_path || latestImage.filePath || '', true) : null;
  const latestFullUrl = latestImage ? getImageUrl(latestImage.source_path || latestImage.filePath || '', false) : null;

  return h(React.Fragment, null,
    h('style', null, CSS_STYLES),

    geo.winMode !== 'open' && h(OrbCompanionHud, {
      themeClass,
      orbPos: geo.orbPos,
      openOrbHud: bridge.openOrbHud,
      scheduleCloseOrbHud: bridge.scheduleCloseOrbHud,
      showOrbHud: bridge.showOrbHud,
      bridgeLocks: bridge.bridgeLocks,
      toggleBridgeLock: bridge.toggleBridgeLock,
      latestImage,
      latestThumbUrl,
      handleDragStart,
      setPreviewIndex: lightbox.setPreviewIndex,
      setPreviewCustomItem: lightbox.setPreviewCustomItem,
      resetZoom: lightbox.resetZoom,
      handleForkToWorkbench,
      seedMode,
      seed,
      setSeedMode,
      setSeed,
      setBridgeLocks: bridge.setBridgeLocks,
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
      updateWinMode: geo.updateWinMode,
      totalCount: gallery.totalCount,
      isBusyGenerating,
      dragRef: geo.dragRef,
      balance: accounts.balance,
      accountInfo: accounts.accountInfo
    }),

    geo.winMode === 'open' && h('div', {
      className: `nai5-floating-window ${themeClass} ${geo.isMaximized ? 'maximized' : ''} ${peekArt ? 'peek-art' : ''}`,
      style: winStyle
    },
      h(StudioBackdrop),

      !geo.isMaximized && h(React.Fragment, null,
        ['e', 'w', 's', 'se', 'sw'].map(dir =>
          h('div', { key: dir, className: `nai5-resize-${dir}`, onMouseDown: (e) => geo.startWindowResize(dir, e) })
        )
      ),

      h('div', {
        className: 'nai5-win-header',
        onMouseDown: geo.startWindowDrag,
        onDoubleClick: () => geo.setIsMaximized(m => !m)
      },
        h('div', { className: 'nai5-win-brand' },
          h('div', { className: 'nai5-hanko-seal', title: 'NAI5 Studio' }, 'N5'),
          h('span', { className: 'nai5-brand-title' }, 'NAI5 Studio'),
          h('span', { className: 'nai5-brand-sub' },
            h(Icon, { name: 'sakura', size: 11, style: { marginRight: '3px', verticalAlign: '-1px' } }),
            '绘卷工坊'
          )
        ),

        h('div', { className: 'nai5-seg-nav' },
          h('button', {
            type: 'button',
            className: `nai5-seg-btn ${activeTab === 'studio' ? 'active' : ''}`,
            onClick: () => setActiveTab('studio')
          }, h(Icon, { name: 'sakura', size: 13 }), '绘卷工坊'),
          h('button', {
            type: 'button',
            className: `nai5-seg-btn ${activeTab === 'gallery' ? 'active' : ''}`,
            onClick: () => {
              setActiveTab('gallery');
              if (gallery.history.length === 0) gallery.fetchHistoryWithParams({ isReset: true });
            }
          }, h(Icon, { name: 'grid', size: 13 }), `典藏画廊 (${gallery.filteredTotal || gallery.totalCount || gallery.history.length})`),
          h('button', {
            type: 'button',
            className: `nai5-seg-btn ${activeTab === 'codex' ? 'active' : ''}`,
            onClick: () => setActiveTab('codex')
          }, h(Icon, { name: 'book', size: 13 }), '词库与法典')
        ),

        h('div', { className: 'nai5-win-actions' },
          studioConfig?.hasWallpaper && h('button', {
            type: 'button',
            className: `nai5-btn xs ${peekArt ? 'primary' : ''}`,
            title: '透视欣赏自定义背景原画',
            onClick: () => setPeekArt(p => !p)
          }, h(Icon, { name: 'sakura', size: 12 }), h('span', null, '赏画')),
          h('button', {
            type: 'button',
            className: 'nai5-btn xs',
            title: `当前色调模式: ${themePref === 'auto' ? '跟随系统' : themePref === 'light' ? '雪昼浅色' : '绯夜深色'}（点击切换）`,
            onClick: cycleThemePref
          },
            h(Icon, { name: isLightTheme ? 'sun' : 'moon', size: 12 }),
            h('span', null, themePref === 'auto' ? '随系统' : (isLightTheme ? '雪昼' : '绯夜'))
          ),
          h(AccountPopover, accounts),
          h('button', {
            type: 'button',
            className: 'nai5-btn xs',
            title: accounts.accountInfo.endpoint ? `点击刷新账户状态 (${accounts.accountInfo.endpoint})` : '点击刷新账户状态',
            onClick: accounts.fetchBalance
          },
            h(Icon, { name: 'zap', size: 12, style: { color: '#e0284f' } }),
            h('span', null, accounts.loadingBalance
              ? '...'
              : (accounts.accountInfo.configured === false
                ? '未配置'
                : (accounts.accountInfo.balanceSupported === false
                  ? (accounts.accountInfo.tier || '中转已连')
                  : (accounts.balance !== null ? `${accounts.balance} Anlas` : 'Anlas'))))
          ),
          h('button', { type: 'button', className: 'nai5-win-ctrl', title: '收起为悬浮球 (Alt+N)', onClick: () => geo.updateWinMode('minimized') }, h(Icon, { name: 'minus', size: 14 })),
          h('button', { type: 'button', className: 'nai5-win-ctrl', title: geo.isMaximized ? '还原窗口尺寸' : '最大化窗口', onClick: () => geo.setIsMaximized(m => !m) }, h(Icon, { name: geo.isMaximized ? 'minimize' : 'maximize', size: 13 })),
          h('button', { type: 'button', className: 'nai5-win-ctrl danger', title: '最小化收起窗口', onClick: () => geo.updateWinMode('minimized') }, h(Icon, { name: 'close', size: 14 }))
        )
      ),

      activeTab === 'studio' && h(StudioWorkbench, {
        ...geo,
        ...chars,
        bridgeLocks: bridge.bridgeLocks,
        toggleBridgeLock: bridge.toggleBridgeLock,
        autoMirrorAgent: bridge.autoMirrorAgent,
        setAutoMirrorAgent: bridge.setAutoMirrorAgent,
        sendToChatComposer,
        accountsCount: (accounts.accountsData.accounts || []).length,
        accountsLoaded: accounts.accountsLoaded,
        onOpenAccountSetup: accounts.openConfigureAccount,
        studioConfig,
        width, height, setWidth, setHeight,
        aspectRatio, pixelTier, setPixelTier,
        handleTierChange, handleRatioChange,
        seedMode, setSeedMode, seed, setSeed,
        steps, setSteps, cfgScale, setCfgScale,
        sampler, setSampler, cfgRescale, setCfgRescale,
        latestImage, latestFullUrl, setLatestImage,
        artistPresets, serverArtistPresets, setArtistPresets, selectedArtistId, setSelectedArtistId,
        ocPresets, serverOcPresets, setOcPresets, selectedOcId, setSelectedOcId,
        onImportPresetsJson: handleImportPresetsJson,
        positivePrompt, setPositivePrompt,
        negativePrompt, setNegativePrompt,
        ucMode, setUcMode, stylePrompt, setStylePrompt,
        showStyleAndUc, setShowStyleAndUc,
        posTextareaRef, charTextareaRefs,
        ...codex,
        copyToClipboard, copyImageToClipboard, handleDragStart,
        handleForkToWorkbench, handleRevealInExplorer,
        setPreviewIndex: lightbox.setPreviewIndex,
        setPreviewCustomItem: lightbox.setPreviewCustomItem,
        resetZoom: lightbox.resetZoom,
        history: gallery.history,
        costInfo, isGenerating, handleGenerate, showToast
      }),

      activeTab === 'gallery' && h(GalleryView, {
        history: gallery.history,
        totalCount: gallery.totalCount,
        loadingHistory: gallery.loadingHistory,
        loadingMore: gallery.loadingMore,
        hasMore: gallery.hasMore,
        gridDensity: gallery.gridDensity,
        setGridDensity: gallery.setGridDensity,
        galleryLayout: gallery.galleryLayout,
        setGalleryLayout: gallery.updateGalleryLayout,
        filterChar: gallery.filterChar,
        filterMonth: gallery.filterMonth,
        filterRating: gallery.filterRating,
        filterTopic: gallery.filterTopic,
        gallerySearch: gallery.gallerySearch,
        setGallerySearch: gallery.setGallerySearch,
        galleryMeta: gallery.galleryMeta,
        applyFilter: gallery.applyFilter,
        onRefreshGallery: gallery.handleRefreshGallery,
        onBackfillMetadata: gallery.handleBackfillMetadata,
        onLoadMore: gallery.handleLoadMore,
        onOpenPreview: lightbox.handleOpenPreview,
        onDragStart: handleDragStart,
        onCopyImage: copyImageToClipboard,
        onRevealInExplorer: handleRevealInExplorer,
        onForkToWorkbench: handleForkToWorkbench,
        onSendToChat: sendToChatComposer,
        onCopyText: copyToClipboard
      }),

      activeTab === 'codex' && h(CodexView, {
        ...codex,
        onAppendPositive: handleAppendPositive,
        onAppendNegative: handleAppendNegative,
        onOverwriteStudio: handleOverwriteStudio,
        onCopyText: copyToClipboard,
        onSendToChat: sendToChatComposer
      })
    ),

    lightbox.activeItem && h(LightboxOverlay, {
      ...lightbox,
      displayedRecords: gallery.history,
      handleDragStart,
      sendToChatComposer,
      handleForkToWorkbench,
      copyFullParams,
      copyImageToClipboard,
      handleRevealInExplorer,
      handleDeleteImage
    }),

    toast && h('div', {
      style: {
        position: 'fixed', bottom: '24px', right: '24px',
        background: 'rgba(15, 18, 26, 0.96)', color: '#f8fafc',
        padding: '9px 15px', borderRadius: '9px',
        border: '1px solid rgba(99, 102, 241, 0.45)',
        boxShadow: '0 16px 36px -8px rgba(0, 0, 0, 0.85)',
        fontSize: '12px', zIndex: 1000000,
        display: 'flex', alignItems: 'center', gap: '8px'
      }
    },
      h(Icon, { name: 'sparkles', size: 13, style: { color: 'var(--fx-crimson-soft)' } }),
      toast
    )
  );
}
