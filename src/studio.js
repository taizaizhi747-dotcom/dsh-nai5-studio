function NovelAiFloatingStudio({ CSS_STYLES }) {
  const [activeTab, setActiveTab] = useState('studio');
  const [peekArt, setPeekArt] = useState(false);
  const [studioConfig, setStudioConfig] = useState(null);

  const { toast, showToast } = useToast();
  const { themePref, isLightTheme, themeClass, cycleThemePref } = useHostTheme(showToast);
  const handleWallpaperStateChange = useCallback((has) => {
    setStudioConfig(prev => (prev ? { ...prev, hasWallpaper: has } : { hasWallpaper: has }));
  }, []);
  const scene = useStudioScene(isLightTheme, Boolean(studioConfig?.hasWallpaper), showToast, handleWallpaperStateChange);
  const [sceneMenuOpen, setSceneMenuOpen] = useState(false);
  const sceneMenuRef = useRef(null);
  const sceneUploadInputRef = useRef(null);
  const geo = useWindowGeometry(setActiveTab);
  const accounts = useAccounts(showToast);
  const chars = useCharacterBoxes(showToast);

  useEffect(() => {
    if (!sceneMenuOpen) return;
    const onDown = (e) => {
      if (sceneMenuRef.current && !sceneMenuRef.current.contains(e.target)) {
        setSceneMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [sceneMenuOpen]);

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
  const [model, setModel] = useState('nai-diffusion-5-full');
  const [effort, setEffort] = useState('high');
  const [noiseSchedule, setNoiseSchedule] = useState('karras');
  const [variety, setVariety] = useState(false);
  const [transparentBackground, setTransparentBackground] = useState(false);
  const [batchCount, setBatchCount] = useState(1);

  const [genMode, setGenMode] = useState('txt2img'); // 'txt2img' | 'img2img' | 'inpaint'
  const [sourceImage, setSourceImage] = useState('');
  const [sourceImagePreviewUrl, setSourceImagePreviewUrl] = useState('');
  const [i2iStrength, setI2iStrength] = useState(0.55);
  const [i2iNoise, setI2iNoise] = useState(0);
  const [inpaintMask, setInpaintMask] = useState('');
  const [inpaintStrength, setInpaintStrength] = useState(0.7);
  const [colorCorrect, setColorCorrect] = useState(true);

  const [refTab, setRefTab] = useState('vibe');
  const [vibeReferences, setVibeReferences] = useState([]);
  const [preciseReferences, setPreciseReferences] = useState([]);
  const [showRefPanel, setShowRefPanel] = useState(false);
  const [showChunksDrawer, setShowChunksDrawer] = useState(false);

  const [compareBeforeItem, setCompareBeforeItem] = useState(null);
  const [compareActive, setCompareActive] = useState(false);
  const [busyPostAction, setBusyPostAction] = useState('');

  const [isGenerating, setIsGenerating] = useState(false);
  const [latestImage, setLatestImage] = useState(null);

  const posTextareaRef = useRef(null);
  const charTextareaRefs = useRef({});

  // Gallery, Lightbox & Codex Search
  const gallery = useGalleryState(showToast, setLatestImage);
  const lightbox = useLightboxState(gallery.history);
  const codex = useCodexSearch(activeTab, showToast);

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
          setArtistPresets(mergePresetsWithBuiltins('dsh_nai5_artist_presets_v1', srvArtists));
          setOcPresets(mergePresetsWithBuiltins('dsh_nai5_oc_presets_v1', srvOcs));
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
    if (genMode === 'img2img' && !sourceImage) {
      showToast('请先选择或从成图送入一张底图后再运行图生图');
      return;
    }
    if (genMode === 'inpaint') {
      if (!sourceImage) {
        showToast('请先选择底图后再进行局部重绘');
        return;
      }
      if (!inpaintMask) {
        showToast('请先用画笔涂抹需要重绘的区域');
        return;
      }
    }

    setIsGenerating(true);
    const prevSnapshot = latestImage;
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
        steps: effort === 'medium' ? 14 : Number(steps),
        cfgScale: Number(cfgScale),
        cfgRescale: Number(cfgRescale),
        sampler,
        model,
        effort,
        noiseSchedule,
        variety,
        transparentBackground,
        count: genMode === 'txt2img' ? Number(batchCount) || 1 : 1,
        vibeReferences: preciseReferences.length > 0 ? [] : vibeReferences,
        preciseReferences,
        characterPrompts: activeCharBoxes,
        seed: (seedMode === 'fixed' && seed !== '') ? Number(seed) : undefined
      };

      let endpoint = '/api/novelai/generate';
      if (genMode === 'img2img') {
        endpoint = '/api/novelai/img2img';
        payload.image = sourceImage;
        payload.strength = Number(i2iStrength);
        payload.noise = Number(i2iNoise);
      } else if (genMode === 'inpaint') {
        endpoint = '/api/novelai/inpaint';
        payload.image = sourceImage;
        payload.mask = inpaintMask;
        payload.strength = Number(inpaintStrength);
        payload.colorCorrect = Boolean(colorCorrect);
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.ok) {
        const items = Array.isArray(data.results) && data.results.length > 0 ? data.results : [data];
        const enrichedList = items.map(it => ({
          ...it,
          source_path: it.filePath,
          prompt: it.prompt || positivePrompt,
          uc: it.uc !== undefined ? it.uc : negativePrompt,
          stylePrompt: it.stylePrompt !== undefined ? it.stylePrompt : stylePrompt,
          cfg: it.cfg || cfgScale,
          cfgRescale: it.cfgRescale !== undefined ? it.cfgRescale : cfgRescale,
          sampler: it.sampler || sampler,
          characterPrompts: activeCharBoxes,
          _metaHydrated: true
        }));
        const primary = enrichedList[0];
        if (genMode !== 'txt2img' && prevSnapshot) {
          setCompareBeforeItem(prevSnapshot);
        }
        setLatestImage(primary);
        setCompareActive(false);
        gallery.setHistory(prev => {
          const seen = new Set(prev.map(x => x.source_path || x.filePath));
          const fresh = enrichedList.filter(e => !seen.has(e.source_path));
          return [...fresh, ...prev];
        });
        showToast(enrichedList.length > 1
          ? `批量生成完成 (${enrichedList.length} 张) · 首图 Seed: ${primary.seed}`
          : `生成完成 · Seed: ${primary.seed}`);
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

  const applyCodexToWorkbench = useCallback((c) => {
    const posGlobal = String(c.globalPrompt !== undefined ? c.globalPrompt : (c.prompt || '')).trim();
    setPositivePrompt(posGlobal);
    if (c.negative) setNegativePrompt(c.negative.trim());
    if (Array.isArray(c.characterPrompts) && c.characterPrompts.length > 0) {
      chars.setCharacterPrompts(c.characterPrompts.map((cp, i) => ({
        id: 'codex_' + Date.now() + '_' + i,
        prompt: cp.prompt || cp.char_caption || '',
        negativePrompt: cp.negative || cp.uc || '',
        x: typeof cp.x === 'number' ? cp.x : 0.5,
        y: typeof cp.y === 'number' ? cp.y : 0.5,
        useCoords: cp.useCoords !== false
      })));
      chars.setShowCharBoxes(true);
    } else {
      chars.setCharacterPrompts([]);
    }
    return posGlobal;
  }, [chars.setCharacterPrompts, chars.setShowCharBoxes]);

  const sendToChatComposer = useCallback(async (rawItem = null, isCodex = false) => {
    let target = rawItem || latestImage || {};
    if (!isCodex && target && !target.codex && !target.codexKey && !target._metaHydrated && (target.source_path || target.filePath)) {
      target = await ensureRecordMetadata(target);
    }

    let chatText = '';
    if (isCodex || target.codex || target.codexKey) {
      const fullText = formatCodexFullText(target);
      const neg = target.negative ? `\n负向排他：${target.negative.trim()}` : '';
      chatText = `请以《${target.codex || '权威法典'}》【${target.name || '经典配方'}】为基准出图：\n${fullText}${neg}\n👉 请以此法典配方为骨架进行精修组装，并直接调用 generate_image 出图：`;
      applyCodexToWorkbench(target);
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
      const pathLine = imgPath ? `\n底模路径：${imgPath}` : '';
      chatText = `[NAI5 Studio 续写底模 · 角色: ${target.character || '当前角色'} | Seed: ${targetSeed} | 画幅: ${targetW}×${targetH} (已锁定同画风/同画幅)]${pathLine}\n基底提示词：${cleanPos}${charCoordsInfo}\n👉 请保持上述角色外貌与画风一致，在此画面基础上继续演进下一幕并直接调用 generate_image 出图：`;
    }

    geo.updateWinMode('minimized');
    bridge.setShowOrbHud(false);
    lightbox.setPreviewIndex(null);
    lightbox.setPreviewCustomItem(null);

    showToast(dshComposerBridge.injectIntoChat(chatText)
      ? '💬 已推送至 DSH 对话输入框（已同步画风/画幅硬锁），输入下一幕剧情即可回车生图！'
      : '💬 续写指令已复制到剪贴板，在对话框 Ctrl+V 粘贴即可继续生图');
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
    applyCodexToWorkbench(c);
    setActiveTab('studio');
    showToast(`已载入《${c.codex || '词库'}》配方至绘卷工坊`);
  }, [applyCodexToWorkbench, showToast]);

  const handleUpscale = useCallback(async (targetItem, scale = 2) => {
    const item = targetItem || latestImage;
    const imgPath = item?.source_path || item?.filePath;
    if (!imgPath || busyPostAction) return;
    setBusyPostAction(`upscale${scale}`);
    showToast(`正在执行 NovelAI ${scale}× 无损超分...`);
    try {
      const res = await fetch('/api/novelai/upscale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imgPath, scale, character: item.character, topic: item.topic })
      });
      const data = await res.json();
      if (data.ok) {
        const enriched = { ...data, source_path: data.filePath, _metaHydrated: true };
        setCompareBeforeItem(item);
        setLatestImage(enriched);
        setCompareActive(true);
        gallery.setHistory(prev => [enriched, ...prev.filter(x => (x.source_path || x.filePath) !== enriched.source_path)]);
        gallery.fetchGalleryMeta();
        accounts.fetchBalance();
        showToast(`✨ ${scale}× 超分完成 (${data.width}×${data.height})`);
      } else {
        showToast(`超分失败: ${data.error || '未知错误'}`);
      }
    } catch (err) {
      showToast(`超分异常: ${err.message}`);
    } finally {
      setBusyPostAction('');
    }
  }, [latestImage, busyPostAction, gallery, accounts, showToast]);

  const handleDirector = useCallback(async (targetItem, opts = {}) => {
    const item = targetItem || latestImage;
    const imgPath = item?.source_path || item?.filePath;
    if (!imgPath || busyPostAction) return;
    const tool = opts.tool || 'bg-removal';
    setBusyPostAction(`director:${tool}`);
    showToast(`正在运行导演工具 [${tool}]...`);
    try {
      const res = await fetch('/api/novelai/director', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: imgPath,
          tool,
          defry: opts.defry ?? 0,
          prompt: opts.prompt || '',
          emotion: opts.emotion || 'neutral',
          emotionLevel: opts.emotionLevel || 'normal',
          character: item.character,
          topic: item.topic
        })
      });
      const data = await res.json();
      if (data.ok) {
        const enriched = { ...data, source_path: data.filePath, _metaHydrated: true };
        setCompareBeforeItem(item);
        setLatestImage(enriched);
        setCompareActive(true);
        gallery.setHistory(prev => [enriched, ...prev.filter(x => (x.source_path || x.filePath) !== enriched.source_path)]);
        gallery.fetchGalleryMeta();
        accounts.fetchBalance();
        showToast(`🎨 导演工具 [${tool}] 处理完成`);
      } else {
        showToast(`导演处理失败: ${data.error || '未知错误'}`);
      }
    } catch (err) {
      showToast(`导演处理异常: ${err.message}`);
    } finally {
      setBusyPostAction('');
    }
  }, [latestImage, busyPostAction, gallery, accounts, showToast]);

  const handleSendToImg2Img = useCallback(async (rawItem) => {
    const item = rawItem && !rawItem._metaHydrated ? await ensureRecordMetadata(rawItem) : (rawItem || latestImage);
    const imgPath = item?.source_path || item?.filePath;
    if (!imgPath) return;
    setSourceImage(imgPath);
    setSourceImagePreviewUrl(getImageUrl(imgPath, false));
    setGenMode('img2img');
    setCompareActive(false);
    if (rawItem) await handleForkToWorkbench(item, true);
    geo.updateWinMode('open');
    setActiveTab('studio');
    lightbox.setPreviewIndex(null);
    lightbox.setPreviewCustomItem(null);
    showToast('已将图像送入图生图 (Img2Img) 模式');
  }, [latestImage, ensureRecordMetadata, handleForkToWorkbench, geo.updateWinMode, lightbox.setPreviewIndex, lightbox.setPreviewCustomItem, showToast]);

  const handleSendToInpaint = useCallback(async (rawItem) => {
    const item = rawItem && !rawItem._metaHydrated ? await ensureRecordMetadata(rawItem) : (rawItem || latestImage);
    const imgPath = item?.source_path || item?.filePath;
    if (!imgPath) return;
    setSourceImage(imgPath);
    setSourceImagePreviewUrl(getImageUrl(imgPath, false));
    setInpaintMask('');
    setGenMode('inpaint');
    setCompareActive(false);
    if (rawItem) await handleForkToWorkbench(item, true);
    geo.updateWinMode('open');
    setActiveTab('studio');
    lightbox.setPreviewIndex(null);
    lightbox.setPreviewCustomItem(null);
    showToast('已进入局部重绘 (Inpaint)，请用画笔涂抹待重绘区域');
  }, [latestImage, ensureRecordMetadata, handleForkToWorkbench, geo.updateWinMode, lightbox.setPreviewIndex, lightbox.setPreviewCustomItem, showToast]);

  const handleUploadSourceImage = useCallback((dataUrl) => {
    setSourceImage(dataUrl);
    setSourceImagePreviewUrl(dataUrl);
    setInpaintMask('');
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) {
        setWidth(Math.max(64, Math.min(2048, Math.round(img.naturalWidth / 64) * 64)));
        setHeight(Math.max(64, Math.min(2048, Math.round(img.naturalHeight / 64) * 64)));
        setPixelTier('custom');
      }
    };
    img.src = dataUrl;
  }, []);

  const handleRepairPrompt = useCallback(async () => {
    try {
      const res = await fetch('/api/novelai/repair-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: positivePrompt })
      });
      const data = await res.json();
      if (data.ok && typeof data.repaired === 'string') {
        setPositivePrompt(data.repaired);
        showToast('✨ V5 权重语法与标点已一键修复');
      }
    } catch (err) {
      showToast(`语法修复失败: ${err.message}`);
    }
  }, [positivePrompt, showToast]);

  const handleInspectDroppedFile = useCallback((file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== 'string') return;
      try {
        const res = await fetch('/api/novelai/inspect-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: dataUrl })
        });
        const data = await res.json();
        if (data.ok && data.meta && (data.meta.prompt || data.meta.positivePrompt)) {
          const m = data.meta;
          let cleanPos = m.prompt || m.positivePrompt || '';
          if (m.stylePrompt && cleanPos.startsWith(m.stylePrompt)) {
            cleanPos = cleanPos.slice(m.stylePrompt.length).replace(/^,\s*/, '');
          }
          if (cleanPos) setPositivePrompt(cleanPos);
          if (m.uc) setNegativePrompt(m.uc);
          if (m.stylePrompt) setStylePrompt(m.stylePrompt);
          if (data.width) setWidth(Math.round(Number(data.width) / 64) * 64);
          if (data.height) setHeight(Math.round(Number(data.height) / 64) * 64);
          if (m.steps) setSteps(Number(m.steps));
          if (m.cfg || m.scale) setCfgScale(Number(m.cfg || m.scale));
          if (m.sampler) setSampler(m.sampler);
          if (m.seed !== undefined) { setSeedMode('fixed'); setSeed(m.seed); }
          if (Array.isArray(m.characterPrompts) && m.characterPrompts.length > 0) {
            chars.setCharacterPrompts(m.characterPrompts.map((cp, i) => ({
              id: 'drop_' + Date.now() + '_' + i,
              prompt: cp.prompt || cp.char_caption || '',
              negativePrompt: cp.negativePrompt || cp.uc || '',
              x: typeof cp.x === 'number' ? cp.x : 0.5,
              y: typeof cp.y === 'number' ? cp.y : 0.5,
              useCoords: cp.useCoords !== false
            })));
            chars.setShowCharBoxes(true);
          }
          showToast('📥 已解析拖入 PNG 元数据并回灌完整参数');
        } else {
          handleUploadSourceImage(dataUrl);
          if (genMode === 'txt2img') setGenMode('img2img');
          showToast('已载入图片至底图槽位（未检测到 NAI 元数据）');
        }
      } catch (err) {
        showToast(`拖入解析失败: ${err.message}`);
      }
    };
    reader.readAsDataURL(file);
  }, [chars.setCharacterPrompts, chars.setShowCharBoxes, genMode, handleUploadSourceImage, showToast]);

  const handleUseCurrentCanvasAsRef = useCallback(async (kind = 'vibe') => {
    const imgPath = latestImage?.source_path || latestImage?.filePath;
    if (!imgPath) {
      showToast('当前画布暂无成品图可抓取');
      return;
    }
    try {
      const resp = await fetch(getImageUrl(imgPath, false));
      const blob = await resp.blob();
      const dataUrl = await new Promise((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.readAsDataURL(blob);
      });
      if (typeof dataUrl !== 'string') return;
      if (kind === 'precise') {
        setPreciseReferences(prev => [...prev, { image: dataUrl, name: 'canvas_ref.png', type: 'character&style', strength: 1.0, fidelity: 1.0 }].slice(0, 4));
      } else {
        setVibeReferences(prev => [...prev, { image: dataUrl, name: 'canvas_vibe.png', strength: 0.6, infoExtracted: 1.0 }].slice(0, 6));
      }
      showToast('已将当前预览图加入参考槽位');
    } catch (err) {
      showToast(`抓取失败: ${err.message}`);
    }
  }, [latestImage, showToast]);

  const handleToggleFavorite = useCallback(async (imgPath) => {
    const nextFav = await gallery.toggleFavorite(imgPath);
    if (nextFav !== null) {
      lightbox.setPreviewCustomItem(prev => (prev && (prev.source_path || prev.filePath) === imgPath ? { ...prev, isFavorite: nextFav } : prev));
    }
  }, [gallery, lightbox]);

  const handleSetBackdrop = useCallback((item) => {
    const p = item?.source_path || item?.filePath;
    if (p) scene.setCustomBackdrop(p, item.character || '典藏画卷');
  }, [scene.setCustomBackdrop]);

  const effStepsForCost = effort === 'medium' ? 14 : steps;
  const costInfoRaw = estimateAnlasCost(width, height, effStepsForCost);
  const costCount = genMode === 'txt2img' ? (Number(batchCount) || 1) : 1;
  const costInfo = costCount > 1 && costInfoRaw.cost > 0
    ? { ...costInfoRaw, cost: costInfoRaw.cost * costCount, label: `约 ${costInfoRaw.cost * costCount} Anlas (${costCount}张)` }
    : costInfoRaw;
  const winStyle = geo.isMaximized
    ? { top: 'calc(var(--dsh-frame-chrome-top, var(--dsh-windows-titlebar-height, 36px)) + 8px)', left: '12px', right: '12px', bottom: '12px' }
    : { left: `${geo.winRect.x}px`, top: `${geo.winRect.y}px`, width: `${geo.winRect.w}px`, height: `${geo.winRect.h}px` };

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
      'data-bg-intensity': scene.bgIntensity,
      style: winStyle
    },
      h(StudioBackdrop, { bgUrl: scene.activeBgUrl, bgPos: scene.activeBgPos, bgGradient: scene.activeBgGradient }),

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
          h('div', { className: 'nai5-hanko-seal', title: 'NAI5 Studio · Frost & Maple Atelier' }, 'N5'),
          h('span', { className: 'nai5-brand-title' }, 'NAI5 Studio'),
          h('span', { className: 'nai5-brand-sub' },
            h(Icon, { name: 'maple', size: 11, style: { marginRight: '3px', verticalAlign: '-1px' } }),
            '枫霜画室'
          ),
          bridge.bridgeLocks.enabled && h('span', {
            className: 'nai5-lock-chip active',
            style: { marginLeft: '4px', cursor: 'pointer' },
            title: 'DSH 对话硬件锁已开启，点击关闭或前往 参数与协同 标签管理',
            onClick: () => bridge.toggleBridgeLock('enabled')
          }, '🔗 协同锁')
        ),

        h('div', { className: 'nai5-seg-nav' },
          h('button', {
            type: 'button',
            className: `nai5-seg-btn ${activeTab === 'studio' ? 'active' : ''}`,
            onClick: () => setActiveTab('studio')
          }, h(Icon, { name: 'maple', size: 13 }), '绘卷工坊'),
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
          h('div', {
            ref: sceneMenuRef,
            className: 'nai5-scene-wrap',
            onMouseDown: e => e.stopPropagation()
          },
            h('button', {
              type: 'button',
              className: `nai5-btn xs ${sceneMenuOpen ? 'primary' : ''}`,
              title: `切换工坊背景画卷 · 当前：《${scene.activeTitle}》`,
              onClick: () => setSceneMenuOpen(v => !v)
            }, h(Icon, { name: 'image', size: 12 }), h('span', null, '景致 ▾')),
            sceneMenuOpen && h('div', {
              className: 'nai5-scene-popover',
              onClick: e => e.stopPropagation()
            },
              h('div', { className: 'nai5-scene-pop-head' },
                h('span', { className: 'nai5-scene-pop-title' },
                  h(Icon, { name: 'maple', size: 12, style: { color: 'var(--fx-crimson-soft)' } }),
                  '画卷景致 · 精选收藏'
                ),
                h('button', {
                  type: 'button',
                  className: `nai5-btn xs ${scene.scenePref === 'auto' ? 'primary' : ''}`,
                  onClick: () => { scene.selectScene('auto'); setSceneMenuOpen(false); }
                }, '随明暗自动')
              ),
              h('div', { className: 'nai5-scene-intensity-row' },
                h('span', { className: 'nai5-scene-intensity-label' }, '画卷通透'),
                h('div', { className: 'nai-seg-mini' },
                  [
                    { id: 'soft', label: '静谧' },
                    { id: 'balanced', label: '平衡' },
                    { id: 'vivid', label: '浓映' }
                  ].map(lv =>
                    h('button', {
                      key: lv.id,
                      type: 'button',
                      className: `nai-seg-mini-btn ${scene.bgIntensity === lv.id ? 'active' : ''}`,
                      onClick: () => scene.updateBgIntensity(lv.id)
                    }, lv.label)
                  )
                )
              ),
              h('input', {
                ref: sceneUploadInputRef,
                type: 'file',
                accept: 'image/png,image/jpeg,image/webp,image/gif',
                style: { display: 'none' },
                onChange: (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) scene.uploadBackdropFile(f);
                }
              }),
              h('div', { className: 'nai5-scene-upload-row' },
                h('button', {
                  type: 'button',
                  className: 'nai5-btn xs',
                  style: { flex: 1, justifyContent: 'center' },
                  disabled: scene.uploadingBg,
                  onClick: () => sceneUploadInputRef.current?.click()
                }, h(Icon, { name: 'upload', size: 11 }), scene.uploadingBg ? '上传中...' : (scene.hasUploadedWallpaper ? '更换本地背景图' : '上传本地图片作背景')),
                h('span', { style: { fontSize: '9.5px', color: 'var(--fx-text-muted)', flex: 'none' } }, '≤15MB')
              ),
              scene.hasUploadedWallpaper && h('div', { className: 'nai5-scene-custom-bar' },
                h('img', {
                  src: `/api/novelai/wallpaper?v=${scene.wallpaperRev}`,
                  className: 'nai5-scene-custom-thumb'
                }),
                h('div', { style: { flex: 1, minWidth: 0 } },
                  h('div', { style: { fontSize: '11px', fontWeight: 700, color: 'var(--fx-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
                    `本地背景：${scene.uploadedBgLabel || '自定义壁纸'}`
                  ),
                  h('div', { style: { fontSize: '9.5px', color: 'var(--fx-text-muted)' } }, '持久化保存在本机配置目录')
                ),
                scene.scenePref !== 'wallpaper' && h('button', {
                  type: 'button',
                  className: 'nai5-btn xs primary',
                  onClick: () => { scene.selectScene('wallpaper'); setSceneMenuOpen(false); }
                }, '启用'),
                h('button', {
                  type: 'button',
                  className: 'nai5-btn xs',
                  title: '移除本地上传背景图',
                  onClick: () => scene.clearUploadedBackdrop()
                }, '清除')
              ),
              scene.customBgPath && h('div', { className: 'nai5-scene-custom-bar' },
                h('img', {
                  src: getImageUrl(scene.customBgPath, true),
                  className: 'nai5-scene-custom-thumb'
                }),
                h('div', { style: { flex: 1, minWidth: 0 } },
                  h('div', { style: { fontSize: '11px', fontWeight: 700, color: 'var(--fx-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
                    `自选：${scene.customBgLabel || '典藏画卷'}`
                  ),
                  h('div', { style: { fontSize: '9.5px', color: 'var(--fx-text-muted)' } }, '从画廊或暗房设为工坊背景')
                ),
                scene.scenePref !== 'custom' && h('button', {
                  type: 'button',
                  className: 'nai5-btn xs primary',
                  onClick: () => { scene.selectScene('custom'); setSceneMenuOpen(false); }
                }, '启用'),
                h('button', {
                  type: 'button',
                  className: 'nai5-btn xs',
                  title: '移除自定义画卷',
                  onClick: () => scene.clearCustomBackdrop()
                }, '清除')
              ),
              h('div', { className: 'nai5-scene-grid' },
                STUDIO_SCENES.map(sc => {
                  const isActive = scene.scenePref === sc.id || (scene.scenePref === 'auto' && scene.activeScene.id === sc.id);
                  return h('button', {
                    key: sc.id,
                    type: 'button',
                    className: `nai5-scene-card ${isActive ? 'is-active' : ''}`,
                    onClick: () => { scene.selectScene(sc.id); setSceneMenuOpen(false); }
                  },
                    h('div', { className: 'nai5-scene-thumb-wrap' },
                      h('div', {
                        className: 'nai5-scene-thumb',
                        style: {
                          backgroundImage: sc.gradient,
                          backgroundPosition: sc.pos,
                          backgroundSize: 'cover'
                        }
                      }),
                      isActive && h('span', { className: 'nai5-scene-badge' }, scene.scenePref === 'auto' ? '自动' : '当前')
                    ),
                    h('div', { className: 'nai5-scene-meta' },
                      h('strong', null, sc.title),
                      h('span', null, sc.subtitle)
                    )
                  );
                })
              )
            )
          ),
          h('button', {
            type: 'button',
            className: `nai5-btn xs ${peekArt ? 'primary' : ''}`,
            title: '透视隐藏工作区界面，全身欣赏工坊精选景致画卷（支持 ◀ ▶ 切景 · 点击画布随时返回）',
            onClick: () => setPeekArt(p => !p)
          }, h(Icon, { name: 'eye', size: 12 }), h('span', null, peekArt ? '退出赏画' : '赏画')),
          h('button', {
            type: 'button',
            className: 'nai5-btn xs',
            title: `当前色调模式: ${themePref === 'auto' ? '跟随系统' : themePref === 'light' ? '霜晓浅色' : '玄月深色'}（点击切换）`,
            onClick: cycleThemePref
          },
            h(Icon, { name: isLightTheme ? 'sun' : 'moon', size: 12 }),
            h('span', null, themePref === 'auto' ? '随系统' : (isLightTheme ? '霜晓' : '玄月'))
          ),
          h(AccountPopover, accounts),
          h('button', {
            type: 'button',
            className: 'nai5-btn xs',
            title: accounts.accountInfo.endpoint ? `点击刷新账户状态 (${accounts.accountInfo.endpoint})` : '点击刷新账户 Anlas 余额',
            onClick: accounts.fetchBalance
          },
            h(Icon, { name: 'zap', size: 12, style: { color: 'var(--fx-gold)' } }),
            h('span', null, accounts.loadingBalance
              ? '...'
              : (accounts.accountInfo.balanceSupported === false
                ? (accounts.accountInfo.tier || '中转已连')
                : (accounts.balance !== null ? `${accounts.balance} Anlas` : 'Anlas')))
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
        model, setModel, effort, setEffort,
        noiseSchedule, setNoiseSchedule,
        variety, setVariety,
        transparentBackground, setTransparentBackground,
        batchCount, setBatchCount,
        genMode, setGenMode,
        sourceImage, setSourceImage,
        sourceImagePreviewUrl, setSourceImagePreviewUrl,
        i2iStrength, setI2iStrength,
        i2iNoise, setI2iNoise,
        inpaintMask, setInpaintMask,
        inpaintStrength, setInpaintStrength,
        colorCorrect, setColorCorrect,
        refTab, setRefTab,
        vibeReferences, setVibeReferences,
        preciseReferences, setPreciseReferences,
        showRefPanel, setShowRefPanel,
        showChunksDrawer, setShowChunksDrawer,
        compareBeforeItem, compareActive, setCompareActive,
        busyPostAction,
        handleUpscale, handleDirector,
        handleSendToImg2Img, handleSendToInpaint,
        handleUploadSourceImage, handleRepairPrompt,
        handleInspectDroppedFile, handleUseCurrentCanvasAsRef,
        onToggleFavorite: handleToggleFavorite,
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
        filterFavorites: gallery.filterFavorites,
        gallerySearch: gallery.gallerySearch,
        setGallerySearch: gallery.setGallerySearch,
        galleryMeta: gallery.galleryMeta,
        applyFilter: gallery.applyFilter,
        onRefreshGallery: gallery.handleRefreshGallery,
        onBackfillMetadata: gallery.handleBackfillMetadata,
        onLoadMore: gallery.handleLoadMore,
        onToggleFavorite: handleToggleFavorite,
        onBatchMove: gallery.batchMove,
        onBatchDelete: gallery.batchDelete,
        onSendToImg2Img: handleSendToImg2Img,
        onSendToInpaint: handleSendToInpaint,
        onOpenPreview: lightbox.handleOpenPreview,
        onDragStart: handleDragStart,
        onCopyImage: copyImageToClipboard,
        onRevealInExplorer: handleRevealInExplorer,
        onForkToWorkbench: handleForkToWorkbench,
        onSendToChat: sendToChatComposer,
        onSetAsBackdrop: handleSetBackdrop,
        onCopyText: copyToClipboard,
        showToast
      }),

      activeTab === 'codex' && h(CodexView, {
        ...codex,
        onAppendPositive: handleAppendPositive,
        onAppendNegative: handleAppendNegative,
        onOverwriteStudio: handleOverwriteStudio,
        onCopyText: copyToClipboard,
        onSendToChat: sendToChatComposer
      }),

      peekArt && h('div', {
        className: 'nai5-peek-overlay',
        onClick: () => setPeekArt(false),
        title: '点击任意区域退出赏画模式'
      },
        h('div', { className: 'nai5-peek-pill' },
          h('button', {
            type: 'button',
            className: 'nai5-peek-nav-btn',
            title: '上一幅精选景致',
            onClick: (e) => { e.stopPropagation(); scene.cycleCuratedScene(-1); }
          }, h(Icon, { name: 'chevronLeft', size: 13 })),
          h(Icon, { name: 'maple', size: 13, style: { color: 'var(--fx-crimson-soft)' } }),
          h('span', null, `赏画 · 《${scene.activeTitle}》 · 点击画布返回`),
          h('button', {
            type: 'button',
            className: 'nai5-peek-nav-btn',
            title: '下一幅精选景致',
            onClick: (e) => { e.stopPropagation(); scene.cycleCuratedScene(1); }
          }, h(Icon, { name: 'chevronRight', size: 13 }))
        )
      )
    ),

    lightbox.activeItem && h(LightboxOverlay, {
      ...lightbox,
      displayedRecords: gallery.history,
      handleDragStart,
      sendToChatComposer,
      handleForkToWorkbench,
      onToggleFavorite: handleToggleFavorite,
      onSetAsBackdrop: handleSetBackdrop,
      onUpscale: handleUpscale,
      onDirector: handleDirector,
      onSendToImg2Img: handleSendToImg2Img,
      onSendToInpaint: handleSendToInpaint,
      copyFullParams,
      copyImageToClipboard,
      handleRevealInExplorer,
      handleDeleteImage
    }),

    toast && h('div', { className: `nai5-toast-pill ${themeClass}` },
      h(Icon, { name: 'maple', size: 13, style: { color: 'var(--fx-crimson-soft)' } }),
      h('span', null, toast)
    )
  );
}
