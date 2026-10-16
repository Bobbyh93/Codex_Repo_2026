/*
 * ecg-rhythms.js — procedural ECG waveform sources for the Code Shift patient monitor.
 *
 * Rhythm criteria follow the LLUMC Quick Look table (BART Table 2014): rate bands,
 * P-wave behaviour, PR pattern and QRS width per rhythm. Waveforms are schematic
 * teaching figures: time is to scale (seconds), amplitude is nominal (1.0 = R wave).
 *
 * No dependencies. Works as a classic script (window.EcgRhythms) or CommonJS module.
 *
 *   const src = EcgRhythms.create('nsr', { rate: 75 });
 *   src.sample(t)      -> waveform value at absolute time t (seconds)
 *   src.setRate(90)    -> change rate inside the rhythm's band
 *   src.inject('pvc')  -> one ectopic beat on the next cycle (sinus-type rhythms)
 *   src.hr(t)          -> heart rate as a monitor counts it (QRS in last 6 s × 10)
 *   EcgRhythms.CATALOG -> rhythm list grouped by pacing node, with rate bands
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EcgRhythms = factory();
}(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  const g = (t, mu, s, a) => a * Math.exp(-((t - mu) * (t - mu)) / (2 * s * s));

  /* ---- complex shapes; dt is time relative to the R-wave anchor ---- */
  const SH = {
    p: (dt, a, inv) => g(dt, 0, 0.028, inv ? -a : a),
    pOdd: (dt) => g(dt, 0, 0.016, 0.22),
    qrs: (dt, a) => a * g(dt, 0, 0.011, 1) - 0.28 * a * g(dt, 0.035, 0.013, 1) - 0.10 * a * g(dt, -0.030, 0.010, 1),
    t: (dt, a) => g(dt, 0, 0.065, a),
    wide: (dt, a, up) => { const s = up ? 1 : -1; return s * a * g(dt, 0, 0.050, 1) - s * 0.45 * a * g(dt, 0.22, 0.095, 1); },
    notched: (dt) => 0.85 * g(dt, -0.02, 0.030, 1) + 0.70 * g(dt, 0.06, 0.030, 1) - 0.32 * g(dt, 0.27, 0.09, 1),
    vt: (dt) => 1.15 * g(dt, 0, 0.055, 1) - 0.75 * g(dt, 0.16, 0.075, 1),
    chbV: (dt) => 1.15 * g(dt, 0, 0.038, 1) - 0.5 * g(dt, 0.20, 0.085, 1)
  };

  /* value of one scheduled complex at absolute time t */
  function complexValue(c, t) {
    const dt = t - c.t;
    if (dt < -0.5 || dt > 0.65) return 0;
    switch (c.kind) {
      case 'beat': { // P + narrow QRS + T
        let v = SH.qrs(dt, c.qa || 1) + SH.t(dt - 0.30, c.ta == null ? 0.28 : c.ta);
        if (c.p !== false) v += SH.p(dt + (c.pr || 0.16) + 0.04, c.pa || 0.15, !!c.pinv);
        return v;
      }
      case 'p': return SH.p(dt, c.pa || 0.15, !!c.pinv);
      case 'qrs': return SH.qrs(dt, 1) + SH.t(dt - 0.30, c.ta == null ? 0.22 : c.ta);
      case 'wide': return SH.wide(dt, 1, true);
      case 'pvc': return SH.wide(dt, 1.1, false);
      case 'bbb': return SH.p(dt + 0.20, 0.15, false) + SH.notched(dt);
      case 'vt': return SH.vt(dt);
      case 'chbV': return SH.chbV(dt);
      case 'pac': return SH.pOdd(dt + 0.15) + SH.qrs(dt, 1) + SH.t(dt - 0.30, 0.22);
      case 'pjc': return SH.p(dt + 0.08, 0.10, true) + SH.qrs(dt, 1) + SH.t(dt - 0.30, 0.22);
      default: return 0;
    }
  }
  const VENTRICULAR = { beat: 1, qrs: 1, wide: 1, pvc: 1, bbb: 1, vt: 1, chbV: 1, pac: 1, pjc: 1 };

  /* ---- catalog: pacing node → rhythms, with rate bands (min, max, default) ---- */
  const CATALOG = [
    { node: 'SA node', items: [
      { id: 'nsr', name: 'Normal Sinus Rhythm', band: [60, 100, 75] },
      { id: 'brady', name: 'Sinus Bradycardia', band: [30, 59, 48] },
      { id: 'stach', name: 'Sinus Tachycardia', band: [101, 150, 125] },
      { id: 'sarr', name: 'Sinus Arrhythmia', band: [60, 100, 75] },
      { id: 'sarrest', name: 'Sinus Arrest', band: [50, 100, 75] },
      { id: 'sblock', name: 'Sinus Block', band: [50, 100, 75] }
    ]},
    { node: 'Atria', items: [
      { id: 'atach', name: 'Atrial Tachycardia', band: [151, 220, 170] },
      { id: 'aflutter', name: 'Atrial Flutter', band: [250, 350, 300], rateLabel: 'atrial rate', extra: { ratio: [2, 6, 4] } },
      { id: 'afib', name: 'Atrial Fibrillation', band: [50, 170, 90], rateLabel: 'ventricular rate' }
    ]},
    { node: 'AV junction', items: [
      { id: 'junc', name: 'Junctional Rhythm', band: [40, 60, 48] },
      { id: 'juncacc', name: 'Accelerated Junctional Rhythm', band: [61, 100, 80] },
      { id: 'junctach', name: 'Junctional Tachycardia', band: [101, 180, 120] }
    ]},
    { node: 'AV node', items: [
      { id: 'avb1', name: '1st Degree AV Block', band: [50, 100, 75] },
      { id: 'wenck', name: '2nd Degree AV Block — Mobitz I', band: [60, 100, 90], rateLabel: 'atrial rate' },
      { id: 'mobitz2', name: '2nd Degree AV Block — Mobitz II', band: [60, 100, 90], rateLabel: 'atrial rate' },
      { id: 'chb', name: '3rd Degree AV Block', band: [20, 40, 36], rateLabel: 'ventricular rate', lethal: true }
    ]},
    { node: 'Ventricles', items: [
      { id: 'ivr', name: 'Idioventricular Rhythm', band: [15, 40, 30] },
      { id: 'aivr', name: 'Accelerated IVR', band: [41, 100, 65] },
      { id: 'vtach', name: 'Ventricular Tachycardia', band: [100, 300, 180], lethal: true },
      { id: 'torsades', name: 'Polymorphic V-Tach (Torsades)', band: [150, 300, 220], lethal: true },
      { id: 'vfib', name: 'Ventricular Fibrillation', band: null, lethal: true, pulse: false },
      { id: 'asystole', name: 'Asystole', band: null, lethal: true, pulse: false }
    ]},
    { node: 'Conduction', items: [
      { id: 'bbb', name: 'Sinus Rhythm with BBB', band: [60, 100, 75] }
    ]}
  ];
  const BY_ID = {};
  CATALOG.forEach(n => n.items.forEach(it => { BY_ID[it.id] = Object.assign({ node: n.node }, it); }));

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /* ---- schedulers ----
     A scheduler owns `complexes` (upcoming + recent) and `fill(until)` which schedules
     ahead to time `until`. `cont(t)` returns continuous baseline activity. */

  function base(meta, opts) {
    const S = {
      id: meta.id, meta, complexes: [], tNext: 0.4, rate: meta.band ? clamp(opts.rate || meta.band[2], meta.band[0], meta.band[1]) : 0,
      pending: null, cont: () => 0, fill: () => {}, qrsTimes: [], beatCount: 0, ectopy: opts.ectopy || null
    };
    S.vrate = () => S.rate;   // conducted (ventricular) rate; schedulers that drop or divide beats override this
    S.push = c => { S.complexes.push(c); if (VENTRICULAR[c.kind]) S.qrsTimes.push(c.t); };
    S.prune = t => { S.complexes = S.complexes.filter(c => c.t > t - 1.2); S.qrsTimes = S.qrsTimes.filter(x => x > t - 12); };
    return S;
  }

  /* regular beats with optional pauses, ectopy and per-beat variation */
  function regular(meta, opts, cfg) {
    const S = base(meta, opts);
    const rr = () => 60 / S.rate;
    let sinceEctopy = 0;
    S.fill = until => {
      while (S.tNext < until) {
        const T0 = S.tNext;
        const RR = rr() * (cfg.vary ? cfg.vary(T0) : 1);
        // ectopic beat: arrives EARLY, before the beat expected at T0; must still be in the future
        let ect = null;
        const early = T0 - 0.4 * RR, nowApprox = until - 2;
        if (early > nowApprox + 0.05) {
          if (S.pending) { ect = S.pending; S.pending = null; }
          else if (S.ectopy && S.ectopy.every) { sinceEctopy++; if (sinceEctopy >= S.ectopy.every) { ect = S.ectopy.kind; sinceEctopy = 0; } }
        }
        if (ect === 'pvc') {            // wide bizarre beat, T opposite, full compensatory pause: next normal lands 2 R-R after the last normal
          S.push({ kind: 'pvc', t: early }); S.tNext = T0 + RR; S.beatCount++; continue;
        }
        if (ect === 'pac' || ect === 'pjc') {   // early narrow beat; the sinus node resets from the ectopic beat
          S.push({ kind: ect, t: early }); S.tNext = early + RR; S.beatCount++; continue;
        }
        S.push(Object.assign({ t: T0 }, cfg.beat(T0)));
        S.beatCount++;
        let next = T0 + RR;
        if (cfg.pauseEvery && S.beatCount % cfg.pauseEvery === 0) next = T0 + RR * cfg.pauseFactor;
        S.tNext = next;
      }
    };
    return S;
  }

  const BUILD = {
    nsr: (m, o) => regular(m, o, { beat: () => ({ kind: 'beat', pr: 0.16 }) }),
    brady: (m, o) => regular(m, o, { beat: () => ({ kind: 'beat', pr: 0.16 }) }),
    stach: (m, o) => regular(m, o, { beat: () => ({ kind: 'beat', pr: 0.15, ta: 0.2 }) }),
    sarr: (m, o) => regular(m, o, { beat: () => ({ kind: 'beat', pr: 0.16 }), vary: t => 1 + 0.18 * Math.sin(2 * Math.PI * t / 4.0) }),
    sarrest: (m, o) => regular(m, o, { beat: () => ({ kind: 'beat', pr: 0.16 }), pauseEvery: 5, pauseFactor: 2.6 }),   // not a multiple of R-R
    sblock: (m, o) => regular(m, o, { beat: () => ({ kind: 'beat', pr: 0.16 }), pauseEvery: 5, pauseFactor: 3.0 }),    // exact multiple: resumes on time
    atach: (m, o) => regular(m, o, { beat: () => ({ kind: 'beat', p: false, ta: 0.15 }) }),
    junc: (m, o) => regular(m, o, { beat: () => ({ kind: 'beat', pr: 0.09, pinv: true, pa: 0.12 }) }),
    juncacc: (m, o) => regular(m, o, { beat: () => ({ kind: 'beat', pr: 0.09, pinv: true, pa: 0.12 }) }),
    junctach: (m, o) => regular(m, o, { beat: () => ({ kind: 'beat', pr: 0.09, pinv: true, pa: 0.10, ta: 0.18 }) }),
    avb1: (m, o) => regular(m, o, { beat: () => ({ kind: 'beat', pr: 0.34 }) }),
    bbb: (m, o) => regular(m, o, { beat: () => ({ kind: 'bbb' }) }),
    ivr: (m, o) => regular(m, o, { beat: () => ({ kind: 'wide' }) }),
    aivr: (m, o) => regular(m, o, { beat: () => ({ kind: 'wide' }) }),
    vtach: (m, o) => regular(m, o, { beat: () => ({ kind: 'vt' }) }),

    wenck: (m, o) => {                   // PR lengthens 0.16 → 0.26 → 0.36 → dropped, repeats
      const S = base(m, o); const prs = [0.16, 0.26, 0.36, null]; let i = 0;
      S.fill = until => { while (S.tNext < until) { const P = S.tNext, pr = prs[i % 4]; S.push({ kind: 'p', t: P });
        if (pr !== null) S.push({ kind: 'qrs', t: P + pr + 0.06 }); i++; S.tNext = P + 60 / S.rate; } };
      S.vrate = () => S.rate * 3 / 4;   // 4:3 conduction
      return S;
    },
    mobitz2: (m, o) => {                 // constant PR, every third P not conducted
      const S = base(m, o); let i = 0;
      S.fill = until => { while (S.tNext < until) { const P = S.tNext; S.push({ kind: 'p', t: P });
        if (i % 3 !== 2) S.push({ kind: 'qrs', t: P + 0.20 }); i++; S.tNext = P + 60 / S.rate; } };
      S.vrate = () => S.rate * 2 / 3;   // 3:2 conduction
      return S;
    },
    chb: (m, o) => {                     // independent atrial and ventricular trains
      const S = base(m, o); S.atrial = clamp(o.atrialRate || 90, 60, 100); let tP = 0.25;
      S.fill = until => {
        while (tP < until) { S.push({ kind: 'p', t: tP, pa: 0.17 }); tP += 60 / S.atrial; }
        while (S.tNext < until) { S.push({ kind: 'chbV', t: S.tNext }); S.tNext += 60 / S.rate; }
      };
      return S;
    },
    aflutter: (m, o) => {                // sawtooth F waves at the atrial rate, conducted at ratio:1
      const S = base(m, o); S.ratio = clamp(o.ratio || 4, 2, 6);
      S.cont = t => { const f = S.rate / 60, ph = (t * f) % 1; return 0.18 * (2 * Math.abs(2 * ph - 1) - 1); };
      S.fill = until => { while (S.tNext < until) { S.push({ kind: 'qrs', t: S.tNext, ta: 0.10 }); S.tNext += S.ratio * 60 / S.rate; } };
      S.vrate = () => S.rate / S.ratio;
      return S;
    },
    afib: (m, o) => {                    // chaotic f waves, irregularly irregular R-R
      const S = base(m, o);
      S.cont = t => 0.05 * Math.sin(2 * Math.PI * 6.8 * t) + 0.04 * Math.sin(2 * Math.PI * 10.7 * t + 1.2) + 0.025 * Math.sin(2 * Math.PI * 15.3 * t + 2.9);
      S.fill = until => { while (S.tNext < until) { S.push({ kind: 'qrs', t: S.tNext, ta: 0.14 }); S.tNext += (60 / S.rate) * (0.6 + 0.8 * Math.random()); } };
      return S;
    },
    torsades: (m, o) => {                // amplitude twists around the baseline
      const S = base(m, o);
      S.cont = t => (0.30 + 0.95 * Math.abs(Math.sin(2 * Math.PI * t / 2.0))) * Math.sin(2 * Math.PI * (S.rate / 60) * t);
      S.hrOverride = () => S.rate;
      return S;
    },
    vfib: (m, o) => {
      const S = base(m, o); let n = 0, last = 0;
      S.cont = t => {
        if (t - last > 0.02) { last = t; n = 0.8 * n + 0.2 * (Math.random() - 0.5); }
        return 0.55 * Math.sin(2 * Math.PI * 4.6 * t) + 0.38 * Math.sin(2 * Math.PI * 7.5 * t + 2.1) + 0.22 * Math.sin(2 * Math.PI * 11.3 * t + 4.6) + 2.2 * n;
      };
      S.hrOverride = () => null;
      return S;
    },
    asystole: (m, o) => {
      const S = base(m, o); let n = 0, last = 0;
      S.cont = t => { if (t - last > 0.05) { last = t; n = 0.9 * n + 0.1 * (Math.random() - 0.5); } return 0.04 * Math.sin(2 * Math.PI * 0.6 * t) + 0.06 * n; };
      S.hrOverride = () => null;
      return S;
    }
  };

  function create(id, opts) {
    const meta = BY_ID[id]; if (!meta) throw new Error('Unknown rhythm: ' + id);
    opts = opts || {};
    const S = BUILD[id](meta, opts);
    let filled = 0;
    const api = {
      id, meta,
      sample(t) {
        if (t + 2 > filled) { S.fill(t + 2); filled = t + 2; if (S.complexes.length > 64) S.prune(t); }
        let v = S.cont(t);
        for (let i = 0; i < S.complexes.length; i++) v += complexValue(S.complexes[i], t);
        return v;
      },
      setRate(bpm) { if (meta.band) S.rate = clamp(bpm, meta.band[0], meta.band[1]); return S.rate; },
      getRate() { return S.rate; },
      setExtra(k, v) { if (k === 'ratio' && S.ratio) S.ratio = clamp(v, 2, 6); if (k === 'atrialRate' && S.atrial) S.atrial = clamp(v, 60, 100); },
      inject(kind) { if (S.fill && 'pending' in S) S.pending = kind; },
      hr(t) {  // the way a monitor counts: QRS complexes in the last 6 seconds × 10
        if (S.hrOverride) return S.hrOverride();
        if (t < 6) return Math.round(S.vrate());   // warming up: the conducted rate the scheduler is producing, not the atrial rate
        return S.qrsTimes.filter(x => x > t - 6 && x <= t).length * 10;
      }
    };
    return api;
  }

  return { create, CATALOG, BY_ID, complexValue };
}));
