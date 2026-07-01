'use client';

import { useEffect, useRef } from 'react';

// Hyperspace warp — streaks race out from the centre, tinted with the accent.
export default function WarpBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0, h = 0, cx = 0, cy = 0, raf = 0, colTimer = 0;
    let accent = '#5a63d8';
    const readAccent = () => {
      accent = (getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#5a63d8').trim();
    };

    type Star = { a: number; r: number; z: number };
    let stars: Star[] = [];
    const spawn = (): Star => ({ a: Math.random() * Math.PI * 2, r: Math.random() * 40, z: 0.5 + Math.random() * 1.6 });
    const maxR = () => Math.hypot(w, h) * 0.62;

    function build() {
      const n = Math.min(260, Math.max(90, Math.round((w * h) / 8500)));
      stars = Array.from({ length: n }, () => {
        const s = spawn();
        s.r = Math.random() * maxR();
        return s;
      });
    }
    function resize() {
      w = window.innerWidth; h = window.innerHeight; cx = w / 2; cy = h / 2;
      canvas!.width = Math.floor(w * dpr);
      canvas!.height = Math.floor(h * dpr);
      canvas!.style.width = w + 'px';
      canvas!.style.height = h + 'px';
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    }

    readAccent();
    resize();
    window.addEventListener('resize', resize);

    function frame(now: number) {
      if (now - colTimer > 500) { readAccent(); colTimer = now; }
      ctx!.clearRect(0, 0, w, h);
      const mr = maxR();
      ctx!.strokeStyle = accent;
      for (const s of stars) {
        s.r += s.z * (1.4 + s.r * 0.014);
        if (s.r > mr) { const n = spawn(); s.a = n.a; s.r = n.r; s.z = n.z; }
        const tail = Math.min(s.r * 0.16, 46) + 3;
        const r0 = Math.max(0, s.r - tail);
        const ca = Math.cos(s.a), sa = Math.sin(s.a);
        ctx!.globalAlpha = Math.min(0.85, s.r / mr + 0.08);
        ctx!.lineWidth = Math.min(2.4, 0.4 + s.r * 0.0045);
        ctx!.beginPath();
        ctx!.moveTo(cx + ca * r0, cy + sa * r0);
        ctx!.lineTo(cx + ca * s.r, cy + sa * s.r);
        ctx!.stroke();
      }
      ctx!.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={ref} className="bg-net" aria-hidden="true" />;
}
