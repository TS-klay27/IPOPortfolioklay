#!/usr/bin/env node
/*
  Reads the text back out of the Personal Mission Statement PDF and checks that every headline line,
  every mission paragraph (complete, unchanged), the guiding principle and every value from
  src/content/mission.json are in it. Also checks the basic PDF structure (one page, xref offsets).

  Usage (from development/kluivert-os):  node tools/verify/check-mission-pdf.js [file.pdf]
  Default file: ../../pdfs/Kluivert_Personal_Mission_Statement.pdf
*/
'use strict';
const fs = require('fs'), path = require('path');
const WIN = { 128: 0x20AC, 130: 0x201A, 131: 0x0192, 132: 0x201E, 133: 0x2026, 134: 0x2020, 135: 0x2021, 136: 0x02C6, 137: 0x2030, 138: 0x0160, 139: 0x2039, 140: 0x0152, 142: 0x017D, 145: 0x2018, 146: 0x2019, 147: 0x201C, 148: 0x201D, 149: 0x2022, 150: 0x2013, 151: 0x2014, 152: 0x02DC, 153: 0x2122, 154: 0x0161, 155: 0x203A, 156: 0x0153, 158: 0x017E, 159: 0x0178 };

function pdfText(buf) {
  const s = buf.toString('latin1');
  const m = s.match(/\/Contents (\d+) 0 R/); if (!m) throw Error('no /Contents');
  const obj = s.match(new RegExp(`\\n${m[1]} 0 obj\\n<< /Length (\\d+) >>\\nstream\\n`));
  const start = obj.index + obj[0].length, stream = s.slice(start, start + +obj[1]);
  const lines = [];
  for (const t of stream.matchAll(/\((?:\\.|[^\\)])*\) Tj/g)) {
    const raw = t[0].slice(1, -4); let out = '';
    for (let i = 0; i < raw.length; i++) {
      let c = raw.charCodeAt(i);
      if (raw[i] === '\\') { const oct = raw.slice(i + 1).match(/^[0-7]{1,3}/); if (oct) { c = parseInt(oct[0], 8); i += oct[0].length; } else { c = raw.charCodeAt(++i); } }
      out += String.fromCodePoint(WIN[c] || c);
    }
    lines.push(out);
  }
  return lines;
}

function checkMissionPdf(buf, mission) {
  const s = buf.toString('latin1'), problems = [];
  if (!s.startsWith('%PDF-1.')) problems.push('missing %PDF header');
  if ((s.match(/\/Type \/Page\b/g) || []).length !== 1) problems.push('expected exactly one page');
  const sx = +s.match(/startxref\n(\d+)/)[1];
  if (!s.startsWith('xref', sx)) problems.push('startxref does not point at the xref table');
  const entries = [...s.slice(sx).matchAll(/^(\d{10}) 00000 n $/gm)].map(e => +e[1]);
  entries.forEach((off, i) => { if (!s.startsWith(`${i + 1} 0 obj`, off)) problems.push(`xref offset of object ${i + 1} is wrong`); });
  const lines = pdfText(buf), all = lines.join(' ');
  const need = [...mission.headline, ...mission.paragraphs, mission.principle, ...mission.values.map(v => v[0])];
  for (const t of need) if (!all.includes(t)) problems.push('text missing from PDF: ' + t.slice(0, 60) + '…');
  return { ok: problems.length === 0, problems, lines: lines.length, checked: need.length };
}
module.exports = { checkMissionPdf, pdfText };

if (require.main === module) {
  const ROOT = path.resolve(__dirname, '..', '..');
  const file = process.argv[2] || path.join(ROOT, '..', '..', 'pdfs', 'Kluivert_Personal_Mission_Statement.pdf');
  const mission = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/content/mission.json'), 'utf8'));
  const r = checkMissionPdf(fs.readFileSync(file), mission);
  console.log(`${path.basename(file)}: ${r.lines} text lines, ${r.checked} required texts — ${r.ok ? 'all present, structure OK' : 'PROBLEMS'}`);
  r.problems.forEach(p => console.log('  ' + p));
  process.exit(r.ok ? 0 : 1);
}
