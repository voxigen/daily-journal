'use client';

import { useEffect, useState } from 'react';
import {
  NotebookPen, Feather, Sparkles, Sun, Moon, Flame, Star, Gem, Leaf, Rocket, Zap, Heart, type LucideIcon,
} from 'lucide-react';

// Stylish glyphs for the app logo. They render white on the accent-gradient mark,
// so they read well under any theme colour.
export const LOGO_ICONS: Record<string, LucideIcon> = {
  notebook: NotebookPen, feather: Feather, sparkles: Sparkles, sun: Sun, moon: Moon, flame: Flame,
  star: Star, gem: Gem, leaf: Leaf, rocket: Rocket, zap: Zap, heart: Heart,
};
export const LOGO_KEYS = Object.keys(LOGO_ICONS);
export const DEFAULT_LOGO = 'notebook';

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
