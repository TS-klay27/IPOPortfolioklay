// Builds KPC GAME in another language from the Spanish original with exact, longest-first string replacement
// (same method as translate-game.js). Game logic, levels, save keys and mechanics are untouched.
// Usage: node localize-game.js <kpc-game.es.html> <map.json> <out.html>
const fs = require('fs');
const [, , SRC, MAP, OUT] = process.argv;
let t = fs.readFileSync(SRC, 'utf8');
const M = JSON.parse(fs.readFileSync(MAP, 'utf8'));
const keys = Object.keys(M).sort((a, b) => b.length - a.length), missing = [];
for (const k of keys) { if (!t.includes(k)) { missing.push(k); continue; } t = t.split(k).join(M[k]); }
if (missing.length) throw Error('game strings not found in the source:\n' + missing.join('\n'));
fs.writeFileSync(OUT, t);
console.log('replaced', keys.length, 'strings');
