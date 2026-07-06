'use client';

import { useEffect, useRef, useState } from 'react';

// Custom cursor + pointer effects, driven by data-cursor / data-cursorfx on <html>.
// Desktop-only: activates for fine pointers, so phones are unaffected.

const CURSOR_STYLES = new Set(['ring', 'glow', 'dot', 'cross']);
const FX = new Set(['trail', 'sparks', 'glow', 'ribbon', 'orbit', 'bubbles']);

type Particle = { x: number; y: number; vx: number; vy: number; life: number; size: number };
type Pt = { x: number; y: number; life: number };

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.trim().replace('#', '');
  const s = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(s || '5a63d8', 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export default function CursorFx() {
  const [cfg, setCfg] = useState({ cursor: 'system', fx: 'none' });
  const [fine, setFine] = useState(false);

  useEffect(() => {
    // any-pointer: a mouse attached anywhere counts (desktops with touchscreens
    // can report a coarse primary pointer, which killed the feature there).
    const mq = matchMedia('(any-pointer: fine)');
    setFine(mq.matches);
    const onMq = (e: MediaQueryListEvent) => setFine(e.matches);
    mq.addEventListener('change', onMq);
    const read = () => setCfg({
      cursor: document.documentElement.dataset.cursor || 'system',
      fx: document.documentElement.dataset.cursorfx || 'none',
    });
    read();
    window.addEventListener('cursorchange', read);
    window.addEventListener('storage', read);
    return () => {
      mq.removeEventListener('change', onMq);
      window.removeEventListener('cursorchange', read);
      window.removeEventListener('storage', read);
    };
  }, []);

  if (!fine || (!CURSOR_STYLES.has(cfg.cursor) && !FX.has(cfg.fx))) return null;
  return <CursorLayer key={`${cfg.cursor}-${cfg.fx}`} cursor={cfg.cursor} fx={cfg.fx} />;
}

function CursorLayer({ cursor, fx }: { cursor: string; fx: string }) {
  const elRef = useRef<HTMLDivElement>(null);     // main cursor shape (ring lags behind)
  const dotRef = useRef<HTMLDivElement>(null);    // instant center dot for the ring style
  const cvRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    const hasCursor = CURSOR_STYLES.has(cursor);
    const cv = cvRef.current;
    const ctx = cv ? cv.getContext('2d') : null;
    // No prefers-reduced-motion gate: picking an effect in settings is an
    // explicit opt-in, and the OS-level flag silently killed it on Windows
    // machines with "show animations" turned off.
    const fxOn = FX.has(fx) && !!ctx;
    if (hasCursor) root.classList.add('cursor-none');

    let mx = -100, my = -100;      // raw pointer
    let rx = -100, ry = -100;      // lerped (ring)
    let gx = -100, gy = -100;      // lerped (glow / orbit fx)
    let scale = 1, scaleT = 1;
    let visible = false;
    let overText = false;          // native cursor restored over text fields
    let started = false;           // don't lerp from (-100,-100) on first move
    const parts: Particle[] = [];  // trail / sparks / bubbles
    const pts: Pt[] = [];          // ribbon spine
    let orbitAng = 0;
    let lastSpawn = 0, lastX = -100, lastY = -100;
    let accent: [number, number, number] = [90, 99, 216];
    let canvasDirty = false;       // canvas has pixels from the previous frame
    const readAccent = () => {
      accent = hexToRgb(getComputedStyle(root).getPropertyValue('--accent') || '#5a63d8');
    };
    readAccent();
    // Re-read only when the theme/accent actually changes — no per-frame polling.
    const mo = new MutationObserver(readAccent);
    mo.observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-accent', 'style'] });

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    function resize() {
      if (!cv) return;
      cv.width = Math.floor(window.innerWidth * dpr);
      cv.height = Math.floor(window.innerHeight * dpr);
    }
    if (fxOn) { resize(); window.addEventListener('resize', resize); }

    function spark(x: number, y: number, boost = 0): Particle {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.5 + Math.random() * (1.6 + boost);
      return { x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.7, life: 1, size: 1 + Math.random() * 2.4 };
    }
    function bubble(x: number, y: number): Particle {
      return {
        x: x + (Math.random() - 0.5) * 10, y,
        vx: (Math.random() - 0.5) * 0.4, vy: -(0.5 + Math.random() * 1),
        life: 1, size: 3 + Math.random() * 7,
      };
    }

    function onMove(e: PointerEvent) {
      mx = e.clientX; my = e.clientY;
      if (!started) { rx = mx; ry = my; gx = mx; gy = my; started = true; }
      visible = true;
      const t = e.target as Element | null;
      overText = !!(t && t.closest && t.closest('input, textarea, select, [contenteditable="true"]'));
      if (hasCursor) root.classList.toggle('cursor-none', !overText);
      const interactive = t && t.closest && t.closest('a, button, [role="button"], label, summary');
      scaleT = interactive ? 1.5 : 1;
      if (!fxOn) return;
      const dist = Math.hypot(mx - lastX, my - lastY);
      const now = performance.now();
      if (fx === 'trail' && dist > 4) {
        parts.push({ x: mx, y: my, vx: 0, vy: 0, life: 1, size: 4.6 });
        lastX = mx; lastY = my;
        if (parts.length > 90) parts.shift();
      } else if (fx === 'sparks' && dist > 14 && now - lastSpawn > 24) {
        lastSpawn = now; lastX = mx; lastY = my;
        parts.push(spark(mx, my), spark(mx, my));
        if (parts.length > 160) parts.splice(0, parts.length - 160);
      } else if (fx === 'bubbles' && dist > 14 && now - lastSpawn > 42) {
        lastSpawn = now; lastX = mx; lastY = my;
        parts.push(bubble(mx, my));
        if (parts.length > 80) parts.shift();
      } else if (fx === 'ribbon' && dist > 3) {
        lastX = mx; lastY = my;
        pts.push({ x: mx, y: my, life: 1 });
        if (pts.length > 42) pts.shift();
      }
    }
    function onDown() {
      scaleT = 0.8;
      if (!fxOn) return;
      if (fx === 'sparks') for (let i = 0; i < 14; i++) parts.push(spark(mx, my, 1.2));
      else if (fx === 'bubbles') for (let i = 0; i < 6; i++) parts.push(bubble(mx, my));
    }
    function onUp() { scaleT = 1; }
    function onLeave() { visible = false; }

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    root.addEventListener('pointerleave', onLeave);

    let raf = 0;
    let lastT = 0;
    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      // Time-based smoothing: fixed per-frame factors made the ring crawl when a
      // heavy shader background dropped the frame rate. Clamp dt so a background
      // tab doesn't teleport particles on return.
      const dt = lastT ? Math.min((now - lastT) / 1000, 0.05) : 1 / 60;
      lastT = now;
      const step = dt * 60;   // 1 at 60fps — scales the old per-frame constants
      const el = elRef.current, dot = dotRef.current;
      if (el) {
        const k = cursor === 'ring' ? 1 - Math.exp(-dt * 15) : 1;
        rx += (mx - rx) * k;
        ry += (my - ry) * k;
        scale += (scaleT - scale) * (1 - Math.exp(-dt * 21));
        const show = visible && !overText;
        el.style.transform = `translate(${rx}px, ${ry}px) translate(-50%,-50%) scale(${scale.toFixed(3)})`;
        el.style.opacity = show ? '1' : '0';
        if (dot) {
          dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%,-50%)`;
          dot.style.opacity = show ? '1' : '0';
        }
      }
      if (!fxOn || !ctx || !cv) return;
      // Idle ⇒ nothing to draw: skip the full-screen clear entirely (a real cost
      // on large canvases every frame). Continuous effects stay busy while visible.
      const continuous = fx === 'glow' || fx === 'orbit';
      const busy = continuous ? visible : (parts.length > 0 || pts.length > 0);
      if (!busy && !canvasDirty) return;
      const [cr, cg, cb] = accent;
      const rgba = (a: number) => `rgba(${cr},${cg},${cb},${a})`;
      ctx.clearRect(0, 0, cv.width, cv.height);
      canvasDirty = busy;

      if (fx === 'glow') {
        const gk = 1 - Math.exp(-dt * 9);
        gx += (mx - gx) * gk; gy += (my - gy) * gk;
        if (visible) {
          const cx = gx * dpr, cy = gy * dpr;
          // Two-layer halo: a wide soft wash + a tighter brighter core.
          const outer = 200 * dpr;
          const g1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, outer);
          g1.addColorStop(0, rgba(0.10)); g1.addColorStop(1, rgba(0));
          ctx.fillStyle = g1; ctx.fillRect(cx - outer, cy - outer, outer * 2, outer * 2);
          const inner = 72 * dpr;
          const g2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, inner);
          g2.addColorStop(0, rgba(0.16)); g2.addColorStop(1, rgba(0));
          ctx.fillStyle = g2; ctx.fillRect(cx - inner, cy - inner, inner * 2, inner * 2);
        }
      } else if (fx === 'orbit') {
        orbitAng += dt * 2.4;
        const gk = 1 - Math.exp(-dt * 18);
        gx += (mx - gx) * gk; gy += (my - gy) * gk;
        if (visible) {
          ctx.globalCompositeOperation = 'lighter';
          const N = 3;
          for (let i = 0; i < N; i++) {
            const a = orbitAng + i * ((Math.PI * 2) / N);
            const r = (17 + Math.sin(orbitAng * 1.4 + i) * 4) * dpr;
            const x = gx * dpr + Math.cos(a) * r;
            const y = gy * dpr + Math.sin(a) * r;
            const s = 3.4 * dpr;
            const g = ctx.createRadialGradient(x, y, 0, x, y, s * 2.6);
            g.addColorStop(0, rgba(0.9)); g.addColorStop(1, rgba(0));
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, s * 2.6, 0, Math.PI * 2); ctx.fill();
          }
          ctx.globalCompositeOperation = 'source-over';
        }
      } else if (fx === 'ribbon') {
        for (let i = pts.length - 1; i >= 0; i--) { pts[i].life -= dt * 1.7; if (pts[i].life <= 0) pts.splice(i, 1); }
        if (pts.length > 1) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          for (let i = 0; i < pts.length - 1; i++) {
            const p = pts[i], q = pts[i + 1];
            const head = (i + 1) / pts.length;        // newest points are at the end
            ctx.strokeStyle = rgba(0.5 * p.life);
            ctx.lineWidth = (0.6 + head * 6) * dpr;
            ctx.beginPath(); ctx.moveTo(p.x * dpr, p.y * dpr); ctx.lineTo(q.x * dpr, q.y * dpr); ctx.stroke();
          }
          ctx.globalCompositeOperation = 'source-over';
        }
      } else if (fx === 'bubbles') {
        for (let i = parts.length - 1; i >= 0; i--) {
          const p = parts[i];
          p.x += p.vx * step; p.y += p.vy * step; p.vy *= Math.pow(0.985, step);
          p.size += 0.05 * step; p.life -= 0.011 * step;
          if (p.life <= 0) { parts.splice(i, 1); continue; }
          const a = p.life * 0.5;
          ctx.beginPath(); ctx.arc(p.x * dpr, p.y * dpr, p.size * dpr, 0, Math.PI * 2);
          ctx.strokeStyle = rgba(a); ctx.lineWidth = 1.3 * dpr; ctx.stroke();
          ctx.beginPath();
          ctx.arc((p.x - p.size * 0.3) * dpr, (p.y - p.size * 0.3) * dpr, p.size * 0.2 * dpr, 0, Math.PI * 2);
          ctx.fillStyle = rgba(a * 0.9); ctx.fill();
        }
      } else {
        // trail / sparks — additive glowing dots
        ctx.globalCompositeOperation = 'lighter';
        for (let i = parts.length - 1; i >= 0; i--) {
          const p = parts[i];
          if (fx === 'sparks') {
            p.x += p.vx * step; p.y += p.vy * step; p.vy += 0.05 * step;
            p.life -= 0.022 * step;
          } else {
            p.life -= 0.03 * step;
          }
          if (p.life <= 0) { parts.splice(i, 1); continue; }
          const a = fx === 'trail' ? p.life * 0.5 : p.life * 0.8;
          ctx.beginPath();
          ctx.arc(p.x * dpr, p.y * dpr, p.size * p.life * dpr, 0, Math.PI * 2);
          ctx.fillStyle = rgba(a);
          ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      mo.disconnect();
      root.classList.remove('cursor-none');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      root.removeEventListener('pointerleave', onLeave);
      if (fxOn) window.removeEventListener('resize', resize);
    };
  }, [cursor, fx]);

  return (
    <>
      {FX.has(fx) && <canvas ref={cvRef} className="cursor-fx-canvas" aria-hidden="true" />}
      {CURSOR_STYLES.has(cursor) && <div ref={elRef} className={`cursor-el cursor-${cursor}`} aria-hidden="true" />}
      {cursor === 'ring' && <div ref={dotRef} className="cursor-el cursor-ring-dot" aria-hidden="true" />}
    </>
  );
}
