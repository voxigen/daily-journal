'use client';

import { useEffect, useRef } from 'react';

const MODES: Record<string, number> = { plasma: 0, liquid: 1, flow: 2, vortex: 3, aurora: 4 };

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
float fbm(vec2 p){ float v=0.0; float a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p=p*2.02; a*=0.5; } return v; }
void main(){
  vec2 p = (gl_FragCoord.xy - 0.5*uRes)/uRes.y;
  float t = uTime*0.06;
  float f = 0.0;
  if (uMode < 0.5) {
    f = 0.5 + 0.18*(sin(p.x*4.0+t*3.0)+sin(p.y*4.0+t*2.3)+sin((p.x+p.y)*3.0+t*1.7)) + 0.3*fbm(p*2.5+t);
  } else if (uMode < 1.5) {
    float s=0.0;
    for(int i=0;i<5;i++){ float fi=float(i);
      vec2 c = 0.55*vec2(sin(t*1.3+fi*1.7), cos(t*1.1+fi*2.3));
      s += 0.055/max(0.02, length(p-c)); }
    f = smoothstep(0.7, 1.8, s);
  } else if (uMode < 2.5) {
    vec2 q = p*1.6;
    vec2 w = vec2(fbm(q+vec2(0.0,t)), fbm(q+vec2(4.3,-t)));
    f = fbm(q + 1.8*w);
  } else if (uMode < 3.5) {
    float r=length(p); float a=atan(p.y,p.x)+r*3.0 - t*2.0;
    vec2 sp = r*vec2(cos(a), sin(a));
    f = 0.5 + 0.5*sin(sp.x*5.0 + fbm(sp*2.0+t)*5.0);
  } else {
    float n = fbm(vec2(p.x*1.3 + t, p.y*0.7 - t*0.5));
    f = 0.5 + 0.5*sin(p.y*4.0 + n*6.0 + t*1.5);
    f *= smoothstep(0.95, 0.1, abs(p.y));
  }
  f = clamp(f, 0.0, 1.0);
  vec3 rose = vec3(0.88, 0.11, 0.28);
  vec3 col = mix(uA, uB, smoothstep(0.2, 0.75, f));
  col = mix(col, rose, smoothstep(0.75, 1.0, f)*0.55);
  float k = uMix * (0.32 + 0.68*f);
  gl_FragColor = vec4(mix(uC, col, k), 1.0);
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
    gl.uniform1f(uMode, MODES[mode] ?? 2);

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
      gl!.uniform1f(uMix, document.documentElement.dataset.theme === 'light' ? 0.5 : 0.78);
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
