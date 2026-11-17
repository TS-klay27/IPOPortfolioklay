// Compare two versions line by line after removing all text: string literals, HTML text nodes,
// attribute values and comments. Any remaining difference is a real code/logic change.
const fs = require('fs');
const [a, b] = process.argv.slice(2).map(f => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n').split('\n'));
const strip = s => s
  .replace(/\/\*[\s\S]*?\*\//g, '')                 // block comments
  .replace(/(^|[^:])\/\/.*$/g, '$1')                 // line comments
  .replace(/'(?:[^'\\]|\\.)*'/g, "''")               // '...'
  .replace(/"(?:[^"\\]|\\.)*"/g, '""')               // "..."
  .replace(/`(?:[^`\\]|\\.)*`/g, '``')               // `...`
  .replace(/>[^<>{}();]*</g, '><')                  // HTML text between tags
  .replace(/\s+/g, ' ').trim();
if (a.length !== b.length) console.log('line count differs:', a.length, b.length);
let changed = 0, codeDiff = [];
for (let i = 0; i < Math.max(a.length, b.length); i++) {
  if (a[i] === b[i]) continue;
  changed++;
  if (strip(a[i] || '') !== strip(b[i] || '')) codeDiff.push(i + 1);
}
console.log(JSON.stringify({ linesChanged: changed, linesWithCodeChanges: codeDiff.length, lines: codeDiff.slice(0, 20) }));
