'use client';

import { useEffect } from 'react';

// Страховка от «сброса темы». Инлайновый themeScript ставит data-* на <html> до
// первой отрисовки, но если на странице случается расхождение гидрации, React
// перерисовывает корень с нуля и сносит эти атрибуты (остаются только lang+class)
// — тема слетает на дефолт. Здесь мы перечитываем localStorage после гидрации и
// возвращаем всё на место. Если атрибуты целы — это no-op без мигания.
function apply() {
  const r = document.documentElement;
  try {
    let t = localStorage.getItem('theme');
    if (t !== 'light' && t !== 'dark') t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    r.dataset.theme = t;
    r.style.colorScheme = t;
    const acc = localStorage.getItem('accent') || 'indigo';
    r.dataset.accent = acc;
    if (acc === 'custom') {
      const ac = localStorage.getItem('accentCustom'), ah = localStorage.getItem('accentCustomH');
      if (ac) { r.style.setProperty('--accent', ac); r.style.setProperty('--accent-hover', ah || ac); }
    } else {
      r.style.removeProperty('--accent');
      r.style.removeProperty('--accent-hover');
    }
    r.dataset.logo = localStorage.getItem('logo') || 'mark';
    r.dataset.logofx = localStorage.getItem('logofx') || 'anim';
    r.dataset.bg = localStorage.getItem('bg') || 'none';
    r.dataset.font = localStorage.getItem('font') || 'inter';
    r.dataset.size = localStorage.getItem('size') || 'md';
    r.dataset.surface = localStorage.getItem('surface') || 'solid';
    r.dataset.tilefx = localStorage.getItem('tilefx') || 'none';
    r.dataset.sound = localStorage.getItem('sound') || 'sfx';
    r.dataset.cursor = localStorage.getItem('cursor') || 'system';
    r.dataset.cursorfx = localStorage.getItem('cursorfx') || 'none';
  } catch { /* private mode / storage disabled — leave defaults */ }
}

export default function ThemeApplier() {
  useEffect(() => {
    apply();
    // Если React снёс атрибуты уже ПОСЛЕ нашего первого прохода (поздняя
    // рекавери-перерисовка), вернём их. Наблюдаем только за пропажей data-theme
    // и восстанавливаем один раз, чтобы не крутить бесконечный цикл.
    let fixed = false;
    const mo = new MutationObserver(() => {
      if (!fixed && !document.documentElement.dataset.theme) { fixed = true; apply(); }
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    // Тема/акцент могли восстановиться позже, чем смонтировались фоны/логотип/
    // курсор — пнём их, чтобы перечитали значения.
    window.dispatchEvent(new Event('bgchange'));
    window.dispatchEvent(new Event('logochange'));
    window.dispatchEvent(new Event('cursorchange'));
    return () => mo.disconnect();
  }, []);
  return null;
}
