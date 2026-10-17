# Patient monitor ECG module

`src/ecg/` draws the monitor traces from rhythm criteria instead of fixed shapes. No dependencies; the same files run in the browser (Vite bundles them into the client) and under Node (`npm test`).

| File | Purpose |
|---|---|
| `ecg-rhythms.js` | Procedural waveform sources for 23 rhythms grouped by pacing node, with rate bands per the LLUMC Quick Look table (BART Table 2014). Schedules P, QRS and T complexes in time; conduction patterns (Wenckebach 4:3, Mobitz II 3:2, flutter ratio, 3rd degree independent trains), automatic or injected ectopy, and the pulse wave each complex produces. |
| `ecg-monitor.js` | Sweeping monitor on a `<canvas>`: 25 mm/s, 1 mV = 10 mm, beam and erase bar, wraps at the edge, optional second canvas for the plethysmograph in step with the ECG. |
| `rhythms.js` | The rhythm list the instructor can set. One table serves the server (validation, display names) and the client (select list, trace). Each entry names the criteria row it is drawn to. |

## Use

```js
import { mount } from './ecg/ecg-monitor.js';
import { sourceOptions } from './ecg/rhythms.js';
const mon = mount(ecgCanvas, { ...sourceOptions('sinus_tach_pvc', 112), pleth: plethCanvas, seconds: 6 });
mon.setRate(118);                 // the trace follows the HR on the readout
mon.setRhythm('afib', { rate: 110, clamp: false });
mon.setBlank(true);               // leads off
mon.destroy();
```

| Call | Effect |
|---|---|
| `setRhythm(id, { rate, clamp, ectopy, ratio, atrialRate, pulse })` | Switch rhythm (criteria row id). `clamp: false` lets the rate leave the row's band (15–300); `ectopy = { kind: 'pvc'|'pac'|'pjc', every: n }`; `ratio` = flutter conduction 2–6; `atrialRate` = atrial train for 3rd degree. |
| `setRate(bpm)` | Rate; atrial rate for flutter and 2nd degree block, ventricular for everything else. |
| `inject('pvc' | 'pac' | 'pjc')` | One early beat on the next cycle. PVC keeps a full compensatory pause and a weak pulse wave; PAC/PJC reset the cycle. |
| `setPulse(bool)` | Pleth lane on or off (PEA: organized rhythm, no pulse). |
| `setBlank(bool)` · `pause()` / `resume()` | Leads off (traces cleared) · freeze the sweep. |
| `setTheme(name or object)` · `setSeconds(n)` | Colors (`monitor`, `paper`, or `{ bg, minor, major, trace, beam, pleth }`) · screen width in seconds. |
| `onHr(cb)` | HR as a monitor counts it: conducted rate while warming up, QRS in the last 6 s × 10 after that; `null` for V-Fib and asystole. |
| `getState()` / `setState(json)` | Serialisable `{ rhythm, rate, pulse, extra }` including automatic ectopy. |

## Code Shift rhythm ids

Instructor-facing ids (`rhythms.js`), each drawn to a criteria row. Rate bands shown in the select are the row's range; for flutter and the 2nd degree blocks the instructor's HR is the ventricular rate and the atrial train is derived (flutter 300 with the conduction ratio from HR; Wenckebach 4:3; Mobitz II 3:2).

| Pacing node | ids |
|---|---|
| SA node | `nsr` `sinus_brady` `sinus_tach` `sinus_arrhythmia` `sinus_arrest` `sinus_block` `nsr_pac` `nsr_pjc` `nsr_pvc` `sinus_tach_pvc` |
| Atria | `svt` (drawn to the atrial tachycardia row) `aflutter` `afib` |
| AV junction | `junctional` `junctional_acc` `junctional_tach` |
| AV node | `avb1` `avb2_mobitz1` `avb2_mobitz2` `avb3` |
| Ventricles | `ivr` `aivr` `vtach` `torsades` `vfib` `asystole` |
| Conduction | `bbb` |

Waveforms are schematic teaching figures drawn from the criteria values: time is to scale, amplitude is nominal.

## Checks

`node --test tests/ecg.test.js` (part of `npm test`): rate fidelity and band clamping, HR readout, pulse signal (absent for V-Fib, asystole and torsades; weaker after a PVC), every Code Shift id maps to a criteria row, `sourceOptions` keeps the trace at the instructor's HR, monitor state round-trips automatic ectopy.
