# BLOCKTYPE STUDIO █░▒

An interactive, responsive generator for creating large display text banners using solid and faded blocks (`█`, `▓`, `▒`, `░`), featuring **flexible 5–15 character height**, **live line gap preview**, **character redraw & editing**, **line length limits**, and **spacing controls**.

---

## ✨ Features

- **Flexible 5–15 Glyph Height Matrix**:
  - Slider to set character height anywhere from **5** (standard warehouse station baseline) up to **15** characters/lines tall.
  - Multi-resolution engine scales glyphs cleanly across all heights.
- **Comprehensive Default Font**:
  - **Uppercase**: `A` – `Z`
  - **Lowercase**: `a` – `z`
  - **Digits**: `0` – `9`
  - **Special Symbols**: `!`, `£`, `$`, `%`, `&`, `@`, `#`, `/`, `?`, `.`
  - **Common Punctuation**: `-`, `+`, `=`, `:`, `;`, `,`, `"`, `'`, `(`, `)`, `_`, space
- **Blank & Filler Character Options**:
  - **Hangul Blank `ㅤ` (`U+3164`)**: Non-collapsing fullwidth Hangul filler blank that prevents trimming and spaces collapsing in terminals.
  - **Braille Blank `⠀` (`U+2800`)**: Standard Unicode Braille pattern blank cell.
  - **Standard Space ` ` (`ASCII 0x20`)**
  - **Shaded Faded Blocks**: `░` (Light), `▒` (Medium), `▓` (Dark)
- **Output System Gap Simulation & Clear Line Separation**:
  - **Block Row Gap (`0px` to `8px`)**: Simulates the constant hardware leading/line-height between adjacent rows of blocks in your terminal display.
  - **Line Separation (`0px` to `40px`)**: Visual spacing slider creating unmistakable, clear separation between text lines in the preview.
  - **Line Gap Slider (`0` to `6` rows)**: Number of data blank/filler rows physically inserted between text lines in output.
  - **Top Margin Slider (`0` to `10` rows)**: Vertical offset above the first line.
  - **15-Line Budget Tracker**: Real-time counter tracks total rows against the 15-line station display limit:
    $$\text{e.g., } 2\text{ lines} \times 5\text{h} + 1\text{ gap} = 11 / 15\text{ lines used (4 remaining)}$$
  - **Preview Row Gutter & Line Headers**: Clear visual labeling (`01 │ ...`, `GAP │ ...`, `Line 1`, `Line 2`).
- **Line Length Limiter**:
  - Configurable maximum line length in blocks (e.g. 65 columns).
  - Real-time block width counter and progress bar with safe/warning/exceeded status indicators.
  - Optional **Enforce Limit** mode to prevent typing beyond the limit.
  - Optional **Auto-wrap Words** mode to break long sentences into multiple block rows.
  - Optional **Pad to Limit**: Fills trailing space with faded blocks up to the maximum column limit.
- **Interactive Character Redraw & Font Editor**:
  - Pick any character to edit or customize at your chosen height (5 to 15).
  - **✏️ Redraw / Clear Button**: Clears the grid to blank so you can draw any character from scratch.
  - **Interactive H×W Grid**: Click and drag to paint with:
    - `█` Solid Block (Key `1`)
    - `▓` Dark Shade (Key `2`)
    - `▒` Medium Shade (Key `3`)
    - `░` Light Shade (Key `4`)
    - `⌫` Eraser / Blank (Key `5` or Right-Click)
  - **Variable Widths**: Adjust character width from 1 to 5 blocks across.
  - **Transforms**: Shift ↑ ↓ ← →, Invert, Flip Horizontal, Flip Vertical.
  - Automatically saves custom edits per height in browser `localStorage`.
- **Spacing & Styling Controls**:
  - **Letter Spacing**: Adjust empty block columns between letters (0 to 8 blocks).
  - **Background Fill**: Choose Faded Blocks (`░`), Medium (`▒`), Dark (`▓`), or Spaces (` `).
  - **Preview Zoom**: Scale the monospace font size (6px to 22px) to fit large banners on any display.
  - **Themes**: Dark Slate, Matrix Green, Retro Amber CRT, Clean Light.
- **Copy & Export**:
  - **Copy Generated Text**: One-click copy of the raw block text to clipboard (without row gutter numbers, ready for station).
  - **Download .TXT**: Save generated banner to a text file.
  - **Export / Import Font JSON**: Back up your custom glyph designs and reload them anytime.

---

## 🚀 How to Run

### Option 1: Direct in Browser
Simply double-click or open [index.html](file:///c:/Users/david/Documents/antigravity/bold-maxwell/index.html) in Google Chrome, Microsoft Edge, Firefox, or any modern web browser.

### Option 2: Local HTTP Server (Node.js)
In the terminal, run:
```bash
npm start
```
or
```bash
node server.js
```
Then open: **`http://localhost:3000`**

---

## ⌨️ Shortcuts in Character Editor

- `1` : Select Solid Block (`█`)
- `2` : Select Dark Shade (`▓`)
- `3` : Select Medium Shade (`▒`)
- `4` : Select Light Shade (`░`)
- `5` or `Backspace` : Eraser
- **Left-Click & Drag** : Paint cells
- **Right-Click & Drag** : Erase cells
