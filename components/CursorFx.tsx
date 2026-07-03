'use client';

import { useEffect, useRef, useState } from 'react';

// Custom cursor + pointer effects, driven by data-cursor / data-cursorfx on <html>.
// Desktop-only: activates for fine pointers, so phones are unaffected.

const CURSOR_STYLES = new Set(['ring', 'glow']);
const FX = new Set(['trail', 'sparks', 'glow']);

type Particle = { x: number; y: number; vx: number; vy: number; life: number; size: number };

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
    let gx = -100, gy = -100;      // lerped (glow fx)
    let scale = 1, scaleT = 1;
    let visible = false;
    let overText = false;          // native cursor restored over text fields
    let started = false;           // don't lerp from (-100,-100) on first move
    const parts: Particle[] = [];
    let lastSpawn = 0, lastX = -100, lastY = -100;
    let accent: [number, number, number] = [90, 99, 216];
    let colTimer = 0;

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
      return { x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.7, life: 1, size: 1 + Math.random() * 2 };
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
        parts.push({ x: mx, y: my, vx: 0, vy: 0, life: 1, size: 4.4 });
        lastX = mx; lastY = my;
        if (parts.length > 90) parts.shift();
      } else if (fx === 'sparks' && dist > 14 && now - lastSpawn > 24) {
        lastSpawn = now; lastX = mx; lastY = my;
        parts.push(spark(mx, my), spark(mx, my));
        if (parts.length > 160) parts.splice(0, parts.length - 160);
      }
    }
    function onDown() {
      scaleT = 0.8;
      if (fxOn && fx === 'sparks') for (let i = 0; i < 14; i++) parts.push(spark(mx, my, 1.2));
    }
    function onUp() { scaleT = 1; }
    function onLeave() { visible = false; }

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    root.addEventListener('pointerleave', onLeave);

    let raf = 0;
    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      if (now - colTimer > 500) {
        colTimer = now;
        accent = hexToRgb(getComputedStyle(root).getPropertyValue('--accent') || '#5a63d8');
      }
      const el = elRef.current, dot = dotRef.current;
      if (el) {
        rx += (mx - rx) * (cursor === 'ring' ? 0.22 : 1);
        ry += (my - ry) * (cursor === 'ring' ? 0.22 : 1);
        scale += (scaleT - scale) * 0.3;
        const show = visible && !overText;
        el.style.transform = `translate(${rx}px, ${ry}px) translate(-50%,-50%) scale(${scale.toFixed(3)})`;
        el.style.opacity = show ? '1' : '0';
        if (dot) {
          dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%,-50%)`;
          dot.style.opacity = show ? '1' : '0';
        }
      }
      if (!fxOn || !ctx || !cv) return;
      const [cr, cg, cb] = accent;
      ctx.clearRect(0, 0, cv.width, cv.height);
      if (fx === 'glow') {
        gx += (mx - gx) * 0.14; gy += (my - gy) * 0.14;
        if (visible) {
          const rad = 170 * dpr;
          const g = ctx.createRadialGradient(gx * dpr, gy * dpr, 0, gx * dpr, gy * dpr, rad);
          g.addColorStop(0, `rgba(${cr},${cg},${cb},0.16)`);
          g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
          ctx.fillStyle = g;
          ctx.fillRect(gx * dpr - rad, gy * dpr - rad, rad * 2, rad * 2);
        }
      } else {
        for (let i = parts.length - 1; i >= 0; i--) {
          const p = parts[i];
          if (fx === 'sparks') {
            p.x += p.vx; p.y += p.vy; p.vy += 0.05;
            p.life -= 0.022;
          } else {
            p.life -= 0.026;
          }
          if (p.life <= 0) { parts.splice(i, 1); continue; }
          const a = fx === 'trail' ? p.life * 0.6 : p.life * 0.8;
          ctx.beginPath();
          ctx.arc(p.x * dpr, p.y * dpr, p.size * p.life * dpr, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${cr},${cg},${cb},${a.toFixed(3)})`;
          ctx.fill();
        }
      }
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
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
