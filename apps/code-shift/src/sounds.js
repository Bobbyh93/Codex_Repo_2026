// Synthesized exam sounds for the room display (WebAudio; no media files, works offline).
// Heart: two thumps per beat at the monitor rate. Breath: noise bursts at the respiratory rate, with crackles when the finding says so.
export function playExamSound(kind, vitals, finding = '') {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)(), now = ctx.currentTime, hr = Math.max(30, Math.min(200, vitals?.hr || 72)), rr = Math.max(6, Math.min(40, vitals?.rr || 16));
    const master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    const noise = (start, dur, gainPeak, lowpass) => { const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; const src = ctx.createBufferSource(); src.buffer = buf; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lowpass; const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, start); g.gain.exponentialRampToValueAtTime(gainPeak, start + dur * 0.35); g.gain.exponentialRampToValueAtTime(0.0001, start + dur); src.connect(f); f.connect(g); g.connect(master); src.start(start); src.stop(start + dur); };
    const thump = (start, freq, dur) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(freq, start); o.frequency.exponentialRampToValueAtTime(freq * 0.6, start + dur); g.gain.setValueAtTime(0.0001, start); g.gain.exponentialRampToValueAtTime(0.5, start + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, start + dur); o.connect(g); g.connect(master); o.start(start); o.stop(start + dur); };
    const total = 10;
    if (kind === 'heart') { const beat = 60 / hr, irregular = /irregular|run of/i.test(finding); let t = now + 0.1, i = 0; while (t < now + total) { const jitter = irregular && i % 5 === 4 ? beat * 0.4 : 0; thump(t, 55, 0.11); thump(t + beat * 0.32, 45, 0.08); t += beat - jitter; i++; } }
    else if (kind === 'breath') { const cycle = 60 / rr, crackles = /crackle/i.test(finding); let t = now + 0.1; while (t < now + total) { noise(t, cycle * 0.4, 0.35, 900); noise(t + cycle * 0.45, cycle * 0.45, 0.25, 600); if (crackles) for (let c = 0; c < 6; c++) noise(t + cycle * 0.25 + c * 0.04, 0.02, 0.5, 4000); t += cycle; } }
    else if (kind === 'bowel') { let t = now + 0.2; while (t < now + total) { noise(t, 0.12, 0.3, 300); t += 1.5 + Math.random() * 3; } }
    setTimeout(() => ctx.close(), (total + 1) * 1000);
  } catch {}
}
