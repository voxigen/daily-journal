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
  // Геометрическая «А» — монограмма Almanax
  mark: () => (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M5.5 19.5 12 4.5l6.5 15" />
      <path d="M8.6 14.2h6.8" />
    </svg>
  ),
  // Рассвет — новый день над горизонтом
  dawn: () => (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M6.5 15.5a5.5 5.5 0 0 1 11 0" />
      <path d="M3.5 15.5h17" />
      <path d="M12 7.6V5.2" />
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
