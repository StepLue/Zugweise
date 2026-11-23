// Tonhöhenerkennung über das Mikrofon (YIN-Verfahren)
let stream = null, ctx = null, analyser = null, timer = null, buf = null;

export function isRunning() { return !!stream; }

export async function start(onPitch) {
  stop();
  if (!window.isSecureContext) { const e = new Error('insecure'); e.name = 'InsecureContext'; throw e; }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { const e = new Error('nomedia'); e.name = 'NoMediaDevices'; throw e; }
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  } catch (e) {
    // Bei Berechtigungsproblemen nicht nochmal fragen; sonst mit einfachster Anfrage erneut versuchen
    if (e.name === 'NotAllowedError' || e.name === 'SecurityError') throw e;
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') await ctx.resume();
  const src = ctx.createMediaStreamSource(stream);
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 55;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500;
  analyser = ctx.createAnalyser();
  analyser.fftSize = 4096;
  src.connect(hp).connect(lp).connect(analyser);
  buf = new Float32Array(analyser.fftSize);
  const tick = () => {
    analyser.getFloatTimeDomainData(buf);
    onPitch(detect(buf, ctx.sampleRate));
  };
  timer = setInterval(tick, 60);
}

export function stop() {
  if (timer) clearInterval(timer);
  timer = null;
  if (stream) stream.getTracks().forEach(t => t.stop());
  stream = null;
  if (ctx) ctx.close();
  ctx = null;
}

export function detect(b, sr) {
  let rms = 0;
  for (let i = 0; i < b.length; i++) rms += b[i] * b[i];
  rms = Math.sqrt(rms / b.length);
  if (rms < 0.008) return { freq: 0, rms, clarity: 0 };
  const W = 2048;
  const tauMin = Math.floor(sr / 900), tauMax = Math.min(Math.floor(sr / 60), W - 1);
  const d = new Float32Array(tauMax + 1);
  for (let tau = 1; tau <= tauMax; tau++) {
    let s = 0;
    for (let i = 0; i < W; i++) { const x = b[i] - b[i + tau]; s += x * x; }
    d[tau] = s;
  }
  // kumulierte normierte Differenz
  let run = 0; d[0] = 1;
  for (let tau = 1; tau <= tauMax; tau++) { run += d[tau]; d[tau] = d[tau] * tau / (run || 1); }
  let tau = -1;
  for (let t = tauMin; t <= tauMax; t++) {
    if (d[t] < 0.15) { while (t + 1 <= tauMax && d[t + 1] < d[t]) t++; tau = t; break; }
  }
  if (tau < 0) return { freq: 0, rms, clarity: 0 };
  const x0 = d[tau - 1], x1 = d[tau], x2 = tau + 1 <= tauMax ? d[tau + 1] : x1;
  const den = x0 + x2 - 2 * x1;
  const better = den ? tau + (x0 - x2) / (2 * den) : tau;
  return { freq: sr / better, rms, clarity: 1 - x1 };
}

export function freqToMidi(f) { return 69 + 12 * Math.log2(f / 440); }
