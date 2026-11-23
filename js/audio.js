// Posaunenklang: Töne werden als WAV berechnet und über <audio> abgespielt.
// Das funktioniert zuverlässiger auf Handys als reine Web-Audio-Synthese.
const SR = 22050;
const cache = new Map();
let volume = 0.7;
let current = [];
let timers = [];

try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* ignore */ }

export function setVolume(v) { volume = v; }

function renderWav(midi, dur) {
  const f = 440 * Math.pow(2, (midi - 69) / 12);
  const n = Math.floor(SR * (dur + 0.25));
  const data = new Float32Array(n);
  // Obertöne einer Posaune (vereinfacht): kräftige 2.–5. Harmonische
  const amps = [1, 0.85, 0.75, 0.6, 0.45, 0.32, 0.22, 0.15, 0.1, 0.07];
  const maxH = Math.max(1, Math.min(amps.length, Math.floor(5000 / f)));
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const att = Math.min(1, t / 0.07);
    const rel = t > dur ? Math.max(0, 1 - (t - dur) / 0.2) : 1;
    const env = att * (0.85 + 0.15 * Math.exp(-t * 4)) * rel;
    const bright = 0.35 + 0.65 * Math.min(1, t / 0.12); // Ansatz: erst dunkel, dann heller
    const vib = 1 + 0.003 * Math.sin(2 * Math.PI * 5 * t) * Math.min(1, t / 0.5);
    let s = 0;
    for (let h = 1; h <= maxH; h++) s += amps[h - 1] * Math.pow(bright, h - 1) * Math.sin(2 * Math.PI * f * h * vib * t);
    data[i] = s * env;
    if (Math.abs(data[i]) > peak) peak = Math.abs(data[i]);
  }
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const w = (o, str) => { for (let k = 0; k < str.length; k++) v.setUint8(o + k, str.charCodeAt(k)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, SR, true); v.setUint32(28, SR * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, n * 2, true);
  const g = 0.8 / (peak || 1);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, data[i] * g)) * 32767, true);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

function urlFor(midi, dur) {
  const k = midi + '|' + dur.toFixed(2);
  if (!cache.has(k)) cache.set(k, renderWav(midi, dur));
  return cache.get(k);
}

function stopAll() {
  timers.forEach(clearTimeout); timers = [];
  current.forEach(a => { try { a.pause(); } catch { } }); current = [];
}

export function playMidi(midi, dur = 1.1) {
  stopAll();
  const a = new Audio(urlFor(midi, dur));
  a.volume = volume;
  current.push(a);
  const p = a.play();
  if (p && p.catch) p.catch(err => console.warn('Ton blockiert', err));
}

export function playSequence(midis, step = 0.55) {
  stopAll();
  const els = midis.map(m => { const a = new Audio(urlFor(m, step * 0.9)); a.volume = volume; a.preload = 'auto'; return a; });
  current = els;
  els.forEach((a, i) => timers.push(setTimeout(() => { a.play().catch(() => { }); }, i * step * 1000)));
  // erstes sofort im Klick starten (Freigabe durch Nutzergeste)
  if (els[0]) { clearTimeout(timers[0]); els[0].play().catch(() => { }); }
  return midis.length * step;
}

export function unlock() { /* nicht mehr nötig */ }
