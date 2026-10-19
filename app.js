// BLOCKTYPE STUDIO - Application Logic
// Supports variable glyph heights from 5 to 15, live line gap preview, background filler, and interactive character redraw

(function() {
  'use strict';

  // -------------------------------------------------------------
  // STATE MANAGEMENT
  // -------------------------------------------------------------
  const STORAGE_KEY_CUSTOM_GLYPHS = 'blocktype_custom_glyphs_by_height_v2';
  
  // Storage for custom glyphs by height: { [height]: { [char]: { width, rows } } }
  let customGlyphsByHeight = {};

  function initCustomStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CUSTOM_GLYPHS);
      if (saved) {
        customGlyphsByHeight = JSON.parse(saved);
      }
    } catch (e) {
      customGlyphsByHeight = {};
    }
  }
  initCustomStorage();

  const state = {
    glyphHeight: 5, // 5 to 15 characters tall
    glyphWidth: 4, // 1 to 12 blocks wide (base default is 4)
    activeChar: 'A',
    activeBrush: '█',
    activeTab: 'required',
    letterSpacing: 2,
    lineGap: 1, // Number of rows between multiple lines
    topMargin: 0, // Number of rows above the first line
    maxLineLimit: 65,
    enforceLimit: false,
    autoWrap: true,
    padToLimit: false,
    showRowGutter: true,
    showHeaders: true,
    blockRowGap: 4, // Inherent display hardware gap between rows of blocks (0 to 20px)
    bgFiller: '\u2800', // Default Braille Pattern Blank (U+2800)
    solidChar: '█',
    textColor: 'black', // 'black' (Black text on white bg) or 'white' (White text on black bg)
    invertBlocks: false, // Invert solid blocks and blanks in output text
    previewZoom: 12,
    theme: 'default',
    isMouseDown: false,
    mouseButton: 0
  };

  // -------------------------------------------------------------
  // DYNAMIC MULTI-HEIGHT & MULTI-WIDTH GLYPH ENGINE
  // -------------------------------------------------------------
  function scaleRowHorizontally(rowStr, srcW, targetW) {
    if (srcW === targetW) return rowStr.padEnd(targetW, ' ').substring(0, targetW);
    const padded = rowStr.padEnd(srcW, ' ');
    const out = new Array(targetW).fill(' ');
    const sampledSrc = new Array(srcW).fill(false);

    for (let c = 0; c < targetW; c++) {
      const srcX = Math.min(srcW - 1, Math.max(0, Math.floor(((c + 0.5) / targetW) * srcW)));
      out[c] = padded[srcX];
      sampledSrc[srcX] = true;
    }

    // When downscaling (targetW < srcW), preserve any unsampled isolated stroke (e.g. center stem of T, M, I)
    if (targetW < srcW) {
      for (let s = 0; s < srcW; s++) {
        if (!sampledSrc[s] && padded[s] !== ' ') {
          const leftEmpty = (s === 0 || padded[s - 1] === ' ');
          const rightEmpty = (s === srcW - 1 || padded[s + 1] === ' ');
          if (leftEmpty && rightEmpty) {
            const destIdx = Math.min(targetW - 1, Math.max(0, Math.floor((s / srcW) * targetW)));
            out[destIdx] = padded[s];
          }
        }
      }
    }
    return out.join('');
  }

  function scaleGlyph(srcGlyph, targetHeight, targetWidth) {
    const srcH = srcGlyph.rows.length;
    const srcW = srcGlyph.width;
    const finalW = (typeof targetWidth === 'number' && targetWidth >= 1) ? targetWidth : srcW;

    const vRows = [];
    if (srcH === targetHeight) {
      vRows.push(...srcGlyph.rows);
    } else {
      for (let r = 0; r < targetHeight; r++) {
        const srcY = ((r + 0.5) / targetHeight) * srcH;
        const srcIdx = Math.min(srcH - 1, Math.max(0, Math.floor(srcY)));
        vRows.push(srcGlyph.rows[srcIdx]);
      }
    }

    if (finalW === srcW) {
      return { width: srcW, rows: vRows };
    }
    const scaledRows = vRows.map(row => scaleRowHorizontally(row, srcW, finalW));
    return { width: finalW, rows: scaledRows };
  }

  function getTargetCharWidth(srcGlyph, globalW) {
    const srcW = srcGlyph.width;
    // Naturally narrow characters ('!', '.', ':', ';', "'", 'i', 'l', ',') scale proportionally
    if (srcW < 3) {
      if (globalW <= 2) return Math.max(1, Math.min(srcW, globalW));
      return Math.max(1, Math.round(srcW * (globalW / 4)));
    }
    return globalW;
  }

  function getBaseGlyphForHeight(ch, H, W = state.glyphWidth) {
    let baseFontGlyph = null;
    if (H === 15 && DEFAULT_FONT_15[ch]) {
      baseFontGlyph = DEFAULT_FONT_15[ch];
    } else if (H >= 10 && DEFAULT_FONT_15[ch]) {
      baseFontGlyph = DEFAULT_FONT_15[ch];
    } else if (DEFAULT_FONT_5[ch]) {
      baseFontGlyph = DEFAULT_FONT_5[ch];
    }

    if (!baseFontGlyph) {
      return { width: W, rows: Array(H).fill(' '.repeat(W)) };
    }

    // At default width 4 and native height 5, keep original native glyph widths (e.g. M/W=5, A-Z=4)
    if (H === 5 && W === 4 && DEFAULT_FONT_5[ch]) {
      return { width: DEFAULT_FONT_5[ch].width, rows: [...DEFAULT_FONT_5[ch].rows] };
    }

    const targetW = getTargetCharWidth(baseFontGlyph, W);
    return scaleGlyph(baseFontGlyph, H, targetW);
  }

  function getDimKey() {
    return `${state.glyphHeight}x${state.glyphWidth}`;
  }

  function getActiveGlyph(ch) {
    const H = state.glyphHeight;
    const W = state.glyphWidth;
    const dimKey = getDimKey();
    if (customGlyphsByHeight[dimKey] && customGlyphsByHeight[dimKey][ch]) {
      return customGlyphsByHeight[dimKey][ch];
    }
    if (W === 4 && customGlyphsByHeight[H] && customGlyphsByHeight[H][ch]) {
      return customGlyphsByHeight[H][ch];
    }
    return getBaseGlyphForHeight(ch, H, W);
  }

  function saveCustomGlyph(ch, glyph) {
    const dimKey = getDimKey();
    if (!customGlyphsByHeight[dimKey]) {
      customGlyphsByHeight[dimKey] = {};
    }
    customGlyphsByHeight[dimKey][ch] = {
      width: glyph.width,
      rows: [...glyph.rows]
    };
    try {
      localStorage.setItem(STORAGE_KEY_CUSTOM_GLYPHS, JSON.stringify(customGlyphsByHeight));
    } catch (e) {}
  }

  // Categories for character picker
  const CHAR_TABS = {
    required: ['!', '£', '$', '%', '&', '@', '#', '/', '?', '.', ' '],
    upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
    lower: 'abcdefghijklmnopqrstuvwxyz'.split(''),
    digits: '0123456789'.split(''),
    all: Object.keys(DEFAULT_FONT_5)
  };

  const charUndoStack = {};

  // DOM Elements
  const el = {
    themeSelect: document.getElementById('themeSelect'),
    exportFontBtn: document.getElementById('exportFontBtn'),
    importFontBtn: document.getElementById('importFontBtn'),
    fontFileInput: document.getElementById('fontFileInput'),
    resetAllFontsBtn: document.getElementById('resetAllFontsBtn'),
    copyTopBtn: document.getElementById('copyTopBtn'),
    fontModeHeaderPill: document.getElementById('fontModeHeaderPill'),
    
    // Left panel
    textInput: document.getElementById('textInput'),
    clearInputBtn: document.getElementById('clearInputBtn'),
    charCountLabel: document.getElementById('charCountLabel'),
    terminalBudgetBadge: document.getElementById('terminalBudgetBadge'),
    
    // Limits
    currentWidthStat: document.getElementById('currentWidthStat'),
    maxWidthStat: document.getElementById('maxWidthStat'),
    limitStatusText: document.getElementById('limitStatusText'),
    limitProgressFill: document.getElementById('limitProgressFill'),
    maxLineLimitInput: document.getElementById('maxLineLimitInput'),
    enforceLimitCheck: document.getElementById('enforceLimitCheck'),
    autoWrapCheck: document.getElementById('autoWrapCheck'),
    padToLimitCheck: document.getElementById('padToLimitCheck'),
    invertBlocksCheck: document.getElementById('invertBlocksCheck'),
    
    // Controls: Height 5-15, Width 1-12, Line Gap, Letter Spacing, Top Margin
    glyphHeightRange: document.getElementById('glyphHeightRange'),
    glyphHeightVal: document.getElementById('glyphHeightVal'),
    glyphWidthRange: document.getElementById('glyphWidthRange'),
    glyphWidthVal: document.getElementById('glyphWidthVal'),
    lineGapRange: document.getElementById('lineGapRange'),
    lineGapVal: document.getElementById('lineGapVal'),
    letterSpacingRange: document.getElementById('letterSpacingRange'),
    letterSpacingVal: document.getElementById('letterSpacingVal'),
    rowGapRange: document.getElementById('rowGapRange'),
    rowGapVal: document.getElementById('rowGapVal'),
    topMarginRange: document.getElementById('topMarginRange'),
    topMarginVal: document.getElementById('topMarginVal'),
    bgFillerSelect: document.getElementById('bgFillerSelect'),
    textColorSelect: document.getElementById('textColorSelect'),
    zoomRange: document.getElementById('zoomRange'),
    zoomVal: document.getElementById('zoomVal'),
    
    // Preview
    showRowGutterCheck: document.getElementById('showRowGutterCheck'),
    showHeadersCheck: document.getElementById('showHeadersCheck'),
    colorBlackBtn: document.getElementById('colorBlackBtn'),
    colorWhiteBtn: document.getElementById('colorWhiteBtn'),
    previewDims: document.getElementById('previewDims'),
    previewHeightLines: document.getElementById('previewHeightLines'),
    previewRuler: document.getElementById('previewRuler'),
    previewContainer: document.getElementById('previewContainer'),
    previewOutput: document.getElementById('previewOutput'),
    copyPreviewBtn: document.getElementById('copyPreviewBtn'),
    downloadTxtBtn: document.getElementById('downloadTxtBtn'),
    
    // Right panel / Editor
    currentCharBadge: document.getElementById('currentCharBadge'),
    redrawCharBtn: document.getElementById('redrawCharBtn'),
    resetCharBtn: document.getElementById('resetCharBtn'),
    charGridPicker: document.getElementById('charGridPicker'),
    charWidthSelect: document.getElementById('charWidthSelect'),
    charWidthVal: document.getElementById('charWidthVal'),
    pixelGrid: document.getElementById('pixelGrid'),
    gridWrapper: document.getElementById('gridWrapper'),
    miniCharLabel: document.getElementById('miniCharLabel'),
    miniPreviewText: document.getElementById('miniPreviewText'),
    
    // Transforms
    shiftUpBtn: document.getElementById('shiftUpBtn'),
    shiftDownBtn: document.getElementById('shiftDownBtn'),
    shiftLeftBtn: document.getElementById('shiftLeftBtn'),
    shiftRightBtn: document.getElementById('shiftRightBtn'),
    invertBtn: document.getElementById('invertBtn'),
    flipHBtn: document.getElementById('flipHBtn'),
    flipVBtn: document.getElementById('flipVBtn'),
    toastContainer: document.getElementById('toastContainer'),

    // Custom Drawing Canvas
    canvasDimsBadge: document.getElementById('canvasDimsBadge'),
    canvasCoordBadge: document.getElementById('canvasCoordBadge'),
    canvasWidthInput: document.getElementById('canvasWidthInput'),
    canvasHeightInput: document.getElementById('canvasHeightInput'),
    canvasCellSizeRange: document.getElementById('canvasCellSizeRange'),
    canvasCellSizeVal: document.getElementById('canvasCellSizeVal'),
    canvasPixelGrid: document.getElementById('canvasPixelGrid'),
    canvasScrollContainer: document.getElementById('canvasScrollContainer'),
    canvasLoadBannerBtn: document.getElementById('canvasLoadBannerBtn'),
    canvasClearBtn: document.getElementById('canvasClearBtn'),
    canvasDownloadBtn: document.getElementById('canvasDownloadBtn'),
    canvasCopyBtn: document.getElementById('canvasCopyBtn'),
    canvasShiftUp: document.getElementById('canvasShiftUp'),
    canvasShiftDown: document.getElementById('canvasShiftDown'),
    canvasShiftLeft: document.getElementById('canvasShiftLeft'),
    canvasShiftRight: document.getElementById('canvasShiftRight'),
    canvasInvertBtn: document.getElementById('canvasInvertBtn'),
    canvasFlipHBtn: document.getElementById('canvasFlipHBtn'),
    canvasFlipVBtn: document.getElementById('canvasFlipVBtn'),

    // Right Panel Mode Tabs
    tabCustomCanvas: document.getElementById('tabCustomCanvas'),
    tabCharEditor: document.getElementById('tabCharEditor'),
    tabViewBoth: document.getElementById('tabViewBoth'),
    viewCustomCanvas: document.getElementById('viewCustomCanvas'),
    viewCharEditor: document.getElementById('viewCharEditor')
  };

  // -------------------------------------------------------------
  // INITIALIZATION
  // -------------------------------------------------------------
  function init() {
    setupCharPicker(state.activeTab);
    loadCharIntoEditor(state.activeChar);
    initCanvas();
    setupEvents();
    
    // Multi-line default text so Line Gap is instantly visible!
    el.textInput.value = "TEST\n1234";
    updateGenerator();
  }

  // -------------------------------------------------------------
  // CHARACTER PICKER
  // -------------------------------------------------------------
  function setupCharPicker(tabKey) {
    el.charGridPicker.innerHTML = '';
    const chars = CHAR_TABS[tabKey] || CHAR_TABS.required;
    const H = state.glyphHeight;
    
    chars.forEach(ch => {
      const glyph = getActiveGlyph(ch);
      const btn = document.createElement('button');
      btn.className = `char-pick-btn ${ch === state.activeChar ? 'active' : ''}`;
      btn.textContent = ch === ' ' ? '␣' : ch;
      btn.title = `Edit '${ch}' (${glyph.width}×${H})`;
      btn.addEventListener('click', () => {
        selectCharacter(ch);
      });
      el.charGridPicker.appendChild(btn);
    });
  }

  function selectCharacter(ch) {
    state.activeChar = ch;
    document.querySelectorAll('.char-pick-btn').forEach(btn => {
      const charText = btn.textContent === '␣' ? ' ' : btn.textContent;
      btn.classList.toggle('active', charText === ch);
    });
    loadCharIntoEditor(ch);
  }

  // -------------------------------------------------------------
  // CHARACTER EDITOR
  // -------------------------------------------------------------
  function loadCharIntoEditor(ch) {
    const glyph = getActiveGlyph(ch);
    const H = state.glyphHeight;
    
    const displayChar = ch === ' ' ? 'Space' : `'${ch}'`;
    el.currentCharBadge.textContent = `${displayChar} (${glyph.width}×${H})`;
    el.miniCharLabel.textContent = ch === ' ' ? '␣' : ch;
    const clampedW = Math.min(12, Math.max(1, glyph.width));
    el.charWidthSelect.value = String(clampedW);
    if (el.charWidthVal) {
      el.charWidthVal.textContent = `${clampedW} col${clampedW === 1 ? '' : 's'}`;
    }

    buildGridUI(glyph);
    updateMiniPreview(glyph);
  }

  function buildGridUI(glyph) {
    const H = state.glyphHeight;
    el.pixelGrid.innerHTML = '';
    el.pixelGrid.style.gridTemplateColumns = `repeat(${glyph.width}, var(--grid-cell-size))`;
    
    for (let r = 0; r < H; r++) {
      const rowStr = glyph.rows[r] || ' '.repeat(glyph.width);
      for (let c = 0; c < glyph.width; c++) {
        const charVal = rowStr[c] || ' ';
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.dataset.row = r;
        cell.dataset.col = c;
        cell.dataset.val = charVal;
        cell.textContent = charVal === ' ' ? '' : charVal;
        
        cell.addEventListener('mousedown', (e) => {
          e.preventDefault();
          state.isMouseDown = true;
          state.mouseButton = e.button;
          saveUndo(state.activeChar);
          paintCell(cell, e.button === 2 ? ' ' : state.activeBrush);
        });

        cell.addEventListener('mouseenter', () => {
          if (state.isMouseDown) {
            paintCell(cell, state.mouseButton === 2 ? ' ' : state.activeBrush);
          }
        });

        cell.addEventListener('contextmenu', (e) => e.preventDefault());
        el.pixelGrid.appendChild(cell);
      }
    }
  }

  function saveUndo(ch) {
    const key = `${getDimKey()}_${ch}`;
    if (!charUndoStack[key]) charUndoStack[key] = [];
    const glyph = getActiveGlyph(ch);
    charUndoStack[key].push({
      width: glyph.width,
      rows: [...glyph.rows]
    });
    if (charUndoStack[key].length > 20) charUndoStack[key].shift();
  }

  function paintCell(cell, brushChar) {
    const r = parseInt(cell.dataset.row, 10);
    const c = parseInt(cell.dataset.col, 10);
    const glyph = getActiveGlyph(state.activeChar);

    let rowChars = (glyph.rows[r] || ' '.repeat(glyph.width)).split('');
    while (rowChars.length < glyph.width) rowChars.push(' ');
    rowChars[c] = brushChar;
    glyph.rows[r] = rowChars.join('');

    cell.dataset.val = brushChar;
    cell.textContent = brushChar === ' ' ? '' : brushChar;

    saveCustomGlyph(state.activeChar, glyph);
    updateMiniPreview(glyph);
    updateGenerator();
  }

  function updateMiniPreview(glyph) {
    const bgChar = state.invertBlocks ? state.solidChar : state.bgFiller;
    const solidChar = state.invertBlocks ? state.bgFiller : state.solidChar;
    const text = glyph.rows.map(row => {
      let r = '';
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === ' ') r += (bgChar === ' ' ? '·' : bgChar);
        else if (ch === '█') r += solidChar;
        else if (state.invertBlocks) {
          if (ch === '░') r += '▓';
          else if (ch === '▓') r += '░';
          else r += ch;
        } else {
          r += ch;
        }
      }
      return r;
    }).join('\n');
    el.miniPreviewText.textContent = text;
    if (state.textColor === 'black') {
      el.miniPreviewText.style.background = '#ffffff';
      el.miniPreviewText.style.color = '#000000';
    } else {
      el.miniPreviewText.style.background = 'var(--bg-primary)';
      el.miniPreviewText.style.color = 'var(--text-main)';
    }
  }

  // -------------------------------------------------------------
  // GRID ACTIONS: REDRAW, RESET, SHIFT, INVERT, FLIP
  // -------------------------------------------------------------
  function redrawCharacter() {
    saveUndo(state.activeChar);
    const glyph = getActiveGlyph(state.activeChar);
    const H = state.glyphHeight;
    glyph.rows = Array(H).fill(' '.repeat(glyph.width));
    saveCustomGlyph(state.activeChar, glyph);
    buildGridUI(glyph);
    updateMiniPreview(glyph);
    updateGenerator();
    showToast(`Cleared '${state.activeChar}' for redraw!`, 'success');
  }

  function resetCurrentCharacter() {
    saveUndo(state.activeChar);
    const H = state.glyphHeight;
    const W = state.glyphWidth;
    const base = getBaseGlyphForHeight(state.activeChar, H, W);
    saveCustomGlyph(state.activeChar, base);
    loadCharIntoEditor(state.activeChar);
    updateGenerator();
    showToast(`Reset '${state.activeChar}' (${W}×${H}) to default`, 'success');
  }

  function shiftGrid(dr, dc) {
    saveUndo(state.activeChar);
    const glyph = getActiveGlyph(state.activeChar);
    const H = state.glyphHeight;
    const W = glyph.width;
    const newRows = Array(H).fill('');

    for (let r = 0; r < H; r++) {
      const origR = r - dr;
      let newRow = '';
      if (origR < 0 || origR >= H) {
        newRow = ' '.repeat(W);
      } else {
        const oldRow = glyph.rows[origR];
        let rowArr = [];
        for (let c = 0; c < W; c++) {
          const origC = c - dc;
          if (origC < 0 || origC >= W) {
            rowArr.push(' ');
          } else {
            rowArr.push(oldRow[origC] || ' ');
          }
        }
        newRow = rowArr.join('');
      }
      newRows[r] = newRow;
    }
    glyph.rows = newRows;
    saveCustomGlyph(state.activeChar, glyph);
    buildGridUI(glyph);
    updateMiniPreview(glyph);
    updateGenerator();
  }

  function invertGrid() {
    saveUndo(state.activeChar);
    const glyph = getActiveGlyph(state.activeChar);
    glyph.rows = glyph.rows.map(row => {
      return row.split('').map(ch => (ch === ' ' ? '█' : ' ')).join('');
    });
    saveCustomGlyph(state.activeChar, glyph);
    buildGridUI(glyph);
    updateMiniPreview(glyph);
    updateGenerator();
  }

  function flipHorizontal() {
    saveUndo(state.activeChar);
    const glyph = getActiveGlyph(state.activeChar);
    glyph.rows = glyph.rows.map(row => row.split('').reverse().join(''));
    saveCustomGlyph(state.activeChar, glyph);
    buildGridUI(glyph);
    updateMiniPreview(glyph);
    updateGenerator();
  }

  function flipVertical() {
    saveUndo(state.activeChar);
    const glyph = getActiveGlyph(state.activeChar);
    glyph.rows = [...glyph.rows].reverse();
    saveCustomGlyph(state.activeChar, glyph);
    buildGridUI(glyph);
    updateMiniPreview(glyph);
    updateGenerator();
  }

  function changeCharWidth(newWidth) {
    newWidth = parseInt(newWidth, 10);
    if (isNaN(newWidth) || newWidth < 1 || newWidth > 12) return;
    saveUndo(state.activeChar);
    const glyph = getActiveGlyph(state.activeChar);
    glyph.width = newWidth;
    glyph.rows = glyph.rows.map(row => {
      if (row.length < newWidth) return row.padEnd(newWidth, ' ');
      return row.substring(0, newWidth);
    });
    saveCustomGlyph(state.activeChar, glyph);
    loadCharIntoEditor(state.activeChar);
    setupCharPicker(state.activeTab);
    updateGenerator();
  }

  // -------------------------------------------------------------
  // TEXT GENERATOR & LINE GAP / BUDGET ENGINE
  // -------------------------------------------------------------
  function calculateLineWidth(textLine) {
    let width = 0;
    const chars = Array.from(textLine);
    chars.forEach((ch, idx) => {
      const glyph = getActiveGlyph(ch);
      width += glyph.width;
      if (idx < chars.length - 1) {
        width += state.letterSpacing;
      }
    });
    return width;
  }

  // Holds clean text to copy without gutter row numbers
  let lastGeneratedCleanText = '';

  function updateGenerator() {
    const rawText = el.textInput.value;
    el.charCountLabel.textContent = `${rawText.length} char${rawText.length === 1 ? '' : 's'}`;

    let inputLines = rawText.split('\n');

    // Auto word wrap if enabled
    if (state.autoWrap && state.maxLineLimit > 0) {
      const wrapped = [];
      inputLines.forEach(line => {
        if (!line) {
          wrapped.push('');
          return;
        }
        const words = line.split(' ');
        let currentLine = '';
        words.forEach(word => {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const testWidth = calculateLineWidth(testLine);
          if (testWidth <= state.maxLineLimit || !currentLine) {
            currentLine = testLine;
          } else {
            wrapped.push(currentLine);
            currentLine = word;
          }
        });
        if (currentLine !== '') {
          wrapped.push(currentLine);
        }
      });
      inputLines = wrapped.length > 0 ? wrapped : [''];
    }

    // Line width calculation
    let maxWidthFound = 0;
    inputLines.forEach(line => {
      const w = calculateLineWidth(line);
      if (w > maxWidthFound) maxWidthFound = w;
    });

    el.currentWidthStat.textContent = maxWidthFound;
    el.maxWidthStat.textContent = state.maxLineLimit;
    const pct = Math.min(100, Math.round((maxWidthFound / state.maxLineLimit) * 100));
    el.limitProgressFill.style.width = `${pct}%`;

    if (maxWidthFound > state.maxLineLimit) {
      el.limitProgressFill.style.backgroundColor = 'var(--accent-red)';
      el.limitStatusText.className = 'limit-status-danger';
      el.limitStatusText.textContent = `⚠️ Exceeds Limit by ${maxWidthFound - state.maxLineLimit} blocks!`;
    } else if (pct >= 80) {
      el.limitProgressFill.style.backgroundColor = 'var(--accent-amber)';
      el.limitStatusText.className = 'limit-status-warn';
      el.limitStatusText.textContent = `⚡ Approaching Limit (${maxWidthFound}/${state.maxLineLimit})`;
    } else {
      el.limitProgressFill.style.backgroundColor = 'var(--accent-green)';
      el.limitStatusText.className = 'limit-status-safe';
      el.limitStatusText.textContent = `✓ Within Limit (${maxWidthFound}/${state.maxLineLimit})`;
    }

    // Vertical line budget calculation:
    // totalRows = topMargin + (numLines * glyphHeight) + (numLines - 1) * lineGap
    const H = state.glyphHeight;
    const numLines = inputLines.length;
    const gapRowsCount = Math.max(0, numLines - 1) * state.lineGap;
    const totalLinesNeeded = state.topMargin + (numLines * H) + gapRowsCount;

    el.previewDims.textContent = `${maxWidthFound} × ${totalLinesNeeded}`;
    el.previewHeightLines.textContent = `${totalLinesNeeded} / 15 lines`;
    
    // Detailed breakdown in badge
    const gapText = numLines > 1 ? ` + ${gapRowsCount} gap` : '';
    const topText = state.topMargin > 0 ? ` + ${state.topMargin} top` : '';
    el.terminalBudgetBadge.textContent = `${totalLinesNeeded} / 15 Lines Budget (${numLines}L × ${H}h${gapText}${topText})`;

    if (totalLinesNeeded > 15) {
      el.terminalBudgetBadge.style.background = 'rgba(239, 68, 68, 0.2)';
      el.terminalBudgetBadge.style.color = 'var(--accent-red)';
      el.terminalBudgetBadge.style.borderColor = 'rgba(239, 68, 68, 0.4)';
    } else if (totalLinesNeeded >= 14) {
      el.terminalBudgetBadge.style.background = 'rgba(245, 158, 11, 0.2)';
      el.terminalBudgetBadge.style.color = 'var(--accent-amber)';
      el.terminalBudgetBadge.style.borderColor = 'rgba(245, 158, 11, 0.4)';
    } else {
      el.terminalBudgetBadge.style.background = 'rgba(16, 185, 129, 0.2)';
      el.terminalBudgetBadge.style.color = 'var(--accent-green)';
      el.terminalBudgetBadge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
    }

    renderBanner(inputLines, maxWidthFound);
  }

  function renderBanner(lines, maxWidthFound) {
    const H = state.glyphHeight;
    const bgChar = state.bgFiller;
    const solidChar = state.solidChar;

    // Apply color mode to previewContainer and previewRuler
    if (state.textColor === 'black') {
      el.previewContainer.classList.add('text-mode-black');
      el.previewContainer.classList.remove('text-mode-white');
      el.previewRuler.classList.add('ruler-mode-black');
      el.previewRuler.classList.remove('ruler-mode-white');
    } else {
      el.previewContainer.classList.add('text-mode-white');
      el.previewContainer.classList.remove('text-mode-black');
      el.previewRuler.classList.add('ruler-mode-white');
      el.previewRuler.classList.remove('ruler-mode-black');
    }

    if (el.colorBlackBtn && el.colorWhiteBtn) {
      el.colorBlackBtn.classList.toggle('active', state.textColor === 'black');
      el.colorWhiteBtn.classList.toggle('active', state.textColor === 'white');
    }
    if (el.textColorSelect) {
      el.textColorSelect.value = state.textColor;
    }
    if (el.invertBlocksCheck) {
      el.invertBlocksCheck.checked = state.invertBlocks;
    }

    // Determine characters for background vs solid
    // If invertBlocks is active, solid block and blank filler swap roles
    const effectiveBg = state.invertBlocks ? solidChar : bgChar;
    const effectiveSolid = state.invertBlocks ? bgChar : solidChar;
    const letterSpaceStr = effectiveBg.repeat(state.letterSpacing);
    const targetW = state.padToLimit ? state.maxLineLimit : Math.max(1, maxWidthFound);

    // Apply simulation CSS custom properties
    document.documentElement.style.setProperty('--block-row-gap', `${state.blockRowGap}px`);
    el.previewOutput.style.setProperty('--block-row-gap', `${state.blockRowGap}px`);

    const cleanOutputRows = [];
    const htmlSections = [];
    let currentRowNum = 1;

    function formatGutterTag(label) {
      if (!state.showRowGutter) return '';
      return `<span class="gutter-tag">${label} │ </span>`;
    }

    // 1. Top Margin Rows (if any)
    if (state.topMargin > 0) {
      let topHtml = `<div class="preview-gap-block">`;
      if (state.showHeaders) {
        topHtml += `<div class="preview-gap-header">Top Margin (${state.topMargin} row${state.topMargin === 1 ? '' : 's'})</div>`;
      }
      for (let t = 0; t < state.topMargin; t++) {
        const topRow = effectiveBg.repeat(targetW);
        cleanOutputRows.push(topRow);
        const tag = formatGutterTag('TOP');
        topHtml += `<div class="preview-row-item">${tag}${escapeHtml(topRow)}</div>`;
      }
      topHtml += `</div>`;
      htmlSections.push(topHtml);
    }

    // 2. Render each line of text
    lines.forEach((lineText, lIdx) => {
      const chars = Array.from(lineText);
      let lineHtml = `<div class="preview-line-block">`;

      if (state.showHeaders) {
        lineHtml += `<div class="preview-block-header">Line ${lIdx + 1} (${H} rows)</div>`;
      }

      // Render H rows for this line
      for (let r = 0; r < H; r++) {
        const segments = [];
        chars.forEach(ch => {
          const glyph = getActiveGlyph(ch);
          let rawRow = glyph.rows[r] || ' '.repeat(glyph.width);

          let rowStr = '';
          for (let i = 0; i < rawRow.length; i++) {
            const block = rawRow[i];
            if (block === ' ') {
              rowStr += effectiveBg;
            } else if (block === '█') {
              rowStr += effectiveSolid;
            } else if (state.invertBlocks) {
              if (block === '░') rowStr += '▓';
              else if (block === '▓') rowStr += '░';
              else rowStr += block;
            } else {
              rowStr += block;
            }
          }
          segments.push(rowStr);
        });

        let fullRow = segments.join(letterSpaceStr);

        // If Pad to Limit is checked, pad out to targetW
        if (targetW > fullRow.length) {
          fullRow = fullRow + effectiveBg.repeat(targetW - fullRow.length);
        }

        cleanOutputRows.push(fullRow);
        const numStr = String(currentRowNum).padStart(2, '0');
        const tag = formatGutterTag(numStr);
        lineHtml += `<div class="preview-row-item">${tag}${escapeHtml(fullRow)}</div>`;
        currentRowNum++;
      }
      lineHtml += `</div>`;
      htmlSections.push(lineHtml);

      // 3. Line Gap Rows between lines (if not last line and lineGap > 0)
      if (lIdx < lines.length - 1 && state.lineGap > 0) {
        let gapHtml = `<div class="preview-gap-block">`;
        if (state.showHeaders) {
          gapHtml += `<div class="preview-gap-header">Line Gap (${state.lineGap} row${state.lineGap === 1 ? '' : 's'})</div>`;
        }
        for (let g = 0; g < state.lineGap; g++) {
          const gapRow = effectiveBg.repeat(targetW);
          cleanOutputRows.push(gapRow);
          const tag = formatGutterTag('GAP');
          gapHtml += `<div class="preview-row-item">${tag}${escapeHtml(gapRow)}</div>`;
        }
        gapHtml += `</div>`;
        htmlSections.push(gapHtml);
      }
    });

    lastGeneratedCleanText = cleanOutputRows.join('\n');
    el.previewOutput.innerHTML = htmlSections.join('');

    updateRuler(targetW);
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function updateRuler(width) {
    const targetW = Math.max(width, state.maxLineLimit, 65);
    let r = state.showRowGutter ? '     ' : ''; // offset for gutter
    for (let i = 0; i <= targetW; i += 10) {
      r += String(i).padEnd(10, '.');
    }
    el.previewRuler.textContent = r;
  }

  // -------------------------------------------------------------
  // TEST IMAGE REFERENCE & AUTO-TRACE FEATURE
  // -------------------------------------------------------------


  // -------------------------------------------------------------
  // CLIPBOARD COPY & EXPORT
  // -------------------------------------------------------------
  function copyOutputText() {
    const textToCopy = lastGeneratedCleanText;
    if (!textToCopy) {
      showToast('Nothing to copy!', 'error');
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        showToast(`Copied ${textToCopy.length} characters (ready for station)!`, 'success');
      }).catch(() => fallbackCopy(textToCopy));
    } else {
      fallbackCopy(textToCopy);
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      showToast('Copied text to clipboard!', 'success');
    } catch (err) {
      showToast('Failed to copy to clipboard', 'error');
    }
    document.body.removeChild(ta);
  }

  function downloadAsTxt() {
    const text = lastGeneratedCleanText;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `blocktype-banner-H${state.glyphHeight}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Downloaded banner as .txt', 'success');
  }

  function exportFontJSON() {
    const jsonStr = JSON.stringify(customGlyphsByHeight, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `blocktype-custom-fonts-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Exported font definition JSON', 'success');
  }

  function importFontJSON(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        customGlyphsByHeight = imported;
        localStorage.setItem(STORAGE_KEY_CUSTOM_GLYPHS, JSON.stringify(customGlyphsByHeight));
        loadCharIntoEditor(state.activeChar);
        updateGenerator();
        showToast('Successfully imported font definitions!', 'success');
      } catch (err) {
        showToast('Error parsing font JSON file', 'error');
      }
    };
    reader.readAsText(file);
  }

  function resetAllFonts() {
    const H = state.glyphHeight;
    const W = state.glyphWidth;
    const dimKey = getDimKey();
    if (confirm(`Reset all customized characters at size ${W}×${H} to defaults?`)) {
      delete customGlyphsByHeight[dimKey];
      if (W === 4 && customGlyphsByHeight[H]) {
        delete customGlyphsByHeight[H];
      }
      localStorage.setItem(STORAGE_KEY_CUSTOM_GLYPHS, JSON.stringify(customGlyphsByHeight));
      setupCharPicker(state.activeTab);
      loadCharIntoEditor(state.activeChar);
      updateGenerator();
      showToast(`Reset characters at ${W}×${H} to defaults!`, 'success');
    }
  }

  function showToast(message, type = 'normal') {
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'success' ? 'toast-success' : ''}`;
    toast.innerHTML = `<span>${type === 'success' ? '✓' : 'ℹ'}</span><span>${message}</span>`;
    el.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.2s';
      setTimeout(() => toast.remove(), 200);
    }, 2500);
  }

  // -------------------------------------------------------------
  // CUSTOM DRAWING CANVAS LOGIC (15 rows max, variable width)
  // -------------------------------------------------------------
  const canvasState = {
    width: 65,
    height: 5,
    cellSize: 16,
    activeBrush: '█',
    rows: [],
    isMouseDown: false,
    mouseButton: 0,
    undoStack: []
  };

  function initCanvas() {
    canvasState.rows = Array(canvasState.height).fill(' '.repeat(canvasState.width));
    buildCanvasGridUI();
  }

  function buildCanvasGridUI() {
    if (!el.canvasPixelGrid) return;
    el.canvasPixelGrid.innerHTML = '';
    el.canvasPixelGrid.style.setProperty('--canvas-cell-size', `${canvasState.cellSize}px`);
    el.canvasPixelGrid.style.gridTemplateColumns = `repeat(${canvasState.width}, var(--canvas-cell-size, 16px))`;
    
    if (el.canvasDimsBadge) {
      el.canvasDimsBadge.textContent = `${canvasState.width} × ${canvasState.height} Grid`;
    }

    for (let r = 0; r < canvasState.height; r++) {
      const rowStr = canvasState.rows[r] || ' '.repeat(canvasState.width);
      for (let c = 0; c < canvasState.width; c++) {
        const charVal = rowStr[c] || ' ';
        const cell = document.createElement('div');
        cell.className = 'grid-cell canvas-cell';
        cell.dataset.row = r;
        cell.dataset.col = c;
        cell.dataset.val = charVal;
        cell.textContent = charVal === ' ' ? '' : charVal;

        cell.addEventListener('mousedown', (e) => {
          e.preventDefault();
          canvasState.isMouseDown = true;
          canvasState.mouseButton = e.button;
          saveCanvasUndo();
          paintCanvasCell(cell, e.button === 2 ? ' ' : canvasState.activeBrush);
        });

        cell.addEventListener('mouseenter', () => {
          if (el.canvasCoordBadge) {
            el.canvasCoordBadge.textContent = `Col: ${c + 1}, Row: ${r + 1}`;
          }
          if (canvasState.isMouseDown) {
            paintCanvasCell(cell, canvasState.mouseButton === 2 ? ' ' : canvasState.activeBrush);
          }
        });

        cell.addEventListener('contextmenu', (e) => e.preventDefault());
        el.canvasPixelGrid.appendChild(cell);
      }
    }
  }

  function paintCanvasCell(cell, brushChar) {
    const r = parseInt(cell.dataset.row, 10);
    const c = parseInt(cell.dataset.col, 10);
    if (r >= canvasState.height || c >= canvasState.width) return;

    let rowChars = (canvasState.rows[r] || ' '.repeat(canvasState.width)).split('');
    while (rowChars.length < canvasState.width) rowChars.push(' ');
    rowChars[c] = brushChar;
    canvasState.rows[r] = rowChars.join('');

    cell.dataset.val = brushChar;
    cell.textContent = brushChar === ' ' ? '' : brushChar;
  }

  function saveCanvasUndo() {
    canvasState.undoStack.push([...canvasState.rows]);
    if (canvasState.undoStack.length > 20) canvasState.undoStack.shift();
  }

  function resizeCanvas(newW, newH) {
    saveCanvasUndo();
    const clampedW = Math.max(5, Math.min(120, parseInt(newW, 10) || 65));
    const clampedH = Math.max(1, Math.min(15, parseInt(newH, 10) || 5)); // strictly 1 to 15 max!

    const newRows = [];
    for (let r = 0; r < clampedH; r++) {
      if (r < canvasState.rows.length) {
        let existing = canvasState.rows[r];
        if (existing.length < clampedW) {
          existing = existing.padEnd(clampedW, ' ');
        } else {
          existing = existing.substring(0, clampedW);
        }
        newRows.push(existing);
      } else {
        newRows.push(' '.repeat(clampedW));
      }
    }

    canvasState.width = clampedW;
    canvasState.height = clampedH;
    canvasState.rows = newRows;

    if (el.canvasWidthInput) el.canvasWidthInput.value = clampedW;
    if (el.canvasHeightInput) el.canvasHeightInput.value = clampedH;

    buildCanvasGridUI();
    showToast(`Canvas resized to ${clampedW} × ${clampedH}`, 'normal');
  }

  function clearCanvas() {
    saveCanvasUndo();
    canvasState.rows = Array(canvasState.height).fill(' '.repeat(canvasState.width));
    buildCanvasGridUI();
    showToast('Cleared canvas for redraw!', 'success');
  }

  function loadBannerIntoCanvas() {
    if (!lastGeneratedCleanText) {
      showToast('No banner generated yet!', 'error');
      return;
    }
    saveCanvasUndo();

    const rawLines = lastGeneratedCleanText.split('\n');
    const newH = Math.min(15, Math.max(1, rawLines.length));
    let maxW = 0;
    rawLines.forEach(l => { if (l.length > maxW) maxW = l.length; });
    maxW = Math.max(10, Math.min(120, maxW));

    const newRows = [];
    for (let r = 0; r < newH; r++) {
      let line = rawLines[r] || '';
      let normalized = '';
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '\u3164' || ch === '\u2800' || ch === ' ') {
          normalized += ' ';
        } else {
          normalized += ch;
        }
      }
      if (normalized.length < maxW) {
        normalized = normalized.padEnd(maxW, ' ');
      } else {
        normalized = normalized.substring(0, maxW);
      }
      newRows.push(normalized);
    }

    canvasState.width = maxW;
    canvasState.height = newH;
    canvasState.rows = newRows;

    if (el.canvasWidthInput) el.canvasWidthInput.value = maxW;
    if (el.canvasHeightInput) el.canvasHeightInput.value = newH;

    buildCanvasGridUI();
    showToast(`Loaded banner into Canvas (${maxW}×${newH})!`, 'success');
  }

  function copyCanvasText() {
    const bgChar = state.bgFiller;
    const textRows = canvasState.rows.map(row => {
      let out = '';
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        out += (ch === ' ' ? bgChar : ch);
      }
      return out;
    });
    const resultText = textRows.join('\n');

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(resultText).then(() => {
        showToast(`Copied canvas drawing (${canvasState.width}×${canvasState.height})!`, 'success');
      }).catch(() => fallbackCopy(resultText));
    } else {
      fallbackCopy(resultText);
    }
  }

  function downloadCanvasTxt() {
    const bgChar = state.bgFiller;
    const textRows = canvasState.rows.map(row => {
      let out = '';
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        out += (ch === ' ' ? bgChar : ch);
      }
      return out;
    });
    const resultText = textRows.join('\n');

    const blob = new Blob([resultText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `blocktype-drawing-${canvasState.width}x${canvasState.height}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Downloaded drawing as .txt', 'success');
  }

  function shiftCanvas(dr, dc) {
    saveCanvasUndo();
    const H = canvasState.height;
    const W = canvasState.width;
    const newRows = Array(H).fill('');

    for (let r = 0; r < H; r++) {
      const origR = r - dr;
      if (origR < 0 || origR >= H) {
        newRows[r] = ' '.repeat(W);
      } else {
        const oldRow = canvasState.rows[origR];
        let rowArr = [];
        for (let c = 0; c < W; c++) {
          const origC = c - dc;
          if (origC < 0 || origC >= W) {
            rowArr.push(' ');
          } else {
            rowArr.push(oldRow[origC] || ' ');
          }
        }
        newRows[r] = rowArr.join('');
      }
    }
    canvasState.rows = newRows;
    buildCanvasGridUI();
  }

  function invertCanvas() {
    saveCanvasUndo();
    canvasState.rows = canvasState.rows.map(row => {
      let newRow = '';
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === ' ') newRow += '█';
        else if (ch === '█') newRow += ' ';
        else if (ch === '░') newRow += '▓';
        else if (ch === '▓') newRow += '░';
        else newRow += ch;
      }
      return newRow;
    });
    buildCanvasGridUI();
    showToast('Inverted canvas pixels', 'normal');
  }

  function flipCanvasH() {
    saveCanvasUndo();
    canvasState.rows = canvasState.rows.map(row => row.split('').reverse().join(''));
    buildCanvasGridUI();
  }

  function flipCanvasV() {
    saveCanvasUndo();
    canvasState.rows = [...canvasState.rows].reverse();
    buildCanvasGridUI();
  }

  // -------------------------------------------------------------
  // EVENT LISTENERS
  // -------------------------------------------------------------
  function setupEvents() {
    document.addEventListener('mouseup', () => {
      state.isMouseDown = false;
      canvasState.isMouseDown = false;
    });

    el.themeSelect.addEventListener('change', (e) => {
      document.body.className = e.target.value === 'default' ? '' : `theme-${e.target.value}`;
    });

    // 1. Glyph Height slider (5 to 15)
    el.glyphHeightRange.addEventListener('input', (e) => {
      state.glyphHeight = parseInt(e.target.value, 10);
      el.glyphHeightVal.textContent = `${state.glyphHeight} lines`;
      el.fontModeHeaderPill.textContent = `${state.glyphWidth}W × ${state.glyphHeight}H MATRIX`;
      setupCharPicker(state.activeTab);
      loadCharIntoEditor(state.activeChar);
      updateGenerator();
    });

    // 1b. Character Width slider (1 to 12 blocks)
    if (el.glyphWidthRange) {
      el.glyphWidthRange.addEventListener('input', (e) => {
        state.glyphWidth = parseInt(e.target.value, 10);
        if (el.glyphWidthVal) {
          el.glyphWidthVal.textContent = `${state.glyphWidth} block${state.glyphWidth === 1 ? '' : 's'}`;
        }
        el.fontModeHeaderPill.textContent = `${state.glyphWidth}W × ${state.glyphHeight}H MATRIX`;
        setupCharPicker(state.activeTab);
        loadCharIntoEditor(state.activeChar);
        updateGenerator();
      });
    }

    // 2. Line Gap slider (0 to 6 rows)
    el.lineGapRange.addEventListener('input', (e) => {
      state.lineGap = parseInt(e.target.value, 10);
      el.lineGapVal.textContent = `${state.lineGap} row${state.lineGap === 1 ? '' : 's'}`;
      updateGenerator();
    });

    // 3. Top Margin slider (0 to 10 rows)
    el.topMarginRange.addEventListener('input', (e) => {
      state.topMargin = parseInt(e.target.value, 10);
      el.topMarginVal.textContent = `${state.topMargin} row${state.topMargin === 1 ? '' : 's'}`;
      updateGenerator();
    });

    // 4. Letter Spacing slider (0 to 8 blocks)
    el.letterSpacingRange.addEventListener('input', (e) => {
      state.letterSpacing = parseInt(e.target.value, 10);
      el.letterSpacingVal.textContent = `${state.letterSpacing} block${state.letterSpacing === 1 ? '' : 's'}`;
      updateGenerator();
    });

    // 5. Background filler selection
    el.bgFillerSelect.addEventListener('change', (e) => {
      state.bgFiller = e.target.value;
      updateGenerator();
      updateMiniPreview(getActiveGlyph(state.activeChar));
    });

    // Simulation Block Row Gap (Constant of system)
    el.rowGapRange.addEventListener('input', (e) => {
      state.blockRowGap = parseInt(e.target.value, 10);
      el.rowGapVal.textContent = `${state.blockRowGap} px`;
      updateGenerator();
    });

    // Preview Line Headers toggle
    el.showHeadersCheck.addEventListener('change', (e) => {
      state.showHeaders = e.target.checked;
      updateGenerator();
    });

    // 6. Preview Zoom
    el.zoomRange.addEventListener('input', (e) => {
      state.previewZoom = parseInt(e.target.value, 10);
      el.zoomVal.textContent = `${state.previewZoom} px`;
      el.previewOutput.style.fontSize = `${state.previewZoom}px`;
    });

    // Row Gutter toggle
    el.showRowGutterCheck.addEventListener('change', (e) => {
      state.showRowGutter = e.target.checked;
      updateGenerator();
    });

    // Pad to limit toggle
    el.padToLimitCheck.addEventListener('change', (e) => {
      state.padToLimit = e.target.checked;
      updateGenerator();
    });

    // Invert Blocks toggle (Negative cutout)
    if (el.invertBlocksCheck) {
      el.invertBlocksCheck.addEventListener('change', (e) => {
        state.invertBlocks = e.target.checked;
        updateGenerator();
        updateMiniPreview(getActiveGlyph(state.activeChar));
        showToast(state.invertBlocks ? 'Negative / Inverted blocks enabled' : 'Normal blocks enabled', 'normal');
      });
    }

    // Text Color Switcher (Black text vs White text)
    function setTextColor(mode) {
      state.textColor = mode;
      if (el.textColorSelect) el.textColorSelect.value = mode;
      if (el.colorBlackBtn) el.colorBlackBtn.classList.toggle('active', mode === 'black');
      if (el.colorWhiteBtn) el.colorWhiteBtn.classList.toggle('active', mode === 'white');
      updateGenerator();
      updateMiniPreview(getActiveGlyph(state.activeChar));
      showToast(`Set: ${mode === 'black' ? '⬛ Black Text (White Bg)' : '⬜ White Text (Black Bg)'}`, 'normal');
    }

    if (el.colorBlackBtn) {
      el.colorBlackBtn.addEventListener('click', () => setTextColor('black'));
    }
    if (el.colorWhiteBtn) {
      el.colorWhiteBtn.addEventListener('click', () => setTextColor('white'));
    }
    if (el.textColorSelect) {
      el.textColorSelect.addEventListener('change', (e) => setTextColor(e.target.value));
    }

    // Copy & Export
    el.copyTopBtn.addEventListener('click', copyOutputText);
    el.copyPreviewBtn.addEventListener('click', copyOutputText);
    el.downloadTxtBtn.addEventListener('click', downloadAsTxt);
    el.exportFontBtn.addEventListener('click', exportFontJSON);
    el.importFontBtn.addEventListener('click', () => el.fontFileInput.click());
    el.fontFileInput.addEventListener('change', (e) => {
      if (e.target.files.length) importFontJSON(e.target.files[0]);
    });
    el.resetAllFontsBtn.addEventListener('click', resetAllFonts);

    // Text Input
    el.textInput.addEventListener('input', () => {
      if (state.enforceLimit) {
        const lines = el.textInput.value.split('\n');
        let exceeds = false;
        lines.forEach(l => {
          if (calculateLineWidth(l) > state.maxLineLimit) exceeds = true;
        });
        if (exceeds) {
          showToast('Reached maximum line limit!', 'error');
        }
      }
      updateGenerator();
    });

    el.clearInputBtn.addEventListener('click', () => {
      el.textInput.value = '';
      updateGenerator();
    });

    el.maxLineLimitInput.addEventListener('input', (e) => {
      state.maxLineLimit = Math.max(10, parseInt(e.target.value, 10) || 65);
      updateGenerator();
    });

    el.enforceLimitCheck.addEventListener('change', (e) => {
      state.enforceLimit = e.target.checked;
    });

    el.autoWrapCheck.addEventListener('change', (e) => {
      state.autoWrap = e.target.checked;
      updateGenerator();
    });

    // Character Redraw & Reset
    el.redrawCharBtn.addEventListener('click', redrawCharacter);
    el.resetCharBtn.addEventListener('click', resetCurrentCharacter);

    // Per-Character Width slider (1 to 12 cols)
    el.charWidthSelect.addEventListener('input', (e) => {
      changeCharWidth(e.target.value);
    });

    // Category Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.activeTab = btn.dataset.tab;
        setupCharPicker(state.activeTab);
      });
    });

    // Character Editor Brushes
    document.querySelectorAll('.tool-brushes .brush-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tool-brushes .brush-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.activeBrush = btn.dataset.brush;
      });
    });

    // Custom Canvas Brushes
    document.querySelectorAll('.canvas-brush-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.canvas-brush-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        canvasState.activeBrush = btn.dataset.brush;
      });
    });

    window.addEventListener('keydown', (e) => {
      if (document.activeElement === el.textInput || document.activeElement === el.canvasWidthInput || document.activeElement === el.canvasHeightInput) return;
      if (e.key === '1') selectBrush('█');
      if (e.key === '2') selectBrush('▓');
      if (e.key === '3') selectBrush('▒');
      if (e.key === '4') selectBrush('░');
      if (e.key === '5' || e.key === 'Backspace') selectBrush(' ');
    });

    function selectBrush(brushChar) {
      document.querySelectorAll('.tool-brushes .brush-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.brush === brushChar);
      });
      document.querySelectorAll('.canvas-brush-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.brush === brushChar);
      });
      state.activeBrush = brushChar;
      canvasState.activeBrush = brushChar;
    }

    // Character Editor Shift & Transform
    el.shiftUpBtn.addEventListener('click', () => shiftGrid(1, 0));
    el.shiftDownBtn.addEventListener('click', () => shiftGrid(-1, 0));
    el.shiftLeftBtn.addEventListener('click', () => shiftGrid(0, 1));
    el.shiftRightBtn.addEventListener('click', () => shiftGrid(0, -1));
    el.invertBtn.addEventListener('click', invertGrid);
    el.flipHBtn.addEventListener('click', flipHorizontal);
    el.flipVBtn.addEventListener('click', flipVertical);

    // Custom Canvas Controls
    if (el.canvasWidthInput) {
      el.canvasWidthInput.addEventListener('change', (e) => {
        resizeCanvas(e.target.value, canvasState.height);
      });
    }
    if (el.canvasHeightInput) {
      el.canvasHeightInput.addEventListener('change', (e) => {
        resizeCanvas(canvasState.width, e.target.value);
      });
    }
    if (el.canvasCellSizeRange) {
      el.canvasCellSizeRange.addEventListener('input', (e) => {
        canvasState.cellSize = parseInt(e.target.value, 10);
        if (el.canvasCellSizeVal) el.canvasCellSizeVal.textContent = `${canvasState.cellSize}px`;
        if (el.canvasPixelGrid) {
          el.canvasPixelGrid.style.setProperty('--canvas-cell-size', `${canvasState.cellSize}px`);
        }
      });
    }

    if (el.canvasClearBtn) el.canvasClearBtn.addEventListener('click', clearCanvas);
    if (el.canvasLoadBannerBtn) el.canvasLoadBannerBtn.addEventListener('click', loadBannerIntoCanvas);
    if (el.canvasCopyBtn) el.canvasCopyBtn.addEventListener('click', copyCanvasText);
    if (el.canvasDownloadBtn) el.canvasDownloadBtn.addEventListener('click', downloadCanvasTxt);

    if (el.canvasShiftUp) el.canvasShiftUp.addEventListener('click', () => shiftCanvas(1, 0));
    if (el.canvasShiftDown) el.canvasShiftDown.addEventListener('click', () => shiftCanvas(-1, 0));
    if (el.canvasShiftLeft) el.canvasShiftLeft.addEventListener('click', () => shiftCanvas(0, 1));
    if (el.canvasShiftRight) el.canvasShiftRight.addEventListener('click', () => shiftCanvas(0, -1));
    if (el.canvasInvertBtn) el.canvasInvertBtn.addEventListener('click', invertCanvas);
    if (el.canvasFlipHBtn) el.canvasFlipHBtn.addEventListener('click', flipCanvasH);
    if (el.canvasFlipVBtn) el.canvasFlipVBtn.addEventListener('click', flipCanvasV);

    // Right Panel Mode Switching (Custom Canvas vs Character Editor vs Both)
    function setRightPanelMode(mode) {
      if (!el.viewCustomCanvas || !el.viewCharEditor) return;
      if (mode === 'canvas') {
        el.viewCustomCanvas.style.display = 'flex';
        el.viewCharEditor.style.display = 'none';
        if (el.tabCustomCanvas) el.tabCustomCanvas.classList.add('active');
        if (el.tabCharEditor) el.tabCharEditor.classList.remove('active');
        if (el.tabViewBoth) el.tabViewBoth.classList.remove('active');
      } else if (mode === 'char') {
        el.viewCustomCanvas.style.display = 'none';
        el.viewCharEditor.style.display = 'flex';
        if (el.tabCustomCanvas) el.tabCustomCanvas.classList.remove('active');
        if (el.tabCharEditor) el.tabCharEditor.classList.add('active');
        if (el.tabViewBoth) el.tabViewBoth.classList.remove('active');
      } else if (mode === 'both') {
        el.viewCustomCanvas.style.display = 'flex';
        el.viewCharEditor.style.display = 'flex';
        if (el.tabCustomCanvas) el.tabCustomCanvas.classList.remove('active');
        if (el.tabCharEditor) el.tabCharEditor.classList.remove('active');
        if (el.tabViewBoth) el.tabViewBoth.classList.add('active');
      }
    }

    if (el.tabCustomCanvas) el.tabCustomCanvas.addEventListener('click', () => setRightPanelMode('canvas'));
    if (el.tabCharEditor) el.tabCharEditor.addEventListener('click', () => setRightPanelMode('char'));
    if (el.tabViewBoth) el.tabViewBoth.addEventListener('click', () => setRightPanelMode('both'));

  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
