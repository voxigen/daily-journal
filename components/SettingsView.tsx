'use client';

import { useEffect, useState } from 'react';
import AppShell from './AppShell';
import { Check, Palette, Sparkles, SunMoon, Type, ALargeSmall, Layers } from 'lucide-react';

type ThemeChoice = 'light' | 'dark' | 'auto';

const SURFACES: { key: string; label: string }[] = [
  { key: 'solid', label: 'Обычные' },
  { key: 'glass', label: 'Стекло' },
  { key: 'matte', label: 'Матовые' },
  { key: 'soft', label: 'Тени' },
];

const FONTS: { key: string; label: string; css: string }[] = [
  { key: 'inter', label: 'Inter', css: 'var(--font-inter), sans-serif' },
  { key: 'manrope', label: 'Manrope', css: 'var(--font-manrope), sans-serif' },
  { key: 'lora', label: 'Serif', css: 'var(--font-lora), Georgia, serif' },
  { key: 'mono', label: 'Моно', css: 'ui-monospace, Menlo, monospace' },
];

const SIZES: { key: string; label: string }[] = [
  { key: 'sm', label: 'Мелкий' },
  { key: 'md', label: 'Обычный' },
  { key: 'lg', label: 'Крупный' },
];

const ACCENTS: { key: string; hex: string }[] = [
  { key: 'indigo', hex: '#5a63d8' },
  { key: 'violet', hex: '#7c3aed' },
  { key: 'blue', hex: '#2f6feb' },
  { key: 'teal', hex: '#0d9488' },
  { key: 'green', hex: '#16a34a' },
  { key: 'amber', hex: '#d97706' },
  { key: 'rose', hex: '#e11d48' },
  { key: 'slate', hex: '#64748b' },
];

const BACKGROUNDS: { key: string; label: string }[] = [
  { key: 'none', label: 'Нет' },
  { key: 'constellation', label: 'Созвездие' },
  { key: 'aurora', label: 'Аврора' },
  { key: 'nebula', label: 'Туманность' },
  { key: 'silk', label: 'Шёлк' },
  { key: 'waves', label: 'Волны' },
  { key: 'particles', label: 'Частицы' },
  { key: 'stars', label: 'Звёзды' },
  { key: 'grid', label: 'Сетка' },
];

export default function SettingsView() {
  const [theme, setThemeState] = useState<ThemeChoice>('auto');
  const [accent, setAccentState] = useState('indigo');
  const [bg, setBgState] = useState('none');
  const [font, setFontState] = useState('inter');
  const [size, setSizeState] = useState('md');
  const [surface, setSurfaceState] = useState('solid');

  useEffect(() => {
    const t = localStorage.getItem('theme');
    setThemeState(t === 'light' || t === 'dark' ? t : 'auto');
    setAccentState(document.documentElement.dataset.accent || 'indigo');
    setBgState(document.documentElement.dataset.bg || 'none');
    setFontState(document.documentElement.dataset.font || 'inter');
    setSizeState(document.documentElement.dataset.size || 'md');
    setSurfaceState(document.documentElement.dataset.surface || 'solid');
  }, []);

  function chooseTheme(v: ThemeChoice) {
    setThemeState(v);
    const r = document.documentElement;
    if (v === 'auto') {
      localStorage.removeItem('theme');
      const sys = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      r.dataset.theme = sys;
      r.style.colorScheme = sys;
    } else {
      localStorage.setItem('theme', v);
      r.dataset.theme = v;
      r.style.colorScheme = v;
    }
  }

  function chooseAccent(key: string) {
    setAccentState(key);
    document.documentElement.dataset.accent = key;
    localStorage.setItem('accent', key);
    window.dispatchEvent(new Event('bgchange'));
  }

  function chooseBg(key: string) {
    setBgState(key);
    document.documentElement.dataset.bg = key;
    localStorage.setItem('bg', key);
    window.dispatchEvent(new Event('bgchange'));
  }

  function chooseFont(key: string) {
    setFontState(key);
    document.documentElement.dataset.font = key;
    localStorage.setItem('font', key);
  }

  function chooseSize(key: string) {
    setSizeState(key);
    document.documentElement.dataset.size = key;
    localStorage.setItem('size', key);
  }

  function chooseSurface(key: string) {
    setSurfaceState(key);
    document.documentElement.dataset.surface = key;
    localStorage.setItem('surface', key);
  }

  return (
    <AppShell title="Настройки">
      <div className="section">
        <div className="section-head"><span className="section-label"><SunMoon /> Тема</span></div>
        <div className="setting-card">
          <div className="segment">
            {(['light', 'dark', 'auto'] as ThemeChoice[]).map((v) => (
              <button key={v} className={theme === v ? 'sel' : ''} onClick={() => chooseTheme(v)}>
                {v === 'light' ? 'Светлая' : v === 'dark' ? 'Тёмная' : 'Авто'}
              </button>
            ))}
          </div>
          <div className="setting-hint">«Авто» подстраивается под системную тему телефона.</div>
        </div>
      </div>

      <div className="section">
        <div className="section-head"><span className="section-label"><Type /> Шрифт</span></div>
        <div className="setting-card">
          <div className="pills">
            {FONTS.map((f) => (
              <button
                key={f.key}
                className={`pill${font === f.key ? ' sel' : ''}`}
                style={{ fontFamily: f.css }}
                onClick={() => chooseFont(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-head"><span className="section-label"><ALargeSmall /> Размер интерфейса</span></div>
        <div className="setting-card">
          <div className="segment">
            {SIZES.map((s) => (
              <button key={s.key} className={size === s.key ? 'sel' : ''} onClick={() => chooseSize(s.key)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-head"><span className="section-label"><Palette /> Акцентный цвет</span></div>
        <div className="setting-card">
          <div className="accent-row">
            {ACCENTS.map((a) => (
              <button
                key={a.key}
                className={`accent-sw${accent === a.key ? ' sel' : ''}`}
                style={{ background: a.hex, color: a.hex }}
                onClick={() => chooseAccent(a.key)}
                aria-label={a.key}
              >
                {accent === a.key && <Check style={{ color: '#fff' }} />}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-head"><span className="section-label"><Layers /> Стиль блоков</span></div>
        <div className="setting-card">
          <div className="pills">
            {SURFACES.map((s) => (
              <button key={s.key} className={`pill${surface === s.key ? ' sel' : ''}`} onClick={() => chooseSurface(s.key)}>
                {s.label}
              </button>
            ))}
          </div>
          <div className="setting-hint">«Стекло» и «Матовые» лучше всего смотрятся с анимированным фоном.</div>
        </div>
      </div>

      <div className="section">
        <div className="section-head"><span className="section-label"><Sparkles /> Анимированный фон</span></div>
        <div className="setting-card">
          <div className="bg-opts">
            {BACKGROUNDS.map((b) => (
              <button key={b.key} className={`bg-opt${bg === b.key ? ' sel' : ''}`} onClick={() => chooseBg(b.key)}>
                <div className={`bg-prev ${b.key}`} />
                <div className="bg-opt-label">{b.label}</div>
              </button>
            ))}
          </div>
          <div className="setting-hint">Фон анимируется в цвете акцента. При включённом «уменьшении движения» в системе анимация отключается.</div>
        </div>
      </div>
    </AppShell>
  );
}
