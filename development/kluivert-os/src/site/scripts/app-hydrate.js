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
      const root = $('.hx', body);
      // Habit navigation — ARIA tabs (click / touch, ←/→, Home/End)
      const tabs = $$('[role="tab"]', root), panels = tabs.map(t => $('#' + t.getAttribute('aria-controls'), root)), bar = tabs[0].parentElement;
      const show = (i, focus) => {
        tabs.forEach((t, j) => { const on = j === i; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; panels[j].hidden = !on; });
        if (focus) tabs[i].focus({ preventScroll: true });
        if (bar.scrollWidth > bar.clientWidth) bar.scrollTo({ left: tabs[i].offsetLeft - 4, behavior: reduced() ? 'auto' : 'smooth' });
        const top = panels[i].getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop - bar.offsetHeight - 8;
        if (body.scrollTop > top) body.scrollTo({ top, behavior: 'auto' });
      };
      tabs.forEach((t, i) => t.addEventListener('click', () => show(i)));
      bar.addEventListener('keydown', e => {
        const i = tabs.indexOf(document.activeElement); if (i < 0) return;
        const n = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key]; if (n === undefined) return;
        e.preventDefault(); show((n + tabs.length) % tabs.length, true);
      });
      // Habit 01 — IDEA → INITIATIVE → ACTION → LEARNING
      const cycle = $('.hx-cycle', root), steps = $$('.hx-step', cycle), stages = steps.map(s => $('#' + s.getAttribute('aria-controls'), cycle));
      const count = $('[data-step-count]', cycle), next = $('[data-step-next]', cycle); let cur = 0;
      const step = i => {
        cur = i; cycle.style.setProperty('--step', i);
        steps.forEach((s, j) => { s.setAttribute('aria-pressed', String(j === i)); s.parentElement.classList.toggle('done', j < i); stages[j].hidden = j !== i; });
        count.textContent = `STAGE ${i + 1} / ${steps.length}`;
        next.firstChild.textContent = i === steps.length - 1 ? 'Start again' : 'Next stage';
      };
      steps.forEach((s, i) => s.addEventListener('click', () => step(i)));
      next.addEventListener('click', () => step((cur + 1) % steps.length));
      // Habit 03 — Rocks, Pebbles & Sand (expand / collapse; the jar highlights the open layers)
      const jar = $('.hx-jar', root), cats = $$('.hx-cat', root);
      cats.forEach(c => {
        const b = $('h3 button', c), region = $('#' + b.getAttribute('aria-controls'), c);
        b.addEventListener('click', () => {
          const open = b.getAttribute('aria-expanded') !== 'true';
          b.setAttribute('aria-expanded', String(open)); c.classList.toggle('open', open); region.inert = !open;
          jar.classList.toggle('hl-' + c.dataset.cat, open); jar.classList.toggle('any', cats.some(x => x.classList.contains('open')));
        });
      });
    }
    if (k === 'arcade') {
      const st = $('[data-arc-stage]', body);
      $('[data-arc="play"]', body).addEventListener('click', () => {
        if (!st.querySelector('iframe')) { const f = document.createElement('iframe'); f.title = 'KPC GAME playable module'; f.allow = 'fullscreen; autoplay'; f.src = 'kpc-game.html'; st.append(f); f.addEventListener('load', () => { try { f.contentWindow.focus(); } catch (_) {} }); }
        st.classList.add('playing');
      });
      $('[data-arc="full"]', body).addEventListener('click', async () => { try { if (!document.fullscreenElement) await st.requestFullscreen(); else await document.exitFullscreen(); } catch (_) { toast('FULLSCREEN NOT AVAILABLE'); } });
    }