// ECG module checks: rate fidelity, HR readout, pulse signal, Code Shift rhythm mapping, monitor state.
//   node --test tests/ecg.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { create, CATALOG, BY_ID } from '../src/ecg/ecg-rhythms.js';
import { RHYTHMS, RHYTHM_SPECS, sourceOptions, bandLabel } from '../src/ecg/rhythms.js';

const run = (src, secs) => { for (let t = 0; t <= secs; t += 1 / 300) src.sample(t); };

test('HR readout: conducted rate while warming up, QRS count × 10 after 6 s', () => {
  const cases = [['aflutter', { rate: 300, ratio: 4 }, 75], ['wenck', { rate: 90 }, 68], ['mobitz2', { rate: 90 }, 60], ['chb', { rate: 35, atrialRate: 90 }, 35], ['nsr', { rate: 75, ectopy: { kind: 'pvc', every: 3 } }, 75], ['ivr', { rate: 30 }, 30]];
  for (const [id, o, want] of cases) {
    const s = create(id, o);
    assert.equal(s.hr(0), want, `${id} warm-up`);
    run(s, 12);
    assert.ok(Math.abs(s.hr(12) - want) <= 10, `${id} counted ${s.hr(12)} vs ${want}`);
  }
  assert.equal(create('vfib').hr(0), null); assert.equal(create('asystole').hr(0), null);
});

test('rate stays in the criteria band unless clamp is off', () => {
  assert.equal(create('nsr', { rate: 130 }).getRate(), 100);
  assert.equal(create('nsr', { rate: 130, clamp: false }).getRate(), 130);
  assert.equal(create('vtach', { rate: 20, clamp: false }).getRate(), 20);
  assert.equal(create('vtach', { rate: 900, clamp: false }).getRate(), 300);
  const s = create('stach', { rate: 120 }); assert.equal(s.setRate(90), 101);
});

test('pulse follows the QRS complexes and is absent without a perfusing rhythm', () => {
  const nsr = create('nsr', { rate: 60 });
  let peak = 0; for (let t = 0; t <= 4; t += 1 / 300) peak = Math.max(peak, nsr.pulse(t));
  assert.ok(peak > 0.9 && peak < 1.4, `nsr pulse peak ${peak}`);
  for (const id of ['vfib', 'asystole', 'torsades']) { const s = create(id, { rate: 220 }); let m = 0; for (let t = 0; t <= 4; t += 1 / 300) m = Math.max(m, s.pulse(t)); assert.equal(m, 0, id); }
  const pvc = create('nsr', { rate: 60, ectopy: { kind: 'pvc', every: 2 } });
  const peaks = []; let prev = 0, rising = false;
  for (let t = 0; t <= 8; t += 1 / 300) { const v = pvc.pulse(t); if (v > prev) rising = true; else if (rising && v < prev && prev > 0.05) { peaks.push(prev); rising = false; } prev = v; }
  assert.ok(peaks.some(p => p < 0.6) && peaks.some(p => p > 0.9), `PVC pulse waves are weaker: ${peaks.map(p => p.toFixed(2)).join(' ')}`);
});

test('Code Shift rhythm table maps every id to a criteria row', () => {
  for (const [id, spec] of Object.entries(RHYTHM_SPECS)) { assert.ok(BY_ID[spec.base], `${id} → ${spec.base}`); assert.equal(RHYTHMS[id], spec.name); }
  for (const id of ['nsr', 'sinus_brady', 'sinus_tach', 'sinus_tach_pvc', 'svt', 'afib', 'vtach', 'vfib', 'asystole']) assert.ok(RHYTHMS[id], `legacy id ${id}`);
  assert.deepEqual(RHYTHM_SPECS.sinus_tach_pvc.ectopy, { kind: 'pvc', every: 5 });
  assert.equal(bandLabel('sinus_tach'), '101–150'); assert.equal(bandLabel('vfib'), '');
  assert.equal(CATALOG.flatMap(n => n.items).length, 23);
});

test('sourceOptions runs the trace at the instructor HR', () => {
  assert.deepEqual(sourceOptions('sinus_tach_pvc', 112), { rhythm: 'stach', rate: 112, clamp: false, ectopy: { kind: 'pvc', every: 5 } });
  assert.equal(sourceOptions('nsr', 130).rate, 130);
  const fl = sourceOptions('aflutter', 150); assert.equal(fl.rate, 300); assert.equal(fl.ratio, 2);
  assert.equal(sourceOptions('aflutter', 75).ratio, 4);
  assert.equal(create('aflutter', { rate: 300, ratio: sourceOptions('aflutter', 100).ratio }).hr(0), 100);
  assert.equal(create('wenck', { ...sourceOptions('avb2_mobitz1', 60) }).hr(0), 60);
  assert.equal(create('mobitz2', { ...sourceOptions('avb2_mobitz2', 60) }).hr(0), 60);
  assert.equal(create('chb', { ...sourceOptions('avb3', 32) }).hr(0), 32);
});

test('monitor state carries automatic ectopy across getState/setState', async () => {
  globalThis.window = { devicePixelRatio: 1 };
  globalThis.requestAnimationFrame = () => 1; globalThis.cancelAnimationFrame = () => {};
  const ctx = { setTransform() {}, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, drawImage() {} };
  globalThis.document = { createElement: () => ({ getContext: () => ctx }) };
  const canvas = () => ({ getContext: () => ctx, getBoundingClientRect: () => ({ width: 600, height: 110 }) });
  const { mount } = await import('../src/ecg/ecg-monitor.js');
  const a = mount(canvas(), { rhythm: 'nsr', rate: 75, pleth: canvas() });
  a.setRhythm('stach', { rate: 120, ectopy: { kind: 'pvc', every: 6 } });
  const state = JSON.parse(JSON.stringify(a.getState()));
  const b = mount(canvas(), { rhythm: 'nsr', rate: 75 });
  b.setState(state);
  assert.deepEqual(b.getState(), state);
  assert.equal(state.extra.ectopy.every, 6); assert.equal(b.getRate(), 120);
  a.destroy(); b.destroy();
});
