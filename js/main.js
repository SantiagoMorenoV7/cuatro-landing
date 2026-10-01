/* Cuatro: video, reproductores de audio, gráfico de la ruta, precios y guía de componentes. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- VIDEO con capítulos ----------
  const video = $('#video');
  if (video) {
    const frame = video.closest('.video-frame'), fill = $('#videoFill'), track = $('#videoTrack'), time = $('#videoTime');
    const chapters = $$('.chapters button');
    // en celular se usa una versión cuadrada del video, con letra más grande
    const mqSquare = matchMedia('(max-width: 600px)');
    const pickVersion = () => {
      const sq = mqSquare.matches, base = sq ? 'assets/video/leccion-1-cuadrado' : 'assets/video/leccion-1';
      if (video.dataset.version === base) return;
      const t = video.currentTime, wasPlaying = !video.paused;
      video.dataset.version = base;
      video.poster = `${base}-poster.jpg`;
      const srcs = $$('source', video); srcs[0].src = `${base}.mp4`; srcs[1].src = `${base}.webm`;
      frame.classList.toggle('is-square', sq);
      video.load(); if (t) { video.addEventListener('loadedmetadata', () => { video.currentTime = t; if (wasPlaying) video.play().catch(() => {}); }, { once: true }); }
    };
    pickVersion(); mqSquare.addEventListener('change', pickVersion);
    const play = () => { pauseAllAudio(); video.play().catch(() => {}); };
    const toggle = () => (video.paused ? play() : video.pause());
    $('#videoPlay').addEventListener('click', play);
    $('#videoToggle').addEventListener('click', toggle);
    video.addEventListener('click', toggle);
    video.addEventListener('play', () => frame.classList.add('is-playing'));
    video.addEventListener('pause', () => frame.classList.remove('is-playing'));
    video.addEventListener('ended', () => frame.classList.remove('is-playing'));
    $('#videoMute').addEventListener('click', e => { video.muted = !video.muted; frame.classList.toggle('is-muted', video.muted); e.currentTarget.setAttribute('aria-label', video.muted ? 'Activar sonido' : 'Silenciar'); });
    video.addEventListener('timeupdate', () => {
      const p = video.currentTime / (video.duration || 21.5);
      fill.style.width = `${p * 100}%`; time.textContent = fmt(video.currentTime);
      track.setAttribute('aria-valuenow', Math.round(p * 100));
      let active = -1; chapters.forEach((b, i) => { if (video.currentTime >= +b.dataset.t - 0.05) active = i; });
      chapters.forEach((b, i) => b.classList.toggle('on', i === active && video.currentTime > 0.1));
    });
    const seekTo = clientX => { const r = track.getBoundingClientRect(); video.currentTime = Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * (video.duration || 21.5); };
    let dragging = false;
    track.addEventListener('pointerdown', e => { dragging = true; track.setPointerCapture(e.pointerId); seekTo(e.clientX); });
    track.addEventListener('pointermove', e => dragging && seekTo(e.clientX));
    track.addEventListener('pointerup', () => (dragging = false));
    track.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') video.currentTime += 2;
      else if (e.key === 'ArrowLeft') video.currentTime -= 2;
      else return; e.preventDefault();
    });
    const seekSafe = t => { if (video.readyState >= 1) video.currentTime = t; else { video.addEventListener('loadedmetadata', () => { video.currentTime = t; }, { once: true }); video.load(); } };
    chapters.forEach(b => b.addEventListener('click', () => { seekSafe(+b.dataset.t); play(); }));
  }

  // ---------- AUDIO: semana 1 vs semana 8 ----------
  const players = $$('.player').map(el => {
    const audio = new Audio(el.dataset.src); audio.preload = 'none';
    const canvas = $('.wave', el), btn = $('.pbtn', el), ptime = $('.ptime', el);
    const peaks = (window.PEAKS || {})[el.dataset.peaks] || [];
    const p = { el, audio, canvas, btn, ptime, peaks };
    btn.addEventListener('click', () => (audio.paused ? playAudio(p) : audio.pause()));
    audio.addEventListener('play', () => { el.classList.add('is-playing'); btn.setAttribute('aria-label', `Pausar ${$('h3', el).textContent}`); loop(); });
    audio.addEventListener('pause', () => { el.classList.remove('is-playing'); btn.setAttribute('aria-label', `Reproducir ${$('h3', el).textContent}`); });
    audio.addEventListener('ended', () => { el.classList.remove('is-playing'); audio.currentTime = 0; drawWave(p); });
    audio.addEventListener('timeupdate', () => { ptime.textContent = fmt(audio.currentTime); drawWave(p); });
    canvas.addEventListener('click', e => {
      const r = canvas.getBoundingClientRect();
      const go = () => { audio.currentTime = (e.clientX - r.left) / r.width * audio.duration; };
      if (isNaN(audio.duration)) { audio.addEventListener('loadedmetadata', go, { once: true }); playAudio(p); } else { go(); if (audio.paused) playAudio(p); }
    });
    return p;
  });

  function pauseAllAudio(except) { players.forEach(p => p !== except && p.audio.pause()); }

  // Espectro en vivo: solo cuando la página corre en http(s) (en file:// el navegador silenciaría el audio)
  let analyser = null; const wired = new WeakSet();
  function wire(p) {
    if (!/^https?:$/.test(location.protocol) || !window.Cuatro) return;
    window.Cuatro.initAudio(); const ctx = window.Cuatro.ctx; if (!ctx || wired.has(p.audio)) return;
    if (!analyser) { analyser = ctx.createAnalyser(); analyser.fftSize = 256; analyser.smoothingTimeConstant = 0.8; analyser.connect(ctx.destination); }
    try { ctx.createMediaElementSource(p.audio).connect(analyser); wired.add(p.audio); } catch (_) { /* ya conectado */ }
  }
  function playAudio(p) {
    pauseAllAudio(p); video && video.pause(); wire(p);
    p.audio.play().catch(() => {});
  }

  function sizeCanvas(c) {
    const dpr = Math.min(2, devicePixelRatio || 1), w = c.clientWidth, h = c.clientHeight;
    if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); return { g, w, h };
  }
  function drawWave(p) {
    const { g, w, h } = sizeCanvas(p.canvas), n = p.peaks.length || 1;
    const prog = p.audio.duration ? p.audio.currentTime / p.audio.duration : 0;
    g.clearRect(0, 0, w, h);
    const bw = w / n;
    p.peaks.forEach((v, i) => {
      const bh = Math.max(3, v * (h - 8));
      g.fillStyle = i / n < prog ? '#161A3B' : 'rgba(22,26,59,.28)';
      g.beginPath(); g.roundRect ? g.roundRect(i * bw + 1, (h - bh) / 2, Math.max(1.5, bw - 2.5), bh, 2) : g.rect(i * bw + 1, (h - bh) / 2, Math.max(1.5, bw - 2.5), bh); g.fill();
    });
  }
  const spec = $('#spectrum');
  let looping = false;
  function loop() {
    if (looping) return; looping = true;
    const step = () => {
      const playing = players.some(p => !p.audio.paused);
      if (spec) {
        const { g, w, h } = sizeCanvas(spec); g.clearRect(0, 0, w, h);
        const N = 64, data = new Uint8Array(analyser ? analyser.frequencyBinCount : N);
        if (analyser) analyser.getByteFrequencyData(data);
        const bw = w / N, t = performance.now() / 1000;
        for (let i = 0; i < N; i++) {
          // sin analizador (file://) se usa una animación que sigue la forma de onda
          let v = analyser ? data[Math.floor(i * data.length / N * 0.7)] / 255 : (playing ? (0.25 + 0.35 * Math.abs(Math.sin(t * 6 + i * 0.5)) * (1 - i / N)) : 0);
          const bh = Math.max(2, v * h);
          g.fillStyle = '#161A3B'; g.globalAlpha = 0.18 + v * 0.7;
          g.fillRect(i * bw + 1, h - bh, bw - 3, bh);
        }
        g.globalAlpha = 1;
      }
      if (playing) requestAnimationFrame(step); else { looping = false; idleSpectrum(); }
    };
    requestAnimationFrame(step);
  }
  function idleSpectrum() {
    if (!spec) return; const { g, w, h } = sizeCanvas(spec); g.clearRect(0, 0, w, h);
    const N = 64, bw = w / N; g.fillStyle = '#161A3B'; g.globalAlpha = 0.18;
    for (let i = 0; i < N; i++) g.fillRect(i * bw + 1, h - 4, bw - 3, 4);
    g.globalAlpha = 1;
  }
  const redrawWaves = () => { players.forEach(drawWave); if (!looping) idleSpectrum(); };
  redrawWaves(); addEventListener('resize', redrawWaves);

  // ---------- GRÁFICO: ruta de 8 semanas ----------
  const WEEKS = [
    { acordes: 3, bpm: 60, txt: 'Re, La7 y Sol. Rasgueo solo hacia abajo y cambios lentos entre acordes.' },
    { acordes: 4, bpm: 80, txt: 'Sumas La. Primer rasgueo de ida y vuelta, abajo y arriba.' },
    { acordes: 6, bpm: 100, txt: 'Mi m y Si m. Tocas el golpe de joropo despacio, sin el apagado.' },
    { acordes: 6, bpm: 115, txt: 'Llega el apagado: la mano frena las cuerdas y nace el sabor llanero.' },
    { acordes: 8, bpm: 130, txt: 'Fa#7 y Do. Acompañas un pajarillo sencillo de principio a fin.' },
    { acordes: 9, bpm: 145, txt: 'Mi7. Seis por derecho, la primera parte, y cambios sin mirar el diapasón.' },
    { acordes: 10, bpm: 160, txt: 'Acordes con media cejilla y golpes de adorno entre compases.' },
    { acordes: 12, bpm: 180, txt: 'Tocas un joropo completo, con introducción, golpe y final.' },
  ];
  const chart = $('#chart');
  if (chart) {
    const NS = 'http://www.w3.org/2000/svg';
    const mk = (t, a, p) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); p && p.appendChild(e); return e; };
    const mqNarrow = matchMedia('(max-width: 600px)');
    const detail = $('#weekDetail');
    let bars = [], dots = [], line = null, sel = 0, shown = false;

    function draw() {
      const narrow = mqNarrow.matches;
      chart.innerHTML = '';
      const VW = narrow ? 400 : 960, VH = narrow ? 390 : 400;
      chart.setAttribute('viewBox', `0 0 ${VW} ${VH}`);
      const X0 = narrow ? 30 : 60, X1 = narrow ? 366 : 900, Y0 = narrow ? 330 : 340, Y1 = 30, bw = (X1 - X0) / 8;
      const yA = a => Y0 - (a / 12) * (Y0 - Y1), yB = b => Y0 - (b / 200) * (Y0 - Y1);
      [0, 3, 6, 9, 12].forEach(v => { mk('line', { x1: X0, x2: X1, y1: yA(v), y2: yA(v), class: 'grid' }, chart); const t = mk('text', { x: X0 - 10, y: yA(v) + 5, 'text-anchor': 'end', class: 'axis' }, chart); t.textContent = v; });
      [60, 120, 180].forEach(v => { const t = mk('text', { x: X1 + (narrow ? 6 : 14), y: yB(v) + 5, class: 'axis axis-r' }, chart); t.textContent = v; });
      bars = [];
      WEEKS.forEach((w, i) => {
        const g = mk('g', { class: 'wk', tabindex: 0, role: 'button', 'aria-label': `Semana ${i + 1}: ${w.acordes} acordes, ${w.bpm} pulsos por minuto` }, chart);
        mk('rect', { x: X0 + i * bw, y: Y1 - 10, width: bw, height: Y0 - Y1 + 50, class: 'wk-hit' }, g);
        const r = mk('rect', { x: X0 + i * bw + bw * (narrow ? 0.14 : 0.2), width: bw * (narrow ? 0.72 : 0.6), y: Y0, height: 0, rx: narrow ? 6 : 8, class: 'bar' }, g);
        r.dataset.y = yA(w.acordes); r.dataset.h = Y0 - yA(w.acordes);
        if (shown) { r.setAttribute('y', r.dataset.y); r.setAttribute('height', r.dataset.h); }
        const v = mk('text', { x: X0 + i * bw + bw / 2, y: Y0 - 14, 'text-anchor': 'middle', class: 'bar-val' }, g); v.textContent = w.acordes;
        const t = mk('text', { x: X0 + i * bw + bw / 2, y: Y0 + 30, 'text-anchor': 'middle', class: 'axis wk-lab' }, g); t.textContent = narrow ? `S${i + 1}` : `Sem ${i + 1}`;
        bars.push({ g, r });
        const pick = () => selectWeek(i);
        g.addEventListener('click', pick);
        g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } if (e.key === 'ArrowRight') bars[Math.min(7, i + 1)].g.focus(); if (e.key === 'ArrowLeft') bars[Math.max(0, i - 1)].g.focus(); });
        g.addEventListener('focus', pick);
      });
      mk('line', { x1: X0, x2: X1, y1: Y0, y2: Y0, class: 'base' }, chart);
      line = mk('polyline', { points: WEEKS.map((w, i) => `${X0 + i * bw + bw / 2},${yB(w.bpm)}`).join(' '), class: 'bpm-line' }, chart);
      dots = WEEKS.map((w, i) => mk('circle', { cx: X0 + i * bw + bw / 2, cy: yB(w.bpm), r: narrow ? 5 : 6, class: 'bpm-dot' }, chart));
      const len = line.getTotalLength ? line.getTotalLength() : 1200;
      line.style.strokeDasharray = len; line.style.strokeDashoffset = shown ? 0 : len;
      selectWeek(sel, true);
    }

    function selectWeek(i, quiet) {
      sel = i;
      bars.forEach((b, k) => b.g.classList.toggle('sel', k === i));
      dots.forEach((d, k) => d.classList.toggle('sel', k === i));
      if (quiet && detail.innerHTML) return;
      const w = WEEKS[i];
      detail.innerHTML = `<p class="wd-week">Semana ${i + 1}</p><p class="wd-txt">${w.txt}</p><p class="wd-nums"><span><strong>${w.acordes}</strong> acordes</span><span><strong>${w.bpm}</strong> pulsos por minuto</span></p>`;
    }
    draw();
    mqNarrow.addEventListener('change', draw);

    const reveal = () => {
      shown = true; chart.classList.add('shown');
      bars.forEach((b, i) => { b.r.style.transitionDelay = reduceMotion ? '0s' : `${i * 70}ms`; b.r.setAttribute('y', b.r.dataset.y); b.r.setAttribute('height', b.r.dataset.h); });
      line.style.strokeDashoffset = 0;
    };
    if ('IntersectionObserver' in window && !reduceMotion) {
      const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { reveal(); io.disconnect(); } }, { threshold: 0.3 });
      io.observe(chart);
    } else reveal();
  }

  // ---------- PRECIOS ----------
  $$('.billing button').forEach(b => b.addEventListener('click', () => {
    $$('.billing button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
    const k = b.dataset.bill;
    $$('[data-mes]').forEach(el => { el.classList.remove('flip'); void el.offsetWidth; el.textContent = el.dataset[k]; el.classList.add('flip'); });
  }));

  // ---------- Guía de componentes multimedia (para la exposición) ----------
  const mmBtn = $('#mmToggle');
  mmBtn && mmBtn.addEventListener('click', () => {
    const on = document.body.classList.toggle('mm-on');
    mmBtn.setAttribute('aria-pressed', String(on));
    mmBtn.lastChild.textContent = on ? ' Ocultar componentes' : ' Ver componentes multimedia';
  });

  // ---------- Menú móvil ----------
  const menuBtn = $('#menuBtn'), sheet = $('#menuSheet');
  if (menuBtn && sheet) {
    const setMenu = open => {
      menuBtn.setAttribute('aria-expanded', String(open)); menuBtn.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
      document.body.classList.toggle('menu-open', open);
      if (open) { sheet.hidden = false; requestAnimationFrame(() => sheet.classList.add('open')); $('a', sheet).focus(); }
      else { sheet.classList.remove('open'); setTimeout(() => { if (!sheet.classList.contains('open')) sheet.hidden = true; }, 250); }
    };
    menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
    $$('a', sheet).forEach(a => a.addEventListener('click', () => setMenu(false)));
    addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.classList.contains('menu-open')) { setMenu(false); menuBtn.focus(); } });
  }

  // ---------- Galería: indicador al deslizar ----------
  const phones = $('.phones'), galDots = $$('.gal-dots i');
  if (phones && galDots.length) {
    phones.addEventListener('scroll', () => {
      const figs = $$('figure', phones), mid = phones.scrollLeft + phones.clientWidth / 2;
      let best = 0; figs.forEach((f, i) => { if (Math.abs(f.offsetLeft + f.clientWidth / 2 - mid) < Math.abs(figs[best].offsetLeft + figs[best].clientWidth / 2 - mid)) best = i; });
      galDots.forEach((d, i) => d.classList.toggle('on', i === best));
    }, { passive: true });
  }

  // ---------- Botón de componentes: aparece al pasar el inicio ----------
  if (mmBtn && 'IntersectionObserver' in window) {
    const heroEl = $('.hero-copy');
    new IntersectionObserver(es => mmBtn.classList.toggle('peek', !es[0].isIntersecting)).observe(heroEl);
  }

  // pausa el video y los audios si el golpe del hero empieza a sonar
  $('#golpeBtn')?.addEventListener('click', () => { pauseAllAudio(); video && video.pause(); });
})();
