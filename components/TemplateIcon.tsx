'use client';

import {
  ClipboardList, Dumbbell, BookOpen, Laptop, Target, Footprints, Apple, PenLine,
  Palette, Wrench, Phone, Brain, Leaf, Wallet, Music, Handshake, type LucideIcon,
} from 'lucide-react';

// Stable keys stored on templates instead of emoji. Order = picker order.
export const ICON_KEYS = [
  'clipboard', 'dumbbell', 'book', 'laptop', 'target', 'run', 'apple', 'pen',
  'palette', 'wrench', 'phone', 'brain', 'leaf', 'wallet', 'music', 'handshake',
];

const MAP: Record<string, LucideIcon> = {
  clipboard: ClipboardList, dumbbell: Dumbbell, book: BookOpen, laptop: Laptop,
  target: Target, run: Footprints, apple: Apple, pen: PenLine, palette: Palette,
  wrench: Wrench, phone: Phone, brain: Brain, leaf: Leaf, wallet: Wallet,
  music: Music, handshake: Handshake,
};

// Existing templates stored an emoji — map the old set to the new keys so they
// upgrade to line icons automatically, without needing to be re-edited.
const EMOJI_ALIAS: Record<string, string> = {
  '📋': 'clipboard', '💪': 'dumbbell', '📚': 'book', '💻': 'laptop',
  '🎯': 'target', '🏃': 'run', '🍎': 'apple', '✍️': 'pen', '🎨': 'palette',
  '🔧': 'wrench', '📞': 'phone', '🧠': 'brain', '🌿': 'leaf', '💰': 'wallet',
  '🎵': 'music', '🤝': 'handshake',
};

// Renders a template's icon as a themeable line icon; falls back to the raw
// string for any custom emoji we don't recognise.
export default function TemplateIcon({
  icon, className, color,
}: { icon?: string | null; className?: string; color?: string }) {
  const key = icon ? (MAP[icon] ? icon : EMOJI_ALIAS[icon]) : undefined;
  const Comp = key ? MAP[key] : undefined;
  const style = color ? { color } : undefined;
  if (Comp) return <Comp className={className} style={style} />;
  return icon ? <span className={className} style={style}>{icon}</span> : null;
}
