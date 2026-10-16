/*
 * test.js — dependency-free checks for the patient-monitor ECG module.
 *   node apps/code-shift/patient-monitor/test.js
 * Exit code 1 on any failure.
 */
'use strict';
const E = require('./ecg-rhythms');
let fail = 0;
const check = (ok, msg) => { if (!ok) fail++; console.log((ok ? 'ok   ' : 'FAIL ') + msg); };

/* 1. HR readout: conducted rate during warm-up, QRS count × 10 after 6 s (±10, the count's resolution) */
const RATES = [
  ['aflutter', { rate: 300, ratio: 4 }, 75],
  ['wenck',    { rate: 90 }, 68],
  ['mobitz2',  { rate: 90 }, 60],
  ['chb',      { rate: 35, atrialRate: 90 }, 35],
  ['nsr',      { rate: 75, ectopy: { kind: 'pvc', every: 3 } }, 75],
  ['ivr',      { rate: 30 }, 30]
];
for (const [id, o, want] of RATES) {
  const s = E.create(id, o);
  const warm = s.hr(0);
  for (let t = 0; t <= 12; t += 1 / 300) s.sample(t);
  const counted = s.hr(12);
  check(warm === want && Math.abs(counted - want) <= 10, `${id.padEnd(9)} hr warm-up ${warm}, counted ${counted}, expected ${want}`);
}
check(E.create('vfib').hr(0) === null && E.create('asystole').hr(0) === null, 'vfib / asystole report no rate');

/* 2. Monitor state carries automatic ectopy across getState/setState (canvas stubbed) */
global.window = { devicePixelRatio: 1 };
global.requestAnimationFrame = () => 1; global.cancelAnimationFrame = () => {};
const ctx = { setTransform() {}, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, drawImage() {} };
global.document = { createElement: () => ({ getContext: () => ctx }) };
const canvas = { getContext: () => ctx, getBoundingClientRect: () => ({ width: 600, height: 220 }) };
const M = require('./ecg-monitor');
const a = M.mount(canvas, { rhythm: 'nsr', rate: 75 });
a.setRhythm('stach', { rate: 120, ectopy: { kind: 'pvc', every: 6 } });
const state = JSON.parse(JSON.stringify(a.getState()));
const b = M.mount(canvas, { rhythm: 'nsr', rate: 75 });
b.setState(state);
check(JSON.stringify(b.getState()) === JSON.stringify(state) && state.extra.ectopy && state.extra.ectopy.every === 6,
  'getState/setState round-trip keeps ectopy ' + JSON.stringify(state.extra));
check(a.getState().rate === 120 && b.getRate() === 120, 'rate survives the round-trip');

process.exit(fail ? 1 : 0);
