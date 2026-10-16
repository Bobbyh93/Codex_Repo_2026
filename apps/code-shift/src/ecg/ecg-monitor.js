/*
 * ecg-monitor.js — sweeping bedside-monitor traces on <canvas>.
 *
 * Draws like a real monitor: the trace is written at the beam position, an erase
 * bar clears the old trace just ahead of it, and the sweep wraps at the right edge.
 * Paper speed 25 mm/s; 1 mV = 10 mm; grid 1 mm / 5 mm. An optional second canvas
 * shows the plethysmograph in step with the ECG.
 *
 *   import { mount } from './ecg-monitor.js';
 *   const mon = mount(ecgCanvas, { rhythm: 'nsr', rate: 75, theme: 'monitor', seconds: 6, pleth: plethCanvas });
 *   mon.setRhythm('afib', { rate: 110 });   mon.setRate(90);   mon.inject('pvc');
 *   mon.pause(); mon.resume(); mon.setBlank(true); mon.getState(); mon.setState(json); mon.onHr(hr => ...);
 *   mon.destroy();
 */
import { create as createRhythm, BY_ID } from './ecg-rhythms.js';

export const THEMES = {
  monitor: { bg: '#0B0F0C', minor: '#13261A', major: '#1C3D25', trace: '#3DFF5A', beam: '#CFFFD8', text: '#3DFF5A', pleth: '#5FD3FF' },
  paper: { bg: '#FFFBFB', minor: '#F5D3D3', major: '#E39A9A', trace: '#101010', beam: '#101010', text: '#1A1A1A', pleth: '#1A6FBF' }
};
const resolveTheme = t => (t && typeof t === 'object') ? Object.assign({}, THEMES.monitor, t) : (THEMES[t] || THEMES.monitor);

export function mount(canvas, opts) {
  opts = opts || {};
  let theme = resolveTheme(opts.theme);
  let seconds = opts.seconds || 6;          // seconds across the screen
  const speed = 25;                          // mm/s
  const mmPerMv = 10;
  let pulse = opts.pulse !== false;
  let clamp = opts.clamp;
  let hrCb = null, hrLast = -1, hrTimer = 0;
  let src = null, rhythm = null, extra = {};
  let simT = 0, lastReal = 0, lastSimT = 0, paused = false, blank = false, blanked = false, raf = 0, destroyed = false;

  /* a lane is one canvas: the ECG (with grid) or the pleth (plain background).
     All lane geometry is in device pixels, so erase copies are exact pixel copies and
     leave no resampling streaks behind the beam. */
  function lane(el, kind) {
    const L = { el, kind, ctx: el.getContext('2d'), W: 0, H: 0, dpr: 1, pxPerMm: 1, gain: 1, baseY: 0, back: null, lastX: null, lastY: null };
    L.resize = () => {
      L.dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = el.getBoundingClientRect();
      L.W = Math.max(1, Math.round(r.width * L.dpr)); L.H = Math.max(1, Math.round(r.height * L.dpr));
      el.width = L.W; el.height = L.H;
      L.ctx.setTransform(1, 0, 0, 1, 0, 0);
      L.pxPerMm = L.W / (seconds * speed);
      L.gain = Math.max(mmPerMv * L.pxPerMm, 0.33 * L.H);   // 1 mV = 10 mm, or taller on a small canvas so complexes stay readable
      L.baseY = kind === 'ecg' ? L.H * 0.62 : L.H * 0.85;
      const back = document.createElement('canvas'); back.width = L.W; back.height = L.H;
      const gc = back.getContext('2d');
      gc.fillStyle = theme.bg; gc.fillRect(0, 0, L.W, L.H);
      if (kind === 'ecg') {
        const minor = L.pxPerMm >= 4;   // 1 mm lines only when there is room for them
        const line = (x1, y1, x2, y2, major) => { if (!major && !minor) return; gc.strokeStyle = major ? theme.major : theme.minor; gc.lineWidth = major ? 1 : 0.5; gc.beginPath(); gc.moveTo(x1, y1); gc.lineTo(x2, y2); gc.stroke(); };
        for (let i = 0; i * L.pxPerMm <= L.W; i++) { const x = Math.round(i * L.pxPerMm) + 0.5; line(x, 0, x, L.H, i % 5 === 0); }
        for (let j = 0; j * L.pxPerMm <= L.H; j++) {
          const y = Math.round(L.baseY - j * L.pxPerMm) + 0.5, y2 = Math.round(L.baseY + j * L.pxPerMm) + 0.5;
          if (y >= 0) line(0, y, L.W, y, j % 5 === 0);
          if (j && y2 <= L.H) line(0, y2, L.W, y2, j % 5 === 0);
        }
      }
      L.back = back;
      L.clear();
    };
    L.clear = () => { L.ctx.drawImage(L.back, 0, 0); L.lastX = null; };
    L.xOf = t => ((t % seconds) / seconds) * L.W;
    L.yOf = v => kind === 'ecg' ? L.baseY - v * L.gain : L.baseY - v * L.H * 0.7;
    L.value = t => kind === 'ecg' ? src.sample(t) : (pulse ? src.pulse(t) : 0);
    L.color = () => kind === 'ecg' ? theme.trace : theme.pleth;
    return L;
  }
  const lanes = [lane(canvas, 'ecg')];
  if (opts.pleth) lanes.push(lane(opts.pleth, 'pleth'));

  function frame(now) {
    if (destroyed) return;
    raf = requestAnimationFrame(frame);
    if (!lastReal) { lastReal = now; return; }
    let dt = (now - lastReal) / 1000; lastReal = now;
    if (blank) { if (!blanked) { lanes.forEach(L => L.clear()); blanked = true; } return; }
    blanked = false;
    if (paused || !src) return;
    if (dt > 0.25) dt = 0.25;                 // tab was hidden: skip ahead, don't burst-draw
    simT += dt;
    const step = 1 / 300;
    for (const L of lanes) {
      const { ctx } = L;
      ctx.lineWidth = 1.6 * L.dpr; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = L.color();
      const gap = Math.max(10 * L.dpr, 0.25 * L.W / seconds);     // a quarter second of blank ahead of the beam
      for (let t = lastSimT + step; t <= simT; t += step) {
        const x = L.xOf(t), y = L.yOf(L.value(t));
        if (L.lastX !== null && x < L.lastX) {   // wrapped: clear the tail (and the beam) at the right edge
          const tx = Math.floor(L.lastX); ctx.drawImage(L.back, tx, 0, L.W - tx, L.H, tx, 0, L.W - tx, L.H); L.lastX = null;
        }
        // erase whole pixel columns from the previous point (covers the old beam) to a gap ahead of the new one
        const sx = Math.floor(L.lastX === null ? x : L.lastX), ex = Math.min(Math.ceil(x + gap), L.W);
        if (ex > sx) ctx.drawImage(L.back, sx, 0, ex - sx, L.H, sx, 0, ex - sx, L.H);
        if (L.lastX !== null) { ctx.beginPath(); ctx.moveTo(L.lastX, L.lastY); ctx.lineTo(x, y); ctx.stroke(); }
        L.lastX = x; L.lastY = y;
      }
      // beam marker on whole pixels, inside the zone the next frame erases
      if (L.lastX !== null) { const bw = Math.max(2, Math.round(2 * L.dpr)); ctx.fillStyle = theme.beam; ctx.fillRect(Math.min(L.W - bw, Math.floor(L.lastX) + 1), 0, bw, L.H); }
    }
    lastSimT = simT;
    hrTimer += dt;
    if (hrTimer > 0.5 && hrCb) { hrTimer = 0; const hr = src.hr(simT); if (hr !== hrLast) { hrLast = hr; hrCb(hr, pulse); } }
  }

  function setRhythm(id, o) {
    o = o || {};
    rhythm = id; extra = {};
    if (o.clamp !== undefined) clamp = o.clamp;
    src = createRhythm(id, Object.assign({}, o, { clamp }));
    if (o.ratio) { src.setExtra('ratio', o.ratio); extra.ratio = o.ratio; }
    if (o.atrialRate) { src.setExtra('atrialRate', o.atrialRate); extra.atrialRate = o.atrialRate; }
    if (o.ectopy && o.ectopy.kind) extra.ectopy = { kind: o.ectopy.kind, every: o.ectopy.every };   // keeps automatic ectopy in the broadcast state
    const meta = BY_ID[id];
    pulse = o.pulse != null ? !!o.pulse : (meta.pulse !== false);
    simT = 0; lastSimT = 0; hrLast = -1;
    lanes.forEach(L => L.clear());
    if (hrCb) hrCb(src.hr(0), pulse);
  }

  const api = {
    setRhythm,
    getRhythm() { return rhythm; },
    setRate(bpm) { if (src) { const r = src.setRate(bpm); if (hrCb) { hrLast = -1; } return r; } },
    getRate() { return src ? src.getRate() : 0; },
    setExtra(k, v) { if (src) { src.setExtra(k, v); extra[k] = v; } },
    getExtra(k) { return src ? src.getExtra(k) : undefined; },
    inject(kind) { if (src) src.inject(kind); },
    setPulse(on) { pulse = !!on; if (hrCb) hrCb(src ? src.hr(simT) : null, pulse); },
    setTheme(name) { theme = resolveTheme(name); lanes.forEach(L => L.resize()); },
    setSeconds(s) { seconds = s; lanes.forEach(L => L.resize()); },
    pause() { paused = true; }, resume() { paused = false; lastReal = 0; },
    isPaused() { return paused; },
    setBlank(on) { blank = !!on; if (!blank) { lastReal = 0; lanes.forEach(L => L.clear()); } },   // leads off: clear the traces and stop sweeping
    onHr(cb) { hrCb = cb; if (src) cb(src.hr(simT), pulse); },
    getState() { return { rhythm, rate: src ? src.getRate() : null, pulse, extra: Object.assign({}, extra) }; },
    setState(s) { if (!s || !s.rhythm) return; setRhythm(s.rhythm, Object.assign({ rate: s.rate, pulse: s.pulse }, s.extra || {})); },
    destroy() { destroyed = true; cancelAnimationFrame(raf); ro && ro.disconnect(); }
  };

  const ro = ('ResizeObserver' in window) ? new ResizeObserver(() => lanes.forEach(L => L.resize())) : null;
  lanes.forEach(L => { if (ro) ro.observe(L.el); L.resize(); });
  setRhythm(opts.rhythm || 'nsr', opts);
  raf = requestAnimationFrame(frame);
  return api;
}

export default { mount, THEMES };
