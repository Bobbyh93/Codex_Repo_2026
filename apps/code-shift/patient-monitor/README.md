# Code Shift — patient monitor ECG module

Drop-in, dependency-free ECG for the Code Shift patient monitor. Two classic scripts and a demo page; nothing to build, nothing fetched from the network, so it runs on the Pi offline.

| File | Purpose |
|---|---|
| `ecg-rhythms.js` | Procedural waveform sources for 24 rhythms, grouped by pacing node, with rate bands per the LLUMC Quick Look table (BART Table 2014). Exposes `window.EcgRhythms`. |
| `ecg-monitor.js` | Sweeping monitor trace on a `<canvas>` (25 mm/s, 1 mV = 10 mm, beam + erase bar, wraps at the edge). Exposes `window.EcgMonitor`. |
| `index.html` | Demo: monitor + instructor controls (rhythm, rate, conduction ratio, ectopy, pulse, freeze, theme) and the JSON state the instructor station would broadcast. |

## Use

```html
<canvas id="ecg" style="width:100%;height:220px"></canvas>
<script src="ecg-rhythms.js"></script>
<script src="ecg-monitor.js"></script>
<script>
  const mon = EcgMonitor.mount(document.getElementById('ecg'), { rhythm: 'nsr', rate: 75, theme: 'monitor', seconds: 6 });
  mon.onHr((hr, pulse) => { /* hr = QRS count in the last 6 s × 10, null for V-Fib / asystole */ });
</script>
```

| Call | Effect |
|---|---|
| `setRhythm(id, { rate, ratio, atrialRate, pulse, ectopy })` | Switch rhythm. `ratio` = flutter conduction (2–6), `atrialRate` = atrial train for 3rd degree, `ectopy = { kind: 'pvc'|'pac'|'pjc', every: n }` for automatic ectopy. |
| `setRate(bpm)` | Rate, clamped to the rhythm's band. |
| `inject('pvc' | 'pac' | 'pjc')` | One early beat on the next cycle. PVC keeps a full compensatory pause; PAC/PJC reset the sinus node. |
| `setPulse(bool)` | Stem fact for the vitals readout (PEA scenario: organized rhythm, no pulse). |
| `pause()` / `resume()` | Freeze the sweep. |
| `setTheme('monitor' | 'paper')` · `setSeconds(n)` | Look and screen width in seconds. |
| `getState()` / `setState(json)` | Serialisable `{ rhythm, rate, pulse, extra }` — broadcast this from the instructor station; every student monitor calls `setState`. |

`EcgRhythms.CATALOG` lists rhythms by pacing node with `band: [min, max, default]`, `lethal`, and `pulse: false` for V-Fib and asystole, so a rhythm picker and a bounded rate slider can be generated from it (see `index.html`).

## Rhythm ids

SA node `nsr brady stach sarr sarrest sblock` · Atria `atach aflutter afib` · AV junction `junc juncacc junctach` · AV node `avb1 wenck mobitz2 chb` · Ventricles `ivr aivr vtach torsades vfib asystole` · Conduction `bbb`.

Waveforms are schematic teaching figures drawn from the criteria values: time is to scale, amplitude is nominal.
