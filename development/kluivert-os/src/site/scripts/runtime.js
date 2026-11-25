/* =======================================================================
   KLUIVERT — runtime (vanilla JS, no dependencies, no build step needed)
   Kian's Room (original isometric renderer, refined) → cinematic monitor
   dolly → KLUIVERT OS boot → desktop.
   ======================================================================= */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const RM = matchMedia('(prefers-reduced-motion: reduce)');
const reduced = () => RM.matches;
const isSmall = () => innerWidth <= 820;
const coarse = matchMedia('(pointer: coarse)');
const wait = ms => new Promise(r => setTimeout(r, ms));
const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, n));
const ease = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const easeIO = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const lerp = (a, b, t) => a + (b - a) * t;
// Frame-driven tween with a timer safety net (finishes even if frames are throttled).
// `soft` tweens (opacity / progress only) still run when reduced motion is requested.
function animate(ms, fn, soft = false) {
  return new Promise(res => {
    if ((reduced() && !soft) || ms <= 0) { fn(1); res(); return; }
    const t0 = performance.now(); let done = false;
    const end = () => { if (done) return; done = true; fn(1); res(); };
    setTimeout(end, ms + 400);
    (function f(now) { if (done) return; const t = clamp((now - t0) / ms); fn(t); if (t < 1) requestAnimationFrame(f); else end(); })(t0);
  });
}

/* ---------- App registry ---------- */
const APPS = {
  about:        { title: 'About Me',     icon: 'i-user',   w: 1080, h: 760, bare: true },
  resume:       { title: 'Resume',       icon: 'i-file',   w: 1040, h: 760, bare: true },
  certificates: { title: 'Certificates', icon: 'i-award',  w: 1120, h: 780, bare: true },
  projects:     { title: 'Projects',     icon: 'i-code',   w: 1080, h: 760, bare: true },
  arcade:       { title: 'KPC GAME',     icon: 'i-game',   w: 1180, h: 800, path: 'KMP://ARCADE' },
  '7hhep':      { title: '7HHEP.EXE',    icon: 'i-layers', w: 1200, h: 820, path: 'KMP://7HHEP.EXE', bare: true },   // bare: full-bleed app, no page footer
  contact:      { title: 'Contact',      icon: 'i-mail',   w: 980,  h: 640, bare: true },
};
const ORDER = ['about', 'resume', 'certificates', 'projects', '7hhep', 'contact'];   // KPC GAME lives inside Projects
const ROUTES = ['index', 'lab', 'os', ...ORDER, 'arcade'];

/* ---------- Small UI helpers ---------- */
let toastT = 0;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1800); }
const Motion = (() => {
  let pref = 'auto'; try { pref = localStorage.getItem('kos-motion') || 'auto'; } catch (_) {}
  const subs = new Set(), notify = () => subs.forEach(f => f());
  RM.addEventListener('change', notify);
  return {
    get pref() { return pref; },
    on: () => pref === 'on' || (pref === 'auto' && !reduced()),
    set(p) { pref = p; try { localStorage.setItem('kos-motion', p); } catch (_) {} notify(); },
    sub: f => subs.add(f)
  };
})();
let spotEl = null, spotX = 0, spotY = 0, spotRaf = 0;   // at most one update per frame
document.addEventListener('pointermove', e => {
  if (e.pointerType === 'touch') return;
  const el = e.target.closest && e.target.closest('.spot'); if (!el) return;
  spotEl = el; spotX = e.clientX; spotY = e.clientY;
  if (!spotRaf) spotRaf = requestAnimationFrame(() => { spotRaf = 0; const r = spotEl.getBoundingClientRect(); spotEl.style.setProperty('--mx', (spotX - r.left) + 'px'); spotEl.style.setProperty('--my', (spotY - r.top) + 'px'); });
}, { passive: true });
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-copy]'); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  try {
    await navigator.clipboard.writeText(b.dataset.copy); toast('COPIED TO CLIPBOARD');
    const lbl = [...b.childNodes].find(n => n.nodeType === 3 && n.textContent.trim());
    if (lbl) { b.dataset.label = b.dataset.label || lbl.textContent; lbl.textContent = 'COPIED'; b.classList.add('copied'); clearTimeout(b._copyT); b._copyT = setTimeout(() => { lbl.textContent = b.dataset.label; b.classList.remove('copied'); }, 1600); }
  } catch (_) { toast(b.dataset.copy); }
});

/* =======================================================================
   KIAN'S ROOM — the original isometric renderer, refined.
   Static geometry is cached to an offscreen layer; only the monitor, fans,
   glow and dust are redrawn each frame (30 fps, paused when hidden/covered).
   ======================================================================= */
const Room = (() => {
  const roomEl = $('#room'), view = $('#view'), canvas = $('#room-canvas'), hint = $('#mon-hint'), hintText = $('#mon-hint-text');
  let ctx = canvas.getContext('2d');
  let w = 1200, h = 760, s = 50, dpr = 1, cy0 = .58, yaw = .72, target = .72, time = 0, last = 0, raf = 0;
  let paused = false, hover = false, frozen = false, fx = 0, fy = 0;
  let zoom = 1, fk = 0, act = 0, anim = null, down = null, onMonitorCb = () => {};
  const v = (x, y, z) => ({ x, y, z });

  /* ---- Projection & primitives (original) ---- */
  function p(a) { return { x: w / 2 + (a.x * Math.cos(yaw) - a.z * Math.sin(yaw)) * s, y: h * cy0 + ((a.x * Math.sin(yaw) + a.z * Math.cos(yaw)) * .47 - a.y * .9) * s }; }
  function poly(points, color, stroke) { ctx.beginPath(); points.map(p).forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.closePath(); ctx.fillStyle = color; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = .7; ctx.stroke(); } }
  function line(a, b, color, width = 1) { const c = p(a), d = p(b); ctx.save(); ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke(); ctx.restore(); }
  const colors = { top: '#275b58', left: '#123737', right: '#1b4544' };
  function box(x, y, z, dx, dy, dz, c = colors) {
    if (typeof c === 'string') c = { top: c, left: c, right: c };
    const a = v(x - dx / 2, y, z - dz / 2), b = v(x + dx / 2, y, z - dz / 2), c1 = v(x + dx / 2, y, z + dz / 2), d = v(x - dx / 2, y, z + dz / 2);
    const up = q => v(q.x, y + dy, q.z);
    poly([b, c1, up(c1), up(b)], c.right); poly([c1, d, up(d), up(c1)], c.left); poly([up(a), up(b), up(c1), up(d)], c.top);
  }
  function plane(origin, u, z, draw) { const a = p(origin), b = p(v(origin.x + u.x, origin.y + u.y, origin.z + u.z)), c = p(v(origin.x + z.x, origin.y + z.y, origin.z + z.z)); ctx.save(); ctx.transform(b.x - a.x, b.y - a.y, c.x - a.x, c.y - a.y, a.x, a.y); draw(); ctx.restore(); }
  function front(x, y, z, width, height, draw) { plane(v(x, y, z), v(width, 0, 0), v(0, -height, 0), draw); }
  function rightArt(z, y, width, height, draw) { plane(v(5.7, y, z), v(0, 0, width), v(0, -height, 0), draw); }
  // Soft contact shadow on the floor plane (new: grounds every object).
  function contact(x, z, rx, rz, a = .5) { plane(v(x - rx, .002, z - rz), v(rx * 2, 0, 0), v(0, 0, rz * 2), () => { const g = ctx.createRadialGradient(.5, .5, 0, .5, .5, .5); g.addColorStop(0, `rgba(2,6,14,${a})`); g.addColorStop(1, 'rgba(2,6,14,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 1, 1); }); }

  /* ---- Room shell (original, with material & light passes) ---- */
  function floor() {
    const shadow = ctx.createRadialGradient(w / 2, h * .65, 0, w / 2, h * .65, s * 9); shadow.addColorStop(0, '#00d8d022'); shadow.addColorStop(1, '#00101400'); ctx.fillStyle = shadow; ctx.fillRect(0, 0, w, h);
    box(0, -.35, 0, 11.8, .35, 10.6, { top: '#343b50', left: '#101827', right: '#202a3d' });
    // Material: engineered wood planks with staggered joints.
    plane(v(-5.9, 0, -5.3), v(11.8, 0, 0), v(0, 0, 10.6), () => {
      const n = 18;
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = i % 2 ? 'rgba(255,255,255,.022)' : 'rgba(0,0,0,.05)'; ctx.fillRect(i / n, 0, 1 / n, 1);
        ctx.fillStyle = 'rgba(4,8,18,.35)'; ctx.fillRect(i / n, 0, .0016, 1);
        for (let k = 0; k < 3; k++) { const y = ((i * 37 + k * 53) % 100) / 100; ctx.fillRect(i / n, y, 1 / n, .0022); }
      }
      const g = ctx.createLinearGradient(0, 0, 0, 1); g.addColorStop(0, 'rgba(0,0,0,.22)'); g.addColorStop(.55, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(34,240,208,.05)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 1, 1);
    });
    contact(-2.7, -1.75, 2.15, 3.3, .55); contact(0, 3.95, 3.4, 1.3, .55); contact(0, 1.85, 1.1, 1.0, .5); contact(5.02, -2.2, .9, 2.4, .45);
    // Deep navy room with cool slate walls and cyan architectural lighting.
    box(0, 0, -5.23, 11.8, 4.6, .16, { top: '#101c2e', left: '#25324b', right: '#1a2940' });
    plane(v(-5.9, 4.6, -5.149), v(11.8, 0, 0), v(0, -4.6, 0), () => { const g = ctx.createLinearGradient(0, 0, 0, 1); g.addColorStop(0, 'rgba(3,8,18,.42)'); g.addColorStop(.6, 'rgba(3,8,18,.05)'); g.addColorStop(1, 'rgba(34,240,208,.07)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 1, 1); });
    box(5.82, 0, 0, .16, 4.6, 10.6, { top: '#1a2940', left: '#29334a', right: '#101b2d' });
    box(-5.83, 0, 0, .16, 4.6, 10.6, { top: '#101b2d', left: '#25324b', right: '#1a2940' });
    plane(v(-5.749, 4.6, -5.3), v(0, 0, 10.6), v(0, -4.6, 0), () => { const g = ctx.createLinearGradient(0, 0, 0, 1); g.addColorStop(0, 'rgba(3,8,18,.38)'); g.addColorStop(.65, 'rgba(3,8,18,0)'); g.addColorStop(1, 'rgba(34,240,208,.06)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 1, 1); });
    line(v(-5.71, .18, -5.05), v(-5.71, .18, 5.05), '#22f0d0', 2);
    line(v(-5.71, 4.58, -5.05), v(-5.71, .15, -5.05), '#8b70ff', 1.5);
    line(v(-5.8, .12, -5.12), v(5.7, .12, -5.12), '#22f0d0', 2);
    line(v(5.7, .12, -5.1), v(5.7, .12, 5.2), '#22f0d0', 2);
    // Large dark window with a stylised neon skyline.
    plane(v(-5.66, 3.75, 4.95), v(0, 0, -3.33), v(0, -3.28, 0), () => {
      ctx.fillStyle = '#071522'; ctx.fillRect(0, 0, 1, 1);
      const g = ctx.createLinearGradient(0, 0, 1, 1); g.addColorStop(0, '#071b35'); g.addColorStop(.55, '#103a58'); g.addColorStop(1, '#241c4b'); ctx.fillStyle = g; ctx.fillRect(.035, .035, .93, .93);
      for (let i = 0; i < 13; i++) { const x = .06 + i * .07, bh = .16 + (i % 5) * .13; ctx.fillStyle = i % 2 ? '#142d51' : '#0b263f'; ctx.fillRect(x, .92 - bh, .055, bh); for (let k = 0; k < 4; k++) { ctx.fillStyle = '#21d9e5'; ctx.fillRect(x + .012, .94 - bh + k * .045, .014, .018); } }
      ctx.strokeStyle = '#22f0d0'; ctx.lineWidth = .018; ctx.strokeRect(.02, .02, .96, .96); ctx.fillStyle = '#8a5cff'; ctx.fillRect(.49, 0, .018, 1); ctx.fillRect(0, .49, 1, .018);
      // Glass reflection
      const r = ctx.createLinearGradient(0, 0, 1, .6); r.addColorStop(0, 'rgba(255,255,255,.07)'); r.addColorStop(.35, 'rgba(255,255,255,0)'); ctx.fillStyle = r; ctx.fillRect(.035, .035, .93, .93);
    });
    // Twin integrated wall displays.
    for (let n = 0; n < 2; n++) front(-4.35 + n * 2.25, 4.15, -5.12, 1.95, 1.35, () => {
      ctx.fillStyle = '#050b16'; ctx.fillRect(0, 0, 1, 1); ctx.fillStyle = '#101d31'; ctx.fillRect(.035, .035, .93, .93);
      ctx.strokeStyle = '#344761'; ctx.lineWidth = .012; ctx.strokeRect(.045, .045, .91, .91);
      ctx.fillStyle = '#22f0d0'; ctx.fillRect(.09, .12, .055, .025);
      ctx.fillStyle = '#9fb2ca'; ctx.font = 'bold .075px monospace'; ctx.textAlign = 'left';
      ctx.fillText(n ? 'SYSTEM MONITOR' : 'KIAN / STATUS', .18, .145);
      ctx.fillStyle = '#617b98'; ctx.fillRect(.09, .19, .82, .008);
      if (!n) {
        ctx.strokeStyle = '#203c56'; ctx.lineWidth = .008;
        for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(.1, .23 + i * .13); ctx.lineTo(.9, .23 + i * .13); ctx.stroke(); }
        ctx.beginPath(); ctx.moveTo(.1, .79);
        for (let i = 0; i <= 32; i++) { const x = .1 + i * .025; const y = .57 + Math.sin(i * .52) * .13 + Math.sin(i * 1.21) * .035; ctx.lineTo(x, y); }
        ctx.strokeStyle = '#22f0d0'; ctx.lineWidth = .025; ctx.stroke();
        ctx.fillStyle = '#9b7cff'; ctx.fillRect(.1, .86, .18, .025); ctx.fillStyle = '#22f0d0'; ctx.fillRect(.31, .86, .12, .025);
        ctx.fillStyle = '#66849f'; ctx.font = '.055px monospace'; ctx.fillText('SIGNAL STABLE  /  98.7%', .48, .885);
      } else {
        for (let i = 0; i < 5; i++) {
          const y = .27 + i * .105;
          ctx.fillStyle = i === 1 ? '#a78bfa' : '#22d9d0'; ctx.beginPath(); ctx.arc(.13, y, .018, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#9fb2ca'; ctx.fillRect(.19, y - .012, .29 + (i % 3) * .07, .018);
          ctx.fillStyle = '#29415b'; ctx.fillRect(.58, y - .014, .29, .025);
          ctx.fillStyle = i === 1 ? '#a78bfa' : '#22f0d0'; ctx.fillRect(.58, y - .014, .12 + (i % 3) * .065, .025);
        }
        ctx.strokeStyle = '#243e59'; ctx.lineWidth = .008; ctx.strokeRect(.1, .82, .8, .1);
        ctx.strokeStyle = '#22f0d0'; ctx.lineWidth = .018; ctx.beginPath(); ctx.moveTo(.13, .88); ctx.lineTo(.28, .85); ctx.lineTo(.42, .89); ctx.lineTo(.58, .84); ctx.lineTo(.73, .86); ctx.lineTo(.87, .83); ctx.stroke();
      }
    });
    box(-2.1, 2.72, -4.91, 4.25, .10, .34, { top: '#34445d', left: '#111c30', right: '#202d43' });
    line(v(-4.18, 2.665, -4.73), v(-.02, 2.665, -4.73), '#22f0d0', 1.25);
    line(v(5.65, 3.9, -4.95), v(5.65, 3.9, 4.95), '#8b70ff', 2);
    rightArt(3.45, 3.45, 1.55, 3.4, () => { ctx.fillStyle = '#171c2d'; ctx.fillRect(0, 0, 1, 1); ctx.fillStyle = '#49345d'; ctx.fillRect(.07, .04, .86, .92); ctx.strokeStyle = '#22f0d0'; ctx.lineWidth = .025; ctx.strokeRect(.17, .12, .65, .76); ctx.fillStyle = '#22f0d0'; ctx.fillRect(.8, .48, .12, .035); });
  }
  function bed() {
    box(-2.7, .08, -1.75, 3.65, .55, 5.95, { top: '#171e31', left: '#090f1d', right: '#10172a' });
    box(-2.7, .63, -1.75, 3.54, .32, 5.84, { top: '#34466f', left: '#1a2949', right: '#27375c' });
    box(-2.7, .95, -1.06, 3.56, .12, 4.35, { top: '#293a60', left: '#172544', right: '#202f51' });
    plane(v(-4.48, 1.077, -3.235), v(3.56, 0, 0), v(0, 0, 4.35), () => { ctx.fillStyle = '#25365d'; ctx.fillRect(0, 0, 1, 1); for (let r = 0; r < 13; r++) { ctx.fillStyle = r % 2 ? '#314775' : '#1a2b50'; ctx.fillRect(0, r / 13, 1, 1 / 13 + .002); ctx.strokeStyle = '#6078a6'; ctx.lineWidth = .008; ctx.beginPath(); ctx.moveTo(0, r / 13); ctx.lineTo(1, r / 13); ctx.stroke(); } const g = ctx.createLinearGradient(0, 0, 1, 0); g.addColorStop(0, 'rgba(0,0,0,.18)'); g.addColorStop(.5, 'rgba(255,255,255,.03)'); g.addColorStop(1, 'rgba(0,0,0,.12)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 1, 1); });
    box(-2.7, .06, -4.76, 3.9, 1.65, .28, { top: '#242d43', left: '#101827', right: '#19243a' });
    line(v(-4.55, 1.12, -4.55), v(-.85, 1.12, -4.55), '#22f0d0', 1.5);
    for (const x of [-3.6, -1.83]) box(x, .95, -3.94, 1.62, .28, 1.12, { top: '#aebbd1', left: '#687b9c', right: '#899ab7' });
    box(-2.1, 1.09, -.7, 1.18, .06, .85, { top: '#141c2d', left: '#080e19', right: '#0d1524' }); box(-2.1, 1.15, -1.08, 1.18, .73, .045, { top: '#111b2c', left: '#070e19', right: '#0a1423' });
    front(-2.64, 1.81, -1.052, 1.06, .58, () => { ctx.fillStyle = '#06263d'; ctx.fillRect(0, 0, 1, 1); ctx.fillStyle = '#22f0d0'; for (let i = 0; i < 5; i++) ctx.fillRect(.1, .17 + i * .12, .35 + (i % 3) * .15, .025); });
    for (let r = 0; r < 4; r++) for (let c = 0; c < 10; c++) box(-2.57 + c * .105, 1.155, -.87 + r * .1, .075, .007, .055, c % 3 ? '#28d9e4' : '#9b7cff');
  }

  /* ---- The computer: monitor UI reacts to hover and to activation ---- */
  function drawMonitorUI() {
    ctx.fillStyle = '#061323'; ctx.fillRect(0, 0, 1, 1);
    ctx.fillStyle = '#0b2036'; ctx.fillRect(.018, .025, .964, .95);
    ctx.fillStyle = '#22f0d0'; ctx.fillRect(.055, .105, .025, .025);
    ctx.fillStyle = '#e2fff9'; ctx.font = 'bold .105px monospace'; ctx.textAlign = 'left'; ctx.fillText('KIAN', .105, .13);
    ctx.fillStyle = '#7795b0'; ctx.font = '.045px monospace'; ctx.fillText('WORKSTATION', .66, .13);
    ctx.fillStyle = '#1a4058'; ctx.fillRect(.055, .21, .89, .008);
    ctx.fillStyle = '#102b43'; ctx.fillRect(.055, .27, .89, .34);
    ctx.fillStyle = '#7f9bb5'; ctx.font = '.06px monospace'; ctx.fillText('SYSTEM STATUS', .095, .36);
    ctx.fillStyle = '#22f0d0'; ctx.font = 'bold .095px monospace'; ctx.fillText(hover ? 'CLICK TO ENTER' : 'SYSTEM ONLINE', .095, .47);
    ctx.strokeStyle = '#22f0d0'; ctx.lineWidth = .012; ctx.beginPath(); ctx.moveTo(.095, .55);
    for (let i = 0; i <= 44; i++) { const x = .095 + i * .018; const y = .55 + Math.sin(i * .42 + time * 1.25) * .035 + Math.sin(i * .91) * .012; ctx.lineTo(x, y); }
    ctx.stroke();
    const cards = [['CPU', '42%'], ['RAM', '68%'], ['NET', 'LIVE']];
    for (let i = 0; i < 3; i++) { const x = .055 + i * .305; ctx.fillStyle = '#10283d'; ctx.fillRect(x, .69, .275, .19); ctx.fillStyle = '#7894ad'; ctx.font = '.05px monospace'; ctx.fillText(cards[i][0], x + .025, .76); ctx.fillStyle = i === 1 ? '#a78bfa' : '#22f0d0'; ctx.font = 'bold .075px monospace'; ctx.fillText(cards[i][1], x + .025, .84); }
    ctx.strokeStyle = hover ? '#5ff5e0' : '#1a7182'; ctx.lineWidth = hover ? .014 : .008; ctx.strokeRect(.018, .025, .964, .95);
    ctx.fillStyle = '#a9fff0'; ctx.fillRect(.48, .94, .04, .012);
    if (hover && act === 0) { ctx.fillStyle = 'rgba(42,214,205,.07)'; ctx.fillRect(0, 0, 1, 1); }
    if (act > 0) {
      // Activation: power flicker → dark boot canvas → KLUIVERT OS mark and progress.
      const flick = Math.max(0, 1 - Math.abs(act - .12) / .12);
      // Same layout as the DOM boot screen (#boot) so the hand-off is seamless.
      ctx.globalAlpha = clamp(act * 1.6);
      const bg = ctx.createRadialGradient(.5, .45, 0, .5, .45, .75); bg.addColorStop(0, '#0F3238'); bg.addColorStop(.6, '#081E23'); bg.addColorStop(1, '#05161A');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, 1, 1);
      ctx.fillStyle = 'rgba(42,199,201,.05)';
      for (let x = .5 % .0306; x < 1; x += .0306) ctx.fillRect(x, 0, .0007, 1);
      for (let y = .5 % .0489; y < 1; y += .0489) ctx.fillRect(0, y, 1, .0011);
      ctx.globalAlpha = clamp((act - .3) / .5);
      ctx.strokeStyle = 'rgba(42,199,201,.5)'; ctx.lineWidth = .0012; ctx.fillStyle = 'rgba(24,183,160,.16)';
      ctx.fillRect(.478, .378, .044, .071); ctx.strokeRect(.478, .378, .044, .071);
      const k = innerHeight / innerWidth; // undo the unit-square stretch so type matches the DOM
      const T = (str, y, font, color, ls) => { ctx.save(); ctx.translate(.5, y); ctx.scale(k, 1); ctx.font = font; ctx.fillStyle = color; ctx.textAlign = 'center'; if (ls && 'letterSpacing' in ctx) ctx.letterSpacing = ls; ctx.fillText(str, 0, 0); ctx.restore(); };
      T('K', .427, '800 .031px "Segoe UI",Inter,Arial,sans-serif', '#2AC7C9');
      T('KLUIVERT OS', .53, '800 .053px "Segoe UI",Inter,Arial,sans-serif', '#E2F3F1', '.0106px');
      T('PERSONAL OPERATING ENVIRONMENT · v2.0', .567, '500 .0117px monospace', '#93B4B5', '.0037px');
      ctx.fillStyle = 'rgba(42,199,201,.14)'; ctx.fillRect(.32, .605, .36, .0024);
      ctx.textAlign = 'left'; ctx.globalAlpha = 1;
      if (flick > 0) { ctx.fillStyle = `rgba(190,255,245,${flick * .35})`; ctx.fillRect(0, 0, 1, 1); }
    }
  }
  function monitorFaces() {
    // Stand first, glass last: the screen is never covered by its own stand.
    box(.38, 2.21, 4.65, .68, .07, .48, { top: '#29374e', left: '#101827', right: '#1b2940' });
    box(.38, 2.32, 4.65, .14, .32, .13, { top: '#394b66', left: '#121d30', right: '#202d43' });
    box(.38, 2.5, 4.65, .82, .08, .55, { top: '#202d43', left: '#0b1321', right: '#131e30' });
    front(-1.05, 3.72, 4.765, 2.86, 1.12, drawMonitorUI);
    plane(v(1.81, 3.72, 4.565), v(-2.86, 0, 0), v(0, -1.12, 0), () => { ctx.save(); ctx.translate(1, 0); ctx.scale(-1, 1); drawMonitorUI(); ctx.restore(); });
    box(.51, 2.565, 4.93, .055, .018, .025, { top: '#22f0d0', left: '#22f0d0', right: '#22f0d0' });
  }
  function fanPanel() { front(-3.03, 3.5, 4.73, .7, 1.5, () => { ctx.fillStyle = '#091a2b'; ctx.fillRect(0, 0, 1, 1); for (const cy of [.26, .7]) { ctx.save(); ctx.translate(.5, cy); ctx.scale(1, .42); ctx.rotate(time); ctx.strokeStyle = '#22f0d0'; ctx.lineWidth = .045; ctx.beginPath(); ctx.arc(0, 0, .34, 0, 7); ctx.stroke(); for (let k = 0; k < 5; k++) { ctx.rotate(1.2566); ctx.fillStyle = '#2b9fb0'; ctx.fillRect(.05, 0, .22, .08); } ctx.restore(); } }); }
  function deskTail() {
    line(v(2.7, 1.87, 4.45), v(2.7, 2.7, 4.3), '#a78bfa', 4); line(v(2.7, 2.7, 4.3), v(2.0, 3.05, 3.65), '#a78bfa', 4); line(v(2, 3.05, 3.65), v(1.55, 2.73, 3.1), '#22f0d0', 4);
    box(1.55, 2.43, 3.1, .28, .46, .33, { top: '#202b42', left: '#0c1424', right: '#131e32' });
    box(2.45, 1.88, 3.45, .45, .32, .4, { top: '#aebbd1', left: '#64728b', right: '#899ab7' });
  }
  function desk() {
    for (const x of [-2.8, 2.8]) box(x, 0, 3.95, .16, 1.7, 1.8, { top: '#111a2a', left: '#070d18', right: '#0b1321' });
    box(0, 1.7, 3.95, 6.15, .16, 2.05, { top: '#151d30', left: '#090f1b', right: '#10182a' });
    line(v(-3.07, 1.72, 4.99), v(3.07, 1.72, 4.99), '#22f0d0', 2);
    box(.1, 1.87, 3.65, 3.9, .025, .9, '#0a1727');
    box(.1, 1.9, 3.55, 2.2, .07, .57, '#111b2d');
    for (let r = 0; r < 4; r++) for (let c = 0; c < 14; c++) box(-.9 + c * .15, 1.975, 3.33 + r * .13, .11, .01, .08, (r + c) % 4 === 0 ? '#a78bfa' : '#29dce5');
    box(1.55, 1.91, 3.58, .32, .13, .45, { top: '#aebbd1', left: '#64728b', right: '#899ab7' });
    box(0, 1.88, 4.55, 1.12, .09, .62, { top: '#202b40', left: '#080e19', right: '#111a2b' });
    box(0, 2.02, 4.65, .18, .42, .16, { top: '#34445d', left: '#101827', right: '#1a263b' });
    box(.38, 2.58, 4.65, 3.05, 1.36, .16, { top: '#151f32', left: '#070d18', right: '#0c1525' });
    box(.38, 2.58, 4.744, 2.86, 1.17, .025, { top: '#050c17', left: '#050c17', right: '#050c17' });
    monitorFaces();
    box(-2.72, 1.87, 4.05, .82, 1.78, 1.38, { top: '#141e31', left: '#080e19', right: '#0b1423' });
    fanPanel(); deskTail();
  }
  function chair() {
    box(0, .1, 1.85, 1.7, .12, .16, { top: '#28334d', left: '#0a1020', right: '#171f34' }); box(0, .1, 1.85, .16, .12, 1.55, '#111827'); box(0, .2, 1.85, .15, .7, .15, '#202b42');
    box(0, .9, 1.9, 1.6, .26, 1.55, { top: '#303f65', left: '#111a2e', right: '#202d4c' });
    box(0, 1.05, 1.18, 1.6, 1.65, .24, { top: '#1b2947', left: '#0b1222', right: '#111d36' }); box(0, 2.68, 1.18, 1.14, .28, .24, '#25365c');
    for (const x of [-.7, .7]) box(x, 1.15, 1.31, .17, 1.45, .07, '#5c6d91');
    box(0, 2.48, 1.32, .68, .19, .08, '#22f0d0');
    for (const x of [-.92, .92]) { box(x, 1.14, 1.85, .1, .38, .1, '#18243b'); box(x, 1.5, 1.85, .22, .12, .83, '#34466f'); }
  }
  function storage() {
    box(5.02, 0, -3.3, 1.28, 2.15, 3.1, { top: '#202b42', left: '#0b1220', right: '#111a2d' });
    for (let i = 0; i < 4; i++) { line(v(4.36, .42 + i * .43, -4.79), v(4.36, .42 + i * .43, -1.82), '#53627e', 1); line(v(4.35, .58 + i * .43, -3.55), v(4.35, .58 + i * .43, -3.05), '#22f0d0', 2); }
    for (let level = 0; level < 2; level++) {
      box(5.24, 2.95 + level * .92, -3.3, .93, .1, 3.3, { top: '#c4c8d8', left: '#7c88a2', right: '#a5aec5' });
      line(v(4.7, 3.02 + level * .92, -4.9), v(5.72, 3.02 + level * .92, -1.7), '#22f0d0', 1.4);
      for (let i = 0; i < 8; i++) box(5.24, 3.05 + level * .92, -4.55 + i * .29, .58, .53 + (i % 3) * .14, .17, ['#164e70', '#a78bfa', '#d4dae8', '#2d8997'][i % 4]);
    }
    box(4.99, 0, -.55, 1.3, 1.65, 1.8, { top: '#252f48', left: '#0b1220', right: '#141d32' });
    for (let row = 0; row < 3; row++) { box(4.95, .22 + row * .44, -.55, 1.28, .06, 1.76, '#3b4866'); for (let k = 0; k < 2; k++) box(4.65, .3 + row * .44, -1.02 + k * .8, .66, .18, .36, '#899ab7'); }
    box(4.92, 1.65, -.55, .8, .55, 1.0, { top: '#66c5e5', left: '#397aab', right: '#4e9dc6' }); box(4.48, 1.7, -.55, .08, .28, .61, '#d9e8f4'); box(4.85, 2.2, -.55, .21, .19, .27, '#66c5e5');
  }
  // Practical light pools (screen blend) — window moonlight and desk lamp.
  function pool(pt, r, rgba) { const c = p(pt); const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r); g.addColorStop(0, rgba); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(c.x - r, c.y - r, r * 2, r * 2); }
  function drawStatic() {
    floor();
    const objects = [{ x: -2.7, z: -1.75, f: bed }, { x: 5.02, z: -2.2, f: storage }, { x: 0, z: 1.85, f: chair }, { x: 0, z: 3.95, f: desk }];
    objects.sort((a, b) => (a.x - b.x) * Math.sin(yaw) + (a.z - b.z) * Math.cos(yaw)).forEach(o => o.f());
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    pool(v(-4.6, .2, 3.2), s * 3.6, 'rgba(70,110,255,.10)');
    pool(v(2.45, 2.3, 3.45), s * 2.2, 'rgba(170,160,255,.10)');
    ctx.restore();
  }
  // Dynamic monitor light: grows with hover and activation.
  function glow() {
    const c = p(v(.38, 2.6, 4.6)), r = s * (3.6 + act * 2.4), a = .10 + (hover ? .07 : 0) + act * .26;
    const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r); g.addColorStop(0, `rgba(42,214,205,${a})`); g.addColorStop(.5, `rgba(42,214,205,${a * .35})`); g.addColorStop(1, 'rgba(42,214,205,0)');
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = g; ctx.fillRect(c.x - r, c.y - r, r * 2, r * 2); ctx.restore();
  }

  /* ---- Camera (dolly toward the monitor) ---- */
  const MON = { c: v(.38, 3.16, 4.565), TL: v(-1.05, 3.72, 4.565), TR: v(1.81, 3.72, 4.565), BL: v(-1.05, 2.6, 4.565), F: [v(-1.05, 3.72, 4.765), v(1.81, 3.72, 4.765), v(1.81, 2.6, 4.765), v(-1.05, 2.6, 4.765)] };
  function monCenter() { const q = p(MON.c); return { x: q.x + fx, y: q.y + fy }; }
  function focusPoint() { const M = monCenter(); return { x: lerp(w / 2, M.x, fk), y: lerp(h / 2, M.y, fk) }; }
  function toScreen(pt) { const q = p(pt), F = focusPoint(); return { x: (q.x + fx - F.x) * zoom + w / 2, y: (q.y + fy - F.y) * zoom + h / 2 }; }
  function quadNow() { return { TL: toScreen(MON.TL), TR: toScreen(MON.TR), BL: toScreen(MON.BL) }; }
  function targetZoom() { const a = p(MON.TL), b = p(MON.TR), c = p(MON.BL); const qw = Math.hypot(b.x - a.x, b.y - a.y), qh = Math.hypot(c.x - a.x, c.y - a.y); return clamp(Math.min(w * .6 / qw, h * .6 / qh), 1.4, 8); }
  function hitMonitor(x, y) {
    const pts = [MON.TL, MON.TR, MON.BL, v(1.81, 2.6, 4.565), ...MON.F].map(toScreen);
    const pad = coarse.matches ? 18 : 8;
    const xs = pts.map(q => q.x), ys = pts.map(q => q.y);
    return x >= Math.min(...xs) - pad && x <= Math.max(...xs) + pad && y >= Math.min(...ys) - pad && y <= Math.max(...ys) + pad;
  }

  /* ---- Rendering ---- */
  const layer = document.createElement('canvas'); let layerKey = '';
  function ensureLayer() {
    const key = [canvas.width, canvas.height, yaw.toFixed(4)].join(':'); if (key === layerKey) return;
    layerKey = key; layer.width = canvas.width; layer.height = canvas.height;
    const main = ctx, t0 = time, h0 = hover, a0 = act; ctx = layer.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    time = 0; hover = false; act = 0; drawStatic(); time = t0; hover = h0; act = a0; ctx = main;
  }
  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    const settled = Math.abs(target - yaw) < .0006;
    if (settled) yaw = target;
    const live = zoom > 1.0005 || !settled;
    ctx.save();
    if (zoom > 1.0005) { const F = focusPoint(); ctx.translate(w / 2, h / 2); ctx.scale(zoom, zoom); ctx.translate(-F.x, -F.y); }
    ctx.translate(fx, fy);
    if (!live) { ensureLayer(); ctx.drawImage(layer, 0, 0, w, h); monitorFaces(); fanPanel(); deskTail(); }
    else drawStatic();
    glow();
    ctx.restore();
    if (act > 0) { // the room dims around the activating screen
      const M = toScreen(MON.c), r0 = Math.min(w, h) * .3, r1 = Math.max(w, h) * .85;
      const g = ctx.createRadialGradient(M.x, M.y, r0, M.x, M.y, r1); g.addColorStop(0, 'rgba(3,10,13,0)'); g.addColorStop(1, `rgba(3,10,13,${.65 * act})`); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    if (!reduced() && zoom < 1.05) for (let i = 0; i < 17; i++) {
      const x = w * (.12 + ((i * 37) % 79) / 100), y = h * (.15 + ((i * 23) % 71) / 100) - Math.sin(time * .5 + i) * 7;
      ctx.fillStyle = `rgba(88,244,217,${.08 + Math.sin(time + i) ** 2 * .16})`; ctx.beginPath(); ctx.arc(x, y, i % 3 === 0 ? 1.5 : 1, 0, 7); ctx.fill();
    }
    placeHint();
  }
  let hintOk = true;
  function placeHint() {
    const show = hintOk && !paused && !anim && zoom < 1.01 && act === 0;
    hint.classList.toggle('show', show); hint.classList.toggle('hot', hover);
    if (!show) return;
    const q = toScreen(v(.38, 4.05, 4.6));
    hint.style.transform = `translate(${q.x.toFixed(1)}px,${q.y.toFixed(1)}px) translate(-50%,calc(-100% - 20px))`;
  }

  /* ---- Loop ---- */
  function wake() { if (!raf && !document.hidden) raf = requestAnimationFrame(frame); }
  function frame(now) {
    raf = 0; if (document.hidden) return;
    const minStep = anim ? 0 : 1000 / 30;
    if (now - last >= minStep) {
      const dt = Math.min((now - last) / 1000, .1); last = now; time += dt;
      if (anim) stepAnim(now);
      if (!frozen) {
        yaw += (target - yaw) * Math.min(1, dt * 5);
        if (!reduced()) { fx = Math.sin(time * .38) * 2.5; fy = Math.sin(time * .62) * 5.5; }
      }
      render();
    }
    const idle = reduced() && !anim && Math.abs(target - yaw) < .0006;
    if (anim || (!paused && !idle)) raf = requestAnimationFrame(frame);
  }
  function stepAnim(now) {
    const a = anim, t = clamp((now - a.t0) / a.ms), e = easeIO(t);
    zoom = lerp(a.from.zoom, a.to.zoom, e); fk = lerp(a.from.fk, a.to.fk, e);
    act = a.to.act > a.from.act ? lerp(a.from.act, a.to.act, ease((t - .42) / .58)) : lerp(a.from.act, a.to.act, ease(t / .45));
    if (t >= 1) { anim = null; a.res(); }
  }
  function run(to, ms) {
    return new Promise(res => {
      anim = { t0: performance.now(), ms, from: { zoom, fk, act }, to, res };
      const mine = anim; setTimeout(() => { if (anim === mine) { stepAnim(performance.now() + ms); render(); } }, ms + 500);
      wake();
    });
  }
  function resize() {
    const r = view.getBoundingClientRect(); if (!r.width || !r.height) return;
    w = r.width; h = r.height; dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const portrait = h > w * 1.1;
    s = portrait ? Math.min(w / 19.4, h / 15) : Math.min(w / 19.2, h / 13.6);
    cy0 = portrait ? .5 : .57;
    layerKey = ''; render();
  }

  /* ---- Input ---- */
  function setHover(v2) { if (v2 === hover) return; hover = v2; view.classList.toggle('hover-mon', v2); render(); }
  canvas.addEventListener('pointerdown', e => { if (e.button !== 0 || frozen) return; down = { x: e.clientX, y: e.clientY, yaw: target, moved: false, id: e.pointerId }; });
  canvas.addEventListener('pointermove', e => {
    if (frozen) return;
    const r = canvas.getBoundingClientRect();
    if (down) {
      const dx = e.clientX - down.x;
      if (!down.moved && Math.hypot(dx, e.clientY - down.y) > 6) { down.moved = true; try { canvas.setPointerCapture(down.id); } catch (_) {} setHover(false); }
      if (down.moved) { target = clamp(down.yaw + dx * .002, .35, 1.08); wake(); }
      return;
    }
    if (e.pointerType === 'mouse') setHover(hitMonitor(e.clientX - r.left, e.clientY - r.top));
  });
  ['pointerup', 'pointercancel'].forEach(ev => canvas.addEventListener(ev, e => {
    if (!down) return; const moved = down.moved; down = null; if (moved || frozen) return;
    const r = canvas.getBoundingClientRect();
    if (hitMonitor(e.clientX - r.left, e.clientY - r.top)) onMonitorCb();
  }));
  canvas.addEventListener('pointerleave', () => setHover(false));
  canvas.addEventListener('keydown', e => {
    if (frozen) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); target = clamp(target + (e.key === 'ArrowLeft' ? -.08 : .08), .35, 1.08); wake(); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onMonitorCb(); }
  });
  document.addEventListener('visibilitychange', () => { cancelAnimationFrame(raf); raf = 0; if (!document.hidden) { last = performance.now(); wake(); } });
  RM.addEventListener && RM.addEventListener('change', wake);

  return {
    start() {
      hintText.textContent = coarse.matches ? 'TAP THE MONITOR' : 'CLICK THE MONITOR';
      if ('ResizeObserver' in window) new ResizeObserver(resize).observe(view); else addEventListener('resize', resize);
      resize(); last = performance.now(); wake();
      view.addEventListener('animationend', () => view.classList.remove('intro'));
    },
    playIntro() { view.classList.remove('intro'); void view.offsetWidth; view.classList.add('intro'); },
    onMonitor(cb) { onMonitorCb = cb; },
    async enter() {
      frozen = true; down = null; setHover(false); hintOk = false;
      if (reduced()) { await run({ zoom: 1, fk: 0, act: 1 }, 750); return null; }  // light only, no camera travel
      await run({ zoom: targetZoom(), fk: 1, act: 1 }, 1400);
      return quadNow();
    },
    async exit() {
      paused = false; wake();
      await run({ zoom: 1, fk: 0, act: 0 }, reduced() ? 500 : 1050);
      frozen = false; hintOk = true; render(); wake();
    },
    snapFocused() { frozen = true; hintOk = false; zoom = targetZoom(); fk = 1; act = 1; render(); },
    pause() { paused = true; cancelAnimationFrame(raf); raf = 0; hint.classList.remove('show'); },
    resume() { paused = false; last = performance.now(); wake(); },
  };
})();

/* =======================================================================
   BOOT — the monitor surface expands to fill the screen, then KLUIVERT OS
   ======================================================================= */
const Boot = (() => {
  const el = $('#boot'), fill = $('#boot-fill'), pct = $('#boot-pct'), lineEl = $('#boot-line'), view = $('#view');
  const setP = p => { fill.style.setProperty('--p', p); pct.textContent = String(Math.round(p * 100)).padStart(2, '0') + '%'; };
  const apply = m => { el.style.transform = `matrix(${m.map(n => n.toFixed(5)).join(',')})`; };
  function fromQuad(q) { const W = innerWidth, H = innerHeight; return [(q.TR.x - q.TL.x) / W, (q.TR.y - q.TL.y) / W, (q.BL.x - q.TL.x) / H, (q.BL.y - q.TL.y) / H, q.TL.x, q.TL.y]; }
  return {
    el,
    async expand(quad) {
      const m0 = fromQuad(quad), I = [1, 0, 0, 1, 0, 0];
      setP(0); lineEl.textContent = 'Initialising';
      el.classList.remove('fade'); el.style.opacity = '0'; apply(m0); el.hidden = false;
      await animate(260, t => { el.style.opacity = String(t); });     // dissolve onto the monitor glass
      view.classList.add('entering');                                    // the room falls out of focus
      await animate(850, t => apply(m0.map((v, i) => lerp(v, I[i], easeIO(t)))));  // the screen fills the view
      el.style.transform = 'none';
    },
    async dissolveIn() { // reduced-motion entrance: the screen glow becomes the boot screen
      setP(0); lineEl.textContent = 'Initialising'; el.classList.remove('fade'); el.style.transform = 'none'; el.style.opacity = '0'; el.hidden = false; view.classList.add('entering');
      await animate(450, t => { el.style.opacity = String(t); }, true);
    },
    async run(short) {
      const steps = short ? [['Restoring session', 1]] : [['Mounting /home/kluivert', .34], ['Loading modules · systems · networks · creativity', .72], ['Starting desktop session', 1]];
      let p = 0;
      for (const [label, to] of steps) { lineEl.textContent = label; const from = p; await animate(short ? 380 : 340, t => setP(lerp(from, to, ease(t))), true); p = to; }
      await wait(160);
    },
    async hide() { await animate(480, t => { el.style.opacity = String(1 - t); }, true); el.hidden = true; el.style.opacity = ''; el.style.transform = ''; },
  };
})();

/* =======================================================================
   KLUIVERT OS — desktop, windows, taskbar
   ======================================================================= */
const OS = (() => {
  const osEl = $('#os'), winsEl = $('#os-wins'), runEl = $('#os-running'), menu = $('#os-menu'), startBtn = $('#os-start'), roomEl = $('#room'), view = $('#view');
  const wins = new Map(); let z = 10, isOpen = false, opening = null, cascade = 0, booted = false;
  try { booted = sessionStorage.getItem('kos-booted') === '1'; } catch (_) {}

  $('#os-icons').innerHTML = ORDER.map((k, i) => `<button class="os-icon" type="button" data-route="${k}" style="--i:${i}"><span class="glyph"><svg class="i"><use href="#${APPS[k].icon}"/></svg></span>${APPS[k].title}</button>`).join('')
    + `<button class="os-icon" type="button" data-route="lab" style="--i:${ORDER.length}"><span class="glyph"><svg class="i"><use href="#i-room"/></svg></span>Kian's Room</button>`;
  menu.innerHTML = `<header><strong>KLUIVERT OS</strong><span>v2.0 · PERSONAL ENVIRONMENT</span></header>`
    + ORDER.map(k => `<button type="button" role="menuitem" data-route="${k}"><svg class="i"><use href="#${APPS[k].icon}"/></svg>${APPS[k].title}</button>`).join('')
    + `<hr><button type="button" role="menuitem" data-motion title="Animated desktop and playful idle icons. Auto follows your system's reduce-motion setting."><svg class="i"><use href="#i-spark"/></svg>Living desktop<b></b></button>`
    + `<hr><button type="button" role="menuitem" data-route="lab"><svg class="i"><use href="#i-room"/></svg>Leave desk · Kian's Room</button>`;
  function toggleMenu(force) { const show = force ?? menu.hidden; menu.hidden = !show; startBtn.setAttribute('aria-expanded', String(show)); if (show) menu.querySelector('button').focus(); }
  startBtn.addEventListener('click', e => { e.stopPropagation(); toggleMenu(); });
  document.addEventListener('click', e => { if (!menu.hidden && !e.target.closest('#os-menu,#os-start')) toggleMenu(false); });
  const motionLabel = () => { menu.querySelector('[data-motion] b').textContent = { auto: Motion.on() ? 'AUTO · ON' : 'AUTO · OFF', on: 'ON', off: 'OFF' }[Motion.pref]; };
  motionLabel(); Motion.sub(motionLabel);
  menu.addEventListener('click', e => {
    if (e.target.closest('[data-motion]')) { const o = ['auto', 'on', 'off']; Motion.set(o[(o.indexOf(Motion.pref) + 1) % 3]); toast('Living desktop: ' + menu.querySelector('[data-motion] b').textContent); }
    toggleMenu(false);
  });

  function tick() {
    const d = new Date(), t = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    $('#wg-clock').textContent = t; $('#tray-clock').textContent = t;
    $('#wg-date').textContent = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  tick(); setInterval(tick, 15000);

  function reveal() { osEl.classList.remove('reveal'); void osEl.offsetWidth; osEl.classList.add('reveal'); }
  let coverT = 0;   // once the opaque desktop is up, the room behind it stops being painted
  async function open({ cinematic }) {
    if (isOpen) return opening || undefined;
    isOpen = true; roomEl.classList.add('os-open'); toggleMenu(false);
    opening = (async () => {
      const short = booted; booted = true; try { sessionStorage.setItem('kos-booted', '1'); } catch (_) {}
      if (cinematic && !reduced()) { const quad = await Room.enter(); await Boot.expand(quad); await Boot.run(short); }
      else if (cinematic) { await Room.enter(); await Boot.dissolveIn(); await Boot.run(short); }
      else { Room.snapFocused(); view.classList.add('entering'); }
      osEl.classList.add('on'); osEl.setAttribute('aria-hidden', 'false'); reveal();
      Room.pause();
      if (!Boot.el.hidden) await Boot.hide();
      coverT = setTimeout(() => { if (isOpen) roomEl.classList.add('os-covered'); }, reduced() ? 40 : 520);
      Desk.active(true);
    })();
    await opening; opening = null;
  }
  async function close() {
    if (!isOpen) return; if (opening) await opening;
    clearTimeout(coverT); roomEl.classList.remove('os-covered');
    isOpen = false; toggleMenu(false); Desk.active(false);
    [...wins.keys()].forEach(k => destroy(k, true));
    osEl.classList.remove('on'); osEl.setAttribute('aria-hidden', 'true');
    roomEl.classList.remove('os-open'); view.classList.remove('entering');
    await wait(reduced() ? 0 : 200);
    await Room.exit();
    $('#room-canvas').focus({ preventScroll: true });
  }

  /* ---- Windows ---- */
  function topApp() { let best = null, bz = -1; wins.forEach((w, k) => { if (!w.el.classList.contains('min') && +w.el.style.zIndex > bz) { bz = +w.el.style.zIndex; best = k; } }); return best; }
  const taskBtn = k => runEl.querySelector(`[data-task="${k}"]`);
  function renderTasks() {
    const act = topApp();
    [...runEl.children].forEach(b => { if (!wins.has(b.dataset.task)) b.remove(); });
    wins.forEach((w, k) => {
      let b = taskBtn(k);
      if (!b) { b = document.createElement('button'); b.className = 'task new'; b.type = 'button'; b.dataset.task = k; b.innerHTML = `<svg class="i"><use href="#${APPS[k].icon}"/></svg>${APPS[k].title}`; b.addEventListener('animationend', () => b.classList.remove('new', 'flash')); runEl.append(b); }
      b.classList.toggle('active', k === act); b.classList.toggle('min', w.el.classList.contains('min'));
      w.el.classList.toggle('active', k === act);
    });
    $$('#os-icons .os-icon').forEach(i => i.classList.toggle('open', wins.has(i.dataset.route)));
    let cover = false; wins.forEach(w => { if (w.el.classList.contains('max') && !w.el.classList.contains('min')) cover = true; });
    osEl.classList.toggle('covered', cover);   // a maximized window hides the desktop
    let shown = 0; wins.forEach(w => { if (!w.el.classList.contains('min')) shown++; });
    Desk.windows(shown);   // continuous background motion only plays on an empty desktop
  }
  const flash = k => { const b = taskBtn(k); if (b) { b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash'); } };
  // Animates a window between its own box and another box (a taskbar button or a desktop icon).
  function fly(el, box, toBox, ms) {
    const a = el.getBoundingClientRect(); if (!a.width || !box.width) return null;
    const far = { transformOrigin: '0 0', opacity: .15, transform: `translate(${box.left - a.left}px,${box.top - a.top}px) scale(${box.width / a.width},${box.height / a.height})` }, home = { transformOrigin: '0 0', opacity: 1, transform: 'none' };
    return el.animate(toBox ? [home, far] : [far, home], { duration: ms, easing: toBox ? 'cubic-bezier(.4,0,.7,.2)' : 'cubic-bezier(.2,.8,.2,1)' });
  }
  runEl.addEventListener('click', e => {
    const b = e.target.closest('[data-task]'); if (!b) return; const k = b.dataset.task, w = wins.get(k);
    if (w.el.classList.contains('min')) { focus(k); Router.set(k, true); }
    else if (k === topApp()) minimize(k);
    else { focus(k); Router.set(k, true); flash(k); }
  });
  function focus(k) {
    const w = wins.get(k); if (!w) return; const wasMin = w.el.classList.contains('min');
    w.el.style.zIndex = ++z; w.el.classList.remove('min'); renderTasks();
    if (wasMin) { flash(k); const b = taskBtn(k); if (b && Motion.on()) fly(w.el, b.getBoundingClientRect(), false, 280); }
  }
  function minimize(k) {
    const w = wins.get(k); if (!w || w.el.classList.contains('min') || w.el.classList.contains('flying')) return;
    const done = () => { w.el.classList.remove('flying'); w.el.classList.add('min'); renderTasks(); flash(k); Router.set(topApp() || 'os', true); };
    const b = taskBtn(k), an = b && Motion.on() ? fly(w.el, b.getBoundingClientRect(), true, 240) : null;
    if (!an) return done();
    w.el.classList.add('flying'); an.onfinish = done;
  }
  function destroy(k, silent) {
    const w = wins.get(k); if (!w) return; wins.delete(k);
    const iframe = w.el.querySelector('iframe'); if (iframe) iframe.src = 'about:blank';
    if (silent || reduced()) w.el.remove(); else { w.el.classList.add('closing'); w.el.addEventListener('animationend', () => w.el.remove(), { once: true }); }
    renderTasks();
    if (!silent) { const t = topApp(); Router.set(t || 'os', true); if (t) focus(t); }
  }
  let launch = null;   // the desktop icon that was just clicked, so its window can grow out of it
  document.addEventListener('click', e => { const i = e.target.closest && e.target.closest('#os-icons .os-icon'); if (i) launch = { k: i.dataset.route, box: i.querySelector('.glyph').getBoundingClientRect(), t: performance.now() }; }, true);
  function create(k) {
    const app = APPS[k], tpl = $('#tpl-' + k);
    const el = document.createElement('article'); el.className = 'win'; el.dataset.app = k;
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-labelledby', 'wt-' + k);
    el.innerHTML = `<header class="win-bar"><svg class="i"><use href="#${app.icon}"/></svg><h2 class="win-title" id="wt-${k}">${app.title}</h2><span class="win-path">${app.path || 'KMP://' + k.toUpperCase()}</span><div class="win-ctl"><button type="button" data-act="min" aria-label="Minimize ${app.title}"><svg class="i"><use href="#i-min"/></svg></button><button type="button" data-act="max" aria-label="Maximize ${app.title}"><svg class="i"><use href="#i-max"/></svg></button><button type="button" data-act="close" aria-label="Close ${app.title}"><svg class="i"><use href="#i-close"/></svg></button></div></header><div class="win-body" tabindex="-1"><i class="win-progress"></i></div>` + ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].map(d => `<i class="win-rs" data-rs="${d}" aria-hidden="true"></i>`).join('');
    const body = el.querySelector('.win-body');
    body.append(tpl.content.cloneNode(true));
    if (app.bare) el.classList.add('bare');
    const footHost = body.querySelector('.ax-main') || (app.bare ? null : body);   // app shells keep the footer inside their own scroller
    if (k !== 'arcade' && footHost) footHost.insertAdjacentHTML('beforeend', `<div class="pg"><footer class="pg-foot"><div><b>KLUIVERT<span>.</span></b><div style="margin-top:8px">© 2026 Kluivert Manuel Peralta Carrera</div></div><div style="text-align:right">Personal Portfolio<br>Systems <em>•</em> Networks <em>•</em> Technology</div></footer></div>`);
    const area = winsEl.getBoundingClientRect();
    const w = Math.min(app.w, area.width - 40), h = Math.min(app.h, area.height - 40), off = (cascade++ % 6) * 28;
    el.style.width = w + 'px'; el.style.height = h + 'px';
    el.style.left = clamp((area.width - w) / 2 + off - 60, 10, Math.max(10, area.width - w - 10)) + 'px';
    el.style.top = clamp((area.height - h) / 2 + off - 40, 10, Math.max(10, area.height - h - 10)) + 'px';
    if (isSmall() || area.width < 400) el.dataset.fit = '1';   // opened full-screen: take the normal size when the screen grows
    const from = launch && launch.k === k && performance.now() - launch.t < 1500 && Motion.on() ? launch.box : null; launch = null;
    winsEl.append(el); wins.set(k, { el });
    wire(el, k); hydrate(k, body);
    if (from) fly(el, from, false, 340);
  }
  // Keep windows usable when the screen size changes (e.g. a phone rotated, or a browser window widened).
  function fitWindows() {
    if (isSmall()) return; const area = winsEl.getBoundingClientRect(); if (area.width < 400) return;
    wins.forEach(({ el }, k) => {
      if (el.classList.contains('max')) return;
      let w = el.offsetWidth, h = el.offsetHeight, l = el.offsetLeft, t = el.offsetTop;
      if (el.dataset.fit) { w = Math.min(APPS[k].w, area.width - 40); h = Math.min(APPS[k].h, area.height - 40); l = (area.width - w) / 2; t = (area.height - h) / 2; delete el.dataset.fit; }
      else { w = Math.min(w, area.width); h = Math.min(h, area.height); }
      el.style.width = w + 'px'; el.style.height = h + 'px';
      el.style.left = clamp(l, 0, Math.max(0, area.width - w)) + 'px'; el.style.top = clamp(t, 0, Math.max(0, area.height - h)) + 'px';
    });
  }
  let fitT = 0; addEventListener('resize', () => { clearTimeout(fitT); fitT = setTimeout(fitWindows, 150); });
  function openApp(k) {
    if (!APPS[k]) return;
    if (!wins.has(k)) create(k);
    focus(k);
    const body = wins.get(k).el.querySelector('.win-body');
    requestAnimationFrame(() => body.focus({ preventScroll: true }));
  }
  function wire(el, k) {
    const bar = el.querySelector('.win-bar'), body = el.querySelector('.win-body');
    el.addEventListener('pointerdown', () => { if (k !== topApp()) { focus(k); Router.set(k, true); } }, true);
    const maxBtn = el.querySelector('[data-act="max"]'), maxUse = maxBtn.querySelector('use'), title = APPS[k].title;
    function setMax(on, animate = true) {
      if (on === el.classList.contains('max') || (on && isSmall())) return;
      const first = el.getBoundingClientRect();
      el.classList.toggle('max', on); renderTasks();
      maxUse.setAttribute('href', on ? '#i-restore' : '#i-max'); maxBtn.setAttribute('aria-label', (on ? 'Restore ' : 'Maximize ') + title);
      if (animate && Motion.on()) fly(el, first, false, 260);   // restore returns to the size and place saved in left/top/width/height
    }
    el.querySelector('.win-ctl').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return; const a = b.dataset.act;
      if (a === 'close') destroy(k); else if (a === 'min') minimize(k); else if (a === 'max') setMax(!el.classList.contains('max'));
    });
    bar.addEventListener('dblclick', e => { if (!e.target.closest('button')) setMax(!el.classList.contains('max')); });
    // Dragging moves a compositor layer and stays inside the desktop; left/top are written on release.
    let d = null, dragRaf = 0, nx = 0, ny = 0;
    const paintDrag = () => { dragRaf = 0; if (d && !d.fromMax) el.style.transform = `translate3d(${nx - d.l}px,${ny - d.t}px,0)`; };
    const startDrag = (x, y, area) => { d = { x, y, l: el.offsetLeft, t: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight, aw: area.width, ah: area.height }; nx = d.l; ny = d.t; el.classList.add('dragging'); };
    bar.addEventListener('pointerdown', e => {
      if (e.button !== 0 || e.target.closest('button') || isSmall()) return;
      bar.setPointerCapture(e.pointerId);
      if (el.classList.contains('max')) { d = { fromMax: true, x: e.clientX, y: e.clientY }; return; }   // dragging a maximized window restores it
      startDrag(e.clientX, e.clientY, winsEl.getBoundingClientRect());
    });
    bar.addEventListener('pointermove', e => {
      if (!d) return;
      if (d.fromMax) {
        if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8) return;
        const area = winsEl.getBoundingClientRect(), ratio = (e.clientX - area.left) / area.width;
        setMax(false, false);
        el.style.left = clamp(e.clientX - area.left - ratio * el.offsetWidth, 0, Math.max(0, area.width - el.offsetWidth)) + 'px'; el.style.top = '0px';
        startDrag(e.clientX, e.clientY, area);
      }
      nx = clamp(d.l + e.clientX - d.x, 0, Math.max(0, d.aw - d.w)); ny = clamp(d.t + e.clientY - d.y, 0, Math.max(0, d.ah - Math.min(d.h, d.ah)));
      if (!dragRaf) dragRaf = requestAnimationFrame(paintDrag);
    });
    ['pointerup', 'pointercancel'].forEach(ev => bar.addEventListener(ev, () => { if (!d) return; cancelAnimationFrame(dragRaf); dragRaf = 0; if (!d.fromMax) { el.style.left = nx + 'px'; el.style.top = ny + 'px'; el.style.transform = ''; } el.classList.remove('dragging'); d = null; }));
    // Resizing from the edges and corners: at most one layout per frame, never smaller than usable or larger than the desktop.
    const MIN_W = 360, MIN_H = 260; let rs = null, rsRaf = 0, rx = 0, ry = 0;
    const paintResize = () => {
      rsRaf = 0; if (!rs) return; const dx = rx - rs.x, dy = ry - rs.y, dir = rs.dir, minW = Math.min(MIN_W, rs.aw), minH = Math.min(MIN_H, rs.ah);
      let l = rs.l, t = rs.t, w = rs.w, h = rs.h;
      if (dir.includes('e')) w = clamp(rs.w + dx, minW, rs.aw - rs.l);
      if (dir.includes('s')) h = clamp(rs.h + dy, minH, rs.ah - rs.t);
      if (dir.includes('w')) { const right = rs.l + rs.w; l = clamp(rs.l + dx, 0, right - minW); w = right - l; }
      if (dir.includes('n')) { const bottom = rs.t + rs.h; t = clamp(rs.t + dy, 0, bottom - minH); h = bottom - t; }
      el.style.left = l + 'px'; el.style.top = t + 'px'; el.style.width = w + 'px'; el.style.height = h + 'px';
    };
    el.querySelectorAll('.win-rs').forEach(hd => {
      hd.addEventListener('pointerdown', e => {
        if (e.button !== 0 || isSmall() || el.classList.contains('max')) return; e.preventDefault();
        const area = winsEl.getBoundingClientRect(); rs = { dir: hd.dataset.rs, x: e.clientX, y: e.clientY, l: el.offsetLeft, t: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight, aw: area.width, ah: area.height }; rx = e.clientX; ry = e.clientY;
        el.classList.add('resizing'); hd.setPointerCapture(e.pointerId);
      });
      hd.addEventListener('pointermove', e => { if (!rs) return; rx = e.clientX; ry = e.clientY; if (!rsRaf) rsRaf = requestAnimationFrame(paintResize); });
      ['pointerup', 'pointercancel'].forEach(ev => hd.addEventListener(ev, () => { if (!rs) return; cancelAnimationFrame(rsRaf); paintResize(); rs = null; el.classList.remove('resizing'); }));
    });
    const prog = body.querySelector('.win-progress');
    body.addEventListener('scroll', () => { const m = body.scrollHeight - body.clientHeight; prog.style.setProperty('--sp', m > 0 ? body.scrollTop / m : 0); }, { passive: true });
    const rvs = $$('.rv', body);
    if (reduced() || !('IntersectionObserver' in window)) rvs.forEach(r => r.classList.add('in'));
    else { const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { root: body, threshold: .08 }); rvs.forEach((r, i) => { r.style.transitionDelay = Math.min(i, 5) * 60 + 'ms'; io.observe(r); }); }
  }

  function hydrate(k, body) {
%%HYDRATE%%
  }

  function lightbox(src, alt) {
    const lb = document.createElement('div'); lb.className = 'lightbox'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-label', alt);
    lb.innerHTML = `<img src="${src}" alt="${alt}"><button class="btn" type="button">Close ×</button>`;
    const close = () => { lb.remove(); document.removeEventListener('keydown', onKey, true); };
    const onKey = e => { if (e.key === 'Escape') { e.stopImmediatePropagation(); close(); } };
    lb.addEventListener('click', close); document.addEventListener('keydown', onKey, true); document.body.append(lb); lb.querySelector('button').focus();
  }
  document.addEventListener('keydown', e => {
    if (!isOpen || e.key !== 'Escape' || document.fullscreenElement) return;
    if (Arcade.isOpen) { Arcade.focus(); return; }   // Esc belongs to the game (pause); leaving is the Exit button
    if (!menu.hidden) { toggleMenu(false); startBtn.focus(); return; }
    const t = topApp(); if (t) destroy(t);
  });
  $('#leave-desk').addEventListener('click', () => Router.go('lab'));
  return { open, close, openApp, get isOpen() { return isOpen; } };
})();


/* =======================================================================
   LIVING DESKTOP — ambient parallax, icon reactions and the idle Easter egg:
   after 12 s without input the icons wake up and play (gravity, jumps,
   collisions, stacking), then fly home the moment the visitor is back.
   One rAF loop at a time, transforms only, nothing runs while hidden.
   ======================================================================= */
const Desk = (() => {
  const osEl = $('#os'), deskEl = $('.os-desk', osEl), bg = $('.os-bg', osEl), layers = $$('.os-bg-l', bg), menuEl = $('#os-menu');
  const icons = () => $$('#os-icons .os-icon');
  const rnd = (a, b) => a + Math.random() * (b - a);

  // Ambient detail, created once: a few light motes (desktop sizes only) and a different float rhythm per icon.
  if (!isSmall()) {
    const m = $('.os-bg-motes', bg); let s = 11; const r = () => (s = s * 16807 % 2147483647) / 2147483647;
    for (let i = 0; i < 10; i++) { const e = document.createElement('i'); e.style.cssText = `--x:${(r() * 100).toFixed(1)}%;--y:${(30 + r() * 62).toFixed(1)}%;--s:${(1.5 + r() * 2).toFixed(1)}px;--t:${(9 + r() * 9).toFixed(1)}s;--d:${(-r() * 14).toFixed(1)}s;--dx:${((r() - .5) * 60).toFixed(0)}px`; m.append(e); }
  }
  icons().forEach((ic, i) => { const g = ic.firstElementChild; g.style.setProperty('--ft', (4.2 + (i * .37) % 1.6).toFixed(2) + 's'); g.style.setProperty('--fd', (-i * .9).toFixed(2) + 's'); });
  let openWins = 0;
  const syncAlive = () => { osEl.classList.toggle('alive', Motion.on()); osEl.classList.toggle('ambient', Motion.on() && on && !openWins && !document.hidden); if (!Motion.on()) finish(); };

  /* ---- Pointer: parallax background + icons that lean toward the cursor (one shared frame) ---- */
  const DEPTH = [10, 22, 34], R = 150;
  let px = 0, py = 0, inside = false, cx = 0, cy = 0, uiRaf = 0, homes = null, homesAt = 0;
  const near = new Set();
  osEl.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse' || e.buttons) return; px = e.clientX; py = e.clientY; inside = true; if (!uiRaf) uiRaf = requestAnimationFrame(ui); }, { passive: true });
  osEl.addEventListener('pointerleave', () => { inside = false; if (!uiRaf) uiRaf = requestAnimationFrame(ui); });
  function ui() {
    uiRaf = 0; if (!osEl.classList.contains('alive') || !osEl.classList.contains('on')) return;
    const tx = inside ? px / innerWidth - .5 : 0, ty = inside ? py / innerHeight - .5 : 0;
    cx += (tx - cx) * .12; cy += (ty - cy) * .12;
    if (osEl.classList.contains('ambient')) layers.forEach((l, i) => { l.style.transform = `translate3d(${(-cx * DEPTH[i]).toFixed(2)}px,${(-cy * DEPTH[i]).toFixed(2)}px,0)`; });   // parallax only on an empty desktop
    if (!phys && !osEl.classList.contains('covered')) lean();
    if (Math.abs(tx - cx) > .002 || Math.abs(ty - cy) > .002) uiRaf = requestAnimationFrame(ui);   // keep easing, then stop
  }
  const unlean = ic => { near.delete(ic); ['--mx', '--my', '--rx', '--ry'].forEach(p => ic.firstElementChild.style.removeProperty(p)); };
  function lean() {
    const now = performance.now(), list = icons();
    if (!homes || now - homesAt > 1500) { homes = list.map(i => { const b = i.firstElementChild.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; }); homesAt = now; }
    list.forEach((ic, i) => {
      const dx = px - homes[i][0], dy = py - homes[i][1], d = Math.hypot(dx, dy);
      if (!inside || d > R) { if (near.has(ic)) unlean(ic); return; }
      near.add(ic); const f = 1 - d / R, g = ic.firstElementChild.style;
      g.setProperty('--mx', (dx / R * 6 * f).toFixed(2) + 'px'); g.setProperty('--my', (dy / R * 6 * f).toFixed(2) + 'px');
      g.setProperty('--rx', (-dy / R * 16 * f).toFixed(2) + 'deg'); g.setProperty('--ry', (dx / R * 16 * f).toFixed(2) + 'deg');
    });
  }

  /* ---- Click feedback and selection ---- */
  document.addEventListener('pointerdown', e => {
    const ic = e.target.closest && e.target.closest('#os-icons .os-icon');
    if (!ic) { if (e.target.closest && e.target.closest('.os-desk') && !e.target.closest('.os-widget')) icons().forEach(i => i.classList.remove('sel')); return; }
    icons().forEach(i => i.classList.toggle('sel', i === ic));
    ic.classList.remove('tap'); void ic.offsetWidth; ic.classList.add('tap');
  }, true);
  $('#os-icons').addEventListener('animationend', e => { if (e.animationName === 'os-tap') e.target.classList.remove('tap'); });

  /* ---- Idle detection ---- */
  const IDLE = 12000;
  let on = false, lastInput = performance.now(), timer = 0, phys = null, raf = 0;
  const typing = () => { const a = document.activeElement; return !!a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)); };
  const canPlay = () => on && Motion.on() && !isSmall() && !document.hidden && osEl.classList.contains('on') && !osEl.classList.contains('covered')
    && !document.documentElement.classList.contains('game-on') && menuEl.hidden && !typing() && !document.querySelector('.win.dragging,.win.resizing');
  function input(e) { lastInput = performance.now(); if (phys && phys.mode === 'play') wake(e); }
  ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(t => addEventListener(t, input, { capture: true, passive: true }));
  addEventListener('pointerup', () => { if (phys && phys.held) { phys.held = null; phys.rt = 0; phys.bodies.forEach(b => { b.fx = b.x - b.hx; b.fy = b.y - b.hy; b.fa = b.a; }); } }, true);
  function check() { if (!phys && performance.now() - lastInput >= IDLE && canPlay()) play(); }
  function active(v) { on = v; syncAlive(); clearInterval(timer); timer = 0; if (v && !document.hidden) { lastInput = performance.now(); timer = setInterval(check, 1000); } if (!v) finish(); }
  document.addEventListener('visibilitychange', () => { syncAlive(); if (document.hidden) { finish(); clearInterval(timer); timer = 0; } else if (on) active(true); });
  addEventListener('resize', () => { finish(); homes = null; });

  /* ---- Idle physics: a tiny world of 7 boxes ---- */
  const G = 1900, PAD = 14;   // gravity in px/s²; PAD slims the box so labels can overlap a little
  const TYPES = ['hopper', 'wanderer', 'chaser', 'sleeper', 'bouncer', 'follower', 'climber'];
  function play() {
    const list = icons(); if (!list.length) return;
    osEl.classList.remove('reveal'); osEl.classList.add('idle');
    near.forEach(unlean);
    const dr = deskEl.getBoundingClientRect(), B = { l: dr.left + 6, r: dr.right - 6, t: dr.top + 6, b: dr.bottom - 4 };
    const bodies = list.map((el, i) => {
      const b = el.getBoundingClientRect(); el.classList.add('phys');
      return { el, i, type: TYPES[i % TYPES.length], hx: b.left, hy: b.top, x: b.left, y: b.top, w: b.width, h: b.height, vx: 0, vy: 0, a: 0, va: 0, drive: 0,
        next: i * .45 + rnd(.2, 1.6), awake: false, ground: false, on: null, onSince: 0, stay: 0, wx: 0, wy: 0, wa: 0, target: null };
    });
    bodies.forEach(b => { if (b.type === 'chaser' || b.type === 'follower') b.target = bodies[(b.i + 3) % bodies.length]; });
    phys = { bodies, B, t: 0, mode: 'play', last: 0, slow: 0, odd: false, napAt: rnd(70, 95), napping: false, still: 0, sleeping: false, napT: 0, held: null, rt: 0 };
    raf = requestAnimationFrame(step);
  }
  function step(now) {
    raf = 0; const P = phys; if (!P) return;
    let dt = P.last ? (now - P.last) / 1000 : 1 / 60; P.last = now;
    P.slow = P.slow * .96 + (dt > .024 ? .04 : 0);   // share of slow frames: when it is high, draw every other frame
    dt = Math.min(dt, 1 / 20);
    if (P.mode === 'return') returning(dt);
    else { const n = dt > 1 / 45 ? 2 : 1; for (let k = 0; k < n; k++) simulate(dt / n); P.t += dt; nap(dt); }
    if (!phys) return;
    P.odd = !P.odd; if (P.slow < .5 || P.odd) render();
    if (!P.sleeping) raf = requestAnimationFrame(step);
  }
  const jump = (b, v, vx) => { b.vy = -v; b.vx = vx; b.va = (vx >= 0 ? 1 : -1) * rnd(120, 280); b.ground = false; b.on = null; b.onSince = 0; };
  const other = (b, all) => { let o; do o = all[Math.floor(Math.random() * all.length)]; while (o === b && all.length > 1); return o; };
  function behave(b, t, all) {
    if (!b.ground || phys.napping) return;
    if (b.on && b.onSince && t - b.onSince > (b.stay || (b.stay = rnd(1.2, 3.2)))) {   // rested on a friend long enough: hop off
      jump(b, rnd(380, 560), (Math.random() < .5 ? -1 : 1) * rnd(120, 220)); b.stay = 0; b.next = t + rnd(.8, 2); return;
    }
    if (t < b.next) {
      if (b.target && (b.type === 'chaser' || b.type === 'follower')) { const dx = b.target.x - b.x; b.drive = b.type === 'follower' ? (Math.abs(dx) > 140 ? Math.sign(dx) * 90 : 0) : Math.sign(dx) * Math.min(170, Math.abs(dx) * 1.4); }
      return;
    }
    if (Math.random() < .16) { b.drive = 0; b.next = t + rnd(1.4, 3.8); return; }   // a little rest
    switch (b.type) {
      case 'hopper': jump(b, rnd(520, 760), rnd(-80, 80)); b.next = t + rnd(.45, 1.1); break;
      case 'wanderer': b.drive = (Math.random() < .5 ? -1 : 1) * rnd(40, 75); if (Math.random() < .35) jump(b, rnd(260, 360), b.drive); b.next = t + rnd(1.5, 3.5); break;
      case 'chaser': case 'follower': if (Math.random() < .25) b.target = other(b, all); if (Math.abs(b.target.x - b.x) < 150) jump(b, rnd(540, 760), Math.sign(b.target.x - b.x || 1) * rnd(90, 160)); b.next = t + rnd(.9, 2.2); break;
      case 'sleeper': if (Math.random() < .55) { b.drive = 0; b.next = t + rnd(3, 7); break; } jump(b, rnd(700, 950), (Math.random() < .5 ? -1 : 1) * rnd(200, 320)); b.drive = 0; b.next = t + rnd(3, 6); break;
      case 'bouncer': { const o = other(b, all); jump(b, rnd(620, 880), Math.sign(o.x - b.x || 1) * rnd(160, 300)); b.next = t + rnd(1.2, 2.6); break; }
      case 'climber': { const o = other(b, all), v = rnd(620, 780); jump(b, v, clamp((o.x - b.x) / (1.6 * v / G), -380, 380)); b.next = t + rnd(1.6, 3.2); break; }   // aims to land on another icon
    }
  }
  function simulate(dt) {
    const P = phys, { B, bodies } = P, t = P.t;
    for (const b of bodies) {
      if (!b.awake) { if (t >= b.next) { b.awake = true; jump(b, rnd(250, 520), rnd(-90, 90)); b.next = t + rnd(.6, 1.6); } continue; }
      if (b === P.held) continue;
      behave(b, t, bodies);
      b.vy += G * dt;
      if (b.ground) b.vx += (b.drive - b.vx) * Math.min(1, 7 * dt); else b.vx *= 1 - .15 * dt;
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.ground) b.va += (-b.a * 60 - b.va * 10) * dt; else b.va *= 1 - .6 * dt;   // settle upright on the ground, spin a little in the air
      b.a = clamp(b.a + b.va * dt, -40, 40);
      b.ground = false; b.on = null;
      if (b.x < B.l) { b.x = B.l; if (b.vx < 0) { b.vx = -b.vx * .6; b.va += 120; } b.drive = Math.abs(b.drive); }
      if (b.x + b.w > B.r) { b.x = B.r - b.w; if (b.vx > 0) { b.vx = -b.vx * .6; b.va -= 120; } b.drive = -Math.abs(b.drive); }
      if (b.y < B.t) { b.y = B.t; if (b.vy < 0) b.vy = -b.vy * .3; }
      if (b.y + b.h >= B.b) { b.y = B.b - b.h; if (b.vy > 160) { b.vy = -b.vy * .38; b.va += (Math.random() - .5) * 160; } else if (b.vy > 0) b.vy = 0; b.ground = b.vy === 0; }
    }
    // 7 bodies → 21 pairs: plain box checks are enough.
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], b = bodies[j]; if (!a.awake || !b.awake || a === P.held || b === P.held) continue;
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) - PAD * 2, oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ox <= 0 || oy <= 0) continue;
      if (oy < ox * .9) {   // landing on top: stack
        const top = a.y < b.y ? a : b, bot = top === a ? b : a;
        top.y -= oy;
        if (top.vy > bot.vy) { const rv = top.vy - bot.vy; top.vy = rv > 220 ? bot.vy - rv * .3 : bot.vy; top.va += (top.x < bot.x ? -1 : 1) * Math.min(rv, 400) * .2; }
        if (Math.abs(top.vy - bot.vy) < 1) { top.ground = true; top.on = bot; if (!top.onSince) top.onSince = t; }
      } else {              // side bump: push apart, trade speed, wobble
        const l = a.x < b.x ? a : b, rr = l === a ? b : a, push = ox / 2;
        l.x -= push; rr.x += push;
        if (l.vx - rr.vx > 0) {
          const lv = l.vx, rv = rr.vx; l.vx = rv * .8 - 30; rr.vx = lv * .8 + 30; l.drive = -Math.abs(l.drive); rr.drive = Math.abs(rr.drive); l.va -= 140; rr.va += 140;
          if (l.ground && rr.ground && lv - rv > 90) { l.vy = -rnd(160, 320); rr.vy = -rnd(160, 320); l.ground = rr.ground = false; }
        }
      }
    }
    for (const b of bodies) if (!b.on) b.onSince = 0;
  }
  // After a while the icons settle down and the loop stops completely; they play again later.
  function nap(dt) {
    const P = phys;
    if (!P.napping && P.t > P.napAt) { P.napping = true; P.bodies.forEach(b => { b.drive = 0; }); }
    if (!P.napping) return;
    const still = P.bodies.every(b => !b.awake || (b.ground && Math.abs(b.vx) < 4 && Math.abs(b.va) < 3 && Math.abs(b.a) < 1));
    P.still = still ? P.still + dt : 0;
    if (P.still > 1) {
      P.sleeping = true;
      P.napT = setTimeout(() => { if (phys !== P || P.mode !== 'play') return; P.napping = false; P.sleeping = false; P.still = 0; P.napAt = P.t + rnd(60, 90); P.bodies.forEach(b => { b.next = P.t + rnd(.2, 2.5); }); P.last = 0; raf = requestAnimationFrame(step); }, rnd(15000, 28000));
    }
  }
  function render() {
    for (const b of phys.bodies) {
      const dx = b.x - b.hx, dy = b.y - b.hy;
      if (Math.abs(dx - b.wx) + Math.abs(dy - b.wy) + Math.abs(b.a - b.wa) < .08) continue;   // nothing visible changed
      b.wx = dx; b.wy = dy; b.wa = b.a;
      b.el.style.transform = `translate3d(${dx.toFixed(1)}px,${dy.toFixed(1)}px,0) rotate(${b.a.toFixed(1)}deg)`;
    }
  }
  /* ---- Back to work: every icon flies home; the one being pressed waits under the finger ---- */
  function wake(e) {
    const P = phys; clearTimeout(P.napT); P.mode = 'return'; P.rt = 0; P.sleeping = false;
    const ic = e && e.type === 'pointerdown' && e.target.closest && e.target.closest('#os-icons .os-icon');
    P.held = ic ? P.bodies.find(b => b.el === ic) || null : null;
    P.bodies.forEach(b => { b.fx = b.x - b.hx; b.fy = b.y - b.hy; b.fa = b.a; });
    if (!raf) { P.last = 0; raf = requestAnimationFrame(step); }
  }
  const backOut = t => { const c = 1.3; t -= 1; return 1 + (c + 1) * t * t * t + c * t * t; };
  function returning(dt) {
    const P = phys, D = .7; P.rt += dt;
    P.bodies.forEach((b, i) => { if (b === P.held) return; const k = backOut(clamp((P.rt - i * .03) / D)); b.x = b.hx + b.fx * (1 - k); b.y = b.hy + b.fy * (1 - k); b.a = b.fa * (1 - k); });
    if (P.rt > D + .3 && !P.held) finish();
  }
  function finish() {
    const P = phys; if (!P) return; phys = null;
    cancelAnimationFrame(raf); raf = 0; clearTimeout(P.napT);
    P.bodies.forEach(b => { b.el.style.transform = ''; b.el.classList.remove('phys'); });
    osEl.classList.remove('idle'); homes = null; lastInput = performance.now();
  }
  Motion.sub(syncAlive); syncAlive();
  return { active, windows(n) { if (n !== openWins) { openWins = n; syncAlive(); } }, get playing() { return !!phys && phys.mode === 'play'; }, get sleeping() { return !!phys && phys.sleeping; } };
})();

/* =======================================================================
   CODE-RAIN SWEEP — the original KMP page transition (intro ⇄ room)
   ======================================================================= */
const CHARS = '0123456789ABCDEFKMPXYZ', gw = 18, gh = 25;
let atlas = null;
function getAtlas() {
  if (atlas) return atlas;
  atlas = document.createElement('canvas'); atlas.width = CHARS.length * gw; atlas.height = gh * 2;
  const g = atlas.getContext('2d'); g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'bold 15px Consolas,monospace';
  for (let row = 0; row < 2; row++) for (let k = 0; k < CHARS.length; k++) { g.shadowBlur = row ? 5 : 0; g.shadowColor = '#2AC7C9'; g.fillStyle = row ? '#b9f3ee' : '#18B7A0'; g.fillText(CHARS[k], k * gw + gw / 2, row * gh + gh / 2); }
  return atlas;
}
// reveal=false: el retracts to the left (what is beneath appears from the right); reveal=true: el grows back.
function sweep(el, { reveal = false, duration = 1600 } = {}) {
  if (reduced()) return animate(500, t => { el.style.opacity = String(reveal ? t : 1 - t); }, true).then(() => { el.style.opacity = ''; if (!reveal) el.style.clipPath = 'inset(0 100% 0 0)'; else el.style.clipPath = ''; });
  return new Promise(resolve => {
    const cv = $('#fx'), W = innerWidth, H = innerHeight, sc = W < 600 ? .7 : .8;
    cv.hidden = false; cv.width = Math.round(W * sc); cv.height = Math.round(H * sc);
    const g = cv.getContext('2d'); g.setTransform(sc, 0, 0, sc, 0, 0);
    const A = getAtlas(), count = W < 600 ? 85 : 185;
    const seeds = Array.from({ length: count }, (_, i) => ({ y: (i + .5) / count * H, off: ((i * 71) % 113 - 56) * .92, l: (i * 17 + Math.floor(i / 22) * 5 + 3) % CHARS.length, s: .64 + ((i * 7) % 9) * .09, o: .35 + ((i * 11) % 17) / 26 }));
    const t0 = performance.now(); let lastPaint = 0, done = false;
    const finish = () => { if (done) return; done = true; el.style.clipPath = reveal ? '' : 'inset(0 100% 0 0)'; g.clearRect(0, 0, W, H); cv.hidden = true; resolve(); };
    setTimeout(finish, duration + 700);
    (function frame(now) {
      if (done) return;
      const p = clamp((now - t0) / duration), f = easeIO(p), edge = reveal ? f * W : W - f * W;
      el.style.clipPath = `inset(0 ${Math.max(0, W - edge).toFixed(1)}px 0 0)`;
      if (now - lastPaint > 30) {
        lastPaint = now; g.clearRect(0, 0, W, H); const step = Math.floor(now / 225), fade = Math.sin(p * Math.PI) * .9;
        for (let i = 0; i < seeds.length; i++) { const s = seeds[i]; const x = edge + s.off + Math.sin(now / 290 + i * .9) * 9; if (x < -30 || x > W + 30) continue; const z = gw * s.s; g.globalAlpha = fade * s.o; g.drawImage(A, ((s.l + step) % CHARS.length) * gw, i % 9 === 0 ? gh : 0, gw, gh, x, s.y, z, z * gh / gw); }
        g.globalAlpha = 1;
      }
      if (p < 1) requestAnimationFrame(frame); else finish();
    })(t0);
  });
}

/* =======================================================================
   INTRO — first screen, then into Kian's Room
   ======================================================================= */
const Intro = (() => {
  const el = $('#intro'), h1 = $('.in-name', el), cells = $('#term-cells'), btn = $('#intro-enter'), status = $('#intro-status');
  let n = 0, visible = false;
  h1.innerHTML = h1.dataset.lines.split('|').map((line, li, arr) => '<span class="ln" aria-hidden="true">' + [...line].map(ch => ch === ' ' ? `<span class="lt sp" style="--i:${n++}"> </span>` : `<span class="lt" style="--i:${n++}">${ch}</span>`).join('') + (li === arr.length - 1 ? `<span class="lt stop" style="--i:${n++}">.</span>` : '') + '</span>').join('');
  cells.innerHTML = '<i></i>'.repeat(24); const cellEls = $$('i', cells);
  const setTerm = p => { const on = Math.round(p * 24); cellEls.forEach((c, i) => c.classList.toggle('on', i < on)); const v = Math.round(p * 100); $('#term-pct').textContent = String(v).padStart(2, '0') + '%'; cells.setAttribute('aria-valuenow', v); };
  function reset() { btn.hidden = false; $('#term').hidden = true; status.innerHTML = 'A digital space for everything I create <span>✦</span>'; el.style.clipPath = ''; el.style.opacity = ''; }
  return {
    get visible() { return visible; },
    async show(animated) {
      reset(); el.hidden = false; visible = true;
      if (animated) { el.style.clipPath = 'inset(0 100% 0 0)'; await sweep(el, { reveal: true, duration: 1300 }); }
      Room.pause(); btn.focus({ preventScroll: true });
    },
    async leave() {
      btn.hidden = true; $('#term').hidden = false; status.textContent = "Opening Kian's Room…";
      await animate(750, t => setTerm(ease(t)), true);
      Room.resume(); Room.playIntro();
      await sweep(el, { reveal: false, duration: 1500 });
      el.hidden = true; visible = false; reset();
      $('#room-canvas').focus({ preventScroll: true });
    },
    hideNow() { el.hidden = true; visible = false; reset(); Room.resume(); },
  };
})();

/* =======================================================================
   KPC GAME — full-screen game mode (opened from Projects)
   ======================================================================= */
/* Presentation only, applied from outside so the game file stays untouched: the board takes the whole screen. */
const GAME_VIEW_CSS = [
  ".shell.is-fullscreen{padding:0!important;gap:0!important}",
  ".shell.is-fullscreen .topbar{min-height:46px!important;padding:4px 10px!important;border-bottom:1px solid #1d3444;background:#07131d}",
  ".shell.is-fullscreen .brandlogo{width:30px!important;height:30px!important;font-size:16px!important}",
  ".shell.is-fullscreen .brand p{display:none}",
  ".shell.is-fullscreen .viewport-box{height:100%!important;border:0!important;border-radius:0!important;box-shadow:none!important;grid-template-rows:minmax(0,1fr) auto!important}",
  ".shell.is-fullscreen .viewport-head{display:none!important}",
  ".shell.is-fullscreen .viewport-bottom.level-dock{height:auto!important;min-height:58px;padding:6px 12px!important}",
  ".shell>.layout{grid-template-columns:minmax(0,1fr)!important;gap:0!important}",
  "#rank-toggle-btn{display:inline-flex!important}",
  ".rank-panel{display:none!important}",
  ".rank-panel.open{display:flex!important;position:fixed;z-index:80;right:10px;top:54px;bottom:10px;width:min(330px,calc(100vw - 20px));height:auto;max-height:calc(100dvh - 64px);box-shadow:0 25px 80px #000c}",
  ".rank-close{display:block!important}",
  ".dialog{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;background:#040c15e0!important}",
  ".hud-panel{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}",
].join('\n');
const Arcade = (() => {
  const el = $('#arcade'), stage = $('#ar-stage'), load = $('#ar-load');
  const behind = ['#intro', '#room', '#os'].map(s => $(s));   // kept out of Tab order and clicks while playing
  let isOpen = false, hideT = 0, fsBtn = null, wasFull = false, prefetched = false;
  const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement || null;
  const root = document.documentElement;
  const enterFs = () => { const rq = root.requestFullscreen || root.webkitRequestFullscreen; if (!rq || fsEl()) return; try { const p = rq.call(root); if (p && p.catch) p.catch(() => {}); } catch (_) {} };   // refused: the game still fills the window
  const exitFs = () => { if (!fsEl()) return; const ex = document.exitFullscreen || document.webkitExitFullscreen; try { const p = ex.call(document); if (p && p.catch) p.catch(() => {}); } catch (_) {} };
  const focusGame = () => { const f = stage.querySelector('iframe'); if (f) try { f.contentWindow.focus(); } catch (_) {} };
  const syncFs = () => { if (fsBtn) { const on = !!fsEl(); if (on) wasFull = true; fsBtn.textContent = on ? '⛶ EXIT FULLSCREEN' : '⛶ FULLSCREEN'; fsBtn.setAttribute('aria-pressed', String(on)); } if (isOpen) focusGame(); };
  ['fullscreenchange', 'webkitfullscreenchange'].forEach(ev => document.addEventListener(ev, syncFs));
  // Smooth play on any PC, without touching game logic: menus redraw rarely, an idle board runs at 30 fps,
  // moves run at full rate, and glows / internal resolution step down only if frames take too long.
  function tunePerformance(win, canvas) {
    const d = win.document, proto = win.CanvasRenderingContext2D.prototype, blur = Object.getOwnPropertyDescriptor(proto, 'shadowBlur');
    const live = canvas.getContext('2d'), native = win.devicePixelRatio || 1, dialog = d.getElementById('dialog'), nameForm = d.getElementById('name-form');
    const levels = [{ live: 1, board: 1, res: Math.min(native, 1.25) }, { live: .5, board: .7, res: 1 }, { live: 0, board: .4, res: 1 }, { live: 0, board: .25, res: .75 }];
    let q = 0, last = 0, n = 0, sum = 0, active = 0, lastDraw = 0, nextId = 1;
    let overlayOn = true, overlayAt = -1e9;   // layout is read at most 4 times a second, never on every frame
    const overlay = () => { const now = win.performance.now(); if (now - overlayAt > 250) { overlayAt = now; overlayOn = !dialog.hidden || nameForm.getClientRects().length > 0; } return overlayOn; };
    Object.defineProperty(proto, 'shadowBlur', { configurable: true, get() { return blur.get.call(this); }, set(v) { blur.set.call(this, v * (this === live ? levels[q].live : levels[q].board)); } });
    Object.defineProperty(win, 'devicePixelRatio', { configurable: true, get: () => levels[q].res });
    ['keydown', 'pointerdown'].forEach(ev => d.addEventListener(ev, () => { active = win.performance.now(); overlayAt = -1e9; }, true));
    const nativeRaf = win.requestAnimationFrame.bind(win), nativeCancel = win.cancelAnimationFrame.bind(win), jobs = new Map();
    const gap = t => overlay() ? 120 : t - active < 1400 ? 0 : 32;
    win.requestAnimationFrame = cb => { const id = nextId++; const step = t => { if (t - lastDraw < gap(t) - 2) { jobs.set(id, nativeRaf(step)); return; } lastDraw = t; jobs.delete(id); cb(t); }; jobs.set(id, nativeRaf(step)); return id; };
    win.cancelAnimationFrame = id => { const j = jobs.get(id); if (j !== undefined) nativeCancel(j); jobs.delete(id); };
    win.__kpcQuality = () => q; win.__kpcRaf = nativeRaf;
    const tick = t => { const dt = t - last; last = t; if (dt > 0 && dt < 250 && !overlay()) { sum += dt; n++; } if (n >= 30) { if (sum / n > 21 && q < levels.length - 1) q++; n = sum = 0; } nativeRaf(tick); };
    nativeRaf(tick);
  }
  // Adapts the untouched game page to this view from outside: full-size layout, exit button, fullscreen of the whole game view.
  function integrate(f) {
    try {
      const d = f.contentDocument, exit = d.getElementById('back-portfolio-btn');
      const css = d.createElement('style'); css.textContent = GAME_VIEW_CSS; d.head.append(css);
      d.querySelector('.shell').classList.add('is-fullscreen'); d.documentElement.classList.add('game-fullscreen');
      tunePerformance(f.contentWindow, d.getElementById('game'));
      d.addEventListener('pointerdown', () => { if (!wasFull) enterFs(); }, { once: true });   // second chance if the browser refused the first request
      exit.textContent = '✕ EXIT GAME'; exit.style.cssText = 'border-color:#2AC7C9;color:#E2F3F1;background:rgba(42,199,201,.14);box-shadow:0 0 12px rgba(42,199,201,.25)';
      fsBtn = d.getElementById('fullscreen-btn'); fsBtn.onclick = () => { if (fsEl()) exitFs(); else enterFs(); };
      syncFs(); f.contentWindow.dispatchEvent(new Event('resize')); el.classList.add('integrated');
    } catch (_) {}   // if it ever fails, the view's own Exit button stays visible
  }
  $('#ar-exit').addEventListener('click', () => Router.go('projects'));
  return {
    get isOpen() { return isOpen; },
    focus: focusGame,
    prefetch() { if (prefetched) return; prefetched = true; setTimeout(() => { const l = document.createElement('link'); l.rel = 'prefetch'; l.href = 'kpc-game.html'; document.head.append(l); }, 700); },
    // Called synchronously from the PLAY click: browsers only allow fullscreen inside the user's gesture.
    launch() { clearTimeout(hideT); wasFull = false; el.hidden = false; enterFs(); },
    open() {
      if (isOpen) return; isOpen = true; clearTimeout(hideT);
      behind.forEach(b => { b.inert = true; });
      el.hidden = false; el.classList.remove('integrated'); setTimeout(() => { if (isOpen) el.classList.add('on'); }, 30);
      setTimeout(() => { if (isOpen) root.classList.add('game-on'); }, reduced() ? 40 : 460);   // stop painting the desktop behind the game
      load.classList.remove('done');
      const f = document.createElement('iframe'); f.title = 'KPC GAME'; f.allow = 'fullscreen; autoplay'; f.src = 'kpc-game.html';
      const ready = () => { if (f.isConnected) { load.classList.add('done'); focusGame(); } };
      f.addEventListener('load', () => { integrate(f); ready(); }, { once: true }); setTimeout(ready, 6000); // never leave the loader up
      setTimeout(() => { if (isOpen && !stage.querySelector('iframe')) stage.append(f); }, 70);   // let the view paint first
    },
    close() {
      if (!isOpen) return; isOpen = false; fsBtn = null;
      exitFs(); root.classList.remove('game-on');
      behind.forEach(b => { b.inert = false; });
      el.classList.remove('on');
      const f = stage.querySelector('iframe'); if (f) { f.src = 'about:blank'; f.remove(); }
      hideT = setTimeout(() => { if (!isOpen) el.hidden = true; }, reduced() ? 0 : 420);
    },
  };
})();

/* =======================================================================
   ROUTER — #/index (intro) · #/lab (room) · #/os · #/about … · #/arcade
   ======================================================================= */
const Router = (() => {
  let queue = Promise.resolve(), current = '', first = true;
  const parse = () => { const h = decodeURIComponent(location.hash.replace(/^#\/?/, '')).toLowerCase(); return h === '' ? 'index' : ROUTES.includes(h) ? h : 'index'; };
  const titles = { index: 'KLUIVERT | Kluivert Manuel Peralta Carrera', lab: "Kian's Room | KLUIVERT", os: 'KLUIVERT OS | Kluivert Peralta', arcade: 'KPC GAME | KLUIVERT OS' };
  const setTitle = r => { document.title = titles[r] || `${APPS[r].title} | KLUIVERT OS`; };
  function set(r, replace) { current = r; setTitle(r); const h = '#/' + r; if (location.hash !== h) history[replace ? 'replaceState' : 'pushState']({ r }, '', h); }
  async function apply(r) {
    if (r === current) { if (APPS[r] && r !== 'arcade' && OS.isOpen) OS.openApp(r); return; }
    const prev = current; current = r; setTitle(r);
    const wasFirst = first; first = false;
    if (r !== 'arcade') Arcade.close();
    if (r === 'index') { if (OS.isOpen) await OS.close(); await Intro.show(!wasFirst); return; }
    if (Intro.visible) { if (r === 'lab' && !wasFirst) { await Intro.leave(); return; } Intro.hideNow(); }
    if (r === 'lab') { if (OS.isOpen) await OS.close(); return; }
    if (!OS.isOpen) await OS.open({ cinematic: !wasFirst && prev === 'lab' });
    if (r === 'arcade') { OS.openApp('projects'); Arcade.open(); return; }
    if (APPS[r]) OS.openApp(r);
  }
  const enqueue = r => (queue = queue.then(() => apply(r)).catch(e => console.error(e)));
  function go(r) { if (!ROUTES.includes(r)) r = 'os'; if (location.hash !== '#/' + r) history.pushState({ r }, '', '#/' + r); enqueue(r); }
  function init() { const r = parse(); if (location.hash !== '#/' + r) history.replaceState({ r }, '', '#/' + r); enqueue(r); }
  addEventListener('popstate', () => enqueue(parse()));
  addEventListener('hashchange', () => { const r = parse(); if (r !== current) enqueue(r); });
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-route]'); if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey) return;
    e.preventDefault(); if (a.dataset.route === 'arcade') Arcade.launch(); go(a.dataset.route);
  });
  $('#intro-enter').addEventListener('click', e => { e.preventDefault(); go('lab'); });
  return { go, set, init };
})();

window.openPortfolioPage = r => Router.go(r);   // used by KPC GAME's "← PORTFOLIO" button
$('#enter-os').addEventListener('click', () => Router.go('os'));
Room.onMonitor(() => Router.go('os'));
Room.start();
Router.init();
})();
