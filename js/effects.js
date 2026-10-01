/* Cuatro: efectos visuales. Cielo que responde al sonido, atardecer con scroll, títulos y pantallas. */
(() => {
  'use strict';
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

  // ---------- Cielo llanero: estrellas que brillan más cuando suena el cuatro ----------
  const sky = document.getElementById('sky');
  if (sky) {
    const g = sky.getContext('2d');
    let stars = [], W = 0, H = 0, dpr = 1, energy = 0, running = false, visible = true;
    let shooting = null, lastShoot = 0;
    function resize() {
      dpr = Math.min(2, devicePixelRatio || 1);
      W = sky.clientWidth; H = sky.clientHeight;
      sky.width = Math.round(W * dpr); sky.height = Math.round(H * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(220, (W * H) / 7000));
      stars = Array.from({ length: n }, () => ({
        x: Math.random() * W, y: Math.pow(Math.random(), 1.6) * H * 0.7,
        r: Math.random() < 0.08 ? 1.5 + Math.random() * 0.8 : 0.5 + Math.random() * 0.9,
        a: 0.15 + Math.random() * 0.55, sp: 0.6 + Math.random() * 2.2, ph: Math.random() * 6.28,
        gold: Math.random() < 0.14,
      }));
      if (reduceMotion) draw(0);
    }
    function draw(t) {
      g.clearRect(0, 0, W, H);
      const lvl = window.Cuatro ? window.Cuatro.level : 0;
      energy += (Math.min(1.6, lvl / 2.2) - energy) * (lvl / 2.2 > energy ? 0.35 : 0.05);
      for (const s of stars) {
        const tw = reduceMotion ? 1 : 0.65 + 0.35 * Math.sin(t / 1000 * s.sp + s.ph);
        const fade = Math.max(0, 1 - s.y / (H * 0.7));          // más estrellas arriba, se apagan hacia los controles
        const a = Math.min(1, s.a * tw * (1 + energy * 1.4)) * fade;
        if (a < 0.02) continue;
        g.globalAlpha = a;
        g.fillStyle = s.gold ? '#F3CF73' : '#FBFBF7';
        const r = s.r * (1 + energy * (s.gold ? 0.9 : 0.35));
        g.beginPath(); g.arc(s.x, s.y, r, 0, 6.283); g.fill();
      }
      // estrella fugaz cuando el golpe suena fuerte
      if (!reduceMotion && energy > 0.9 && t - lastShoot > 3500 && !shooting) {
        lastShoot = t;
        shooting = { x: W * (0.15 + Math.random() * 0.5), y: H * (0.05 + Math.random() * 0.2), t0: t };
      }
      if (shooting) {
        const p = (t - shooting.t0) / 900;
        if (p >= 1) shooting = null;
        else {
          const len = 140, dx = 260 * p, dy = 90 * p, x = shooting.x + dx, y = shooting.y + dy;
          const grad = g.createLinearGradient(x - len, y - len * 0.35, x, y);
          grad.addColorStop(0, 'rgba(243,207,115,0)'); grad.addColorStop(1, `rgba(251,251,247,${0.9 * (1 - p)})`);
          g.globalAlpha = 1; g.strokeStyle = grad; g.lineWidth = 2; g.lineCap = 'round';
          g.beginPath(); g.moveTo(x - len, y - len * 0.35); g.lineTo(x, y); g.stroke();
        }
      }
      g.globalAlpha = 1;
    }
    function frame(t) { if (!running) return; draw(t); requestAnimationFrame(frame); }
    function start() { if (running || reduceMotion || !visible) return; running = true; requestAnimationFrame(frame); }
    function stop() { running = false; }
    resize(); addEventListener('resize', () => { resize(); });
    new IntersectionObserver(es => { visible = es[0].isIntersecting; visible ? start() : stop(); }).observe(sky);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    start();
  }

  // ---------- Atardecer: el sol baja detrás de los morichales al hacer scroll ----------
  const llano = document.getElementById('llano');
  if (llano && !reduceMotion) {
    const sol = llano.querySelector('.lyr-sol'), noche = llano.querySelector('.lyr-noche');
    const garzas = llano.querySelector('.lyr-garzas'), tierra = llano.querySelector('.lyr-tierra');
    let ticking = false, active = false;
    const update = () => {
      ticking = false;
      const r = llano.getBoundingClientRect(), vh = innerHeight;
      const p = Math.max(0, Math.min(1, (vh - r.top) / (vh + r.height)));   // 0 al entrar, 1 al salir
      sol.style.transform = `translate3d(0, ${(p - 0.25) * 34}%, 0)`;
      noche.style.opacity = Math.max(0, (p - 0.35) * 1.1).toFixed(3);
      garzas.style.transform = `translate3d(${(p - 0.5) * 16}%, ${(0.5 - p) * 6}%, 0)`;
      tierra.style.transform = `translate3d(0, ${(0.5 - p) * 3}%, 0)`;
    };
    const onScroll = () => { if (active && !ticking) { ticking = true; requestAnimationFrame(update); } };
    new IntersectionObserver(es => { active = es[0].isIntersecting; if (active) update(); }, { rootMargin: '100px' }).observe(llano);
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll);
    update();
  }

  // ---------- Títulos que se revelan una vez al entrar ----------
  if (!reduceMotion && 'IntersectionObserver' in window) {
    const heads = document.querySelectorAll('.sec h2, .app-sky h2, .final h2');
    document.documentElement.classList.add('fx');
    // se observa el contenedor: el recorte del título haría que el navegador lo considere invisible
    const map = new Map();
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      map.get(e.target).forEach(h => h.classList.add('in')); io.unobserve(e.target);
    }), { threshold: 0, rootMargin: '0px 0px -12% 0px' });
    heads.forEach(h => {
      h.classList.add('reveal');
      const box = h.parentElement;
      if (!map.has(box)) { map.set(box, []); io.observe(box); }
      map.get(box).push(h);
    });
  }

  // ---------- Pantallas de la app: se inclinan siguiendo el mouse ----------
  if (finePointer && !reduceMotion) {
    document.querySelectorAll('.phones figure').forEach(fig => {
      const img = fig.querySelector('img');
      fig.addEventListener('pointermove', e => {
        const r = img.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        img.style.transform = `perspective(900px) rotateY(${x * 14}deg) rotateX(${-y * 10}deg) translateY(-6px)`;
      });
      fig.addEventListener('pointerleave', () => { img.style.transform = ''; });
    });
  }
})();
