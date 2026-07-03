'use client';

import { useEffect, useMemo, useState } from 'react';
import ShaderBackground from './ShaderBackground';
import ConstellationBackground from './ConstellationBackground';
import WarpBackground from './WarpBackground';

type Dot = { left: number; top: number; size: number; dur: number; delay: number; drift: number };

const SHADER_MODES = new Set(['nebula', 'galaxy', 'ink', 'aurora', 'lava', 'waves']);

export default function AnimatedBackground() {
  const [bg, setBg] = useState('none');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const read = () => setBg(document.documentElement.dataset.bg || 'none');
    read();
    window.addEventListener('bgchange', read);
    window.addEventListener('storage', read);
    return () => {
      window.removeEventListener('bgchange', read);
      window.removeEventListener('storage', read);
    };
  }, []);

  const dots = useMemo<Dot[]>(
    () =>
      Array.from({ length: 26 }, () => ({
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: 2 + Math.random() * 4,
        dur: 12 + Math.random() * 16,
        delay: -Math.random() * 22,
        drift: (Math.random() * 2 - 1) * 50,
      })),
    []
  );

  if (!mounted || bg === 'none') return <div className="bg-anim" aria-hidden="true" />;

  if (bg === 'constellation') {
    return <ConstellationBackground key="constellation" />;
  }
  if (bg === 'warp') {
    return <WarpBackground key="warp" />;
  }
  if (SHADER_MODES.has(bg)) {
    return <ShaderBackground key={bg} mode={bg} />;
  }
  if (bg === 'bokeh') {
    return <div className="bg-anim bg-bokeh" aria-hidden="true"><span /><span /><span /><span /><span /><span /></div>;
  }
  if (bg === 'grid') {
    return <div className="bg-anim bg-grid" aria-hidden="true"><span /></div>;
  }
  if (bg === 'particles') {
    return (
      <div className="bg-anim bg-particles" aria-hidden="true">
        {dots.map((d, i) => (
          <span
            key={i}
            style={{
              left: `${d.left}%`,
              width: d.size,
              height: d.size,
              animationDuration: `${d.dur}s`,
              animationDelay: `${d.delay}s`,
              ['--drift' as string]: `${d.drift}px`,
            } as React.CSSProperties}
          />
        ))}
      </div>
    );
  }
  if (bg === 'stars') {
    return (
      <div className="bg-anim bg-stars" aria-hidden="true">
        {dots.map((d, i) => (
          <span
            key={i}
            style={{
              left: `${d.left}%`,
              top: `${d.top}%`,
              width: d.size,
              height: d.size,
              animationDuration: `${(d.dur / 4 + 2).toFixed(1)}s`,
              animationDelay: `${d.delay}s`,
            }}
          />
        ))}
      </div>
    );
  }
  return <div className="bg-anim" aria-hidden="true" />;
}
