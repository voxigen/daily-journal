'use client';

import { useEffect, useRef } from 'react';

const MODES: Record<string, number> = { aurora: 0, nebula: 1, silk: 2, waves: 3 };

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

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes)/uRes.y;
  float t = uTime;
  vec3 fx = vec3(0.0);
  float e = 0.0;

  if (uMode < 0.5) {
    // ── Aurora: shimmering vertical light curtains ──
    float tt = t*0.12;
    for (int i=0; i<4; i++){
      float fi = float(i);
      float xo = uv.x*1.2 + fi*1.9;
      float base = -0.28 + fbm(vec2(xo*0.7, tt*1.6 + fi*3.0))*0.55 + 0.10*sin(uv.x*2.6 + t*0.5 + fi);
      float d = uv.y - base;
      float curtain = exp(-abs(d)*4.0);
      float up = smoothstep(-0.5, 0.35, uv.y);
      float flick = 0.55 + 0.45*fbm(vec2(xo*2.2, t*0.7 + fi*4.0));
      e += curtain * up * flick * (0.55 - fi*0.07);
    }
    e = clamp(e, 0.0, 1.0);
    vec3 grn = vec3(0.10, 0.90, 0.55);
    vec3 vio = vec3(0.45, 0.22, 0.95);
    fx = mix(grn, vio, smoothstep(-0.1, 0.5, uv.y));
    fx = mix(fx, uA, 0.22);
  } else if (uMode < 1.5) {
    // ── Nebula: drifting cosmic clouds with twinkling stars ──
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
    vec2 gp = uv*90.0;
    float star = pow(noise(gp), 42.0);
    star *= 0.6 + 0.4*sin(t*3.0 + hash(floor(gp))*40.0);
    fx += star;
    e = smoothstep(0.08, 0.85, d) + star;
  } else if (uMode < 2.5) {
    // ── Silk: smooth flowing mesh gradient ──
    float tt = t*0.16;
    vec2 q = uv*1.15;
    float n = fbm(q + vec2(sin(tt), cos(tt*0.8)));
    float g1 = 0.5 + 0.5*sin(q.x*2.1 + n*3.2 + tt*2.0);
    float g2 = 0.5 + 0.5*sin(q.y*2.1 - n*3.2 - tt*1.6);
    fx = mix(uA, uB, g1);
    fx = mix(fx, vec3(0.95, 0.38, 0.58), g2*0.45);
    float sheen = pow(0.5 + 0.5*sin((q.x+q.y)*3.0 + n*4.0 + t*0.5), 3.0);
    fx += sheen*0.15;
    e = 0.72 + 0.28*n;
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
