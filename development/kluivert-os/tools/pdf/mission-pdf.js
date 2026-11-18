/*
  KLUIVERT OS — Personal Mission Statement PDF (7HHEP.EXE · Habit 02).

  Builds a one-page A4 PDF from src/content/mission.json with Node.js only (no dependencies).
  The output is deterministic (no dates, no random IDs), so `build.js --check` can compare it byte for byte.
  Text is real, selectable text in the standard PDF fonts Helvetica, Helvetica-Bold and Courier-Bold
  (WinAnsiEncoding, not embedded). Line wrapping uses the official Helvetica advance widths.

  Used by tools/build.js. Standalone:  node tools/pdf/mission-pdf.js <out.pdf>
*/
'use strict';

// Advance widths (1/1000 em) for WinAnsi codes 32..255 — Helvetica and Helvetica-Bold (Arial uses the same metrics).
const WIDTHS = {
  F1: [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,750,556,750,222,556,333,1000,556,556,333,1000,667,333,1000,750,611,750,750,222,222,333,333,350,556,1000,333,1000,500,333,944,750,500,667,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,552,400,549,333,333,333,576,537,333,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,549,611,556,556,556,556,500,556,500],
  F2: [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,750,556,750,278,556,500,1000,556,556,333,1000,667,333,1000,750,611,750,750,278,278,500,500,350,556,1000,333,1000,556,333,944,750,500,667,278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,552,400,549,333,333,333,576,556,333,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,549,611,611,611,611,611,556,611,556],
};
const FONTS = { F1: 'Helvetica', F2: 'Helvetica-Bold', F3: 'Courier-Bold' };   // F3 is monospaced: 600/1000 em per glyph
// Unicode → WinAnsi for the code points 128..159 (everything else in 32..126 and 160..255 maps to itself).
const WIN = { 0x20AC: 128, 0x201A: 130, 0x0192: 131, 0x201E: 132, 0x2026: 133, 0x2020: 134, 0x2021: 135, 0x02C6: 136, 0x2030: 137, 0x0160: 138, 0x2039: 139, 0x0152: 140, 0x017D: 142, 0x2018: 145, 0x2019: 146, 0x201C: 147, 0x201D: 148, 0x2022: 149, 0x2013: 150, 0x2014: 151, 0x02DC: 152, 0x2122: 153, 0x0161: 154, 0x203A: 155, 0x0153: 156, 0x017E: 158, 0x0178: 159 };

function encode(s) {
  return [...s].map(ch => {
    const u = ch.codePointAt(0), c = (u >= 32 && u < 127) || (u >= 160 && u <= 255) ? u : WIN[u];
    if (c === undefined) throw Error(`character not available in WinAnsiEncoding: ${JSON.stringify(ch)}`);
    return c;
  });
}
const widthOf = (s, f, size, tc = 0) => { const codes = encode(s); const em = f === 'F3' ? codes.length * 600 : codes.reduce((a, c) => a + WIDTHS[f][c - 32], 0); return em * size / 1000 + tc * Math.max(0, codes.length - 1); };
const pdfString = s => '(' + encode(s).map(c => c === 40 || c === 41 || c === 92 ? '\\' + String.fromCharCode(c) : c > 126 ? '\\' + c.toString(8).padStart(3, '0') : String.fromCharCode(c)).join('') + ')';
const n = v => (Math.round(v * 100) / 100).toString();
const rgb = hex => [1, 3, 5].map(i => n(parseInt(hex.slice(i, i + 2), 16) / 255)).join(' ');

function wrap(text, f, size, max) {
  const lines = []; let line = '';
  for (const word of text.split(' ')) {
    const next = line ? line + ' ' + word : word;
    if (line && widthOf(next, f, size) > max) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function buildMissionPdf(m) {
  const W = 595.28, H = 841.89, M = 62, TW = W - 2 * M;
  const C = { ink: '#0B252A', body: '#1E3A3F', teal: '#0F8F80', cyan: '#2AC7C9', accent: '#18B7A0', light: '#E2F3F1', muted: '#93B4B5', faint: '#5C7E80', rule: '#CFE3E0', tint: '#EAF6F4' };
  const ops = [];
  const rect = (x, top, w, h, col) => ops.push(`${rgb(col)} rg ${n(x)} ${n(H - top - h)} ${n(w)} ${n(h)} re f`);
  const text = (x, top, s, f, size, col, tc = 0) => ops.push(`BT /${f} ${n(size)} Tf ${n(tc)} Tc ${rgb(col)} rg ${n(x)} ${n(H - top)} Td ${pdfString(s)} Tj ET`);
  const textR = (right, top, s, f, size, col, tc = 0) => text(right - widthOf(s, f, size, tc), top, s, f, size, col, tc);

  // Header band
  rect(0, 0, W, 168, C.ink);
  rect(0, 168, W, 2.4, C.accent);
  text(M, 54, 'KLUIVERT  ·  7HHEP.EXE  ·  THE 7 HABITS', 'F3', 8, C.cyan, .9);
  text(M, 96, m.title, 'F2', 28, C.light);
  text(M, 120, m.habit, 'F1', 11.5, C.muted);
  text(M, 144, m.author.toUpperCase(), 'F3', 7.5, C.faint, .8);
  rect(W - M - 36, 40, 36, 36, C.accent);                       // brand mark "K."
  text(W - M - 36 + 9.5, 66.5, 'K', 'F2', 20, C.ink);
  rect(W - M - 9, 63, 4, 4, C.ink);

  // Headline
  let y = 214;
  m.headline.forEach((line, i) => { text(M, y, line, 'F2', 16, i === 1 ? C.teal : C.ink, .2); y += 21; });
  y += 10; rect(M, y, 42, 2, C.accent); y += 26;

  // Mission statement
  text(M, y, 'MY PERSONAL MISSION STATEMENT', 'F3', 8, C.teal, .9); y += 24;
  for (const p of m.paragraphs) {
    for (const line of wrap(p, 'F1', 11.5, TW)) { text(M, y, line, 'F1', 11.5, C.body); y += 18.4; }
    y += 10;
  }

  // Guiding principle
  y += 8;
  const pl = wrap(m.principle, 'F2', 14, TW - 44), boxH = 46 + pl.length * 19;
  rect(M, y, TW, boxH, C.tint); rect(M, y, 3, boxH, C.accent);
  text(M + 22, y + 22, 'MY GUIDING PRINCIPLE', 'F3', 7.5, C.teal, .9);
  pl.forEach((line, i) => text(M + 22, y + 42 + i * 19, line, 'F2', 14, C.ink));
  y += boxH + 30;

  // Values
  text(M, y, 'CREATIVE VISION & PERSONAL VALUES', 'F3', 8, C.teal, .9); y += 20;
  const SEP = '   ·   ', vlines = [''];                             // wrap whole values, never leave a separator at a line end
  for (const v of m.values.map(x => x[0])) { const cur = vlines[vlines.length - 1], next = cur ? cur + SEP + v : v; if (cur && widthOf(next, 'F1', 10) > TW) vlines.push(v); else vlines[vlines.length - 1] = next; }
  for (const line of vlines) { text(M, y, line, 'F1', 10, C.body); y += 16; }

  // Footer
  const footTop = H - 52;
  if (y > footTop - 18) throw Error(`mission PDF content overflows the page (y=${n(y)}, footer at ${n(footTop)})`);
  rect(M, footTop, TW, .8, C.rule);
  text(M, footTop + 20, m.author, 'F1', 8, C.faint);
  textR(W - M, footTop + 20, 'THE 7 HABITS  ·  7HHEP.EXE  ·  KLUIVERT OS', 'F3', 7, C.faint, .6);

  const content = Buffer.from(ops.join('\n') + '\n', 'latin1');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R /Lang (en) /ViewerPreferences << /DisplayDocTitle true >> >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> >> /Contents 7 0 R >>`,
    ...['F1', 'F2', 'F3'].map(f => `<< /Type /Font /Subtype /Type1 /BaseFont /${FONTS[f]} /Encoding /WinAnsiEncoding >>`),
    null,                                                         // 7: content stream
    `<< /Title (Kluivert - ${m.title}) /Author (${m.author}) /Subject (7HHEP.EXE - The 7 Habits - Habit 02) /Creator (KLUIVERT OS build) >>`,
  ];
  const parts = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1')], offsets = [];
  let pos = parts[0].length;
  objs.forEach((o, i) => {
    const body = o === null
      ? Buffer.concat([Buffer.from(`${i + 1} 0 obj\n<< /Length ${content.length} >>\nstream\n`, 'latin1'), content, Buffer.from('endstream\nendobj\n', 'latin1')])
      : Buffer.from(`${i + 1} 0 obj\n${o}\nendobj\n`, 'latin1');
    offsets.push(pos); parts.push(body); pos += body.length;
  });
  const xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('')
    + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info 8 0 R >>\nstartxref\n${pos}\n%%EOF\n`;
  parts.push(Buffer.from(xref, 'latin1'));
  return Buffer.concat(parts);
}

module.exports = { buildMissionPdf };

if (require.main === module) {
  const fs = require('fs'), path = require('path');
  const out = process.argv[2]; if (!out) { console.error('usage: node tools/pdf/mission-pdf.js <out.pdf>'); process.exit(2); }
  const m = JSON.parse(fs.readFileSync(path.join(__dirname, '../../src/content/mission.json'), 'utf8'));
  fs.writeFileSync(out, buildMissionPdf(m));
  console.log('wrote', out);
}
