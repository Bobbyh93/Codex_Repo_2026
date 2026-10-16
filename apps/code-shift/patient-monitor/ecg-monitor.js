/*
 * ecg-monitor.js — sweeping bedside-monitor trace on a <canvas>.
 *
 * Draws like a real monitor: the trace is written at the beam position, an erase
 * bar clears the old trace just ahead of it, and the sweep wraps at the right edge.
 * Paper speed 25 mm/s; 1 mV = 10 mm; grid 1 mm / 5 mm.
 *
 *   const mon = EcgMonitor.mount(canvas, { rhythm: 'nsr', rate: 75, theme: 'monitor', seconds: 6 });
 *   mon.setRhythm('afib', { rate: 110 });   mon.setRate(90);   mon.inject('pvc');
 *   mon.pause(); mon.resume(); mon.getState(); mon.setState(json); mon.onHr(hr => ...);
 *   mon.destroy();
 *
 * Depends on ecg-rhythms.js (window.EcgRhythms or require('./ecg-rhythms')).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./ecg-rhythms'));
  else root.EcgMonitor = factory(root.EcgRhythms);
}(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this), function (EcgRhythms) {
  'use strict';

  const THEMES = {
    monitor: { bg: '#0B0F0C', minor: '#13261A', major: '#1C3D25', trace: '#3DFF5A', beam: '#CFFFD8', text: '#3DFF5A' },
    paper: { bg: '#FFFBFB', minor: '#F5D3D3', major: '#E39A9A', trace: '#101010', beam: '#101010', text: '#1A1A1A' }
  };

  function mount(canvas, opts) {
    opts = opts || {};
    const ctx = canvas.getContext('2d');
    let theme = THEMES[opts.theme] || THEMES.monitor;
    let seconds = opts.seconds || 6;          // seconds across the screen
    const speed = 25;                          // mm/s
    const mmPerMv = 10;
    let pulse = opts.pulse !== false;
    let hrCb = null, hrLast = -1, hrTimer = 0;

    let W = 0, H = 0, dpr = 1, pxPerMm = 1, baseY = 0, grid = null;
    let src = null, rhythm = null, extra = {};
    let simT = 0, lastReal = 0, lastSimT = 0, lastX = null, lastY = null, paused = false, raf = 0, destroyed = false;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      pxPerMm = W / (seconds * speed);
      baseY = H * 0.62;
      grid = document.createElement('canvas'); grid.width = canvas.width; grid.height = canvas.height;
      const gc = grid.getContext('2d'); gc.setTransform(dpr, 0, 0, dpr, 0, 0);
      gc.fillStyle = theme.bg; gc.fillRect(0, 0, W, H);
      for (let i = 0; i * pxPerMm <= W; i++) { gc.strokeStyle = i % 5 ? theme.minor : theme.major; gc.lineWidth = i % 5 ? 0.5 : 1;
        const x = Math.round(i * pxPerMm) + 0.5; gc.beginPath(); gc.moveTo(x, 0); gc.lineTo(x, H); gc.stroke(); }
      for (let j = 0; j * pxPerMm <= H; j++) { gc.strokeStyle = j % 5 ? theme.minor : theme.major; gc.lineWidth = j % 5 ? 0.5 : 1;
        const y = Math.round(baseY - j * pxPerMm) + 0.5; if (y < 0) break; gc.beginPath(); gc.moveTo(0, y); gc.lineTo(W, y); gc.stroke();
        const y2 = Math.round(baseY + j * pxPerMm) + 0.5; gc.beginPath(); gc.moveTo(0, y2); gc.lineTo(W, y2); gc.stroke(); }
      ctx.drawImage(grid, 0, 0, W, H);
      lastX = null;
    }

    function xOf(t) { return ((t % seconds) / seconds) * W; }
    function yOf(v) { return baseY - v * mmPerMv * pxPerMm; }

    function frame(now) {
      if (destroyed) return;
      raf = requestAnimationFrame(frame);
      if (!lastReal) { lastReal = now; return; }
      let dt = (now - lastReal) / 1000; lastReal = now;
      if (paused || !src) return;
      if (dt > 0.25) dt = 0.25;                 // tab was hidden: skip ahead, don't burst-draw
      simT += dt;
      const step = 1 / 300;
      ctx.lineWidth = 1.6; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = theme.trace;
      const gap = Math.max(10, 0.25 * W / seconds);     // a quarter second of blank ahead of the beam
      for (let t = lastSimT + step; t <= simT; t += step) {
        const x = xOf(t), y = yOf(src.sample(t));
        if (lastX !== null && x < lastX) lastX = null;   // wrapped
        // erase from just past the previous point (clears the old beam) to a gap ahead of the new one
        const ex = lastX === null ? x : lastX + 1, ew = Math.min(x + gap, W) - ex;
        if (ew > 0) ctx.drawImage(grid, ex * dpr, 0, ew * dpr, H * dpr, ex, 0, ew, H);
        if (lastX !== null) { ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(x, y); ctx.stroke(); }
        lastX = x; lastY = y;
      }
      lastSimT = simT;
      // beam marker, inside the zone the next frame erases
      if (lastX !== null) { ctx.fillStyle = theme.beam; ctx.fillRect(Math.min(W - 2, lastX + 1), 0, 2, H); }
      hrTimer += dt;
      if (hrTimer > 0.5 && hrCb) { hrTimer = 0; const hr = src.hr(simT); if (hr !== hrLast) { hrLast = hr; hrCb(hr, pulse); } }
    }

    function setRhythm(id, o) {
      o = o || {};
      rhythm = id; extra = {};
      src = EcgRhythms.create(id, o);
      if (o.ratio) { src.setExtra('ratio', o.ratio); extra.ratio = o.ratio; }
      if (o.atrialRate) { src.setExtra('atrialRate', o.atrialRate); extra.atrialRate = o.atrialRate; }
      const meta = EcgRhythms.BY_ID[id];
      pulse = o.pulse != null ? !!o.pulse : (meta.pulse !== false);
      simT = 0; lastSimT = 0; lastX = null; hrLast = -1;
      ctx.drawImage(grid, 0, 0, W, H);
      if (hrCb) hrCb(src.hr(0), pulse);
    }

    const api = {
      setRhythm,
      setRate(bpm) { if (src) { const r = src.setRate(bpm); if (hrCb) { hrLast = -1; } return r; } },
      getRate() { return src ? src.getRate() : 0; },
      setExtra(k, v) { if (src) { src.setExtra(k, v); extra[k] = v; } },
      inject(kind) { if (src) src.inject(kind); },
      setPulse(on) { pulse = !!on; if (hrCb) hrCb(src ? src.hr(simT) : null, pulse); },
      setTheme(name) { theme = THEMES[name] || THEMES.monitor; resize(); },
      setSeconds(s) { seconds = s; resize(); },
      pause() { paused = true; }, resume() { paused = false; lastReal = 0; },
      isPaused() { return paused; },
      onHr(cb) { hrCb = cb; if (src) cb(src.hr(simT), pulse); },
      getState() { return { rhythm, rate: src ? src.getRate() : null, pulse, extra: Object.assign({}, extra) }; },
      setState(s) { if (!s || !s.rhythm) return; setRhythm(s.rhythm, Object.assign({ rate: s.rate, pulse: s.pulse }, s.extra || {})); },
      destroy() { destroyed = true; cancelAnimationFrame(raf); ro && ro.disconnect(); }
    };

    const ro = ('ResizeObserver' in window) ? new ResizeObserver(() => resize()) : null;
    if (ro) ro.observe(canvas);
    resize();
    setRhythm(opts.rhythm || 'nsr', opts);
    raf = requestAnimationFrame(frame);
    return api;
  }

  return { mount, THEMES };
}));
