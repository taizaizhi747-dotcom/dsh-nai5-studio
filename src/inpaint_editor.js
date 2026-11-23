// ============================================================
// Inpaint Mask Editor & A/B Compare Slider (Zero-JSX h(...))
// Absorbed from Langbai Studio InpaintCanvas / Compare View
// ============================================================

function InpaintMaskEditor(props) {
  const {
    sourceImageUrl,
    width = 832,
    height = 1216,
    onChangeMask,
    onUploadSource,
    onClearSource
  } = props || {};

  const [tool, setTool] = useState('brush'); // 'brush' | 'erase'
  const [brushSize, setBrushSize] = useState(42);
  const [undoCount, setUndoCount] = useState(0);
  const [hoverPos, setHoverPos] = useState(null);

  const previewCanvasRef = useRef(null);
  const maskCanvasRef = useRef(null);
  const historyRef = useRef([]);
  const drawingRef = useRef(false);
  const lastPtRef = useRef(null);
  const fileInputRef = useRef(null);

  const syncPreviewFromMask = useCallback(() => {
    const prev = previewCanvasRef.current;
    const mask = maskCanvasRef.current;
    if (!prev || !mask) return;
    const pCtx = prev.getContext('2d');
    const mCtx = mask.getContext('2d');
    pCtx.clearRect(0, 0, prev.width, prev.height);
    const imgData = mCtx.getImageData(0, 0, mask.width, mask.height);
    const out = pCtx.createImageData(prev.width, prev.height);
    const src = imgData.data;
    const dst = out.data;
    for (let i = 0; i < src.length; i += 4) {
      if (src[i] > 100) {
        dst[i] = 225;
        dst[i + 1] = 29;
        dst[i + 2] = 72;
        dst[i + 3] = 155;
      }
    }
    pCtx.putImageData(out, 0, 0);
  }, []);

  // Initialize hidden binary mask canvas + preview overlay canvas
  useEffect(() => {
    const w = Math.max(64, Number(width) || 832);
    const hVal = Math.max(64, Number(height) || 1216);
    if (!maskCanvasRef.current) {
      maskCanvasRef.current = document.createElement('canvas');
    }
    const mask = maskCanvasRef.current;
    if (mask.width !== w || mask.height !== hVal) {
      mask.width = w;
      mask.height = hVal;
      const mCtx = mask.getContext('2d');
      mCtx.fillStyle = '#000000';
      mCtx.fillRect(0, 0, w, hVal);
      historyRef.current = [];
      setUndoCount(0);
    }
    if (previewCanvasRef.current) {
      previewCanvasRef.current.width = w;
      previewCanvasRef.current.height = hVal;
      syncPreviewFromMask();
    }
  }, [width, height, sourceImageUrl, syncPreviewFromMask]);

  const emitMask = useCallback(() => {
    const mask = maskCanvasRef.current;
    if (!mask || !onChangeMask) return;
    onChangeMask(mask.toDataURL('image/png'));
  }, [onChangeMask]);

  const pushHistory = useCallback(() => {
    const mask = maskCanvasRef.current;
    if (!mask) return;
    const ctx = mask.getContext('2d');
    const snap = ctx.getImageData(0, 0, mask.width, mask.height);
    const stack = historyRef.current;
    stack.push(snap);
    if (stack.length > 20) stack.shift();
    setUndoCount(stack.length);
  }, []);

  const canvasCoordsFromEvent = (e) => {
    const el = previewCanvasRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    const scaleX = el.width / Math.max(1, rect.width);
    const scaleY = el.height / Math.max(1, rect.height);
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const paintStroke = (fromPt, toPt) => {
    const mask = maskCanvasRef.current;
    if (!mask) return;
    const ctx = mask.getContext('2d');
    ctx.save();
    ctx.strokeStyle = tool === 'brush' ? '#ffffff' : '#000000';
    ctx.fillStyle = tool === 'brush' ? '#ffffff' : '#000000';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brushSize;
    ctx.beginPath();
    ctx.moveTo(fromPt.x, fromPt.y);
    ctx.lineTo(toPt.x, toPt.y);
    ctx.stroke();
    ctx.restore();
    syncPreviewFromMask();
  };

  const handlePointerDown = (e) => {
    if (!sourceImageUrl) return;
    e.preventDefault();
    pushHistory();
    drawingRef.current = true;
    const pt = canvasCoordsFromEvent(e);
    lastPtRef.current = pt;
    paintStroke(pt, pt);
    if (e.currentTarget && e.currentTarget.setPointerCapture) {
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
    }
  };

  const handlePointerMove = (e) => {
    const el = previewCanvasRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      setHoverPos({ x: e.clientX - rect.left, y: e.clientY - rect.top, rectW: rect.width, canvasW: el.width });
    }
    if (!drawingRef.current || !lastPtRef.current) return;
    const pt = canvasCoordsFromEvent(e);
    paintStroke(lastPtRef.current, pt);
    lastPtRef.current = pt;
  };

  const handlePointerUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPtRef.current = null;
    emitMask();
  };

  const handleUndo = () => {
    const mask = maskCanvasRef.current;
    const stack = historyRef.current;
    if (!mask || stack.length === 0) return;
    const prevSnap = stack.pop();
    setUndoCount(stack.length);
    const ctx = mask.getContext('2d');
    ctx.putImageData(prevSnap, 0, 0);
    syncPreviewFromMask();
    emitMask();
  };

  const handleClearMask = () => {
    const mask = maskCanvasRef.current;
    if (!mask) return;
    pushHistory();
    const ctx = mask.getContext('2d');
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, mask.width, mask.height);
    syncPreviewFromMask();
    emitMask();
  };

  const handleInvertMask = () => {
    const mask = maskCanvasRef.current;
    if (!mask) return;
    pushHistory();
    const ctx = mask.getContext('2d');
    const imgData = ctx.getImageData(0, 0, mask.width, mask.height);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const inv = 255 - d[i];
      d[i] = inv;
      d[i + 1] = inv;
      d[i + 2] = inv;
      d[i + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
    syncPreviewFromMask();
    emitMask();
  };

  const handleFilePick = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file || !onUploadSource) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onUploadSource(reader.result, file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  const cursorRadiusPx = hoverPos && hoverPos.rectW > 0
    ? Math.max(4, (brushSize * (hoverPos.rectW / Math.max(1, hoverPos.canvasW))) / 2)
    : 12;

  return h('div', { className: 'nai-inpaint-wrap' },
    h('div', { className: 'nai-inpaint-toolbar' },
      h('button', {
        className: 'nai-pill-btn' + (tool === 'brush' ? ' is-active' : ''),
        onClick: () => setTool('brush')
      }, '画笔重绘'),
      h('button', {
        className: 'nai-pill-btn' + (tool === 'erase' ? ' is-active' : ''),
        onClick: () => setTool('erase')
      }, '橡皮擦除'),
      h('label', { className: 'nai-inpaint-size' },
        h('span', null, '笔刷 ' + brushSize + 'px'),
        h('input', {
          type: 'range',
          min: 8,
          max: 160,
          value: brushSize,
          onChange: (e) => setBrushSize(Number(e.target.value) || 42)
        })
      ),
      h('button', {
        className: 'nai-pill-btn',
        disabled: undoCount === 0,
        onClick: handleUndo
      }, '撤销'),
      h('button', { className: 'nai-pill-btn', onClick: handleInvertMask }, '反选'),
      h('button', { className: 'nai-pill-btn', onClick: handleClearMask }, '清空'),
      h('button', {
        className: 'nai-pill-btn',
        onClick: () => fileInputRef.current && fileInputRef.current.click()
      }, sourceImageUrl ? '换底图' : '选底图'),
      sourceImageUrl ? h('button', {
        className: 'nai-pill-btn is-danger',
        onClick: onClearSource
      }, '退出底图') : null,
      h('input', {
        ref: fileInputRef,
        type: 'file',
        accept: 'image/png,image/jpeg,image/webp',
        style: { display: 'none' },
        onChange: handleFilePick
      })
    ),
    sourceImageUrl
      ? h('div', { className: 'nai-inpaint-stage-host' },
          h('div', { className: 'nai-inpaint-stage' },
            h('img', { src: sourceImageUrl, className: 'nai-inpaint-base', alt: 'inpaint-base', draggable: false }),
            h('canvas', {
              ref: previewCanvasRef,
              className: 'nai-inpaint-canvas',
              onPointerDown: handlePointerDown,
              onPointerMove: handlePointerMove,
              onPointerUp: handlePointerUp,
              onPointerLeave: () => { setHoverPos(null); handlePointerUp(); }
            }),
            hoverPos
              ? h('div', {
                  className: 'nai-inpaint-cursor',
                  style: {
                    left: hoverPos.x + 'px',
                    top: hoverPos.y + 'px',
                    width: (cursorRadiusPx * 2) + 'px',
                    height: (cursorRadiusPx * 2) + 'px'
                  }
                })
              : null
          )
        )
      : h('div', {
          className: 'nai-inpaint-empty',
          onClick: () => fileInputRef.current && fileInputRef.current.click()
        },
          h('div', { className: 'nai-inpaint-empty-title' }, '点击选择本地图片，或在画廊/大图点「局部重绘」送入'),
          h('div', { className: 'nai-inpaint-empty-sub' }, '涂抹红色区域即会被 NovelAI V5 Inpainting 模型按提示词重绘')
        )
  );
}

function CompareSlider(props) {
  const {
    beforeUrl,
    afterUrl,
    beforeLabel = '原图',
    afterLabel = '成图'
  } = props || {};
  const [pos, setPos] = useState(50);
  const wrapRef = useRef(null);
  const draggingRef = useRef(false);

  const updatePos = (clientX) => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / Math.max(1, rect.width)) * 100;
    setPos(Math.max(0, Math.min(100, Math.round(pct))));
  };

  return h('div', {
    ref: wrapRef,
    className: 'nai-compare-wrap',
    onPointerDown: (e) => {
      draggingRef.current = true;
      updatePos(e.clientX);
      if (e.currentTarget.setPointerCapture) {
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
      }
    },
    onPointerMove: (e) => { if (draggingRef.current) updatePos(e.clientX); },
    onPointerUp: () => { draggingRef.current = false; }
  },
    h('img', { src: afterUrl, className: 'nai-compare-img', alt: afterLabel, draggable: false }),
    h('div', {
      className: 'nai-compare-before',
      style: { clipPath: 'inset(0 ' + (100 - pos) + '% 0 0)' }
    },
      h('img', { src: beforeUrl, className: 'nai-compare-img', alt: beforeLabel, draggable: false })
    ),
    h('div', { className: 'nai-compare-divider', style: { left: pos + '%' } },
      h('div', { className: 'nai-compare-handle' }, '↔')
    ),
    h('span', { className: 'nai-compare-badge is-left' }, beforeLabel),
    h('span', { className: 'nai-compare-badge is-right' }, afterLabel)
  );
}
