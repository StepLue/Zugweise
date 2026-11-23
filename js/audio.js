// Einfacher Posaunenklang (Synthese) mit Web Audio
let ctx = null, master = null;
let volume = 0.7;

function ensure() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = volume;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function setVolume(v) { volume = v; if (master) master.gain.value = v; }

export function playMidi(midi, dur = 1.1, when = 0) {
  const c = ensure();
  const t0 = c.currentTime + 0.02 + when;
  const f = 440 * Math.pow(2, (midi - 69) / 12);
  const out = c.createGain();
  out.gain.setValueAtTime(0, t0);
  out.gain.linearRampToValueAtTime(0.32, t0 + 0.06);
  out.gain.setTargetAtTime(0.24, t0 + 0.06, 0.15);
  out.gain.setTargetAtTime(0, t0 + dur, 0.09);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass'; lp.Q.value = 2.5;
  const fc = Math.min(5200, f * 9);
  lp.frequency.setValueAtTime(f * 1.5, t0);
  lp.frequency.exponentialRampToValueAtTime(fc, t0 + 0.09);
  lp.frequency.exponentialRampToValueAtTime(fc * 0.55, t0 + 0.5);
  const body = c.createBiquadFilter();
  body.type = 'peaking'; body.frequency.value = 600; body.Q.value = 1; body.gain.value = 5;
  const o1 = c.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = f;
  const o2 = c.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = f * 1.003;
  const o3 = c.createOscillator(); o3.type = 'square'; o3.frequency.value = f;
  const g3 = c.createGain(); g3.gain.value = 0.25;
  // leichtes Vibrato
  const lfo = c.createOscillator(); lfo.frequency.value = 5;
  const lg = c.createGain(); lg.gain.setValueAtTime(0, t0); lg.gain.linearRampToValueAtTime(f * 0.003, t0 + 0.5);
  lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);
  o1.connect(lp); o2.connect(lp); o3.connect(g3).connect(lp);
  lp.connect(body).connect(out).connect(master);
  const stop = t0 + dur + 0.5;
  [o1, o2, o3, lfo].forEach(o => { o.start(t0); o.stop(stop); });
}

export function playSequence(midis, step = 0.55) {
  midis.forEach((m, i) => playMidi(m, step * 0.9, i * step));
  return midis.length * step;
}

export function unlock() { try { ensure(); } catch (e) { /* ignore */ } }
