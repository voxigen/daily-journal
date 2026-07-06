'use client';

import { useEffect, useRef } from 'react';

const MODES: Record<string, number> = { nebula: 0, galaxy: 1, ink: 2, aurora: 3, lava: 4, waves: 5, plasma: 6, vortex: 7 };

const VERT = `attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform float uMode; uniform float uMix;
uniform vec3 uA; uniform vec3 uB; uniform vec3 uC;

// Precision-stable hash (Dave Hoskins) — no sin() of large args, so the value
// noise doesn't break into blocky cells on real GPUs.
float hash(vec2 p){
  vec3 p3 = fract(vec3(p.x, p.y, p.x) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float noise(vec2 p){
  vec2 i=floor(p); vec2 f=fract(p); f=f*f*f*(f*(f*6.0-15.0)+10.0);  // quintic: C2, no creases at cell edges
  float a=hash(i); float b=hash(i+vec2(1.0,0.0)); float c=hash(i+vec2(0.0,1.0)); float d=hash(i+vec2(1.0,1.0));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
}
float fbm(vec2 p){ float v=0.0; float a=0.5; for(int i=0;i<6;i++){ v+=a*noise(p); p=p*2.02+vec2(1.7,9.2); a*=0.5; } return v; }

// Crisp twinkling star on a jittered grid cell. Sizes are in screen (uv) units so
// stars stay sharp pinpoints regardless of density; thresh controls how many appear.
float starField(vec2 uv, float density, float tw, float thresh, float t){
  vec2 g = uv*density;
  vec2 id = floor(g);
  if (hash(id) < thresh) return 0.0;
  vec2 off = (vec2(hash(id+11.3), hash(id+27.1)) - 0.5) * 0.8;
  float d = length((fract(g) - 0.5) - off) / density;
  float core = smoothstep(0.0026, 0.0, d);          // sharp pinpoint
  float halo = smoothstep(0.0095, 0.0, d) * 0.10;   // tight, faint glow
  float tw2 = 0.5 + 0.5*sin(t*tw + hash(id+5.1)*6.2831);
  tw2 = 0.35 + 0.65*tw2*tw2;
  return (core + halo) * tw2;
}

// A comet: enters from a random edge at a random downward angle each cycle, so it
// never streaks through the same spot twice. seed offsets its schedule.
float comet(vec2 uv, float t, float seed){
  float period = 8.0;
  float tp = t/period + seed;
  float cyc = floor(tp);
  float prog = (fract(tp) * period) / 1.3;          // streak visible for ~1.3s
  if (prog > 1.0) return 0.0;
  float r1 = hash(vec2(cyc, seed*13.1 + 1.0));
  float r2 = hash(vec2(cyc*1.7 + 3.0, seed*7.3 + 2.0));
  float r3 = hash(vec2(cyc*2.3 + 9.0, seed*5.9 + 4.0));
  float r4 = hash(vec2(cyc*3.1 + 5.0, seed*3.7 + 6.0));
  float sx = r4 < 0.5 ? 1.0 : -1.0;                 // travel left→right or right→left
  vec2 start = vec2(sx > 0.0 ? mix(-1.1, 0.4, r1) : mix(-0.4, 1.1, r1), mix(0.20, 0.55, r2));
  vec2 dir = normalize(vec2(sx, mix(-0.85, -0.30, r3)));
  vec2 rel = uv - (start + dir * prog * 2.7);
  float along = dot(rel, -dir);                     // >0 = trail behind the head
  float perp = abs(dot(rel, vec2(-dir.y, dir.x)));
  float trail = smoothstep(0.34, 0.0, along) * step(0.0, along) * smoothstep(0.0045, 0.0, perp);
  float head = smoothstep(0.016, 0.0, length(rel));
  float fade = smoothstep(0.0, 0.12, prog) * smoothstep(1.0, 0.72, prog);
  return (trail*0.8 + head*1.1) * fade;
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes)/uRes.y;
  float t = uTime;

  bool light = uMix < 0.7;
  vec3 outc;

  if (uMode < 0.5) {
    // ── Nebula: drifting cosmic clouds ──
    vec2 q = uv*1.5;
    float tt = t*0.045;
    float w  = fbm(q + vec2(tt, -tt));
    float w2 = fbm(q*1.25 + 3.0*w + vec2(-tt*1.3, tt));
    float d  = fbm(q + 2.6*vec2(w, w2));
    d = pow(clamp(d, 0.0, 1.0), 1.35);
    float s = starField(uv, 20.0, 2.0, 0.86, t) + starField(uv, 34.0, 3.2, 0.93, t)*0.8
            + starField(uv + vec2(t*0.010, t*0.004), 26.0, 1.4, 0.90, t)*0.9;
    float shoot = comet(uv, t, 0.0) + comet(uv, t, 0.5);
    if (!light) {
      vec3 c1 = vec3(0.03, 0.04, 0.14);
      vec3 c3 = vec3(0.95, 0.25, 0.5);
      vec3 col = mix(c1, uA, smoothstep(0.08, 0.62, d));
      col = mix(col, c3, smoothstep(0.50, 0.98, d));
      col += vec3(0.92, 0.95, 1.0) * (s + shoot);
      float e = clamp(smoothstep(0.06, 0.85, d) + s + shoot, 0.0, 1.0);
      outc = mix(uC, col, uMix * (0.30 + 0.70*e));
    } else {
      vec3 soft1 = mix(uC, uA, 0.30);
      vec3 soft2 = mix(uC, vec3(0.93, 0.42, 0.58), 0.42);
      vec3 col = mix(uC, soft1, smoothstep(0.04, 0.60, d));
      col = mix(col, soft2, smoothstep(0.52, 0.96, d));
      col = mix(col, uA * 0.55, clamp((s + shoot) * 0.6, 0.0, 0.5));
      outc = col;
    }
  } else if (uMode < 1.5) {
    // ── Galaxy: tilted rotating spiral with a bright core ──
    float tt = t*0.05;
    vec2 pr = vec2(uv.x*0.9135 - uv.y*0.4067, uv.x*0.4067 + uv.y*0.9135);  // ~23° tilt
    vec2 p = pr * vec2(1.0, 1.42);
    float r = length(p);
    float a = atan(p.y, p.x) + tt;
    float arm = sin(a*2.0 + log(r + 0.05)*7.0);
    float arms = smoothstep(0.15, 0.95, arm) * smoothstep(1.1, 0.05, r);
    arms *= 0.4 + 0.7*fbm(p*3.5 + vec2(tt*2.0, r*5.0));   // cartesian noise — no atan seam
    float core = exp(-r*r*22.0);
    float halo = exp(-r*r*5.5) * 0.22;                    // tighter, dimmer glow
    float st = starField(uv, 22.0, 2.2, 0.9, t) + starField(uv, 40.0, 3.4, 0.96, t)*0.6;
    float field = clamp(arms, 0.0, 1.0);
    if (!light) {
      vec3 armCol = mix(uA, vec3(0.92, 0.3, 0.55), 0.35);
      armCol = mix(armCol, uB, smoothstep(0.22, 0.85, r)*0.55);  // outskirts cool toward blue
      vec3 col = mix(uC, armCol, field);                  // saturated arms (less washed out)
      col += mix(vec3(1.0), uA, 0.55) * core;             // tight accent-white core
      col += uA * halo;                                   // accent halo (not warm white)
      col += vec3(0.85, 0.92, 1.0) * st;
      outc = col;
    } else {
      vec3 col = mix(uC, mix(uC, uA, 0.7), field*0.7);
      col = mix(col, mix(uC, uA, 0.85), core*0.8);
      col = mix(col, mix(uC, uA, 0.4), halo);
      col = mix(col, uA*0.5, st*0.5);
      outc = col;
    }
  } else if (uMode < 2.5) {
    // ── Ink: flowing tendrils in water ──
    float tt = t*0.04;
    vec2 p = uv*2.0;
    float w1 = fbm(p + vec2(tt, tt*0.7));
    float w2 = fbm(p*1.4 + 4.0*w1 + vec2(-tt, tt*1.3));
    float ink = fbm(p*1.1 + 3.0*vec2(w1, w2) + tt);
    ink = pow(clamp(ink, 0.0, 1.0), 2.0);
    float edge = smoothstep(0.35, 0.5, ink) - smoothstep(0.5, 0.72, ink);
    if (!light) {
      vec3 col = mix(uC, mix(uA, uB, 0.4), smoothstep(0.2, 0.7, ink));
      col += mix(uA, vec3(0.95, 0.3, 0.55), 0.5) * edge * 1.2;
      col = mix(col, vec3(0.9, 0.92, 1.0), pow(ink, 4.0)*0.3);
      outc = col;
    } else {
      vec3 col = mix(uC, mix(uC, uA, 0.7), smoothstep(0.15, 0.7, ink));
      col = mix(col, mix(uC, vec3(0.9, 0.4, 0.55), 0.6), edge*0.6);
      outc = col;
    }
  } else if (uMode < 3.5) {
    // ── Aurora: waving polar curtains over a night sky ──
    float tt = t*0.05;
    float st = starField(uv, 24.0, 1.8, 0.88, t) + starField(uv, 42.0, 3.0, 0.95, t)*0.6;
    vec3 acc = vec3(0.0);
    float cur = 0.0;
    // curtains follow the accent, drifting toward blue higher up (no fixed green)
    vec3 curLow = uA*1.3;
    vec3 curHigh = mix(uA, uB, 0.7)*1.1;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float x = uv.x*(1.35 + fi*0.25) + fi*4.7;
      float w = fbm(vec2(x*1.5 + tt*(0.9 + fi*0.25), tt*0.55 + fi*3.1));
      float y0 = 0.34 - fi*0.17 + (w - 0.5)*0.65;
      float dy = uv.y - y0;
      // sharp upper edge, long glow trailing below the curtain
      float band = exp(-dy*dy*(dy > 0.0 ? 26.0 : 7.0)*(1.0 + fi*0.5));
      float rays = 0.45 + 0.55*noise(vec2(x*11.0, tt*1.8 + fi*7.0));
      float c = band*rays;
      acc += mix(curLow, curHigh, clamp(fi*0.5, 0.0, 1.0)) * c * (0.9 - fi*0.22);
      cur += c;
    }
    if (!light) {
      vec3 col = mix(vec3(0.008, 0.015, 0.045), uC, 0.35);
      col += acc*0.95 + vec3(0.85, 0.92, 1.0)*st*0.85;
      outc = col;
    } else {
      vec3 soft = mix(uC, uA, 0.5);
      outc = mix(uC, soft, clamp(cur, 0.0, 1.0)*0.6);
      outc = mix(outc, uA*0.55, clamp(st, 0.0, 1.0)*0.35);
    }
  } else if (uMode < 4.5) {
    // ── Lava lamp: slow metaball blobs rising and sinking ──
    float f = 0.0;
    for (int i = 0; i < 6; i++) {
      float fi = float(i);
      float h1 = hash(vec2(fi, 3.7));
      float h2 = hash(vec2(fi, 17.0));
      float h3 = hash(vec2(fi, 23.0));
      float ph = fract(t*(0.008 + 0.007*h1) + h2);
      float yy = 1.0 - abs(1.0 - 2.0*ph);            // rise, then sink back
      float y = mix(-0.66, 0.60, smoothstep(0.0, 1.0, yy));
      float x = (h2 - 0.5)*1.5 + 0.10*sin(t*0.13 + fi*2.4);
      float r = 0.12 + 0.10*h3;
      vec2 d = uv - vec2(x, y);
      f += r*r/(dot(d, d) + 0.002);
    }
    f += (1.0 - smoothstep(-0.62, -0.38, uv.y))*1.2;  // molten pool at the bottom
    float body = smoothstep(0.92, 1.30, f);
    float rim = smoothstep(0.92, 1.06, f) - smoothstep(1.06, 1.55, f);
    if (!light) {
      vec3 hot = mix(uA, vec3(0.97, 0.32, 0.45), 0.5);
      hot *= 0.85 + 0.35*(uv.y + 0.5);               // brighter toward the top
      hot *= 0.88 + 0.24*fbm(uv*3.0 + vec2(t*0.02, -t*0.015));  // molten mottling
      vec3 col = mix(uC, hot, body);
      col += vec3(1.0, 0.62, 0.55)*clamp(rim, 0.0, 1.0)*0.30;
      outc = col;
    } else {
      outc = mix(uC, mix(uC, uA, 0.7), body*0.8);
      outc = mix(outc, mix(uC, vec3(0.9, 0.42, 0.4), 0.55), clamp(rim, 0.0, 1.0)*0.45);
    }
  } else if (uMode < 5.5) {
    // ── Waves: glowing neon ribbons drifting across the screen ──
    vec3 acc = vec3(0.0);
    float glow = 0.0;
    for (int i = 0; i < 5; i++) {
      float fi = float(i);
      float y0 = (fi - 2.0)*0.17;
      float yy = uv.y - y0
        - 0.13*sin(uv.x*2.1 + t*(0.20 + 0.035*fi) + fi*1.9)
        - 0.055*sin(uv.x*4.3 - t*(0.14 + 0.02*fi) + fi*3.3)
        - 0.028*sin(uv.x*8.1 + t*0.26 + fi*5.1);
      float g = 0.0090/(abs(yy) + 0.011);
      vec3 rc = mix(uA, uB, fi*0.24);
      rc = mix(rc, vec3(0.92, 0.35, 0.60), hash(vec2(fi, 1.3))*0.4);
      acc += rc*g;
      glow += g;
    }
    if (!light) {
      vec3 col = uC*0.75 + acc*0.62;
      col += vec3(1.0)*pow(clamp(glow*0.45, 0.0, 1.0), 6.0)*0.22;  // white-hot cores
      outc = col;
    } else {
      outc = mix(uC, mix(uC, uA, 0.75), clamp(glow*0.30, 0.0, 0.8));
    }
  } else if (uMode < 6.5) {
    // ── Plasma: morphing psychedelic colour field ──
    vec2 p = uv*3.0;
    float tt = t*0.35;
    float v = sin(p.x*1.7 + tt)
            + sin(p.y*1.9 - tt*0.8)
            + sin((p.x + p.y)*1.3 + tt*1.2)
            + sin(length(p)*2.2 - tt*1.5)
            + (fbm(p*0.8 + tt*0.2) - 0.5)*3.0;
    float m  = 0.5 + 0.5*sin(v*1.05);
    float m2 = 0.5 + 0.5*cos(v*1.7 + 1.5);
    if (!light) {
      vec3 col = mix(uC, uA, smoothstep(0.1, 0.9, m));
      col = mix(col, uB, smoothstep(0.25, 0.95, m2)*0.7);
      col = mix(col, vec3(0.95, 0.3, 0.55), pow(m, 4.0)*0.45);   // hot magenta crests
      col += pow(m2, 6.0)*0.14;
      outc = col;
    } else {
      vec3 col = mix(uC, mix(uC, uA, 0.75), smoothstep(0.1, 0.9, m));
      col = mix(col, mix(uC, uB, 0.6), smoothstep(0.3, 0.95, m2)*0.5);
      outc = col;
    }
  } else {
    // ── Vortex: swirling tunnel pulling toward the centre ──
    float r = length(uv);
    float a = atan(uv.y, uv.x);
    float tt = t*0.3;
    float spiral = sin(a*4.0 + log(r + 0.06)*6.0 - tt*3.0);
    float rings  = sin(1.0/(r + 0.09)*3.0 + tt*4.0);          // rings rushing inward
    float warp   = fbm(vec2(a*1.5, r*3.0 - tt));
    float pat = (0.5 + 0.5*spiral*rings) * smoothstep(1.35, 0.08, r) * (0.55 + 0.55*warp);
    pat = clamp(pat, 0.0, 1.0);
    float core = exp(-r*r*7.0);
    if (!light) {
      vec3 col = mix(uC, uA, pat);
      col = mix(col, uB, pat*pat*0.55);
      col += mix(vec3(1.0), uA, 0.5)*core;
      col += uA*pat*0.35;
      outc = col;
    } else {
      vec3 col = mix(uC, mix(uC, uA, 0.7), pat);
      col = mix(col, mix(uC, uA, 0.9), core*0.7);
      outc = col;
    }
  }

  // Interleaved-gradient-noise dither — stable on mobile GPUs (no huge sin args).
  float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  gl_FragColor = vec4(outc + (ign - 0.5) * (2.0/255.0), 1.0);
}`;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.trim().replace('#', '');
  const s = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(s || '000000', 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export default function ShaderBackground({ mode }: { mode: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Anti-seam settings, hard-won on desktop:
    // - low-power: keep WebGL on the SAME GPU as the page compositor. With
    //   high-performance, dual-GPU Windows machines render on the discrete card
    //   and composite on the integrated one; the cross-adapter copy is what
    //   produced the stale "two frames stitched together" rectangles.
    // - alpha: true opts out of the opaque/overlay fast path (partial presents).
    // - preserveDrawingBuffer: the compositor reads a stable copy, never mid-draw.
    const gl = canvas.getContext('webgl', { antialias: false, alpha: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
    if (!gl) return;

    let uRes: WebGLUniformLocation | null = null;
    let uTime: WebGLUniformLocation | null = null;
    let uMode: WebGLUniformLocation | null = null;
    let uMix: WebGLUniformLocation | null = null;
    let uA: WebGLUniformLocation | null = null;
    let uB: WebGLUniformLocation | null = null;
    let uC: WebGLUniformLocation | null = null;
    // Force a resize on the next frame (also used to re-sync after context restore).
    let bufW = 0, bufH = 0;
    let ready = false;

    function compile(type: number, src: string) {
      const sh = gl!.createShader(type)!;
      gl!.shaderSource(sh, src);
      gl!.compileShader(sh);
      return sh;
    }

    // (Re)build all GL objects. Called once up front and again on context restore,
    // since a lost context invalidates every program/buffer/uniform.
    function setup() {
      const prog = gl!.createProgram()!;
      gl!.attachShader(prog, compile(gl!.VERTEX_SHADER, VERT));
      gl!.attachShader(prog, compile(gl!.FRAGMENT_SHADER, FRAG));
      gl!.linkProgram(prog);
      if (!gl!.getProgramParameter(prog, gl!.LINK_STATUS)) return;
      gl!.useProgram(prog);

      const buf = gl!.createBuffer();
      gl!.bindBuffer(gl!.ARRAY_BUFFER, buf);
      gl!.bufferData(gl!.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl!.STATIC_DRAW);
      const aPos = gl!.getAttribLocation(prog, 'aPos');
      gl!.enableVertexAttribArray(aPos);
      gl!.vertexAttribPointer(aPos, 2, gl!.FLOAT, false, 0, 0);

      uRes = gl!.getUniformLocation(prog, 'uRes');
      uTime = gl!.getUniformLocation(prog, 'uTime');
      uMode = gl!.getUniformLocation(prog, 'uMode');
      uMix = gl!.getUniformLocation(prog, 'uMix');
      uA = gl!.getUniformLocation(prog, 'uA');
      uB = gl!.getUniformLocation(prog, 'uB');
      uC = gl!.getUniformLocation(prog, 'uC');
      gl!.uniform1f(uMode, MODES[mode] ?? 0);
      bufW = 0; bufH = 0;   // invalidate cached size so the loop resizes immediately
      readColors();
      ready = true;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    // Full-res render — upscaling from a smaller buffer caused faint shimmer/aliasing
    // artifacts on desktop. Cap total pixels so huge monitors still stay smooth.
    const MAX_PIXELS = 4500000;
    // Resize the drawing buffer INSIDE the render loop (not on the async resize event):
    // `canvas.width = …` clears the buffer to black, and if that happened between the
    // event and the next frame the compositor flashed an empty strip — the flicker/
    // "jitter" seen while the mobile URL bar shows/hides. Doing it right before the draw
    // keeps the resize and the repaint atomic.
    function syncSize() {
      let w = window.innerWidth * dpr;
      let h = window.innerHeight * dpr;
      const over = (w * h) / MAX_PIXELS;
      if (over > 1) { const f = Math.sqrt(over); w /= f; h /= f; }
      w = Math.max(1, Math.floor(w)); h = Math.max(1, Math.floor(h));
      if (w !== bufW || h !== bufH) {
        bufW = w; bufH = h;
        canvas!.width = w; canvas!.height = h;
        gl!.viewport(0, 0, w, h);
        gl!.uniform2f(uRes, w, h);
      }
    }

    function readColors() {
      const cs = getComputedStyle(document.documentElement);
      const a = hexToRgb(cs.getPropertyValue('--accent') || '#5a63d8');
      const b = hexToRgb(cs.getPropertyValue('--blue') || '#4d8df6');
      const c = hexToRgb(cs.getPropertyValue('--page') || '#0c0d10');
      gl!.uniform3f(uA, a[0], a[1], a[2]);
      gl!.uniform3f(uB, b[0], b[1], b[2]);
      gl!.uniform3f(uC, c[0], c[1], c[2]);
      gl!.uniform1f(uMix, document.documentElement.dataset.theme === 'light' ? 0.55 : 0.85);
    }
    // Colors only change when the user flips theme/accent — observe those
    // attribute writes instead of calling getComputedStyle (a forced style
    // recalc) every 400ms inside the render loop.
    const mo = new MutationObserver(() => { if (ready) readColors(); });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-accent', 'style'] });

    // Without preventDefault the context is gone for good and the canvas freezes on its
    // last (often partial) frame — the stuck rectangular block. Rebuild on restore.
    function onLost(e: Event) { e.preventDefault(); ready = false; }
    function onRestored() { setup(); }
    canvas.addEventListener('webglcontextlost', onLost, false);
    canvas.addEventListener('webglcontextrestored', onRestored, false);

    setup();

    let raf = 0;
    const start = performance.now();
    // Ambient motion here is very slow, so 30fps is visually identical to 60 —
    // but it halves the GPU load, leaving headroom for the actual UI (the
    // "everything stutters with a shader background" complaint on weak GPUs).
    const FRAME_MS = 1000 / 30;
    let lastDraw = 0;
    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      if (!ready || gl!.isContextLost()) return;
      if (now - lastDraw < FRAME_MS - 1) return;
      lastDraw = now;
      syncSize();
      gl!.uniform1f(uTime, (now - start) / 1000);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
      gl!.flush();   // nudge ANGLE to hand the frame over promptly
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      mo.disconnect();
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    };
  }, [mode]);

  return <canvas ref={canvasRef} className="bg-shader" aria-hidden="true" />;
}
