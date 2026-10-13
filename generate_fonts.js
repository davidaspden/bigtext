// Script to generate and validate the complete default 15-row font set
const fs = require('fs');

// We want 15 rows tall for each character.
// Width can vary between 1 and 5 blocks across.
// Shading characters:
// S = Solid '█'
// D = Dark '▓'
// M = Medium '▒'
// L = Light '░'
// ' ' = Empty ' '

const glyphTemplates = {};

// Helper to expand a 15-line array of strings
function defineGlyph(char, width, lines) {
  if (lines.length !== 15) {
    throw new Error(`Glyph for '${char}' must have exactly 15 lines, got ${lines.length}`);
  }
  const processed = lines.map((line, r) => {
    let s = line;
    if (s.length < width) {
      s = s.padEnd(width, ' ');
    } else if (s.length > width) {
      s = s.slice(0, width);
    }
    // Replace aliases if used
    return s.replace(/S/g, '█')
            .replace(/D/g, '▓')
            .replace(/M/g, '▒')
            .replace(/L/g, '░');
  });
  glyphTemplates[char] = {
    width: width,
    rows: processed
  };
}

// Let's define Space: width 3, 15 empty rows
defineGlyph(' ', 3, Array(15).fill('   '));

// Let's create uppercase A-Z (15 rows tall, width 5)
// A
defineGlyph('A', 5, [
  " ▓█▓ ",
  " █ █ ",
  " █ █ ",
  "█   █",
  "█   █",
  "█   █",
  "█████",
  "█   █",
  "█   █",
  "█   █",
  "█   █",
  "█   █",
  "█   █",
  "█   █",
  "█   █"
]);

// B
defineGlyph('B', 5, [
  "████ ",
  "█   █",
  "█   █",
  "█   █",
  "█   █",
  "████ ",
  "█   █",
  "█   █",
  "█   █",
  "█   █",
  "█   █",
  "█   █",
  "█   █",
  "█   █",
  "████ "
]);

// C
defineGlyph('C', 5, [
  " ▓███",
  "██   ",
  "█    ",
  "█    ",
  "█    ",
  "█    ",
  "█    ",
  "█    ",
  "█    ",
  "█    ",
  "█    ",
  "█    ",
  "█    ",
  "██   ",
  " ▓███"
]);

// D
defineGlyph('D', 5, [
  "████ ",
  "█   █",
  "█   █",
  "█   █",
  "█   █",
  "█   █",
  "█   █",
  "█   █",
  "█   █",
  "█   █",
  "█   █",
  "█   █",
  "█   █",
  "█   █",
  "████ "
]);

// E
defineGlyph('E', 5, [
  "█████",
  "█    ",
  "█    ",
  "█    ",
  "█    ",
  "█    ",
  "████ ",
  "█    ",
  "█    ",
  "█    ",
  "█    ",
  "█    ",
  "█    ",
  "█    ",
  "█████"
]);

// F
defineGlyph('F', 5, [
  "█████",
  "█    ",
  "█    ",
  "█    ",
  "█    ",
  "█    ",
  "████ ",
  "█    ",
  "█    ",
  "█    ",
  "█    ",
  "█    ",
  "█    ",
  "█    ",
  "█    "
]);

// G
defineGlyph('G', 5, [
  " ▓███",
  "██   ",
  "█    ",
  "█    ",
  "█    ",
  "█    ",
  "█ ███",
  "█   █",
  "█   █",
  "█   █",
  "█   █",
  "█   █",
  "█   █",
  "██  █",
  " ▓███"
]);

// H
defineGlyph('H', 5, [
  "█   █",
  "█   █",
  "█   █",
  "█   █",
  "█   █",
  "█   █",
  "█████",
  "█   █",
  "█   █",
  "█   █",
  "█   █",
  "█   █",
  "█   █",
  "█   █",
  "█   █"
]);

// I
defineGlyph('I', 3, [
  "███",
  " █ ",
  " █ ",
  " █ ",
  " █ ",
  " █ ",
  " █ ",
  " █ ",
  " █ ",
  " █ ",
  " █ ",
  " █ ",
  " █ ",
  " █ ",
  "███"
]);

// J
defineGlyph('J', 5, [
  "   ██",
  "    █",
  "    █",
  "    █",
  "    █",
  "    █",
  "    █",
  "    █",
  "    █",
  "    █",
  "█   █",
  "█   █",
  "█   █",
  "██  █",
  " ▓██ "
]);

// K
defineGlyph('K', 5, [
  "█   █",
  "█  █ ",
  "█ █  ",
  "██   ",
  "██   ",
  "█ █  ",
  "█  █ ",
  "█   █",
  "█   █",
  "█   █",
  "█    ",
  "█   █",
  "█   █",
  "█    ",
  "█   █"
]);

// Let's create a builder for all characters so we have clean, consistent fonts.
console.log('Testing glyph generator skeleton...');
