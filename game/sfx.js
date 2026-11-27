// ═══════════════════════════════════════════════════════
// SFX procedural con Web Audio API (sin archivos MP3, sin licencias)
// Uso: SFX.shoot(), SFX.cut(), SFX.hit(), SFX.venom(),
//      SFX.extract(), SFX.mother(), SFX.win(), SFX.lose(), SFX.toggleMute()
// ═══════════════════════════════════════════════════════
(function () {
  let ctx = null;
  let muted = false;

  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // tono simple con barrido de frecuencia
  function tone(freq, endFreq, dur, type, vol, delay) {
    const a = ac();
    if (!a || muted) return;
    const t0 = a.currentTime + (delay || 0);
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 1), t0 + dur);
    g.gain.setValueAtTime(vol || 0.15, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(a.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // ruido blanco filtrado (golpes, explosiones)
  function noise(dur, vol, cutoff, delay) {
    const a = ac();
    if (!a || muted) return;
    const t0 = a.currentTime + (delay || 0);
    const len = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource();
    src.buffer = buf;
    const filt = a.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = cutoff || 1200;
    const g = a.createGain();
    g.gain.setValueAtTime(vol || 0.2, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt).connect(g).connect(a.destination);
    src.start(t0);
  }

  window.SFX = {
    shoot()   { tone(900, 200, 0.12, 'square', 0.08); },
    cut()     { tone(500, 900, 0.1, 'triangle', 0.15); tone(700, 1200, 0.12, 'triangle', 0.15, 0.1); tone(1000, 1600, 0.18, 'triangle', 0.15, 0.2); },
    hit()     { noise(0.25, 0.3, 900); tone(160, 50, 0.25, 'sawtooth', 0.2); },
    venom()   { tone(300, 600, 0.15, 'sine', 0.2); tone(450, 900, 0.2, 'sine', 0.2, 0.12); },
    extract() { for (let i = 0; i < 4; i++) tone(400, 400, 0.12, 'square', 0.1, i * 0.18); },
    mother()  { tone(90, 40, 1.4, 'sawtooth', 0.3); noise(1.2, 0.2, 400); },
    win()     { [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.25, 'triangle', 0.2, i * 0.15)); },
    lose()    { [392, 330, 262, 196].forEach((f, i) => tone(f, f * 0.9, 0.3, 'sawtooth', 0.15, i * 0.2)); },
    toggleMute() { muted = !muted; return muted; },
    isMuted() { return muted; }
  };

  // Los navegadores bloquean el audio hasta el primer gesto del usuario
  ['pointerdown', 'keydown'].forEach(ev =>
    window.addEventListener(ev, () => ac(), { once: true })
  );
})();
