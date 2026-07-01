'use client';

import { useEffect, useRef } from 'react';

const MODES: Record<string, number> = { nebula: 0, waves: 1 };

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

// Soft twinkling stars on a jittered grid. thresh controls how many cells hold a star.
float starField(vec2 uv, float density, float tw, float thresh, float t){
  vec2 g = uv*density;
  vec2 id = floor(g);
  vec2 f = fract(g) - 0.5;
  float present = step(thresh, hash(id));
  vec2 off = (vec2(hash(id+11.3), hash(id+27.1)) - 0.5) * 0.75;
  float d = length(f - off);
  float core = smoothstep(0.16, 0.0, d);
  float glow = smoothstep(0.5, 0.0, d) * 0.22;
  float tw2 = 0.32 + 0.68*(0.5 + 0.5*sin(t*tw + hash(id+5.1)*6.2831));
  return present * (core + glow) * tw2;
}

// A single shooting star streaking along a diagonal; seed offsets its timing + path.
float shootingStar(vec2 uv, float t, float seed){
  float period = 6.0;
  float lt = mod(t*0.6 + seed*period, period);
  float prog = lt / 1.1;                        // active for ~1.1s each period
  if (prog > 1.0) return 0.0;
  vec2 dir = normalize(vec2(1.0, -0.42));
  vec2 start = vec2(-0.85, 0.42) + vec2(seed*0.7, -seed*0.55);
  vec2 head = start + dir * prog * 2.4;
  vec2 rel = uv - head;
  float along = dot(rel, -dir);                 // >0 = trail behind the head
  float perp = abs(dot(rel, vec2(-dir.y, dir.x)));
  float trail = smoothstep(0.28, 0.0, along) * step(0.0, along) * smoothstep(0.010, 0.0, perp);
  float head2 = smoothstep(0.03, 0.0, length(rel));
  float fade = smoothstep(0.0, 0.12, prog) * smoothstep(1.0, 0.75, prog);
  return (trail*0.9 + head2) * fade;
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes)/uRes.y;
  float t = uTime;
  vec3 fx = vec3(0.0);
  float e = 0.0;

  if (uMode < 0.5) {
    // ── Nebula: drifting cosmic clouds + layered starfield ──
    vec2 q = uv*1.5;
    float tt = t*0.045;
    float w  = fbm(q + vec2(tt, -tt));
    float w2 = fbm(q*1.25 + 3.0*w + vec2(-tt*1.3, tt));
    float d  = fbm(q + 2.6*vec2(w, w2));
    d = pow(clamp(d, 0.0, 1.0), 1.4);
    vec3 c1 = vec3(0.04, 0.05, 0.18);
    vec3 c3 = vec3(0.95, 0.25, 0.5);
    fx = mix(c1, uA, smoothstep(0.15, 0.6, d));
    fx = mix(fx, c3, smoothstep(0.55, 0.95, d));

    // Stars: two static twinkling layers, one slow-drifting layer, plus shooting stars.
    float s = 0.0;
    s += starField(uv, 22.0, 2.2, 0.90, t);
    s += starField(uv, 40.0, 3.4, 0.955, t) * 0.65;
    s += starField(uv + vec2(t*0.012, t*0.004), 27.0, 1.5, 0.93, t) * 0.9;
    float shoot = shootingStar(uv, t, 0.0) + shootingStar(uv, t, 0.37) + shootingStar(uv, t, 0.71);
    fx += vec3(0.9, 0.93, 1.0) * (s + shoot);
    e = smoothstep(0.08, 0.85, d) + s + shoot;
  } else {
    // ── Waves: layered flowing light ribbons ──
    float tt = t*0.5;
    float acc = 0.0;
    for (int i=0; i<5; i++){
      float fi = float(i);
      float yy = uv.y + 0.16*fi - 0.32;
      float wv = 0.085*sin(uv.x*2.8 + tt + fi*1.3) + 0.05*fbm(vec2(uv.x*2.0 + fi*2.0, tt*0.45));
      acc = max(acc, smoothstep(0.03, 0.0, abs(yy - wv)) * (0.6 + 0.09*fi));
    }
    vec3 bg = mix(uA, uB, clamp(uv.y + 0.5, 0.0, 1.0));
    fx = mix(bg*0.55, bg + vec3(0.25), acc);
    e = 0.5 + 0.5*acc;
  }

  e = clamp(e, 0.0, 1.0);
  float k = uMix * (0.28 + 0.72*e);
  gl_FragColor = vec4(mix(uC, fx, k), 1.0);
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
    const scale = 0.7;
    function resize() {
      const w = Math.max(1, Math.floor(window.innerWidth * dpr * scale));
      const h = Math.max(1, Math.floor(window.innerHeight * dpr * scale));
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
