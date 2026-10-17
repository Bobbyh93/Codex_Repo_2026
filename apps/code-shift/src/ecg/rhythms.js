/*
 * rhythms.js — the rhythm list the instructor can set on the Code Shift monitor.
 *
 * One table serves the server (validation and display names) and the client (select
 * list and trace generation). Each rhythm names the criteria row it is drawn to in
 * ecg-rhythms.js (LLUMC Quick Look table, BART Table 2014), plus any automatic ectopy.
 * The ids already used by scenarios and stored vitals are kept.
 */
import { BY_ID } from './ecg-rhythms.js';

const FLUTTER_ATRIAL_RATE = 300;   // the atrial train is near this; the instructor's HR sets the conduction ratio

// [id, display name, criteria row, automatic ectopy]
export const RHYTHM_GROUPS = [
  { node: 'SA node', items: [
    ['nsr', 'Normal sinus rhythm', 'nsr'],
    ['sinus_brady', 'Sinus bradycardia', 'brady'],
    ['sinus_tach', 'Sinus tachycardia', 'stach'],
    ['sinus_arrhythmia', 'Sinus arrhythmia', 'sarr'],
    ['sinus_arrest', 'Sinus arrest', 'sarrest'],
    ['sinus_block', 'Sinus block', 'sblock'],
    ['nsr_pac', 'Normal sinus rhythm with PACs', 'nsr', { kind: 'pac', every: 5 }],
    ['nsr_pjc', 'Normal sinus rhythm with PJCs', 'nsr', { kind: 'pjc', every: 5 }],
    ['nsr_pvc', 'Normal sinus rhythm with PVCs', 'nsr', { kind: 'pvc', every: 5 }],
    ['sinus_tach_pvc', 'Sinus tachycardia with PVCs', 'stach', { kind: 'pvc', every: 5 }]
  ]},
  { node: 'Atria', items: [
    ['svt', 'Supraventricular tachycardia', 'atach'],   // narrow-complex tachycardia, drawn to the atrial tachycardia row
    ['aflutter', 'Atrial flutter', 'aflutter'],
    ['afib', 'Atrial fibrillation', 'afib']
  ]},
  { node: 'AV junction', items: [
    ['junctional', 'Junctional rhythm', 'junc'],
    ['junctional_acc', 'Accelerated junctional rhythm', 'juncacc'],
    ['junctional_tach', 'Junctional tachycardia', 'junctach']
  ]},
  { node: 'AV node', items: [
    ['avb1', '1st degree AV block', 'avb1'],
    ['avb2_mobitz1', '2nd degree AV block, Mobitz I', 'wenck'],
    ['avb2_mobitz2', '2nd degree AV block, Mobitz II', 'mobitz2'],
    ['avb3', '3rd degree AV block', 'chb']
  ]},
  { node: 'Ventricles', items: [
    ['ivr', 'Idioventricular rhythm', 'ivr'],
    ['aivr', 'Accelerated idioventricular rhythm', 'aivr'],
    ['vtach', 'Ventricular tachycardia', 'vtach'],
    ['torsades', 'Polymorphic ventricular tachycardia (torsades)', 'torsades'],
    ['vfib', 'Ventricular fibrillation', 'vfib'],
    ['asystole', 'Asystole', 'asystole']
  ]},
  { node: 'Conduction', items: [
    ['bbb', 'Sinus rhythm with bundle branch block', 'bbb']
  ]}
];

export const RHYTHM_SPECS = {};   // id → { name, base, ectopy, band, node, lethal, pulse }
export const RHYTHMS = {};        // id → display name
for (const group of RHYTHM_GROUPS) for (const [id, name, base, ectopy] of group.items) {
  const row = BY_ID[base];
  RHYTHM_SPECS[id] = { name, base, ectopy: ectopy || null, band: row.band, node: group.node, lethal: !!row.lethal, pulse: row.pulse !== false };
  RHYTHMS[id] = name;
}

/* Rate band shown next to a rhythm name: the criteria row's range, or the ventricular
   range the instructor's HR controls for flutter and the second degree blocks. */
export function bandLabel(id) {
  const s = RHYTHM_SPECS[id]; if (!s || !s.band) return '';
  if (s.base === 'aflutter') return 'atrial 250–350';
  if (s.base === 'wenck' || s.base === 'mobitz2') return 'atrial 60–100';
  return `${s.band[0]}–${s.band[1]}`;
}

/* Options for ecg-monitor.setRhythm / ecg-rhythms.create so the trace runs at the
   instructor's heart rate (the monitor's HR readout): the source rate is the atrial
   rate for flutter and second degree block, so it is derived from the conducted rate;
   rhythms with pauses or early beats get the source rate whose mean QRS rate is the HR. */
export function sourceOptions(id, hr) {
  const s = RHYTHM_SPECS[id] || RHYTHM_SPECS.nsr;
  const bpm = Math.max(15, Math.min(300, Math.round(Number(hr) || 0) || 60));
  const o = { rhythm: s.base, rate: bpm, clamp: false };
  if (s.ectopy) o.ectopy = s.ectopy;
  if (s.base === 'aflutter') { o.ratio = Math.max(2, Math.min(6, Math.round(FLUTTER_ATRIAL_RATE / bpm))); o.rate = bpm * o.ratio; o.clamp = true; }   // atrial train HR × ratio, kept in the flutter band (250–350)
  else if (s.base === 'wenck') o.rate = Math.round(bpm * 4 / 3);     // 4:3 conduction
  else if (s.base === 'mobitz2') o.rate = Math.round(bpm * 3 / 2);   // 3:2 conduction
  else if (s.base === 'sarrest') o.rate = Math.round(bpm * 6.6 / 5); // 5 beats, then a 2.6 R-R pause: 5 beats per 6.6 R-R
  else if (s.base === 'sblock') o.rate = Math.round(bpm * 7 / 5);    // 5 beats, then a 3 R-R pause: 5 beats per 7 R-R
  if (s.ectopy?.kind === 'pac' || s.ectopy?.kind === 'pjc') o.rate = Math.round(bpm * (s.ectopy.every - 0.4) / s.ectopy.every);   // the early beat resets the sinus node: `every` beats per every − 0.4 R-R
  return o;
}

export default { RHYTHM_GROUPS, RHYTHM_SPECS, RHYTHMS, bandLabel, sourceOptions };
