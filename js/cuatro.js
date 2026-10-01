/* Cuatro: el instrumento interactivo del hero.
   Síntesis Karplus-Strong en Web Audio, diapasón en SVG, golpe de joropo y reto. */
(() => {
  'use strict';

  // ---------- Datos del instrumento ----------
  const OPEN = [220.00, 293.66, 369.99, 246.94];           // La3 Re4 Fa#4 Si3 (afinación reentrante)
  const STRING_NAMES = ['La', 'Re', 'Fa#', 'Si'];
  const CHORDS = [
    { id: 'Re',  label: 'Re',   frets: [0, 0, 0, 3], bass: 73.42 },
    { id: 'Sol', label: 'Sol',  frets: [2, 0, 1, 0], bass: 98.00 },
    { id: 'La7', label: 'La7',  frets: [0, 2, 1, 2], bass: 110.0 },
    { id: 'La',  label: 'La',   frets: [0, 2, 3, 2], bass: 110.0 },
    { id: 'Mim', label: 'Mi m', frets: [2, 2, 1, 0], bass: 82.41 },
    { id: 'Sim', label: 'Si m', frets: [2, 0, 0, 0], bass: 61.74 },
    { id: 'Fa#7', label: 'Fa#7', frets: [1, 2, 0, 2], bass: 92.50 },
  ];
  const RETO = ['Re', 'La7', 'Re', 'Sol', 'La7', 'Re'];
  // progresiones para acompañar: un acorde por compás de 3/4
  const SONGS = {
    seis: { name: 'Seis por derecho', bars: ['Re', 'Re', 'Sol', 'Sol', 'La7', 'La7', 'Re', 'Re'], bpm: 160 },
    pajarillo: { name: 'Pajarillo', bars: ['Sim', 'Sim', 'Mim', 'Mim', 'Fa#7', 'Fa#7', 'Sim', 'Sim'], bpm: 172 },
  };
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Audio ----------
  let ctx = null, master = null, dry = null, reverb = null;
  const bufCache = new Map();

  function initAudio() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createDynamicsCompressor();
    master.threshold.value = -14; master.ratio.value = 3;
    const out = ctx.createGain(); out.gain.value = 0.9;
    master.connect(out); out.connect(ctx.destination);

    // caja de resonancia: realce de graves + brillo controlado
    const bodyF = ctx.createBiquadFilter(); bodyF.type = 'peaking'; bodyF.frequency.value = 260; bodyF.Q.value = 1.1; bodyF.gain.value = 5;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6800;
    dry = ctx.createGain();
    dry.connect(bodyF); bodyF.connect(lp); lp.connect(master);

    // reverb corta de sala (respuesta al impulso generada)
    reverb = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 0.9), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    reverb.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = 0.16;
    lp.connect(reverb); reverb.connect(wet); wet.connect(master);
    window.dispatchEvent(new Event('cuatro:audio'));
  }

  // Karplus-Strong: una ráfaga de ruido que se repite y se suaviza = cuerda pulsada
  function ksBuffer(freq, opts = {}) {
    const bright = opts.bright ?? 0.6, dur = opts.dur ?? 1.8, decay = opts.decay ?? 0.9966;
    const key = `${freq.toFixed(2)}|${bright}|${dur}|${decay}`;
    if (bufCache.has(key)) return bufCache.get(key);
    const sr = ctx.sampleRate, n = Math.floor(sr * dur), p = Math.max(2, Math.round(sr / freq - 0.5));
    const buf = ctx.createBuffer(1, n, sr), y = buf.getChannelData(0);
    let prev = 0;
    const a = 1 - bright;
    for (let i = 0; i < p && i < n; i++) { const r = Math.random() * 2 - 1; prev = (1 - a) * r + a * prev; y[i] = prev; }
    let m = 0; for (let i = 0; i < p && i < n; i++) m += y[i]; m /= Math.min(p, n);
    for (let i = 0; i < p && i < n; i++) y[i] -= m;          // sin componente continua
    for (let i = p; i < n; i++) y[i] = decay * 0.5 * (y[i - p] + y[i - p - 1 >= 0 ? i - p - 1 : 0]);
    buf.rate = freq * (p + 0.5) / sr;      // el promedio de 2 muestras agrega medio ciclo de retardo: se corrige la afinación
    bufCache.set(key, buf);
    return buf;
  }

  function playNote(freq, when, gain, opts) {
    if (!ctx) return;
    const src = ctx.createBufferSource(); src.buffer = ksBuffer(freq, opts); src.playbackRate.value = src.buffer.rate;
    const g = ctx.createGain(); g.gain.value = gain;
    if (opts && opts.mute) { g.gain.setValueAtTime(gain, when); g.gain.exponentialRampToValueAtTime(0.001, when + 0.11); }
    src.connect(g); g.connect(dry); src.start(when); src.stop(when + (opts?.dur ?? 1.8));
  }

  let noiseBuf = null;
  function noise() {
    if (noiseBuf) return noiseBuf;
    const n = Math.floor(ctx.sampleRate * 0.1); noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }
  function maraca(when, accent) {
    const src = ctx.createBufferSource(); src.buffer = noise();
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 6500; bp.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(0.5 * accent, when + 0.006);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.07);
    src.connect(bp); bp.connect(g); g.connect(master); src.start(when); src.stop(when + 0.1);
  }
  function bassNote(freq, when, dur) {
    const src = ctx.createBufferSource(); src.buffer = ksBuffer(freq, { bright: 0.15, dur: dur + 0.2, decay: 0.9985 }); src.playbackRate.value = src.buffer.rate;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
    const g = ctx.createGain(); g.gain.value = 1.4;
    src.connect(lp); lp.connect(g); g.connect(master); src.start(when);
  }

  // ---------- Estado ----------
  let current = CHORDS[0];
  const freqOf = (s, chord = current) => OPEN[s] * Math.pow(2, chord.frets[s] / 12);

  // ---------- Diapasón SVG ----------
  const svg = document.getElementById('neck');
  if (!svg) return;
  const NS = 'http://www.w3.org/2000/svg';
  const mk = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };

  let L = null;            // geometría actual
  const strings = [];      // {path, y, amp, phase}
  const dots = [];         // círculos de los dedos

  // En celular el diapasón va vertical (cejuela arriba) y los acordes quedan al lado, como en una app de instrumento.
  const mqVertical = window.matchMedia('(max-width: 719px)');
  let frame = null, overlay = null, rippleG = null, lastRipple = 0, level = 0;

  function layout() {
    const vertical = mqVertical.matches;
    // Coordenadas del "marco": x a lo largo del mástil, y a través de las cuerdas.
    const nFrets = vertical ? 5 : 7;
    const nutX = vertical ? 64 : 90;
    const endX = vertical ? 545 : 1010;
    const top = vertical ? 58 : 72, gap = vertical ? 62 : 62;
    const W = vertical ? 640 : 1200;                       // largo total del marco (incluye la tapa)
    const H = vertical ? 300 : 330;                        // ancho total del marco
    const frets = [];
    let x = nutX; const scale = (endX - nutX) / (1 - Math.pow(1 - 1 / 17.817, nFrets));
    frets.push(x);
    for (let i = 1; i <= nFrets; i++) { x = nutX + scale * (1 - Math.pow(1 - 1 / 17.817, i)); frets.push(x); }
    L = { W, H, vertical, compact: vertical, nFrets, nutX, endX, top, gap, frets };
    svg.setAttribute('viewBox', vertical ? `0 0 ${H} ${W}` : `0 0 ${W} ${H}`);
    svg.classList.toggle('is-vertical', vertical);
    build();
  }

  // pasa un punto del marco a la pantalla del SVG (en vertical se intercambian los ejes)
  const P = (x, y) => (L.vertical ? { x: y, y: x } : { x, y });

  function label(x, y, text, cls, anchorH, anchorV) {
    const p = P(x, y);
    const t = mk('text', { x: p.x, y: p.y, class: cls, 'text-anchor': L.vertical ? anchorV : anchorH, 'dominant-baseline': 'central' }, overlay);
    t.textContent = text; return t;
  }

  function build() {
    svg.innerHTML = '';
    strings.length = 0; dots.length = 0;
    const { W, H, vertical, nutX, endX, top, gap, frets } = L;
    const boardTop = top - 40, boardH = gap * 3 + 80, midY = top + gap * 1.5;

    const defs = mk('defs', {}, svg);
    defs.innerHTML = `
      <linearGradient id="wood" ${vertical ? 'x1="0" y1="0" x2="1" y2="0"' : 'x1="0" y1="0" x2="0" y2="1"'}>
        <stop offset="0" stop-color="#9A5329"/><stop offset=".5" stop-color="#7A3E1D"/><stop offset="1" stop-color="#9A5329"/>
      </linearGradient>
      <radialGradient id="hole" cx=".5" cy=".5" r=".5"><stop offset=".55" stop-color="#0b0d1f"/><stop offset="1" stop-color="#1d2148"/></radialGradient>`;

    // el marco se dibuja en horizontal; en vertical se refleja sobre la diagonal
    frame = mk('g', vertical ? { transform: 'matrix(0 1 1 0 0 0)' } : {}, svg);
    overlay = mk('g', { class: 'overlay' }, svg);

    // tapa y boca del cuatro
    const bodyX = endX + 120;
    mk('path', { d: `M${endX - 10} ${boardTop - 18} C ${endX + 120} ${boardTop - 70}, ${W + 80} ${boardTop - 20}, ${W + 80} ${H / 2} C ${W + 80} ${H - boardTop + 20}, ${endX + 120} ${H - boardTop + 70}, ${endX - 10} ${H - boardTop + 18}Z`, fill: '#D9A15A' }, frame);
    mk('circle', { cx: bodyX, cy: midY, r: 72, fill: '#5B3415' }, frame);
    mk('circle', { cx: bodyX, cy: midY, r: 62, fill: 'url(#hole)' }, frame);
    rippleG = mk('g', { class: 'ripples' }, frame);
    L.hole = { cx: bodyX, cy: midY };
    // diapasón
    mk('rect', { x: nutX - 26, y: boardTop, width: endX - nutX + 26, height: boardH, rx: 14, fill: 'url(#wood)' }, frame);
    [3, 5, 7].forEach(f => { if (f <= L.nFrets) mk('circle', { cx: (frets[f - 1] + frets[f]) / 2, cy: midY, r: 8, fill: '#F1D9B0', opacity: .45 }, frame); });
    mk('rect', { x: nutX - 8, y: boardTop, width: 10, height: boardH, fill: '#FBFBF7' }, frame);
    for (let i = 1; i < frets.length; i++) {
      mk('rect', { x: frets[i] - 2, y: boardTop, width: 4, height: boardH, fill: '#C9CCD6' }, frame);
    }
    // cuerdas
    for (let s = 0; s < 4; s++) {
      const y = top + s * gap;
      const path = mk('path', { d: `M${nutX} ${y} L${bodyX} ${y}`, class: 'string', 'stroke-width': s === 1 || s === 3 ? 3.4 : 2.4 }, frame);
      strings.push({ path, y, amp: 0, t0: 0, x2: bodyX });
    }
    // textos (siempre derechos, por eso van fuera del marco reflejado)
    for (let i = 1; i < frets.length; i++) label((frets[i - 1] + frets[i]) / 2, vertical ? H - 14 : boardTop + boardH + 26, String(i), 'fret-num', 'middle', 'middle');
    for (let s = 0; s < 4; s++) label(vertical ? nutX - 42 : nutX - 40, top + s * gap, STRING_NAMES[s], 'str-name', 'end', 'middle');
    // dedos
    for (let s = 0; s < 4; s++) {
      const g = mk('g', { class: 'dot' }, overlay);
      mk('circle', { r: vertical ? 22 : 21 }, g);
      const t = mk('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central' }, g);
      dots.push({ g, t });
    }
    const vb = svg.viewBox.baseVal;
    mk('rect', { x: 0, y: 0, width: vb.width, height: vb.height, fill: 'transparent', class: 'hit' }, svg);
    placeDots(true);
  }

  function placeDots(instant) {
    for (let s = 0; s < 4; s++) {
      const f = current.frets[s], d = dots[s];
      if (!f || f > L.nFrets) { d.g.classList.remove('on'); continue; }
      const p = P((L.frets[f - 1] + L.frets[f]) / 2, L.top + s * L.gap);
      d.g.style.transition = instant ? 'none' : '';
      d.g.setAttribute('transform', `translate(${p.x} ${p.y})`);
      d.t.textContent = f;
      d.g.classList.add('on');
    }
  }

  // vibración de cuerdas
  let raf = 0;
  function ripple(v) {
    const now = performance.now();
    if (reduceMotion || !rippleG || now - lastRipple < 110) return;
    lastRipple = now;
    const c = mk('circle', { cx: L.hole.cx, cy: L.hole.cy, r: 64, class: 'ripple' }, rippleG);
    c.style.setProperty('--o', Math.min(0.9, 0.35 + v * 0.5).toFixed(2));
    c.addEventListener('animationend', () => c.remove());
    if (rippleG.childNodes.length > 8) rippleG.firstChild.remove();
  }
  function excite(s, v = 1) {
    const st = strings[s]; if (!st) return;
    ripple(v);
    st.amp = Math.min(1.3, st.amp * 0.4 + v); st.t0 = performance.now();
    if (!raf) raf = requestAnimationFrame(tick);
  }
  function tick(now) {
    let alive = false; level = 0;
    for (const st of strings) {
      if (st.amp < 0.01) { st.path.setAttribute('d', `M${L.nutX} ${st.y} L${st.x2} ${st.y}`); st.path.classList.remove('ringing'); continue; }
      alive = true;
      const dt = (now - st.t0) / 1000;
      const a = st.amp * Math.exp(-dt * 3.4);
      if (a < 0.01) { st.amp = 0; continue; }
      level += a;
      const off = reduceMotion ? 0 : a * (L.vertical ? 11 : 13) * Math.sin(now / 1000 * 2 * Math.PI * 13);
      const mid = (L.nutX + st.x2) / 2;
      st.path.setAttribute('d', `M${L.nutX} ${st.y} Q${mid} ${st.y + off * 2} ${st.x2} ${st.y}`);
      st.path.classList.add('ringing');
    }
    raf = alive ? requestAnimationFrame(tick) : 0;
  }

  // ---------- Tocar ----------
  let lastPointerType = 'mouse';
  const buzz = ms => { if (lastPointerType === 'touch' && navigator.vibrate) try { navigator.vibrate(ms); } catch (_) {} };
  function pluck(s, vel = 0.8, when) {
    initAudio(); if (when === undefined) buzz(7);
    const t = when ?? (ctx ? ctx.currentTime : 0);
    if (ctx) playNote(freqOf(s), t, 0.55 * vel, { bright: 0.45 + vel * 0.35 });
    const delay = ctx && when ? Math.max(0, (when - ctx.currentTime) * 1000) : 0;
    setTimeout(() => excite(s, vel), delay);
  }

  function strum(dir = 'down', vel = 0.9, when, mute = false) {
    initAudio();
    const order = dir === 'down' ? [0, 1, 2, 3] : [3, 2, 1, 0];
    const t0 = when ?? (ctx ? ctx.currentTime + 0.005 : 0);
    order.forEach((s, k) => {
      const t = t0 + k * 0.011;
      if (ctx) playNote(freqOf(s), t, (dir === 'down' ? 0.5 : 0.38) * vel, mute ? { bright: 0.35, dur: 0.15, decay: 0.97, mute: true } : { bright: 0.45 + vel * 0.3 });
      const delay = ctx ? Math.max(0, (t - ctx.currentTime) * 1000) : k * 11;
      setTimeout(() => excite(s, mute ? 0.25 : vel), delay);
    });
    if (mute && ctx) maraca(t0, 0.5);
    window.dispatchEvent(new CustomEvent('cuatro:strum', { detail: { chord: current.id, dir, mute } }));
  }

  // ---------- Entrada del puntero: cruzar cuerdas las toca ----------
  let down = false, lastY = null, lastT = 0, usedPointer = false;
  function toLocal(e) {
    const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
    const sx = (e.clientX - r.left) / r.width * vb.width, sy = (e.clientY - r.top) / r.height * vb.height;
    return L.vertical ? { x: sy, y: sx } : { x: sx, y: sy };
  }
  function crossing(y0, y1, speed) {
    const lo = Math.min(y0, y1), hi = Math.max(y0, y1);
    const hits = [];
    strings.forEach((st, s) => { if (st.y > lo && st.y <= hi) hits.push(s); });
    if (y1 < y0) hits.reverse();
    const vel = Math.max(0.35, Math.min(1, speed));
    hits.forEach((s, k) => setTimeout(() => pluck(s, vel), k * 8));
    if (hits.length) hideHint();
  }
  svg.addEventListener('pointerdown', e => {
    initAudio(); down = true; usedPointer = true; lastPointerType = e.pointerType;
    svg.setPointerCapture?.(e.pointerId);
    const p = toLocal(e); lastY = p.y; lastT = performance.now();
    // tocar directamente encima de una cuerda la pulsa
    strings.forEach((st, s) => { if (Math.abs(st.y - p.y) < L.gap * 0.28) { pluck(s, 0.8); hideHint(); } });
  });
  svg.addEventListener('pointermove', e => {
    const p = toLocal(e), now = performance.now();
    // con el mouse, pasar por encima también toca (una vez que el audio está activo)
    const active = down || (e.pointerType === 'mouse' && ctx);
    if (active && lastY !== null) crossing(lastY, p.y, Math.abs(p.y - lastY) / Math.max(1, now - lastT) * 0.6);
    lastY = p.y; lastT = now;
  });
  ['pointerup', 'pointercancel'].forEach(ev => svg.addEventListener(ev, () => { down = false; }));
  svg.addEventListener('pointerleave', () => { lastY = null; down = false; });

  const hint = document.getElementById('neckHint');
  function hideHint() { hint && hint.classList.add('gone'); }

  // ---------- Botones de acordes ----------
  const chordBox = document.querySelector('.chords');
  CHORDS.forEach((c, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chord-btn'; b.dataset.id = c.id;
    b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', i === 0 ? 'true' : 'false');
    b.innerHTML = `<span class="cb-name">${c.label}</span><span class="cb-key" aria-hidden="true">${i + 1}</span>`;
    b.addEventListener('click', () => { setChord(c.id); if (!golpe.on) strum('down', 0.85); });
    chordBox.appendChild(b);
  });
  function setChord(id, fromSong) {
    const c = CHORDS.find(x => x.id === id); if (!c) return;
    if (!fromSong && song.id) pickSong(null);
    current = c;
    chordBox.querySelectorAll('.chord-btn').forEach(b => b.setAttribute('aria-checked', b.dataset.id === id ? 'true' : 'false'));
    placeDots(false);
  }

  document.getElementById('strumBtn').addEventListener('click', () => strum('down', 0.9));

  // ---------- Golpe de joropo automático (3/4, corcheas: ↓ · ↓ ↑ ✕ ↑) ----------
  const PATTERN = [{ d: 'down', v: 1 }, null, { d: 'down', v: 0.8 }, { d: 'up', v: 0.7 }, { d: 'down', v: 0.9, m: true }, { d: 'up', v: 0.7 }];
  const golpe = { on: false, bpm: 150, step: 0, next: 0, timer: 0 };
  const golpeBtn = document.getElementById('golpeBtn');
  const tempo = document.getElementById('tempo'), tempoOut = document.getElementById('tempoOut');
  tempo.addEventListener('input', () => { golpe.bpm = +tempo.value; tempoOut.textContent = tempo.value; });

  function scheduler() {
    const eighth = 60 / golpe.bpm / 2;
    while (golpe.next < ctx.currentTime + 0.12) {
      const st = PATTERN[golpe.step % 6];
      if (golpe.step % 6 === 0 && song.id) {
        const bar = song.i % SONGS[song.id].bars.length, at0 = golpe.next;
        setChord(SONGS[song.id].bars[bar], true);
        setTimeout(() => markBar(bar), Math.max(0, (at0 - ctx.currentTime) * 1000));
        song.i++;
      }
      if (st) strum(st.d, st.v, golpe.next, !!st.m);
      maraca(golpe.next, golpe.step % 6 === 0 || golpe.step % 6 === 3 ? 1 : 0.55);
      if (golpe.step % 6 === 0) bassNote(current.bass, golpe.next, eighth * 3);
      if (golpe.step % 6 === 4) bassNote(current.bass, golpe.next, eighth * 2);
      const stepIdx = golpe.step % 6, at = golpe.next;
      setTimeout(() => window.dispatchEvent(new CustomEvent('cuatro:beat', { detail: stepIdx })), Math.max(0, (at - ctx.currentTime) * 1000));
      golpe.next += eighth; golpe.step++;
    }
  }
  function toggleGolpe(force) {
    initAudio(); if (!ctx) return;
    golpe.on = force ?? !golpe.on;
    golpeBtn.setAttribute('aria-pressed', String(golpe.on));
    golpeBtn.textContent = golpe.on ? 'Parar golpe' : 'Golpe de joropo';
    document.getElementById('instrument').classList.toggle('playing', golpe.on);
    if (golpe.on) { song.i = 0; golpe.step = 0; golpe.next = ctx.currentTime + 0.08; golpe.timer = setInterval(scheduler, 25); hideHint(); }
    else { clearInterval(golpe.timer); beatCells.forEach(c => c.classList.remove('on')); markBar(-1); }
  }
  golpeBtn.addEventListener('click', () => toggleGolpe());
  const beatCells = [...document.querySelectorAll('#beat span')];
  window.addEventListener('cuatro:beat', e => { if (!golpe.on) return; beatCells.forEach((c, i) => c.classList.toggle('on', i === e.detail)); });
  // ---------- Acompañar una canción ----------
  const song = { id: null, i: 0 };
  const songBtns = [...document.querySelectorAll('.song-btn')], barsEl = document.getElementById('bars');
  function renderBars() {
    if (!barsEl) return;
    barsEl.innerHTML = song.id ? SONGS[song.id].bars.map(id => `<li>${CHORDS.find(c => c.id === id).label}</li>`).join('') : '';
    barsEl.hidden = !song.id;
  }
  function markBar(i) { barsEl && [...barsEl.children].forEach((li, k) => li.classList.toggle('on', k === i)); }
  function pickSong(id) {
    song.id = id; song.i = 0;
    songBtns.forEach(b => b.setAttribute('aria-checked', String((b.dataset.song || null) === id)));
    renderBars();
    if (id) {
      golpe.bpm = SONGS[id].bpm; tempo.value = golpe.bpm; tempoOut.textContent = golpe.bpm;
      if (!golpe.on) { setChord(SONGS[id].bars[0], true); toggleGolpe(true); }
      else { song.i = 0; }
    }
  }
  songBtns.forEach(b => b.addEventListener('click', () => { initAudio(); pickSong(b.dataset.song || null); }));

  document.addEventListener('visibilitychange', () => { if (document.hidden && golpe.on) toggleGolpe(false); });

  // ---------- Teclado ----------
  window.addEventListener('keydown', e => {
    if (e.target.closest('input, textarea, select, [contenteditable]')) return;
    const r = svg.getBoundingClientRect();
    const visible = r.bottom > 0 && r.top < window.innerHeight;
    if (!visible) return;
    if (/^[1-7]$/.test(e.key)) { setChord(CHORDS[+e.key - 1].id); if (!golpe.on) strum('down', 0.85); }
    else if (e.code === 'Space' && !e.target.closest('button, a, summary')) { e.preventDefault(); strum(e.shiftKey ? 'up' : 'down', 0.9); }
  });

  // ---------- Reto ----------
  const retoBtn = document.getElementById('retoBtn'), retoSteps = document.getElementById('retoSteps'), retoMsg = document.getElementById('retoMsg');
  const reto = { on: false, i: 0, start: 0 };
  function renderReto() {
    retoSteps.innerHTML = RETO.map((id, i) => {
      const c = CHORDS.find(x => x.id === id);
      const cls = !reto.on ? '' : i < reto.i ? 'done' : i === reto.i ? 'now' : '';
      return `<li class="${cls}"><span>${c.label}</span></li>`;
    }).join('');
  }
  renderReto();
  retoBtn.addEventListener('click', () => {
    if (golpe.on) toggleGolpe(false);
    reto.on = true; reto.i = 0; reto.start = performance.now();
    retoBtn.textContent = 'Reiniciar';
    retoMsg.textContent = `Primero: ${CHORDS.find(c => c.id === RETO[0]).label}. Elige el acorde y rasguea.`;
    document.getElementById('reto').classList.add('active');
    renderReto();
  });
  window.addEventListener('cuatro:strum', e => {
    if (!reto.on || golpe.on || e.detail.mute) return;
    const want = RETO[reto.i];
    if (e.detail.chord === want) {
      reto.i++;
      if (reto.i >= RETO.length) {
        const secs = ((performance.now() - reto.start) / 1000).toFixed(1);
        reto.on = false; renderReto();
        retoSteps.querySelectorAll('li').forEach(li => li.classList.add('done'));
        retoMsg.textContent = `Lo lograste en ${secs} segundos. Ese es el ejercicio del día 1 de la app.`;
        retoBtn.textContent = 'Jugar otra vez';
        document.getElementById('reto').classList.add('won');
        setTimeout(() => document.getElementById('reto').classList.remove('won'), 1600);
        // remate: un golpe corto para celebrar
        if (ctx) { const t = ctx.currentTime + 0.25; [0, 0.18, 0.36].forEach((d, k) => strum(k === 1 ? 'up' : 'down', 1, t + d)); }
        return;
      }
      retoMsg.textContent = `Bien. Ahora: ${CHORDS.find(c => c.id === RETO[reto.i]).label}.`;
    } else {
      retoMsg.textContent = `Ese fue ${CHORDS.find(c => c.id === e.detail.chord).label}. Busca ${CHORDS.find(c => c.id === want).label} y vuelve a rasguear.`;
    }
    renderReto();
  });

  // ---------- Arranque: una sola secuencia de entrada (las cuerdas "se afinan" en silencio) ----------
  layout();
  mqVertical.addEventListener('change', layout);
  if (!reduceMotion) [0, 1, 2, 3].forEach(s => setTimeout(() => excite(s, 0.7), 900 + s * 140));

  // nota de referencia del afinador: corta la anterior para que no se mezclen
  let refPrev = null;
  function refNote(f, gain = 0.6) {
    initAudio(); if (!ctx) return;
    const t = ctx.currentTime + 0.01;
    if (refPrev) { try { refPrev.g.gain.cancelScheduledValues(t); refPrev.g.gain.setTargetAtTime(0, t, 0.015); refPrev.src.stop(t + 0.1); } catch (_) {} }
    const src = ctx.createBufferSource(); src.buffer = ksBuffer(f, { bright: 0.6, dur: 2.4, decay: 0.998 }); src.playbackRate.value = src.buffer.rate;
    const g = ctx.createGain(); g.gain.value = gain;
    src.connect(g); g.connect(dry); src.start(t + 0.03);
    refPrev = { src, g };
  }
  window.Cuatro = { strum, setChord, initAudio, playNote: refNote, get level() { return level; }, get dry() { return dry; }, get ctx() { return ctx; }, get master() { return master; } };
})();
