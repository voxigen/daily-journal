'use client';

import { useEffect, useRef } from 'react';

// Interactive particle network — dots drift, link to nearby dots and to the cursor.
export default function ConstellationBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0, h = 0, raf = 0;
    let accent = '#5a63d8';

    function readAccent() {
      accent = (getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#5a63d8').trim();
    }
    // Accent changes only on explicit user action — observe it instead of
    // polling getComputedStyle (forced style recalc) inside the render loop.
    const mo = new MutationObserver(readAccent);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-accent', 'style'] });

    type P = { x: number; y: number; vx: number; vy: number };
    let pts: P[] = [];
    function build() {
      const count = Math.min(96, Math.max(28, Math.round((w * h) / 22000)));
      pts = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
      }));
    }
    function resize() {
      w = window.innerWidth; h = window.innerHeight;
      canvas!.width = Math.floor(w * dpr);
      canvas!.height = Math.floor(h * dpr);
      canvas!.style.width = w + 'px';
      canvas!.style.height = h + 'px';
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    }

    const mouse = { x: -9999, y: -9999 };
    const onMove = (e: MouseEvent) => { mouse.x = e.clientX; mouse.y = e.clientY; };
    const onLeave = () => { mouse.x = -9999; mouse.y = -9999; };

    readAccent();
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseout', onLeave);

    const LINK = 132, MLINK = 175;
    // 30fps halves the O(N²) link work with no visible difference; drift is
    // dt-scaled so the dots move at exactly the same speed as at 60fps.
    const FRAME_MS = 1000 / 30;
    let lastDraw = 0, lastTick = 0;
    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      if (now - lastDraw < FRAME_MS - 1) return;
      lastDraw = now;
      const dt = lastTick ? Math.min((now - lastTick) / (1000 / 60), 4) : 1; // in 60fps-frame units
      lastTick = now;
      ctx!.clearRect(0, 0, w, h);

      for (const p of pts) {
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      }

      ctx!.lineWidth = 1;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        for (let j = i + 1; j < pts.length; j++) {
          const b = pts[j];
          const dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
          if (d2 < LINK * LINK) {
            ctx!.globalAlpha = (1 - Math.sqrt(d2) / LINK) * 0.45;
            ctx!.strokeStyle = accent;
            ctx!.beginPath(); ctx!.moveTo(a.x, a.y); ctx!.lineTo(b.x, b.y); ctx!.stroke();
          }
        }
        const mdx = a.x - mouse.x, mdy = a.y - mouse.y, md2 = mdx * mdx + mdy * mdy;
        if (md2 < MLINK * MLINK) {
          ctx!.globalAlpha = (1 - Math.sqrt(md2) / MLINK) * 0.6;
          ctx!.strokeStyle = accent;
          ctx!.beginPath(); ctx!.moveTo(a.x, a.y); ctx!.lineTo(mouse.x, mouse.y); ctx!.stroke();
        }
      }

      ctx!.globalAlpha = 0.85;
      ctx!.fillStyle = accent;
      for (const p of pts) { ctx!.beginPath(); ctx!.arc(p.x, p.y, 1.7, 0, 6.283); ctx!.fill(); }
      ctx!.globalAlpha = 1;
    }

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      mo.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseout', onLeave);
    };
  }, []);

  return <canvas ref={ref} className="bg-net" aria-hidden="true" />;
}
