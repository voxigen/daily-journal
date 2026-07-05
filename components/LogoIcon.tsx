'use client';

import { useEffect, useState } from 'react';

// Hand-drawn minimal marks for Almanax. All strokes use currentColor, so the
// logo follows the accent/theme wherever it's rendered — no tile, no gradient.
type Mark = () => JSX.Element;

const stroke = {
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const LOGO_ICONS: Record<string, Mark> = {
  // Монограмма «А» со звездой альманаха — перекликается с orbit (кольцо + точка)
  mark: () => (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M3.8 19.5 10.2 4.8l6.4 14.7" />
      <path d="M6.9 14.2h6.6" />
      <path
        d="M19 3.8c.25 1.55.95 2.25 2.5 2.5-1.55.25-2.25.95-2.5 2.5-.25-1.55-.95-2.25-2.5-2.5 1.55-.25 2.25-.95 2.5-2.5Z"
        fill="currentColor" stroke="none"
      />
    </svg>
  ),
  // Рассвет — солнце с веером лучей над горизонтом
  dawn: () => (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M3.5 16.5h17" />
      <path d="M7.8 16.5a4.2 4.2 0 0 1 8.4 0" />
      <path d="M12 8.6V6.2" />
      <path d="M6.9 10.7 5.2 9" />
      <path d="M17.1 10.7 18.8 9" />
    </svg>
  ),
  // Орбита — кольцо со спутником
  orbit: () => (
    <svg viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="12" r="7.2" />
      <circle cx="17.1" cy="6.9" r="1.9" fill="currentColor" stroke="none" />
    </svg>
  ),
  // Месяц — вечерняя запись
  luna: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M20.2 13.6A8.3 8.3 0 1 1 10.4 3.8a6.6 6.6 0 0 0 9.8 9.8Z" />
    </svg>
  ),
};
export const LOGO_KEYS = Object.keys(LOGO_ICONS);
export const DEFAULT_LOGO = 'mark';

export default function LogoIcon() {
  const [key, setKey] = useState(DEFAULT_LOGO);
  useEffect(() => {
    const read = () => setKey(document.documentElement.dataset.logo || DEFAULT_LOGO);
    read();
    window.addEventListener('logochange', read);
    return () => window.removeEventListener('logochange', read);
  }, []);
  const Icon = LOGO_ICONS[key] || LOGO_ICONS[DEFAULT_LOGO];
  return <Icon />;
}
