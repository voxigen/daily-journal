'use client';

import { useEffect, useRef } from 'react';

const MODES: Record<string, number> = { nebula: 0 };

const VERT = `attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform float uMode; uniform float uMix;
uniform vec3 uA; uniform vec3 uB; uniform vec3 uC;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453123); }
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
  vec3 fx = vec3(0.0);
  float e = 0.0;

  // ── Nebula: drifting cosmic clouds + layered starfield ──
  vec2 q = uv*1.5;
  float tt = t*0.045;
  float w  = fbm(q + vec2(tt, -tt));
  float w2 = fbm(q*1.25 + 3.0*w + vec2(-tt*1.3, tt));
  float d  = fbm(q + 2.6*vec2(w, w2));
  d = pow(clamp(d, 0.0, 1.0), 1.35);
  vec3 c1 = vec3(0.04, 0.05, 0.18);
  vec3 c3 = vec3(0.95, 0.25, 0.5);
  fx = mix(c1, uA, smoothstep(0.10, 0.62, d));
  fx = mix(fx, c3, smoothstep(0.50, 0.98, d));

  // Stars: two static twinkling layers, one slow-drifting layer, plus rare comets.
  float s = 0.0;
  s += starField(uv, 20.0, 2.0, 0.86, t);
  s += starField(uv, 34.0, 3.2, 0.93, t) * 0.8;
  s += starField(uv + vec2(t*0.010, t*0.004), 26.0, 1.4, 0.90, t) * 0.9;
  float shoot = comet(uv, t, 0.0) + comet(uv, t, 0.5);
  fx += vec3(0.92, 0.95, 1.0) * (s + shoot);
  e = smoothstep(0.06, 0.85, d) + s + shoot;

  e = clamp(e, 0.0, 1.0);
  float k = uMix * (0.28 + 0.72*e);
  vec3 outc = mix(uC, fx, k);
  // Interleaved-gradient-noise dither — stable on mobile GPUs (no huge sin args);
  // breaks up the 8-bit colour banding ("contour steps") in the smooth clouds.
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
