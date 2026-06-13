/* Smash Arena — audio. Tiny WebAudio synth, no asset files.
 * AudioContext is created lazily on first user gesture (browser autoplay rules). */

(() => {
  const SA = window.SA;
  let ctx = null;
  let master = null;
  let enabled = true;

  function ensure() {
    if (ctx) return ctx;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch (e) {
      enabled = false;
    }
    return ctx;
  }

  // A short tone with an envelope.
  function tone(freq, dur, type, gain, slideTo) {
    if (!enabled) return;
    if (!ensure()) return;
    if (ctx.state === "suspended") ctx.resume();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain || 0.25, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // Filtered noise burst — used for hits/launches.
  function noise(dur, gain, cutoff) {
    if (!enabled) return;
    if (!ensure()) return;
    if (ctx.state === "suspended") ctx.resume();
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = cutoff || 1800;
    const g = ctx.createGain();
    g.gain.value = gain || 0.3;
    src.connect(filt).connect(g).connect(master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  SA.Audio = {
    resume() { if (ensure() && ctx.state === "suspended") ctx.resume(); },
    setEnabled(v) { enabled = v; },
    isEnabled() { return enabled; },
    jump()   { tone(420, 0.16, "square", 0.16, 760); },
    hit(power) {
      const p = SA.util.clamp(power || 6, 4, 24);
      noise(0.10, 0.20 + p * 0.012, 1200 + p * 80);
      tone(180 + p * 6, 0.10, "triangle", 0.18);
    },
    launch() { noise(0.22, 0.34, 2600); tone(200, 0.22, "sawtooth", 0.16, 90); },
    shield() { tone(620, 0.12, "sine", 0.12, 520); },
    shieldBreak() { noise(0.4, 0.4, 900); tone(120, 0.4, "sawtooth", 0.2, 60); },
    special() { tone(540, 0.18, "sawtooth", 0.16, 880); },
    ko()     { tone(880, 0.5, "sine", 0.2, 110); noise(0.5, 0.25, 1500); },
    menu()   { tone(660, 0.06, "square", 0.12); },
    confirm(){ tone(540, 0.08, "square", 0.14, 880); },
  };
})();
