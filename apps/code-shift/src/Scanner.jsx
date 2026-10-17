import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';

// Camera barcode scanner. Needs a secure context (https, or localhost). On the Pi this means the
// self-signed certificate from deploy/install.sh must be trusted on the phone once.
export const cameraAvailable = () => !!(globalThis.isSecureContext && navigator.mediaDevices?.getUserMedia);
export function scanFeedback() {
  try { navigator.vibrate?.(90); } catch {}
  try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 1320; g.gain.value = 0.08; o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.12); setTimeout(() => ctx.close(), 300); } catch {}
}
const FORMATS = [BarcodeFormat.CODE_128, BarcodeFormat.QR_CODE, BarcodeFormat.CODE_39, BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.DATA_MATRIX, BarcodeFormat.ITF];
const norm = c => String(c ?? '').trim().toUpperCase().replace(/\s+/g, '');
export function Scanner({ onResult, onClose, label = 'Scan', hint = 'Point the camera at the barcode.', ignore = '', ignoreHint = 'That is the wristband. Now point at the medication label.' }) {
  const video = useRef(null), controls = useRef(null), ignored = useRef(ignore), [error, setError] = useState(''), [status, setStatus] = useState('Starting camera…'), [torch, setTorch] = useState(false), [torchAvailable, setTorchAvailable] = useState(false);
  useEffect(() => { ignored.current = ignore; }, [ignore]);
  // The latest onResult is read from a ref: a parent re-render (state poll, broadcast) must not restart the camera.
  const onResultRef = useRef(onResult); useEffect(() => { onResultRef.current = onResult; }, [onResult]);
  useEffect(() => {
    if (!globalThis.isSecureContext) { setError('The camera needs a secure connection (https). Install the Code Shift certificate on this phone (ask the instructor), then reopen.'); return; }
    if (!navigator.mediaDevices?.getUserMedia) { setError('This browser does not expose the camera.'); return; }
    const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, FORMATS], [DecodeHintType.TRY_HARDER, true]]);
    const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 });
    let done = false;
    reader.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } }, video.current, (result, err, c) => {
      controls.current = c;
      if (result && !done) { const text = result.getText().trim(); if (ignored.current && norm(text) === norm(ignored.current)) { setStatus(ignoreHint); return; } done = true; setStatus('Read: ' + text); scanFeedback(); c.stop(); onResultRef.current(text, result.getBarcodeFormat?.()); }
    }).then(c => { controls.current = c; setTorchAvailable(typeof c?.switchTorch === 'function'); setStatus(hint); }).catch(e => setError(e.name === 'NotAllowedError' ? 'Camera permission was denied. Allow the camera for this site in the browser settings, then reopen.' : e.name === 'NotFoundError' ? 'No camera found on this device.' : 'Camera error: ' + (e.message || e.name)));
    return () => { done = true; controls.current?.stop(); };
  }, [hint, ignoreHint]);
  async function toggleTorch() { try { await controls.current?.switchTorch?.(!torch); setTorch(t => !t); } catch { setStatus('Torch is not available on this camera.'); } }
  return <div className="scanner" role="dialog" aria-label={label}>
    <div className="scanner-view"><video ref={video} className="scanner-video" muted playsInline/><div className="scanner-reticle" aria-hidden="true"/></div>
    <div className="scanner-foot"><small>{error || status}</small><span>{torchAvailable && <button type="button" className="text-button" onClick={toggleTorch}>{torch ? 'Torch off' : 'Torch'}</button>}<button type="button" className="text-button" onClick={onClose}>Close</button></span></div>
  </div>;
}
