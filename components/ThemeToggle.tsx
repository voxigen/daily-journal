'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark' | null>(null);

  useEffect(() => {
    const current = (document.documentElement.dataset.theme as 'light' | 'dark') || 'light';
    setTheme(current);
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    try { localStorage.setItem('theme', next); } catch {}
    setTheme(next);
  }

  return (
    <button className="icon-btn theme-toggle" onClick={toggle} aria-label="Сменить тему">
      {theme === 'dark' ? <Sun className="icon" /> : <Moon className="icon" />}
    </button>
  );
}
