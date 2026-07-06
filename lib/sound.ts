// Tiny Web-Audio engine: synthesized UI sound effects + per-background ambient
// drones. No audio files — everything is generated, so it works offline and adds
// no weight. Controlled by the `data-sound` attribute (off | sfx | full).

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let ambient: { key: string; stop: () => void } | null = null;

type Mode = 'off' | 'sfx' | 'full';
function soundMode(): Mode {
  if (typeof document === 'undefined') return 'off';
  const v = document.documentElement.dataset.sound;
  return v === 'sfx' || v === 'full' ? v : 'off';
}

function getCtx(): AudioContext | null {
  if (soundMode() === 'off') return null;
  if (!ctx) {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);
    } catch { return null; }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function blip(c: AudioContext, dest: AudioNode, freq: number, start: number, dur: number, peak: number, type: OscillatorType = 'sine') {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.linearRampToValueAtTime(peak, start + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g); g.connect(dest);
  o.start(start); o.stop(start + dur + 0.03);
}

export type Sfx = 'tick' | 'pop' | 'correct' | 'wrong' | 'success';

export function sfx(type: Sfx) {
  if (soundMode() === 'off') return;
  const c = getCtx();
  if (!c || !master) return;
  const t = c.currentTime;
  switch (type) {
    case 'tick': blip(c, master, 660, t, 0.05, 0.05, 'triangle'); break;
    case 'pop': blip(c, master, 520, t, 0.08, 0.09, 'sine'); blip(c, master, 800, t + 0.05, 0.09, 0.08, 'sine'); break;
    case 'correct': blip(c, master, 660, t, 0.11, 0.11, 'sine'); blip(c, master, 990, t + 0.08, 0.14, 0.11, 'sine'); break;
    case 'wrong': blip(c, master, 180, t, 0.22, 0.13, 'sawtooth'); blip(c, master, 150, t + 0.03, 0.22, 0.10, 'sawtooth'); break;
    case 'success': [523, 659, 784, 1047].forEach((f, i) => blip(c, master!, f, t + i * 0.1, 0.35, 0.11, 'sine')); break;
  }
}

function noiseBuffer(c: AudioContext): AudioBuffer {
  const len = Math.floor(c.sampleRate * 2);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function buildAmbient(c: AudioContext, dest: AudioNode, key: string) {
  const bus = c.createGain();
  bus.gain.value = 0.0001;
  bus.connect(dest);
  const stops: (() => void)[] = [];

  const drone = (freq: number, type: OscillatorType, gain: number, detune = 0) => {
    const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.value = freq; o.detune.value = detune;
    g.gain.value = gain; o.connect(g); g.connect(bus); o.start();
    stops.push(() => { try { o.stop(); } catch { /* already stopped */ } });
  };
  const noisePad = (cutoff: number, q: number, gain: number, lfoRate: number, lfoDepth: number) => {
    const src = c.createBufferSource(); src.buffer = noiseBuffer(c); src.loop = true;
    const flt = c.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = cutoff; flt.Q.value = q;
    const g = c.createGain(); g.gain.value = gain;
    const lfo = c.createOscillator(); const lg = c.createGain(); lfo.frequency.value = lfoRate; lg.gain.value = lfoDepth;
    lfo.connect(lg); lg.connect(flt.frequency); lfo.start();
    src.connect(flt); flt.connect(g); g.connect(bus); src.start();
    stops.push(() => { try { src.stop(); } catch {} try { lfo.stop(); } catch {} });
  };

  if (key === 'nebula') {          // deep, dreamy cosmic pad
    drone(96, 'sine', 0.5);
    drone(144, 'sine', 0.26, 6);
    noisePad(520, 2, 0.5, 0.05, 240);
  } else if (key === 'galaxy') {   // airy, shimmering
    drone(220, 'sine', 0.3);
    drone(330, 'triangle', 0.16, 8);
    noisePad(1500, 3, 0.32, 0.08, 700);
  } else if (key === 'aurora') {   // icy, high shimmer — polar wind
    drone(196, 'sine', 0.28);
    drone(294, 'sine', 0.14, 7);
    noisePad(2400, 2, 0.28, 0.06, 900);
  } else if (key === 'lava') {     // warm, thick and slow
    drone(58, 'sine', 0.55);
    drone(87, 'triangle', 0.18, -4);
    noisePad(230, 6, 0.55, 0.09, 110);
  } else if (key === 'waves') {    // mid, dreamy swells
    drone(131, 'sine', 0.4);
    drone(196, 'sine', 0.18, -6);
    noisePad(900, 3, 0.4, 0.11, 420);
  } else if (key === 'plasma') {   // vibrant, wobbling
    drone(110, 'sine', 0.34);
    drone(165, 'triangle', 0.17, 11);
    drone(220, 'sine', 0.10, -9);
    noisePad(1200, 4, 0.3, 0.19, 640);
  } else if (key === 'vortex') {   // hypnotic, swirling pull
    drone(82, 'sine', 0.42);
    drone(123, 'sine', 0.18, -8);
    noisePad(720, 5, 0.44, 0.15, 380);
  } else {                         // ink — watery, low and bubbly
    drone(70, 'sine', 0.5);
    drone(105, 'sine', 0.2, -5);
    noisePad(320, 5, 0.6, 0.13, 170);
  }

  const t = c.currentTime;
  bus.gain.setValueAtTime(0.0001, t);
  bus.gain.linearRampToValueAtTime(0.06, t + 2.2);

  return {
    key,
    stop: () => {
      const now = c.currentTime;
      bus.gain.cancelScheduledValues(now);
      bus.gain.setValueAtTime(bus.gain.value, now);
      bus.gain.linearRampToValueAtTime(0.0001, now + 0.8);
      setTimeout(() => { stops.forEach((s) => s()); try { bus.disconnect(); } catch {} }, 950);
    },
  };
}

export function setAmbient(bg: string) {
  if (soundMode() !== 'full' || !['nebula', 'galaxy', 'ink', 'aurora', 'lava', 'waves', 'plasma', 'vortex'].includes(bg)) { stopAmbient(); return; }
  const c = getCtx();
  if (!c || !master) return;
  if (ambient && ambient.key === bg) return;
  stopAmbient();
  ambient = buildAmbient(c, master, bg);
}

export function stopAmbient() {
  if (ambient) { ambient.stop(); ambient = null; }
}
