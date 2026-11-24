function useToast() {
  const [toast, setToast] = useState('');
  const toastTimerRef = useRef(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(''), 2600);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  return { toast, showToast };
}

function useHostTheme(showToast) {
  const [themePref, setThemePref] = useState(() => {
    try {
      return localStorage.getItem('dsh_nai5_theme_pref') || 'auto';
    } catch (err) {
      warnSilent('theme.readPref', err);
      return 'auto';
    }
  });
  const [hostIsLight, setHostIsLight] = useState(() => detectHostIsLight());

  useEffect(() => {
    const updateTheme = () => setHostIsLight(detectHostIsLight());
    updateTheme();
    const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
    if (mq && mq.addEventListener) mq.addEventListener('change', updateTheme);
    let obs = null;
    if (typeof MutationObserver !== 'undefined' && document.documentElement) {
      obs = new MutationObserver(updateTheme);
      obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'data-color-mode', 'style'] });
      if (document.body) {
        obs.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
      }
    }
    return () => {
      if (mq && mq.removeEventListener) mq.removeEventListener('change', updateTheme);
      if (obs) obs.disconnect();
    };
  }, []);

  const isLightTheme = themePref === 'light' || (themePref === 'auto' && hostIsLight);
  const themeClass = isLightTheme ? 'nai5-theme-light' : 'nai5-theme-dark';

  const cycleThemePref = useCallback(() => {
    const order = ['auto', 'dark', 'light'];
    const next = order[(order.indexOf(themePref) + 1) % order.length];
    setThemePref(next);
    try {
      localStorage.setItem('dsh_nai5_theme_pref', next);
    } catch (err) {
      warnSilent('theme.savePref', err);
    }
    const labelMap = { auto: '跟随系统与宿主色调', dark: '固定「玄月·寒霜」深色', light: '固定「霜晓·素雪」浅色' };
    showToast(`已切换外观色调：${labelMap[next]}`);
  }, [themePref, showToast]);

  return { themePref, isLightTheme, themeClass, cycleThemePref };
}

function useStudioScene(isLightTheme, hasWallpaper, showToast, onWallpaperStateChange) {
  const [scenePref, setScenePref] = useState(() => {
    try {
      return localStorage.getItem('dsh_nai5_scene_pref_v1') || 'auto';
    } catch (err) {
      warnSilent('scene.readPref', err);
      return 'auto';
    }
  });
  const [customBgPath, setCustomBgPath] = useState(() => {
    try {
      return localStorage.getItem('dsh_nai5_custom_bg_v1') || '';
    } catch (err) {
      warnSilent('scene.readCustomPath', err);
      return '';
    }
  });
  const [customBgLabel, setCustomBgLabel] = useState(() => {
    try {
      return localStorage.getItem('dsh_nai5_custom_bg_label_v1') || '';
    } catch (err) {
      warnSilent('scene.readCustomLabel', err);
      return '';
    }
  });
  const [hasUploadedWallpaper, setHasUploadedWallpaper] = useState(() => Boolean(hasWallpaper));
  const [wallpaperRev, setWallpaperRev] = useState(() => Date.now());
  const [uploadingBg, setUploadingBg] = useState(false);
  const [uploadedBgLabel, setUploadedBgLabel] = useState(() => {
    try {
      return localStorage.getItem('dsh_nai5_uploaded_bg_label_v1') || '';
    } catch {
      return '';
    }
  });
  useEffect(() => {
    setHasUploadedWallpaper(Boolean(hasWallpaper));
  }, [hasWallpaper]);

  const [bgIntensity, setBgIntensity] = useState(() => {
    try {
      const val = localStorage.getItem('dsh_nai5_bg_intensity_v1');
      return ['soft', 'balanced', 'vivid'].includes(val) ? val : 'balanced';
    } catch (err) {
      warnSilent('scene.readIntensity', err);
      return 'balanced';
    }
  });

  const selectScene = useCallback((id) => {
    const nextId = id || 'auto';
    setScenePref(nextId);
    try {
      localStorage.setItem('dsh_nai5_scene_pref_v1', nextId);
    } catch (err) {
      warnSilent('scene.savePref', err);
    }
    if (showToast) {
      if (nextId === 'auto') {
        showToast('画卷景致：已设为随明暗主题自动匹配');
      } else if (nextId === 'wallpaper') {
        showToast('已启用本地上传背景画卷');
      } else {
        const hit = STUDIO_SCENES.find(s => s.id === nextId);
        if (hit) showToast(`画卷已切换：《${hit.title}》`);
      }
    }
  }, [showToast]);

  const setCustomBackdrop = useCallback((imgPath, label = '典藏画卷') => {
    if (!imgPath) return;
    setCustomBgPath(imgPath);
    setCustomBgLabel(label || '典藏画卷');
    setScenePref('custom');
    try {
      localStorage.setItem('dsh_nai5_custom_bg_v1', imgPath);
      localStorage.setItem('dsh_nai5_custom_bg_label_v1', label || '典藏画卷');
      localStorage.setItem('dsh_nai5_scene_pref_v1', 'custom');
    } catch (err) {
      warnSilent('scene.saveCustom', err);
    }
    if (showToast) showToast(`已将「${label || '典藏画卷'}」设为工坊背景画卷`);
  }, [showToast]);

  const clearCustomBackdrop = useCallback(() => {
    setCustomBgPath('');
    setCustomBgLabel('');
    setScenePref('auto');
    try {
      localStorage.removeItem('dsh_nai5_custom_bg_v1');
      localStorage.removeItem('dsh_nai5_custom_bg_label_v1');
      localStorage.setItem('dsh_nai5_scene_pref_v1', 'auto');
    } catch (err) {
      warnSilent('scene.clearCustom', err);
    }
    if (showToast) showToast('已恢复工坊内置精选画卷');
  }, [showToast]);

  const uploadBackdropFile = useCallback((file) => {
    if (!file) return;
    const fname = String(file.name || 'wallpaper.png');
    if (!String(file.type || '').startsWith('image/') && !/\.(png|jpe?g|webp|gif)$/i.test(fname)) {
      if (showToast) showToast('请选择 PNG / JPG / WebP / GIF 格式的图片');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      if (showToast) showToast('背景图片请控制在 15MB 以内');
      return;
    }
    setUploadingBg(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await fetch('/api/novelai/wallpaper', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: reader.result, filename: fname })
        });
        const data = await parseApiJson(res);
        if (!data.ok) throw new Error(data.error || '上传失败');
        setHasUploadedWallpaper(true);
        if (onWallpaperStateChange) onWallpaperStateChange(true);
        setWallpaperRev(Date.now());
        setUploadedBgLabel(fname);
        setScenePref('wallpaper');
        try {
          localStorage.setItem('dsh_nai5_uploaded_bg_label_v1', fname);
          localStorage.setItem('dsh_nai5_scene_pref_v1', 'wallpaper');
        } catch (err) {
          warnSilent('scene.saveUploaded', err);
        }
        if (showToast) showToast(`已上传并设为工坊背景：${fname}`);
      } catch (err) {
        if (showToast) showToast(`上传背景失败：${err.message}`);
      } finally {
        setUploadingBg(false);
      }
    };
    reader.onerror = () => {
      setUploadingBg(false);
      if (showToast) showToast('读取本地图片失败');
    };
    reader.readAsDataURL(file);
  }, [showToast, onWallpaperStateChange]);

  const clearUploadedBackdrop = useCallback(async () => {
    try {
      const res = await fetch('/api/novelai/wallpaper', { method: 'DELETE' });
      const data = await parseApiJson(res);
      if (!data.ok) throw new Error(data.error || '清除失败');
      setHasUploadedWallpaper(false);
      if (onWallpaperStateChange) onWallpaperStateChange(false);
      setUploadedBgLabel('');
      try {
        localStorage.removeItem('dsh_nai5_uploaded_bg_label_v1');
      } catch {}
      setScenePref(prev => {
        if (prev === 'wallpaper') {
          try { localStorage.setItem('dsh_nai5_scene_pref_v1', 'auto'); } catch {}
          return 'auto';
        }
        return prev;
      });
      if (showToast) showToast('已清除本地上传背景图');
    } catch (err) {
      if (showToast) showToast(`清除背景失败：${err.message}`);
    }
  }, [showToast, onWallpaperStateChange]);

  const updateBgIntensity = useCallback((level) => {
    if (!['soft', 'balanced', 'vivid'].includes(level)) return;
    setBgIntensity(level);
    try {
      localStorage.setItem('dsh_nai5_bg_intensity_v1', level);
    } catch (err) {
      warnSilent('scene.saveIntensity', err);
    }
  }, []);

  const isCustomActive = scenePref === 'custom' && Boolean(customBgPath);
  const isUploadedActive = scenePref === 'wallpaper' && hasUploadedWallpaper;
  const useConfigWallpaper = scenePref === 'auto' && Boolean(hasUploadedWallpaper);
  const resolvedCurated = (isCustomActive || isUploadedActive || useConfigWallpaper)
    ? null
    : (scenePref === 'auto'
      ? STUDIO_SCENES.find(s => s.id === (isLightTheme ? 'dawn-snow' : 'moonblade'))
      : (STUDIO_SCENES.find(s => s.id === scenePref) || STUDIO_SCENES[0]));

  const activeScene = resolvedCurated || STUDIO_SCENES[0];
  const activeBgUrl = isCustomActive
    ? getImageUrl(customBgPath, false)
    : ((isUploadedActive || useConfigWallpaper) ? `/api/novelai/wallpaper?v=${wallpaperRev}` : '');
  const activeBgGradient = (isCustomActive || isUploadedActive || useConfigWallpaper) ? '' : (activeScene.gradient || '');
  const activeBgPos = (isCustomActive || isUploadedActive || useConfigWallpaper) ? 'center 24%' : activeScene.pos;
  const activeTitle = isCustomActive
    ? (customBgLabel || '典藏画卷')
    : ((isUploadedActive || useConfigWallpaper) ? (uploadedBgLabel || '自定义壁纸') : activeScene.title);

  const cycleCuratedScene = useCallback((delta = 1) => {
    const idx = STUDIO_SCENES.findIndex(s => s.id === activeScene.id);
    const nextIdx = (idx + delta + STUDIO_SCENES.length) % STUDIO_SCENES.length;
    const nextScene = STUDIO_SCENES[nextIdx];
    setScenePref(nextScene.id);
    try {
      localStorage.setItem('dsh_nai5_scene_pref_v1', nextScene.id);
    } catch (err) {
      warnSilent('scene.cycle', err);
    }
  }, [activeScene]);

  return {
    scenePref,
    customBgPath,
    customBgLabel,
    hasUploadedWallpaper,
    wallpaperRev,
    uploadingBg,
    uploadedBgLabel,
    bgIntensity,
    activeScene,
    activeBgUrl,
    activeBgGradient,
    activeBgPos,
    activeTitle,
    selectScene,
    setCustomBackdrop,
    clearCustomBackdrop,
    uploadBackdropFile,
    clearUploadedBackdrop,
    cycleCuratedScene,
    updateBgIntensity
  };
}

function useWindowGeometry(setActiveTab) {
  const [winMode, setWinMode] = useState(() => {
    try {
      return localStorage.getItem('dsh_nai5_win_mode_v5') || 'open';
    } catch (err) {
      warnSilent('win.readMode', err);
      return 'open';
    }
  });
  const [isMaximized, setIsMaximized] = useState(false);

  const [winRect, setWinRect] = useState(() => {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1440;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
    const defW = Math.min(1140, Math.max(820, vw - 100));
    const defH = Math.min(760, Math.max(540, vh - 96));
    const defX = Math.max(24, Math.round((vw - defW) / 2));
    const defY = Math.max(44, Math.round((vh - defH) / 2));
    try {
      const saved = JSON.parse(localStorage.getItem('dsh_nai5_win_rect_v5') || 'null');
      if (saved && saved.w >= 760 && saved.h >= 500) {
        return {
          x: Math.max(12, Math.min(vw - 200, saved.x)),
          y: Math.max(38, Math.min(vh - 120, saved.y)),
          w: Math.min(vw - 24, saved.w),
          h: Math.min(vh - 48, saved.h)
        };
      }
    } catch (err) {
      warnSilent('win.readRect', err);
    }
    return { x: defX, y: defY, w: defW, h: defH };
  });

  const [orbPos, setOrbPos] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('dsh_nai5_orb_pos_v5') || 'null');
      if (saved && typeof saved.right === 'number' && typeof saved.bottom === 'number') return saved;
    } catch (err) {
      warnSilent('win.readOrb', err);
    }
    return { right: 28, bottom: 78 };
  });

  const winRectRef = useRef(winRect);
  winRectRef.current = winRect;
  const orbPosRef = useRef(orbPos);
  orbPosRef.current = orbPos;

  const updateWinMode = useCallback((next) => {
    setWinMode(next);
    try {
      localStorage.setItem('dsh_nai5_win_mode_v5', next);
    } catch (err) {
      warnSilent('win.saveMode', err);
    }
  }, []);

  useEffect(() => {
    const handler = (action) => {
      if (action.type === 'OPEN') {
        updateWinMode('open');
        if (action.tab) setActiveTab(action.tab);
      } else if (action.type === 'TOGGLE') {
        setWinMode(prev => {
          const next = prev === 'open' ? 'minimized' : 'open';
          try {
            localStorage.setItem('dsh_nai5_win_mode_v5', next);
          } catch (err) {
            warnSilent('win.toggleMode', err);
          }
          return next;
        });
      } else if (action.type === 'CENTER') {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const w = Math.min(1140, Math.max(820, vw - 100));
        const h = Math.min(760, Math.max(540, vh - 96));
        const nextRect = { x: Math.round((vw - w) / 2), y: Math.max(42, Math.round((vh - h) / 2)), w, h };
        setWinRect(nextRect);
        setIsMaximized(false);
        updateWinMode('open');
      }
    };
    studioBus.listeners.add(handler);

    const onKey = (e) => {
      if (e.altKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        handler({ type: 'TOGGLE' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      studioBus.listeners.delete(handler);
      window.removeEventListener('keydown', onKey);
    };
  }, [setActiveTab, updateWinMode]);

  const [mainColSplitX, setMainColSplitX] = useState(41);
  const [styleSplitX, setStyleSplitX] = useState(50);
  const [vertSplitRatio, setVertSplitRatio] = useState(1.05);
  const workbenchBodyRef = useRef(null);
  const splitRowRef = useRef(null);
  const dragRef = useRef(null);

  const startWindowDrag = useCallback((e) => {
    if (isMaximized) return;
    if (e.target.closest('button, input, select, .nai5-seg-nav')) return;
    e.preventDefault();
    dragRef.current = {
      mode: 'move',
      startX: e.clientX,
      startY: e.clientY,
      orig: { ...winRectRef.current }
    };
  }, [isMaximized]);

  const startWindowResize = useCallback((dir, e) => {
    if (isMaximized) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      mode: 'resize',
      dir,
      startX: e.clientX,
      startY: e.clientY,
      orig: { ...winRectRef.current }
    };
  }, [isMaximized]);

  useEffect(() => {
    const onMove = (e) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      if (d.mode === 'move') {
        const nx = Math.max(8, Math.min(vw - 180, d.orig.x + dx));
        const ny = Math.max(38, Math.min(vh - 80, d.orig.y + dy));
        setWinRect(prev => ({ ...prev, x: nx, y: ny }));
      } else if (d.mode === 'resize') {
        let { x, y, w, h } = d.orig;
        if (d.dir.includes('e')) w = Math.max(760, Math.min(vw - x - 8, w + dx));
        if (d.dir.includes('s')) h = Math.max(500, Math.min(vh - y - 8, h + dy));
        if (d.dir.includes('w')) {
          const nw = Math.max(760, w - dx);
          x = x + (w - nw);
          w = nw;
        }
        setWinRect({ x, y, w, h });
      } else if (d.mode === 'orb') {
        if (Math.hypot(dx, dy) > 4) d.moved = true;
        const nr = Math.max(12, Math.min(vw - 180, d.origRight - dx));
        const nb = Math.max(12, Math.min(vh - 60, d.origBottom - dy));
        setOrbPos({ right: nr, bottom: nb });
      } else if (d.mode === 'split_main_col') {
        const totalW = Math.max(600, d.bodyW || 1100);
        const nextPct = Math.max(38, Math.min(70, d.origPct + (dx / totalW) * 100));
        setMainColSplitX(Math.round(nextPct * 10) / 10);
      } else if (d.mode === 'split_h') {
        const totalW = Math.max(200, d.rowW || 500);
        const nextPct = Math.max(22, Math.min(78, d.origPct + (dx / totalW) * 100));
        setStyleSplitX(Math.round(nextPct * 10) / 10);
      } else if (d.mode === 'split_v') {
        const nextRatio = Math.max(0.4, Math.min(2.8, d.origRatio - dy / 140));
        setVertSplitRatio(Math.round(nextRatio * 100) / 100);
      }
    };
    const onUp = () => {
      if (dragRef.current) {
        const mode = dragRef.current.mode;
        dragRef.current = null;
        if (mode === 'move' || mode === 'resize') {
          try {
            localStorage.setItem('dsh_nai5_win_rect_v5', JSON.stringify(winRectRef.current));
          } catch (err) {
            warnSilent('win.saveRect', err);
          }
        } else if (mode === 'orb') {
          try {
            localStorage.setItem('dsh_nai5_orb_pos_v5', JSON.stringify(orbPosRef.current));
          } catch (err) {
            warnSilent('win.saveOrb', err);
          }
        }
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  return {
    winMode,
    updateWinMode,
    isMaximized,
    setIsMaximized,
    winRect,
    orbPos,
    mainColSplitX,
    setMainColSplitX,
    styleSplitX,
    setStyleSplitX,
    vertSplitRatio,
    setVertSplitRatio,
    workbenchBodyRef,
    splitRowRef,
    dragRef,
    startWindowDrag,
    startWindowResize
  };
}

function useLightboxState(displayedRecords) {
  const [previewIndex, setPreviewIndex] = useState(null);
  const [previewCustomItem, setPreviewCustomItem] = useState(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showInspector, setShowInspector] = useState(false);
  const [fullLoaded, setFullLoaded] = useState(false);
  const lightboxRef = useRef(null);

  const activeItem = previewCustomItem || (previewIndex !== null && displayedRecords[previewIndex] ? displayedRecords[previewIndex] : null);

  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const panOffsetRef = useRef({ x: 0, y: 0 });

  const resetZoom = useCallback(() => {
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
    panOffsetRef.current = { x: 0, y: 0 };
    isPanningRef.current = false;
    setIsPanning(false);
  }, []);

  const closeLightbox = useCallback(() => {
    if (document.fullscreenElement) {
      try {
        document.exitFullscreen();
      } catch (err) {
        warnSilent('lightbox.exitFullscreen', err);
      }
    }
    setPreviewIndex(null);
    setPreviewCustomItem(null);
    setShowInspector(false);
    resetZoom();
  }, [resetZoom]);

  useEffect(() => {
    setFullLoaded(false);
  }, [activeItem?.source_path || activeItem?.filePath]);

  useEffect(() => {
    if (previewIndex === null || !displayedRecords.length) return;
    const prefetchIndices = [previewIndex - 1, previewIndex + 1, previewIndex + 2];
    prefetchIndices.forEach(idx => {
      if (idx >= 0 && idx < displayedRecords.length) {
        const rec = displayedRecords[idx];
        const p = rec?.source_path || rec?.filePath;
        if (p) {
          const fullImg = new Image();
          fullImg.src = getImageUrl(p, false);
        }
      }
    });
  }, [previewIndex, displayedRecords]);

  const handlePrev = useCallback(() => {
    if (previewIndex !== null && displayedRecords.length > 0) {
      const nextIdx = previewIndex > 0 ? previewIndex - 1 : displayedRecords.length - 1;
      setPreviewIndex(nextIdx);
      resetZoom();
    }
  }, [previewIndex, displayedRecords.length, resetZoom]);

  const handleNext = useCallback(() => {
    if (previewIndex !== null && displayedRecords.length > 0) {
      const nextIdx = previewIndex < displayedRecords.length - 1 ? previewIndex + 1 : 0;
      setPreviewIndex(nextIdx);
      resetZoom();
    }
  }, [previewIndex, displayedRecords.length, resetZoom]);

  const toggleFullscreen = useCallback(() => {
    const el = lightboxRef.current || document.documentElement;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().then(() => setIsFullscreen(true)).catch((err) => warnSilent('lightbox.enterFs', err));
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch((err) => warnSilent('lightbox.exitFs', err));
    }
  }, []);

  useEffect(() => {
    if (!activeItem) return;
    const onKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'Escape') {
        if (document.fullscreenElement) document.exitFullscreen?.();
        else closeLightbox();
      } else if (e.key === 'ArrowLeft') handlePrev();
      else if (e.key === 'ArrowRight') handleNext();
      else if (e.key === '+' || e.key === '=') setZoomScale(z => Math.min(8, Number((z * 1.25).toFixed(2))));
      else if (e.key === '-' || e.key === '_') setZoomScale(z => Math.max(0.15, Number((z * 0.8).toFixed(2))));
      else if (e.key === '0') resetZoom();
      else if (e.key === 'f' || e.key === 'F') toggleFullscreen();
      else if (e.key === 'i' || e.key === 'I') setShowInspector(s => !s);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeItem, closeLightbox, handlePrev, handleNext, resetZoom, toggleFullscreen]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.18 : 0.85;
    setZoomScale(z => Math.max(0.15, Math.min(8.0, Number((z * factor).toFixed(2)))));
  }, []);

  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0 && e.button !== 1) return;
    if (e.target.closest('button, input, select, .nai5-lightbox-topbar, .nai5-lightbox-bottombar, .nai5-lightbox-drawer')) return;
    e.preventDefault();
    e.stopPropagation();
    isPanningRef.current = true;
    panStartRef.current = { x: e.clientX - panOffsetRef.current.x, y: e.clientY - panOffsetRef.current.y };
    setIsPanning(true);
  }, []);

  useEffect(() => {
    if (!isPanning) return;
    const onMouseMove = (e) => {
      if (!isPanningRef.current) return;
      const newX = e.clientX - panStartRef.current.x;
      const newY = e.clientY - panStartRef.current.y;
      panOffsetRef.current = { x: newX, y: newY };
      setPanOffset({ x: newX, y: newY });
    };
    const onMouseUp = () => {
      isPanningRef.current = false;
      setIsPanning(false);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isPanning]);

  const handleOpenPreview = useCallback((idx) => {
    setPreviewCustomItem(null);
    setPreviewIndex(idx);
    resetZoom();
  }, [resetZoom]);

  return {
    previewIndex,
    setPreviewIndex,
    previewCustomItem,
    setPreviewCustomItem,
    activeItem,
    zoomScale,
    setZoomScale,
    panOffset,
    isPanning,
    isFullscreen,
    showInspector,
    setShowInspector,
    fullLoaded,
    setFullLoaded,
    lightboxRef,
    resetZoom,
    closeLightbox,
    handlePrev,
    handleNext,
    toggleFullscreen,
    handleWheel,
    handleMouseDown,
    handleOpenPreview
  };
}

const CHAR_LAYOUT_PRESETS = {
  '2lr': {
    coords: [{ x: 0.25, y: 0.50 }, { x: 0.75, y: 0.50 }],
    msg: '已应用：双人左右对称站位 (A:0.25 / B:0.75)'
  },
  '2tb': {
    coords: [{ x: 0.45, y: 0.28 }, { x: 0.55, y: 0.72 }],
    msg: '已应用：双人上下/前后层次站位'
  },
  '3row': {
    coords: [{ x: 0.20, y: 0.52 }, { x: 0.50, y: 0.48 }, { x: 0.80, y: 0.52 }],
    msg: '已应用：三人横向并排站位 (A / B / C)'
  },
  '4grid': {
    coords: [{ x: 0.28, y: 0.32 }, { x: 0.72, y: 0.32 }, { x: 0.28, y: 0.72 }, { x: 0.72, y: 0.72 }],
    msg: '已应用：四人 2×2 矩阵站位 (A ~ D)'
  },
  '6group': {
    coords: [
      { x: 0.20, y: 0.32 }, { x: 0.50, y: 0.28 }, { x: 0.80, y: 0.32 },
      { x: 0.22, y: 0.72 }, { x: 0.50, y: 0.75 }, { x: 0.78, y: 0.72 }
    ],
    msg: '已应用：六人群像双排站位 (A ~ F)'
  },
  '9grid': {
    coords: [0.22, 0.50, 0.78].flatMap(y => [0.20, 0.50, 0.80].map(x => ({ x, y }))),
    msg: '已应用：九人 3×3 矩阵站位 (A ~ I)'
  },
  '12group': {
    coords: [0.22, 0.50, 0.78].flatMap(y => [0.16, 0.38, 0.62, 0.84].map(x => ({ x, y }))),
    msg: '已应用：十二人大群像三排站位 (A ~ L)'
  }
};

function useCharacterBoxes(showToast) {
  const [characterPrompts, setCharacterPrompts] = useState([]);
  const [showCharBoxes, setShowCharBoxes] = useState(true);

  const addCharacterBox = useCallback(() => {
    setCharacterPrompts(prev => {
      if (prev.length >= MAX_V5_CHARACTERS) {
        showToast(`NovelAI V5 最多支持 ${MAX_V5_CHARACTERS} 个独立角色分框 (A ~ V)`);
        return prev;
      }
      const idx = prev.length;
      const slot = DEFAULT_CHAR_SLOTS[idx] || { x: 0.50, y: 0.50 };
      return [
        ...prev,
        {
          id: 'char_' + Date.now() + '_' + idx,
          prompt: '',
          negativePrompt: '',
          x: slot.x,
          y: slot.y,
          useCoords: true
        }
      ];
    });
    setShowCharBoxes(true);
  }, [showToast]);

  const applyCharLayoutPreset = useCallback((type) => {
    const preset = CHAR_LAYOUT_PRESETS[type];
    if (!preset) return;
    setShowCharBoxes(true);
    setCharacterPrompts(prev => preset.coords.map((pt, i) => ({
      id: prev[i]?.id || ('char_' + Date.now() + '_' + i),
      prompt: prev[i]?.prompt || '',
      negativePrompt: prev[i]?.negativePrompt || '',
      x: pt.x,
      y: pt.y,
      useCoords: true
    })));
    showToast(preset.msg);
  }, [showToast]);

  const updateCharacterBox = useCallback((index, field, value) => {
    setCharacterPrompts(prev => {
      const next = [...prev];
      if (!next[index]) return prev;
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }, []);

  const updateCharacterCoord2D = useCallback((index, x, y) => {
    setCharacterPrompts(prev => {
      const next = [...prev];
      if (!next[index]) return prev;
      next[index] = { ...next[index], x, y };
      return next;
    });
  }, []);

  const removeCharacterBox = useCallback((index) => {
    setCharacterPrompts(prev => prev.filter((_, i) => i !== index));
  }, []);

  return {
    characterPrompts,
    setCharacterPrompts,
    showCharBoxes,
    setShowCharBoxes,
    addCharacterBox,
    applyCharLayoutPreset,
    updateCharacterBox,
    updateCharacterCoord2D,
    removeCharacterBox
  };
}

function useGalleryState(showToast, setLatestImage) {
  const [history, setHistory] = useState([]);
  const historyLenRef = useRef(0);
  historyLenRef.current = history.length;

  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [gridDensity, setGridDensity] = useState('medium');
  const [galleryLayout, setGalleryLayout] = useState(() => {
    try {
      return localStorage.getItem('dsh_nai5_gallery_layout') || 'masonry';
    } catch (err) {
      warnSilent('gallery.readLayout', err);
      return 'masonry';
    }
  });

  const updateGalleryLayout = useCallback((nextLayout) => {
    setGalleryLayout(nextLayout);
    try {
      localStorage.setItem('dsh_nai5_gallery_layout', nextLayout);
    } catch (err) {
      warnSilent('gallery.saveLayout', err);
    }
  }, []);

  const [filterChar, setFilterChar] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterRating, setFilterRating] = useState('all');
  const [filterTopic, setFilterTopic] = useState('all');
  const [filterFavorites, setFilterFavorites] = useState(false);
  const [gallerySearch, setGallerySearch] = useState('');
  const [galleryMeta, setGalleryMeta] = useState({ characters: [], months: [], ratings: [], topics: [], total: 0, favoritesCount: 0 });

  const fetchGalleryMeta = useCallback(async () => {
    try {
      const res = await fetch('/api/novelai/gallery/meta');
      if (res.ok) {
        const data = await res.json();
        if (data.ok && Array.isArray(data.characters)) {
          setGalleryMeta(data);
          setTotalCount(data.total || 0);
        }
      }
    } catch (err) {
      warnSilent('gallery.meta', err);
    }
  }, []);

  const fetchHistoryWithParams = useCallback(async (opts = {}) => {
    const isReset = opts.isReset !== false;
    const char = opts.character !== undefined ? opts.character : filterChar;
    const mo = opts.month !== undefined ? opts.month : filterMonth;
    const ra = opts.rating !== undefined ? opts.rating : filterRating;
    const top = opts.topic !== undefined ? opts.topic : filterTopic;
    const q = opts.search !== undefined ? opts.search : gallerySearch;
    const fav = opts.favorites !== undefined ? opts.favorites : filterFavorites;

    const pageSize = 24;
    const queryOffset = isReset ? 0 : historyLenRef.current;

    if (isReset) {
      setLoadingHistory(true);
      setHasMore(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const queryParams = new URLSearchParams({
        limit: String(pageSize),
        offset: String(queryOffset),
        character: char,
        month: mo,
        rating: ra,
        topic: top,
        search: q,
        favorites: fav ? '1' : ''
      });
      const res = await fetch(`/api/novelai/history?${queryParams}`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok && Array.isArray(data.records)) {
          if (isReset) {
            setHistory(data.records);
          } else {
            setHistory(prev => {
              const seen = new Set(prev.map(p => p.source_path || p.filePath));
              const fresh = data.records.filter(r => !seen.has(r.source_path || r.filePath));
              return [...prev, ...fresh];
            });
          }
          if (data.records.length > 0) {
            setLatestImage(prev => prev || data.records[0]);
          }
          setHasMore(data.hasMore === true && data.records.length > 0);
          setFilteredTotal(data.filteredTotal !== undefined ? data.filteredTotal : (data.total || data.records.length));
          setTotalCount(data.total || data.records.length);
          if (opts.showToastMsg) {
            showToast(opts.showToastMsg.replace('{count}', String(data.filteredTotal !== undefined ? data.filteredTotal : data.records.length)));
          }
        }
      }
    } catch (err) {
      warnSilent('gallery.history', err);
    } finally {
      setLoadingHistory(false);
      setLoadingMore(false);
    }
  }, [filterChar, filterMonth, filterRating, filterTopic, filterFavorites, gallerySearch, showToast, setLatestImage]);

  const applyFilter = useCallback((patch = {}) => {
    const nextChar = patch.character !== undefined ? patch.character : filterChar;
    const nextMonth = patch.month !== undefined ? patch.month : filterMonth;
    const nextRating = patch.rating !== undefined ? patch.rating : filterRating;
    const nextTopic = patch.topic !== undefined ? patch.topic : filterTopic;
    const nextSearch = patch.search !== undefined ? patch.search : gallerySearch;
    const nextFav = patch.favorites !== undefined ? patch.favorites : filterFavorites;

    if (patch.character !== undefined) setFilterChar(patch.character);
    if (patch.month !== undefined) setFilterMonth(patch.month);
    if (patch.rating !== undefined) setFilterRating(patch.rating);
    if (patch.topic !== undefined) setFilterTopic(patch.topic);
    if (patch.search !== undefined) setGallerySearch(patch.search);
    if (patch.favorites !== undefined) setFilterFavorites(patch.favorites);

    fetchHistoryWithParams({
      character: nextChar,
      month: nextMonth,
      rating: nextRating,
      topic: nextTopic,
      search: nextSearch,
      favorites: nextFav,
      isReset: true,
      showToastMsg: patch.showToast ? '找到 {count} 张匹配图片' : undefined
    });
  }, [filterChar, filterMonth, filterRating, filterTopic, filterFavorites, gallerySearch, fetchHistoryWithParams]);

  const handleRefreshGallery = useCallback(async () => {
    try {
      const res = await fetch('/api/novelai/gallery/refresh', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          setGalleryMeta(data);
          setTotalCount(data.total || 0);
          await fetchHistoryWithParams({ isReset: true });
          showToast(`🔄 已重扫目录，共索引 ${data.total || 0} 张图像`);
          return;
        }
      }
      showToast('刷新索引失败');
    } catch (err) {
      showToast(`刷新异常: ${err.message}`);
    }
  }, [fetchHistoryWithParams, showToast]);

  const handleBackfillMetadata = useCallback(async () => {
    try {
      const res = await fetch('/api/novelai/gallery/backfill', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          if (data.started) showToast(`🧩 已启动后台提取（待补全 ${data.totalPending || 0} 张 PNG 元数据）`);
          else if (data.running) showToast(`⏳ 后台正在提取剩余 ${data.totalPending || 0} 张元数据...`);
          else showToast('✅ 全部图片尺寸与 PNG 元数据均已完整缓存');
          return;
        }
      }
      showToast('启动元数据补全失败');
    } catch (err) {
      showToast(`请求异常: ${err.message}`);
    }
  }, [showToast]);

  const handleLoadMore = useCallback(() => {
    if (hasMore && !loadingHistory && !loadingMore) {
      fetchHistoryWithParams({ isReset: false });
    }
  }, [hasMore, loadingHistory, loadingMore, fetchHistoryWithParams]);

  const toggleFavorite = useCallback(async (imgPath) => {
    if (!imgPath) return null;
    try {
      const res = await fetch('/api/novelai/favorites/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: imgPath })
      });
      const data = await res.json();
      if (data.ok) {
        setHistory(prev => prev.map(x => ((x.source_path || x.filePath) === imgPath ? { ...x, isFavorite: data.isFavorite } : x)));
        setLatestImage(cur => (cur && (cur.source_path || cur.filePath) === imgPath ? { ...cur, isFavorite: data.isFavorite } : cur));
        setGalleryMeta(prev => ({ ...prev, favoritesCount: data.count !== undefined ? data.count : prev.favoritesCount }));
        showToast(data.isFavorite ? '★ 已加入收藏夹' : '☆ 已取消收藏');
        if (filterFavorites && !data.isFavorite) {
          fetchHistoryWithParams({ isReset: true });
        }
        return data.isFavorite;
      }
    } catch (err) {
      showToast(`收藏操作失败: ${err.message}`);
    }
    return null;
  }, [filterFavorites, fetchHistoryWithParams, setLatestImage, showToast]);

  const batchMove = useCallback(async (paths = [], targetCharacter = '综合创作') => {
    if (!Array.isArray(paths) || paths.length === 0) return { ok: false };
    try {
      const res = await fetch('/api/novelai/gallery/batch-move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths, targetCharacter })
      });
      const data = await res.json();
      if (data.ok) {
        showToast(`📂 已将 ${data.movedCount || 0} 张归类至 [${data.targetCharacter || targetCharacter}]`);
        await fetchGalleryMeta();
        await fetchHistoryWithParams({ isReset: true });
        return data;
      }
      showToast(`批量移动失败: ${data.error || '未知错误'}`);
    } catch (err) {
      showToast(`批量移动异常: ${err.message}`);
    }
    return { ok: false };
  }, [fetchGalleryMeta, fetchHistoryWithParams, showToast]);

  const batchDelete = useCallback(async (paths = []) => {
    if (!Array.isArray(paths) || paths.length === 0) return { ok: false };
    try {
      const res = await fetch('/api/novelai/gallery/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths })
      });
      const data = await res.json();
      if (data.ok) {
        showToast(`🗑 已永久删除 ${data.deletedCount || 0} 张图像`);
        await fetchGalleryMeta();
        await fetchHistoryWithParams({ isReset: true });
        return data;
      }
      showToast(`批量删除失败: ${data.error || '未知错误'}`);
    } catch (err) {
      showToast(`批量删除异常: ${err.message}`);
    }
    return { ok: false };
  }, [fetchGalleryMeta, fetchHistoryWithParams, showToast]);

  return {
    history,
    setHistory,
    loadingHistory,
    loadingMore,
    hasMore,
    totalCount,
    setTotalCount,
    filteredTotal,
    setFilteredTotal,
    gridDensity,
    setGridDensity,
    galleryLayout,
    updateGalleryLayout,
    filterChar,
    filterMonth,
    filterRating,
    filterTopic,
    filterFavorites,
    gallerySearch,
    setGallerySearch,
    galleryMeta,
    fetchGalleryMeta,
    fetchHistoryWithParams,
    applyFilter,
    handleRefreshGallery,
    handleBackfillMetadata,
    handleLoadMore,
    toggleFavorite,
    batchMove,
    batchDelete
  };
}

function useBridgeSync({
  characterPrompts,
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
  callbackRef
}) {
  const [showOrbHud, setShowOrbHud] = useState(false);
  const hudTimerRef = useRef(null);
  const openOrbHud = useCallback(() => {
    if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    setShowOrbHud(true);
  }, []);
  const scheduleCloseOrbHud = useCallback(() => {
    if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    hudTimerRef.current = setTimeout(() => setShowOrbHud(false), 260);
  }, []);

  const [bridgeLocks, setBridgeLocks] = useState(() => {
    try {
      const saved = localStorage.getItem('dsh_nai5_bridge_locks_v1');
      if (saved) return JSON.parse(saved);
    } catch (err) {
      warnSilent('bridge.readLocks', err);
    }
    return {
      enabled: false,
      lockStyle: true,
      lockAspect: true,
      lockRatingUc: false,
      lockSeed: false,
      lockChars2D: false
    };
  });
  const [autoMirrorAgent, setAutoMirrorAgent] = useState(true);
  const [agentGenStatus, setAgentGenStatus] = useState('idle');

  const toggleBridgeLock = useCallback((key) => {
    setBridgeLocks(prev => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem('dsh_nai5_bridge_locks_v1', JSON.stringify(next));
      } catch (err) {
        warnSilent('bridge.saveLocks', err);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const activeCharBoxes = characterPrompts
        .filter(c => c && (c.prompt || c.useCoords))
        .map(c => ({
          prompt: (c.prompt || '').trim(),
          negativePrompt: (c.negativePrompt || '').trim(),
          x: Number(c.x) ?? 0.5,
          y: Number(c.y) ?? 0.5,
          useCoords: c.useCoords !== false
        }));
      const selArtist = artistPresets.find(a => a.id === selectedArtistId);
      fetch('/api/novelai/bridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locks: bridgeLocks,
          overrides: {
            artistId: selectedArtistId,
            artistName: selArtist ? selArtist.name : '',
            stylePrompt,
            aspectRatio,
            width: Number(width) || 832,
            height: Number(height) || 1216,
            ucMode,
            negativePrompt,
            seedMode,
            seed: seedMode === 'fixed' ? seed : '',
            characterPrompts: activeCharBoxes
          }
        })
      }).catch((err) => warnSilent('bridge.push', err));
    }, 120);
    return () => clearTimeout(timer);
  }, [bridgeLocks, selectedArtistId, artistPresets, stylePrompt, aspectRatio, width, height, ucMode, negativePrompt, seedMode, seed, characterPrompts]);

  const lastSyncedTopRef = useRef({ path: '', total: 0, initialized: false });
  const sseConnectedRef = useRef(false);

  const applyIncomingRecord = useCallback((topRec, newTotal = 0) => {
    if (!topRec) return;
    const topPath = topRec.source_path || topRec.filePath || '';
    const cb = callbackRef.current;

    if (topPath && topPath === lastSyncedTopRef.current.path) return;
    lastSyncedTopRef.current = { path: topPath, total: Math.max(newTotal || 0, lastSyncedTopRef.current.total + 1), initialized: true };

    cb.setLatestImage?.(topRec);
    cb.setHistory?.(prev => {
      const exists = prev.some(item => (item.source_path || item.filePath) === topPath);
      return exists ? prev : [topRec, ...prev];
    });
    if (newTotal > 0) {
      cb.setTotalCount?.(newTotal);
      cb.setFilteredTotal?.(prev => prev + 1);
    } else {
      cb.setTotalCount?.(prev => prev + 1);
      cb.setFilteredTotal?.(prev => prev + 1);
    }
    cb.fetchGalleryMeta?.();
    cb.fetchBalance?.();

    if (cb.autoMirrorAgent && !cb.isGenerating) {
      const activeEl = document.activeElement;
      const isTypingInWin = activeEl &&
        (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT') &&
        activeEl.closest && activeEl.closest('.nai5-floating-window');
      if (!isTypingInWin) {
        cb.handleForkToWorkbench?.(topRec, true);
      }
      cb.showToast?.(`已实时同步新出图 · ${topRec.character || ''} (Seed: ${topRec.seed})`);
    }
  }, [callbackRef]);

  useEffect(() => {
    let es = null;
    let closed = false;

    if (typeof EventSource !== 'undefined') {
      try {
        es = new EventSource('/api/novelai/events');
        es.onopen = () => { sseConnectedRef.current = true; };
        es.onerror = () => { sseConnectedRef.current = false; };
        es.addEventListener('hello', (ev) => {
          sseConnectedRef.current = true;
          try {
            const payload = JSON.parse(ev.data || '{}');
            if (typeof payload.total === 'number' && payload.total > 0) {
              callbackRef.current.setTotalCount?.(payload.total);
              lastSyncedTopRef.current.total = payload.total;
            }
            const evState = payload.bridge?.lastEvent;
            if (evState) {
              setAgentGenStatus(evState.status === 'generating' && evState.source === 'agent' ? 'generating' : 'idle');
            }
          } catch (err) {
            warnSilent('sse.hello', err);
          }
        });
        es.addEventListener('archive', (ev) => {
          if (closed) return;
          try {
            const payload = JSON.parse(ev.data || '{}');
            if (payload.type === 'image_added' && payload.record) {
              applyIncomingRecord(payload.record, payload.total || 0);
            } else if (payload.type === 'image_deleted' && payload.path) {
              const delPath = payload.path;
              callbackRef.current.setHistory?.(prev => prev.filter(x => (x.source_path || x.filePath) !== delPath));
              if (typeof payload.total === 'number') callbackRef.current.setTotalCount?.(payload.total);
            } else if (payload.type === 'index_refreshed' || payload.type === 'backfill_done') {
              if (typeof payload.total === 'number') callbackRef.current.setTotalCount?.(payload.total);
              callbackRef.current.fetchGalleryMeta?.();
            }
          } catch (err) {
            warnSilent('sse.archive', err);
          }
        });
        es.addEventListener('bridge', (ev) => {
          if (closed) return;
          try {
            const payload = JSON.parse(ev.data || '{}');
            if (payload.type === 'account_update') {
              if (Array.isArray(payload.accounts)) {
                callbackRef.current.setAccountsData?.({
                  activeAccountId: payload.activeAccountId || '',
                  accounts: payload.accounts
                });
              } else {
                callbackRef.current.fetchAccounts?.();
              }
              callbackRef.current.fetchBalance?.();
            }
            const evState = payload.bridge?.lastEvent;
            if (evState) {
              setAgentGenStatus(evState.status === 'generating' && evState.source === 'agent' ? 'generating' : 'idle');
            }
          } catch (err) {
            warnSilent('sse.bridge', err);
          }
        });
      } catch (err) {
        warnSilent('sse.init', err);
        sseConnectedRef.current = false;
      }
    }

    const fallbackPoll = async () => {
      if (closed || sseConnectedRef.current) return;
      try {
        const hRes = await fetch(`/api/novelai/history?limit=1&_t=${Date.now()}`, { cache: 'no-store' });
        if (hRes.ok) {
          const hData = await hRes.json();
          if (hData.ok && Array.isArray(hData.records)) {
            const topRec = hData.records[0] || null;
            const topPath = topRec ? (topRec.source_path || topRec.filePath || '') : '';
            const newTotal = Number(hData.total) || 0;
            if (!lastSyncedTopRef.current.initialized) {
              lastSyncedTopRef.current = { path: topPath, total: newTotal, initialized: true };
              if (topRec) callbackRef.current.setLatestImage?.(prev => prev || topRec);
              if (newTotal > 0) callbackRef.current.setTotalCount?.(newTotal);
            } else if ((topPath && topPath !== lastSyncedTopRef.current.path) || (newTotal > lastSyncedTopRef.current.total && topRec)) {
              applyIncomingRecord(topRec, newTotal);
            }
          }
        }
      } catch (err) {
        warnSilent('sse.fallbackPoll', err);
      }
    };

    const fallbackTimer = setInterval(fallbackPoll, 12000);
    return () => {
      closed = true;
      sseConnectedRef.current = false;
      clearInterval(fallbackTimer);
      if (es) try { es.close(); } catch {}
    };
  }, [applyIncomingRecord, callbackRef]);

  return {
    showOrbHud,
    setShowOrbHud,
    openOrbHud,
    scheduleCloseOrbHud,
    bridgeLocks,
    setBridgeLocks,
    autoMirrorAgent,
    setAutoMirrorAgent,
    agentGenStatus,
    toggleBridgeLock
  };
}

function useCodexSearch(activeTab, showToast) {
  const [showInlineSearch, setShowInlineSearch] = useState(false);
  const [inlineQuery, setInlineQuery] = useState('');
  const [inlineResults, setInlineResults] = useState(null);
  const [inlineSearching, setInlineSearching] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [importingCodex, setImportingCodex] = useState(false);
  const [codexCategory, setCodexCategory] = useState('all');
  const [codexMeta, setCodexMeta] = useState(null);

  const fetchCodexMeta = useCallback(async () => {
    try {
      const res = await fetch('/api/novelai/codexes');
      if (res.ok) setCodexMeta(await res.json());
    } catch (err) {
      warnSilent('codex.meta', err);
    }
  }, []);

  const runTagSearch = useCallback(async (qStr = '', isInline = false, specificCodex = null) => {
    const cat = specificCodex !== null ? specificCodex : (isInline ? 'all' : codexCategory);
    if (isInline) setInlineSearching(true);
    else setSearching(true);
    try {
      const url = `/api/novelai/search?q=${encodeURIComponent((qStr || '').trim())}&codex=${encodeURIComponent(cat || 'all')}&limit=${isInline ? 16 : 40}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (isInline) setInlineResults(data);
        else setSearchResults(data);
      }
    } catch (err) {
      warnSilent('codex.search', err);
    } finally {
      if (isInline) setInlineSearching(false);
      else setSearching(false);
    }
  }, [codexCategory]);

  const importCodexFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList || []).filter(Boolean);
    if (files.length === 0 || importingCodex) return;
    setImportingCodex(true);
    let lastData = null;
    let okCount = 0;
    try {
      for (const file of files) {
        const fname = String(file.name || 'codex.json');
        const res = await fetch(`/api/novelai/codex/import?filename=${encodeURIComponent(fname)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: file
        });
        const data = await parseApiJson(res);
        if (!data.ok) throw new Error(data.error || `导入 ${fname} 失败`);
        lastData = data;
        okCount++;
      }
      if (lastData) {
        setCodexMeta(lastData);
        setCodexCategory('all');
        await runTagSearch(searchQuery, false, 'all');
        if (showToast) {
          showToast(`已导入 ${okCount} 份数据包：共 ${lastData.totalEntries || 0} 条法典配方 / ${lastData.totalTags || 0} 个词条`);
        }
      }
    } catch (err) {
      if (showToast) showToast(`导入词库/法典失败：${err.message}`);
    } finally {
      setImportingCodex(false);
    }
  }, [importingCodex, searchQuery, runTagSearch, showToast]);

  useEffect(() => {
    if (activeTab === 'codex') {
      if (!codexMeta) fetchCodexMeta();
      runTagSearch(searchQuery, false, codexCategory);
    }
  }, [activeTab, codexCategory]);

  return {
    showInlineSearch,
    setShowInlineSearch,
    inlineQuery,
    setInlineQuery,
    inlineResults,
    inlineSearching,
    searchQuery,
    setSearchQuery,
    searchResults,
    searching,
    importingCodex,
    codexCategory,
    setCodexCategory,
    codexMeta,
    runTagSearch,
    importCodexFiles
  };
}
