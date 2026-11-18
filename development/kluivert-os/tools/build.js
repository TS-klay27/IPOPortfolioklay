#!/usr/bin/env node
/*
  KLUIVERT OS — reproducible build of the portfolio (Node.js only, no npm dependencies).

  Usage (from development/kluivert-os):  node tools/build.js [--out <dir>] [--check]
    --out <dir>   where to write index.html, kpc-game.html and pdfs/Kluivert_Personal_Mission_Statement.pdf
                  (default: repository root, two levels up)
    --check       build into a temp folder and compare with the files already in the output dir;
                  exits with code 1 if anything differs (nothing is written)

  Inputs (all under src/):
    site/styles/*.css          concatenated in file-name order inside <style>
    site/markup/10-icons.html  SVG icon sprite
    site/markup/20-screens.html intro, game mode, Kian's Room, boot layer, KLUIVERT OS shell
    site/markup/30-app-templates.html  window contents (About, Resume, Certificates, …)
    site/scripts/runtime.js    application runtime, contains the placeholder %%HYDRATE%%
    site/scripts/app-hydrate.js per-app behaviour injected at %%HYDRATE%%
    assets/                    images inlined as data: URIs (%%IMG_…%% placeholders)
    content/mission.json       7HHEP.EXE mission statement: filled into the app (%%MISSION_…%%) and
                               rendered to pdfs/Kluivert_Personal_Mission_Statement.pdf (tools/pdf/mission-pdf.js)
    game/kpc-game.es.html      original game; tools/translate-game.js produces the English build

  SAFETY: code is never passed as a *string* replacement to String.prototype.replace
  ($$ would become $). Use inject() / function replacers only.
*/
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');                 // development/kluivert-os
const SRC = path.join(ROOT, 'src');
const REPO_ROOT = path.resolve(ROOT, '..', '..');          // repository root = what GitHub Pages publishes
const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const outArg = args.indexOf('--out') >= 0 ? args[args.indexOf('--out') + 1] : null;
if (!outArg && !(fs.existsSync(path.join(REPO_ROOT, 'pdfs')) && fs.existsSync(path.join(REPO_ROOT, 'index.html'))))
  throw Error('repository root not found at ' + REPO_ROOT + ' (expected index.html and pdfs/); pass --out <dir>');
const OUT_FINAL = path.resolve(outArg || REPO_ROOT);
const OUT = CHECK ? fs.mkdtempSync(path.join(os.tmpdir(), 'kluivert-os-build-')) : OUT_FINAL;

const read = p => fs.readFileSync(path.join(SRC, p), 'utf8');
const inject = (src, token, code) => {
  const parts = src.split(token);
  if (parts.length !== 2) throw Error(`placeholder ${token} must appear exactly once (found ${parts.length - 1})`);
  return parts[0] + code + parts[1];
};
const countDD = s => (s.match(/\$\$\(/g) || []).length;

// ---------- 1. compose index.html ----------
const stylesDir = path.join(SRC, 'site/styles');
const styles = fs.readdirSync(stylesDir).filter(f => f.endsWith('.css')).sort().map(f => read('site/styles/' + f));
if (styles.length !== 4) throw Error('expected 4 style files, found ' + styles.length);
const hydrate = read('site/scripts/app-hydrate.js');
const runtimeSrc = read('site/scripts/runtime.js');
const runtime = inject(runtimeSrc, '%%HYDRATE%%', hydrate);
if (!runtime.includes(hydrate)) throw Error('hydrate block was not injected verbatim');
if (countDD(runtime) !== countDD(runtimeSrc) + countDD(hydrate)) throw Error('$$( count changed during injection');

let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#071A1F">
<meta name="color-scheme" content="dark">
<meta name="description" content="KLUIVERT — the interactive portfolio of Kluivert Manuel Peralta Carrera, IT Systems & Networks student. Step into Kian's Room and boot KLUIVERT OS.">
<title>Kian's Room | KLUIVERT — Kluivert Peralta</title>
<style>
${styles[0]}
${styles[1]}
${styles[2]}
${styles[3]}
</style>
</head>
<body>
<noscript><p style="padding:24px;font-family:sans-serif;color:#E2F3F1">This interactive portfolio needs JavaScript. Contact: kluivertp27@gmail.com</p></noscript>

${read('site/markup/10-icons.html')}
${read('site/markup/20-screens.html')}
${read('site/markup/30-app-templates.html')}
<script>
${runtime}
</script>
</body>
</html>
`;

// ---------- 2. 7HHEP.EXE mission statement: one source → app text + PDF ----------
const { buildMissionPdf } = require('./pdf/mission-pdf.js');
const { checkMissionPdf } = require('./verify/check-mission-pdf.js');
const MISSION_PDF = 'Kluivert_Personal_Mission_Statement.pdf';
const mission = JSON.parse(read('content/mission.json'));
const missionPdf = buildMissionPdf(mission);
const pdfCheck = checkMissionPdf(missionPdf, mission);
if (!pdfCheck.ok) throw Error('mission PDF check failed: ' + pdfCheck.problems.join('; '));
fs.mkdirSync(path.join(OUT, 'pdfs'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'pdfs', MISSION_PDF), missionPdf);
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Key sentences highlighted in the app (the text itself is unchanged; the PDF stays plain).
let highlighted = 0;
const markUp = p => (mission.highlights || []).reduce((html, h) => {
  const parts = html.split(esc(h));
  if (parts.length > 2) throw Error('highlight appears more than once in a paragraph: ' + h);
  if (parts.length === 2) highlighted++;
  return parts.join(`<mark>${esc(h)}</mark>`);
}, esc(p));
const missionTokens = {
  MISSION_HEADLINE: mission.headline.map(l => `<span>${esc(l)}</span>`).join(''),
  MISSION_PARAGRAPHS: mission.paragraphs.map(p => `<p>${markUp(p)}</p>`).join('\n'),
  MISSION_PRINCIPLE: esc(mission.principle),
  MISSION_VALUES: mission.values.map(([name, icon], i) => `<li style="--i:${i}"><span class="hx-vi"><svg class="i"><use href="#${icon}"/></svg></span>${esc(name)}</li>`).join(''),
  MISSION_PDF: MISSION_PDF,
  MISSION_PDF_LABEL: MISSION_PDF.split('_').join('_<wbr>'),         // file name with line-break opportunities
  MISSION_PDF_KB: String(Math.max(1, Math.round(missionPdf.length / 1024))),
};
if (highlighted !== (mission.highlights || []).length) throw Error(`only ${highlighted} of ${mission.highlights.length} mission highlights were found in the text`);

// ---------- 3. inline images and fill content placeholders ----------
const A = f => path.join(SRC, 'assets', f);
const uri = (f, mime) => `data:${mime};base64,` + fs.readFileSync(A(f)).toString('base64');
const images = { IMG_PORTRAIT: uri('portrait.jpg', 'image/jpeg'), IMG_CV1: uri('resume-1.jpg', 'image/jpeg'), IMG_CV2: uri('resume-2.jpg', 'image/jpeg'), IMG_CV3: uri('resume-3.jpg', 'image/jpeg') };
for (let i = 1; i <= 11; i++) images['IMG_CERT' + i] = uri(`certificates-${i}.webp`, 'image/webp');
const tokens = { ...images, ...missionTokens };
html = html.replace(/%%([A-Z0-9_]+)%%/g, (m, k) => { if (!(k in tokens)) throw Error('unknown placeholder ' + k); return tokens[k]; });
if (/%%[A-Z0-9_]+%%/.test(html)) throw Error('unresolved placeholder left in output');
fs.writeFileSync(path.join(OUT, 'index.html'), html);

// ---------- 4. KPC GAME (English) ----------
execFileSync(process.execPath, [path.join(__dirname, 'translate-game.js'), path.join(SRC, 'game/kpc-game.es.html'), path.join(OUT, 'kpc-game.html')], { stdio: 'pipe' });

// ---------- 5. syntax check of every inline script ----------
const vm = require('vm');
for (const f of ['index.html', 'kpc-game.html']) {
  const t = fs.readFileSync(path.join(OUT, f), 'utf8');
  for (const m of t.matchAll(/<script(?![^>]*type="application\/json")[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(m[1], { filename: f });
}

const kb = f => (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(0) + ' KB';
if (CHECK) {
  let same = true;
  for (const f of ['index.html', 'kpc-game.html', 'pdfs/' + MISSION_PDF]) {
    const a = fs.readFileSync(path.join(OUT, f)), b = fs.existsSync(path.join(OUT_FINAL, f)) ? fs.readFileSync(path.join(OUT_FINAL, f)) : null;
    const eq = b && a.equals(b); same = same && eq;
    console.log(`${f}: ${eq ? 'identical' : 'DIFFERS'} to ${path.join(OUT_FINAL, f)}`);
  }
  fs.rmSync(OUT, { recursive: true, force: true });
  process.exit(same ? 0 : 1);
}
console.log(`built index.html (${kb('index.html')}), kpc-game.html (${kb('kpc-game.html')}) and pdfs/${MISSION_PDF} (${kb('pdfs/' + MISSION_PDF)}) in ${OUT}`);
