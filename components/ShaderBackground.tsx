'use client';

import { useEffect, useRef } from 'react';

const MODES: Record<string, number> = { nebula: 0, galaxy: 1, ink: 2 };

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
  vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f);
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
    // ── Galaxy: rotating spiral with a bright core ──
    float tt = t*0.05;
    vec2 p = uv * vec2(1.0, 1.4);
    float r = length(p);
    float a = atan(p.y, p.x) + tt;
    float arm = sin(a*2.0 + log(r + 0.06)*7.0);
    float arms = smoothstep(0.1, 0.9, arm) * smoothstep(1.15, 0.06, r);
    arms *= 0.45 + 0.75*fbm(p*3.0 + vec2(a, r*4.0));
    float core = exp(-r*r*11.0);
    float halo = exp(-r*r*2.4) * 0.4;
    float st = starField(uv, 22.0, 2.2, 0.88, t) + starField(uv, 40.0, 3.4, 0.95, t)*0.7;
    float field = clamp(arms, 0.0, 1.0);
    if (!light) {
      vec3 col = uC;
      col = mix(col, mix(uA, uB, 0.5), field*0.9);
      col += vec3(1.0, 0.92, 0.78) * (core + halo);
      col += vec3(0.9, 0.3, 0.5) * clamp(field - 0.5, 0.0, 1.0) * 0.35;
      col += vec3(0.85, 0.92, 1.0) * st;
      outc = col;
    } else {
      vec3 col = uC;
      col = mix(col, mix(uC, uA, 0.62), field*0.55);
      col = mix(col, mix(uC, vec3(0.98, 0.66, 0.35), 0.6), (core + halo)*0.7);
      col = mix(col, uA*0.5, st*0.5);
      outc = col;
    }
  } else {
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
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
    if (!gl) return;

    function compile(type: number, src: string) {
      const sh = gl!.createShader(type)!;
      gl!.shaderSource(sh, src);
      gl!.compileShader(sh);
      return sh;
    }
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, 'uRes');
    const uTime = gl.getUniformLocation(prog, 'uTime');
    const uMode = gl.getUniformLocation(prog, 'uMode');
    const uMix = gl.getUniformLocation(prog, 'uMix');
    const uA = gl.getUniformLocation(prog, 'uA');
    const uB = gl.getUniformLocation(prog, 'uB');
    const uC = gl.getUniformLocation(prog, 'uC');
    gl.uniform1f(uMode, MODES[mode] ?? 0);

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    // Nebula renders near full-res so stars/comets stay crisp; waves can be softer.
    const scale = mode === 'nebula' ? 1.0 : 0.8;
    const MAX_PIXELS = 3200000; // cap work on very large displays
    function resize() {
      let w = window.innerWidth * dpr * scale;
      let h = window.innerHeight * dpr * scale;
      const over = (w * h) / MAX_PIXELS;
      if (over > 1) { const f = Math.sqrt(over); w /= f; h /= f; }
      w = Math.max(1, Math.floor(w)); h = Math.max(1, Math.floor(h));
      if (canvas!.width !== w || canvas!.height !== h) {
        canvas!.width = w; canvas!.height = h;
        gl!.viewport(0, 0, w, h);
      }
      gl!.uniform2f(uRes, w, h);
    }

    let colTimer = 0;
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

    resize();
    readColors();
    window.addEventListener('resize', resize);

    let raf = 0;
    const start = performance.now();
    function frame(now: number) {
      if (now - colTimer > 400) { readColors(); colTimer = now; }
      gl!.uniform1f(uTime, (now - start) / 1000);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    };
  }, [mode]);

  return <canvas ref={canvasRef} className="bg-shader" aria-hidden="true" />;
}
