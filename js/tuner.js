/* Cuatro: afinador con micrófono (autocorrelación) y notas de referencia. */
(() => {
  'use strict';
  const root = document.getElementById('tuner');
  if (!root) return;

  const STRINGS = [
    { name: 'La', f: 220.00 }, { name: 'Re', f: 293.66 }, { name: 'Fa#', f: 369.99 }, { name: 'Si', f: 246.94 },
  ];
  const needle = document.getElementById('needle'), tNote = document.getElementById('tNote'), tInfo = document.getElementById('tInfo');
  const micBtn = document.getElementById('micBtn'), tabs = [...root.querySelectorAll('.t-strings button')];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // marcas del medidor cada 10 cents
  const ticks = root.querySelector('.g-ticks');
  for (let c = -50; c <= 50; c += 10) {
    const a = (c / 50) * 60 * Math.PI / 180, r1 = 168, r2 = c % 50 === 0 ? 186 : (c === 0 ? 188 : 178);
    const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    l.setAttribute('x1', 200 + r1 * Math.sin(a)); l.setAttribute('y1', 210 - r1 * Math.cos(a));
    l.setAttribute('x2', 200 + r2 * Math.sin(a)); l.setAttribute('y2', 210 - r2 * Math.cos(a));
    ticks.appendChild(l);
  }

  let analyser = null, buf = null, stream = null, micSrc = null, raf = 0, listenUntil = 0;
  let shownAngle = 0, targetAngle = 0, lastHeard = 0, frameN = 0;

  function ensureAnalyser() {
    if (!window.Cuatro) return null;
    window.Cuatro.initAudio();
    const ctx = window.Cuatro.ctx; if (!ctx) return null;
    if (!analyser) {
      analyser = ctx.createAnalyser(); analyser.fftSize = 2048;
      const sink = ctx.createGain(); sink.gain.value = 0; analyser.connect(sink); sink.connect(ctx.destination);
      buf = new Float32Array(analyser.fftSize);
      // las notas de referencia también pasan por el analizador
      try { window.Cuatro.dry.connect(analyser); } catch (_) {}
    }
    return analyser;
  }

  // YIN: diferencia normalizada acumulada; devuelve la frecuencia o -1 si no hay tono claro
  function detectPitch(x, sr) {
    const n = x.length;
    let mean = 0, rms = 0;
    for (let i = 0; i < n; i++) mean += x[i];
    mean /= n;
    for (let i = 0; i < n; i++) { const v = x[i] - mean; rms += v * v; }
    rms = Math.sqrt(rms / n);
    if (rms < 0.006) return -1;
    const minLag = Math.floor(sr / 1000), maxLag = Math.min(Math.floor(sr / 70), n >> 1), W = n - maxLag;
    const d = new Float32Array(maxLag + 1);
    for (let tau = 1; tau <= maxLag; tau++) {
      let s = 0;
      for (let i = 0; i < W; i++) { const df = x[i] - x[i + tau]; s += df * df; }
      d[tau] = s;
    }
    // normalización acumulada
    let run = 0; d[0] = 1;
    for (let tau = 1; tau <= maxLag; tau++) { run += d[tau]; d[tau] = run ? d[tau] * tau / run : 1; }
    let tau = -1;
    for (let t = Math.max(2, minLag); t < maxLag; t++) {
      if (d[t] < 0.15) { while (t + 1 < maxLag && d[t + 1] < d[t]) t++; tau = t; break; }
    }
    if (tau < 0) return -1;
    const a = d[tau - 1], b = d[tau], c = d[tau + 1];
    const den = a + c - 2 * b;
    const T = den ? tau + (a - c) / (2 * den) : tau;
    return sr / T;
  }

  const cents = (f, ref) => 1200 * Math.log2(f / ref);

  function show(f) {
    // cuerda más cercana (en cents)
    let k = 0, bc = Infinity;
    STRINGS.forEach((s, i) => { const c = Math.abs(cents(f, s.f)); if (c < bc) { bc = c; k = i; } });
    const c = cents(f, STRINGS[k].f);
    targetAngle = Math.max(-60, Math.min(60, (c / 50) * 60));
    const ok = Math.abs(c) < 5;
    root.classList.toggle('in-tune', ok);
    tNote.textContent = STRINGS[k].name;
    if (Math.abs(c) > 150) tInfo.textContent = `${f.toFixed(0)} Hz: muy lejos de ${STRINGS[k].name}. Revisa qué cuerda estás tocando.`;
    else tInfo.textContent = ok ? `${f.toFixed(1)} Hz: afinada` : `${f.toFixed(1)} Hz: ${c < 0 ? 'sube' : 'baja'} ${Math.abs(c).toFixed(0)} cents`;
    tabs.forEach((t, i) => t.classList.toggle('on', i === k));
  }

  function loop() {
    const now = performance.now();
    if (analyser && (stream || now < listenUntil) && (frameN++ & 1) === 0) {
      analyser.getFloatTimeDomainData(buf);
      const f = detectPitch(buf, window.Cuatro.ctx.sampleRate);
      if (f > 70 && f < 1000) { show(f); lastHeard = now; }
      else if (now - lastHeard > 1200) { targetAngle = 0; root.classList.remove('in-tune'); }
    }
    // la aguja se mueve con un resorte suave
    shownAngle += (targetAngle - shownAngle) * (reduceMotion ? 1 : 0.18);
    needle.setAttribute('transform', `rotate(${shownAngle.toFixed(2)} 200 210)`);
    if (stream || now < listenUntil || Math.abs(targetAngle - shownAngle) > 0.05) raf = requestAnimationFrame(loop);
    else raf = 0;
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };

  // notas de referencia
  tabs.forEach((t, i) => t.addEventListener('click', () => {
    if (!ensureAnalyser()) return;
    window.Cuatro.playNote(STRINGS[i].f, 0.7);
    listenUntil = performance.now() + 2600; kick();
  }));

  // micrófono
  async function startMic() {
    if (!ensureAnalyser()) return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      tInfo.textContent = 'El micrófono solo funciona con la página publicada (https). Usa las notas de referencia.';
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      micSrc = window.Cuatro.ctx.createMediaStreamSource(stream);
      micSrc.connect(analyser);          // no va a los parlantes: evita el acople
      micBtn.textContent = 'Apagar micrófono'; micBtn.setAttribute('aria-pressed', 'true');
      root.classList.add('listening');
      tInfo.textContent = 'Escuchando. Toca una cuerda al aire.';
      kick();
    } catch (err) {
      stream = null;
      tInfo.textContent = err && err.name === 'NotAllowedError'
        ? 'El navegador bloqueó el micrófono. Permítelo desde el candado junto a la dirección y vuelve a intentar.'
        : 'No encontramos un micrófono. Puedes usar las notas de referencia.';
    }
  }
  function stopMic() {
    if (stream) stream.getTracks().forEach(t => t.stop());
    try { micSrc && micSrc.disconnect(); } catch (_) {}
    stream = null; micSrc = null;
    micBtn.textContent = 'Usar micrófono'; micBtn.setAttribute('aria-pressed', 'false');
    root.classList.remove('listening', 'in-tune'); targetAngle = 0; kick();
    tInfo.textContent = 'Toca una cuerda o una nota de referencia';
  }
  micBtn.addEventListener('click', () => (stream ? stopMic() : startMic()));
  document.addEventListener('visibilitychange', () => { if (document.hidden && stream) stopMic(); });
})();
