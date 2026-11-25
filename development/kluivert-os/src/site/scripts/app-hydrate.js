    if (k === 'about') {
      const B = [
        ['i-compass', '01 / Growing through experience', 'My own path', [['Learn from my mistakes', "I've made decisions I would handle differently today. I believe that mistakes are part of growing up, and I try to learn from them instead of allowing them to define who I am."], ['Walk at my own pace', "I don't have everything figured out yet. Sometimes I question my direction, but I've learned that I don't need to follow someone else's path to make progress. I want to build a future that feels like my own."], ['Keep going when things get difficult', "Not everything works on the first attempt. Whether I'm struggling with an assignment or fixing a technical problem, I try different solutions, learn from what went wrong and keep moving forward."]]],
        ['i-heart', '02 / Understanding who I am', 'My inner voice', [['Write what I feel', 'Music and writing have become important ways for me to express myself. Sometimes I find it easier to explain my thoughts through lyrics than through an ordinary conversation. Creating helps me understand myself better.'], ['Be honest with myself', "I have moments of doubt, and I don't always know exactly what I want or how I feel. I want to understand those moments rather than pretend everything is perfect. Knowing myself also means accepting the things I still need to work on."], ['Create without pretending', "I don't want to copy someone else's personality just to fit in. Whether I'm making music, designing something or developing a project, I prefer to experiment and find a style that represents me."]]],
        ['i-globe', '03 / Remembering what matters', 'My roots &amp; connections', [['Never forget where I come from', "I'm from Ecuador, and my roots are an important part of who I am. Living in Spain has also become part of my story. I want to keep my identity while learning from the different people, cultures and experiences around me."], ['Value the people who support me', "My family has an important place in my life, especially my mother and sister. Their words and support have helped me during difficult moments. They remind me that becoming independent doesn't mean forgetting the people who have been there for me."], ['Respect different stories', "Everyone has a different background, different experiences and their own way of understanding life. I don't believe I have all the answers. I want to listen, respect other perspectives and learn without judging people too quickly."]]],
        ['i-spark', '04 / Building something meaningful', 'My ideas in action', [['Learn by building', 'I study Microcomputer Systems and Networks (SMX), and I enjoy understanding how technology works beyond the theory. Working with Linux, Windows Server, virtual machines and networks has taught me that real learning often comes from experimenting and solving problems.'], ['Turn ideas into projects', "I enjoy turning ideas into something that actually works. My personal portfolio and Lilith, the AI assistant I'm developing, are examples of this. I like programming, testing new possibilities and improving projects as I learn new skills."], ['Make what I do meaningful', "I want my knowledge and creativity to have a purpose beyond myself. Whether I'm collaborating with classmates, sharing what I've learned or creating useful technology, I want my actions to contribute something positive to the people around me."]]],
      ];
      let n = 0; const tones = ['', 'tone-b', 'tone-v', ''];
      $('#paradigm-map', body).innerHTML = B.map(([ic, small, h, leaves], bi) => `<section class="card spot branch rv ${tones[bi]}"><header><span class="ico-shell"><svg class="i"><use href="#${ic}"/></svg></span><div><small>${small}</small><h4>${h}</h4></div></header>${leaves.map(([q, a]) => `<details class="leaf"><summary><span class="n">${String(++n).padStart(2, '0')}</span><span>${q}</span><span class="p" aria-hidden="true">+</span></summary><p>${a}</p></details>`).join('')}</section>`).join('');
    }
    if (k === 'resume') {
      const toggles = $$('[data-cv-toggle]', body);
      const set = (key, open) => { const b = toggles.find(t => t.dataset.cvToggle === key), p = $('#cv-' + key, body); p.hidden = !open; b.setAttribute('aria-expanded', String(open)); b.textContent = open ? 'Hide CV −' : 'View CV +'; if (open) $$('img[data-src]', p).forEach(i => { i.src = i.dataset.src; i.removeAttribute('data-src'); }); };
      toggles.forEach(b => b.addEventListener('click', () => { const key = b.dataset.cvToggle, open = b.getAttribute('aria-expanded') !== 'true'; toggles.forEach(t => set(t.dataset.cvToggle, open && t === b)); if (open) $('#cv-' + key, body).scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }); }));
      $$('[data-cv-close]', body).forEach(b => b.addEventListener('click', () => { set(b.dataset.cvClose, false); toggles.find(t => t.dataset.cvToggle === b.dataset.cvClose).focus(); }));
      body.addEventListener('click', e => { const img = e.target.closest('.cv-pages img'); if (img) lightbox(img.src, img.alt); });
    }
    if (k === 'certificates') {
      const C = [
        ['Sustainability Applied to Production Systems', 'Sustainability', '01_Sustainability_Applied_to_Production_Systems.pdf', '%%IMG_CERT1%%'],
        ['Basic Windows System Administration', 'Systems', '02_Basic_Windows_System_Administration.pdf', '%%IMG_CERT2%%'],
        ['Introduction to Networks (CCNA Routing and Switching)', 'Networks', '03_Introduction_to_Networks_CCNA_Routing_Switching.pdf', '%%IMG_CERT3%%'],
        ['Basic Linux System Administration', 'Systems', '04_Basic_Linux_System_Administration.pdf', '%%IMG_CERT4%%'],
        ['AI Tools and Advanced Excel', 'AI & Productivity', '05_AI_Tools_and_Advanced_Excel.pdf', '%%IMG_CERT5%%'],
        ['Email and Calendar Management — Outlook 2019', 'Microsoft Office', '06_Email_Calendar_Management_Outlook_2019.pdf', '%%IMG_CERT6%%'],
        ['Presentations — PowerPoint 2019', 'Microsoft Office', '07_Presentations_PowerPoint_2019.pdf', '%%IMG_CERT7%%'],
        ['Database Applications — Access 2019', 'Microsoft Office', '08_Database_Applications_Access_2019.pdf', '%%IMG_CERT8%%'],
        ['Advanced Spreadsheets — Excel 2019', 'Microsoft Office', '09_Advanced_Spreadsheets_Excel_2019.pdf', '%%IMG_CERT9%%'],
        ['Advanced Text Documents — Word 2019', 'Microsoft Office', '10_Advanced_Text_Documents_Word_2019.pdf', '%%IMG_CERT10%%'],
        ['Introduction to Mobile Phone Repair', 'Hardware', '11_Introduction_to_Mobile_Phone_Repair.pdf', '%%IMG_CERT11%%'],
      ];
      const esc = s => s.replace(/&/g, '&amp;');
      $('#cert-grid', body).innerHTML = C.map(([t, cat, f, img], i) => `<article class="card hov cert" data-cat="${esc(cat)}"><a class="cert-prev" href="pdfs/${f}" target="_blank" rel="noopener" aria-label="Open ${esc(t)} PDF"><img src="${img}" alt="Preview of ${esc(t)} certificate" loading="lazy" decoding="async"></a><div class="cert-body"><span class="cert-cat">${String(i + 1).padStart(2, '0')} / ${esc(cat)}</span><h3>${esc(t)}</h3><p>Institut Sa Palomera · June 2026</p><div class="cv-actions"><a class="btn primary" href="pdfs/${f}" target="_blank" rel="noopener">Open PDF <svg class="i"><use href="#i-ext"/></svg></a><a class="btn" href="pdfs/${f}" download="${f}"><svg class="i"><use href="#i-down"/></svg>Download</a></div></div></article>`).join('');
      const cats = ['All', ...new Set(C.map(c => c[1]))];
      const fl = $('#cert-filters', body);
      fl.innerHTML = cats.map((c, i) => `<button type="button" aria-pressed="${i === 0}" data-f="${esc(c)}">${esc(c)}<span>${c === 'All' ? C.length : C.filter(x => x[1] === c).length}</span></button>`).join('');
      fl.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return; const f = b.dataset.f.replace(/&amp;/g, '&');
        $$('button', fl).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        let shown = 0; $$('.cert', body).forEach(c => { const on = f === 'All' || c.dataset.cat.replace(/&amp;/g, '&') === f; c.classList.toggle('hidden', !on); shown += on; });
        $('#cert-count', body).textContent = shown + (shown === 1 ? ' DOCUMENT' : ' DOCUMENTS');
      });
    }
    if (k === '7hhep') {
      // Every listener lives on nodes inside this window, so closing the window releases them all.
      const shell = $('.hx-shell', body), root = $('.hx', shell), main = $('.hx-main', root);   // the scene library lives in shell, outside .hx
      // --- Scene details: drawn once with a fixed seed (same picture every time, no assets to download) ---
      let seed = 7; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
      const NS = 'http://www.w3.org/2000/svg';
      const add = (parent, tag, attrs) => { const e = document.createElementNS(NS, tag); for (const a in attrs) e.setAttribute(a, attrs[a]); parent.append(e); return e; };
      const starField = (g, n, maxY) => { for (let i = 0; i < n; i++) add(g, 'circle', { cx: (rnd() * 1200).toFixed(1), cy: (rnd() * maxY).toFixed(1), r: (rnd() * 1.2 + .3).toFixed(2), class: i % 6 ? '' : 'tw', style: `animation-delay:${(rnd() * 3.6).toFixed(2)}s` }); };
      starField($('.hx-stars', shell), 80, 300);
      starField($('.hx-cstars', shell), 50, 320);
      starField($('.hx-dstars', shell), 24, 200);
      const city = $('.hx-city', shell);
      for (let x = -20; x < 1220;) { const w = 34 + rnd() * 56, h = 50 + rnd() * 150; add(city, 'rect', { x: x.toFixed(1), y: (500 - h).toFixed(1), width: w.toFixed(1), height: (h + 110).toFixed(1), fill: 'url(#hxg-farcity)', opacity: '.6' }); x += w + 2 + rnd() * 14; }
      for (let x = -30; x < 1230;) {
        const w = 46 + rnd() * 70, h = 70 + rnd() * 200, y = 600 - h;
        add(city, 'rect', { x: x.toFixed(1), y: y.toFixed(1), width: w.toFixed(1), height: h.toFixed(1), fill: '#06151a' });
        for (let wy = y + 12; wy < 590; wy += 16) for (let wx = x + 7; wx < x + w - 8; wx += 12) if (rnd() < .16) add(city, 'rect', { x: wx.toFixed(1), y: wy.toFixed(1), width: '5', height: '7', fill: rnd() < .55 ? '#f1c98a' : '#7fe9e3', opacity: (.35 + rnd() * .5).toFixed(2) });
        x += w + 4 + rnd() * 10;
      }
      const peb = $('.hx-peb', shell);
      for (let row = 0; row < 5; row++) for (let i = 0; i < 9; i++) {
        const rx = 26 + rnd() * 22, cx = i * 70 + (row % 2) * 34 + rnd() * 10 - 10, cy = 300 - row * 34 - rnd() * 8;
        add(peb, 'ellipse', { cx: cx.toFixed(1), cy: cy.toFixed(1), rx: rx.toFixed(1), ry: (rx * .62).toFixed(1), fill: 'url(#hxg-peb)' });
        add(peb, 'ellipse', { cx: (cx - rx * .25).toFixed(1), cy: (cy - rx * .25).toFixed(1), rx: (rx * .35).toFixed(1), ry: (rx * .12).toFixed(1), fill: '#effffb', opacity: '.16' });
      }
      $$('.hx-fx', root).forEach(fx => { for (let i = 0; i < 7; i++) { const s = document.createElement('span'); s.style.cssText = `--x:${(rnd() * 100).toFixed(1)}%;--s:${(1.5 + rnd() * 2.5).toFixed(1)}px;--t:${(7 + rnd() * 8).toFixed(1)}s;--dl:${(-rnd() * 12).toFixed(1)}s;--dx:${(rnd() * 80 - 40).toFixed(0)}px`; fx.append(s); } });

      // --- Chapters and session progress (kept in memory only; nothing is stored) ---
      const tabs = $$('[role="tab"]', root), views = tabs.map(t => $('#' + t.getAttribute('aria-controls'), root)), nav = tabs[0].parentElement;
      const seen = new Set();
      const paint = cur => {
        $$('[data-explored-count]', root).forEach(e => { e.textContent = seen.size + ' / ' + (tabs.length - 1); });
        $$('.hx-jbar i', root).forEach(i => { const n = +i.dataset.j; i.classList.toggle('seen', seen.has(n)); i.classList.toggle('cur', n === cur); });
        tabs.forEach((t, n) => t.classList.toggle('seen', seen.has(n)));
        $$('.hx-chap', root).forEach(c => c.classList.toggle('seen', seen.has(+c.dataset.go)));
      };
      const show = (v, focus) => {
        tabs.forEach((t, j) => { const on = j === v; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; views[j].hidden = !on; });
        root.dataset.view = v; if (v > 0) seen.add(v); paint(v);
        main.scrollTop = 0;
        if (nav.scrollWidth > nav.clientWidth + 1) { const a = nav.getBoundingClientRect(), b = tabs[v].getBoundingClientRect(); nav.scrollLeft += b.left - a.left - (a.width - b.width) / 2; }   // mobile tab bar: keep the current habit in view
        if (focus) tabs[v].focus({ preventScroll: true });
      };
      tabs.forEach((t, i) => t.addEventListener('click', () => show(i)));
      nav.addEventListener('keydown', e => {
        const i = tabs.indexOf(document.activeElement); if (i < 0) return;
        const n = { ArrowDown: i + 1, ArrowRight: i + 1, ArrowUp: i - 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key]; if (n === undefined) return;
        e.preventDefault(); show((n + tabs.length) % tabs.length, true);
      });
      root.addEventListener('click', e => {
        const go = e.target.closest('[data-go]'); if (go) { show(+go.dataset.go); return; }
        if (e.target.closest('[data-goto="mission"]')) { show(2); const m = $('#hx-mission', root); main.scrollTop = m.getBoundingClientRect().top - main.getBoundingClientRect().top - 24; }
      });

      // --- Habit 01: IDEA → INITIATIVE → ACTION → LEARNING ---
      const cyc = $('.hx-cyc', root), stg = $$('.hx-stg', cyc), stages = stg.map(s => $('#' + s.getAttribute('aria-controls'), cyc));
      const count = $('[data-step-count] b', cyc), next = $('[data-step-next]', cyc); let cur = 0;
      const step = (i, reveal) => {
        cur = (i + stg.length) % stg.length; cyc.style.setProperty('--step', cur);
        stg.forEach((s, j) => { s.setAttribute('aria-pressed', String(j === cur)); s.parentElement.classList.toggle('done', j < cur); stages[j].hidden = j !== cur; });
        count.textContent = cur + 1;
        next.firstChild.textContent = cur === stg.length - 1 ? 'Start again' : 'Next stage';
        if (reveal) { const r = stages[cur].getBoundingClientRect(), b = main.getBoundingClientRect(); if (r.bottom > b.bottom - 8) main.scrollBy({ top: r.bottom - b.bottom + 24, behavior: reduced() ? 'auto' : 'smooth' }); }
      };
      stg.forEach((s, i) => s.addEventListener('click', () => step(i, true)));
      next.addEventListener('click', () => step(cur + 1, true));
      $('[data-step-prev]', cyc).addEventListener('click', () => step(cur - 1, true));

      // --- Habit 03: Rocks, Pebbles & Sand ---
      $$('.hx-lv', root).forEach(lv => {
        const b = $('.hx-lv-btn', lv), label = $('span', b), closed = label.textContent, items = $('#' + b.getAttribute('aria-controls'), lv);
        const toggle = () => { const open = b.getAttribute('aria-expanded') !== 'true'; b.setAttribute('aria-expanded', String(open)); lv.classList.toggle('open', open); items.inert = !open; label.textContent = open ? label.dataset.openLabel : closed; };
        b.addEventListener('click', toggle);
        $('.hx-lv-art', lv).addEventListener('click', toggle);
      });
      paint(0);
    }
    if (k === 'projects') Arcade.prefetch();
    if (k === 'arcade') {
      const st = $('[data-arc-stage]', body);
      $('[data-arc="play"]', body).addEventListener('click', () => {
        if (!st.querySelector('iframe')) { const f = document.createElement('iframe'); f.title = 'KPC GAME playable module'; f.allow = 'fullscreen; autoplay'; f.src = 'kpc-game.html'; st.append(f); f.addEventListener('load', () => { try { f.contentWindow.focus(); } catch (_) {} }); }
        st.classList.add('playing');
      });
      $('[data-arc="full"]', body).addEventListener('click', async () => { try { if (!document.fullscreenElement) await st.requestFullscreen(); else await document.exitFullscreen(); } catch (_) { toast('FULLSCREEN NOT AVAILABLE'); } });
    }