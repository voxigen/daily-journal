'use client';

import { useEffect } from 'react';
import { sfx, setAmbient, stopAmbient } from '@/lib/sound';

// .learn-opt is excluded — answering already plays its own correct/wrong sound.
const CLICKABLE = 'button:not(.learn-opt), a, [role="button"], .side-link, .tab-link, .task-row.clickable, .tpl-row.clickable, .hist-day, .bg-opt, .accent-sw, .icon-pick, .color-sw, .pill, .segment button, .add-row, .photo-add, .photo-thumb';

// Plays a soft tick on interactions and manages the per-background ambient drone.
// Audio only unlocks after a user gesture (browser autoplay policy).
export default function SoundController() {
  useEffect(() => {
    const mode = () => document.documentElement.dataset.sound || 'off';

    const applyAmbient = () => {
      if (mode() === 'full') setAmbient(document.documentElement.dataset.bg || 'none');
      else stopAmbient();
    };

    const onDown = (e: PointerEvent) => {
      if (mode() === 'off') return;
      const el = (e.target as HTMLElement | null)?.closest(CLICKABLE);
      if (el) sfx('tick');
    };
    const unlock = () => applyAmbient();

    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    window.addEventListener('soundchange', applyAmbient);
    window.addEventListener('bgchange', applyAmbient);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('soundchange', applyAmbient);
      window.removeEventListener('bgchange', applyAmbient);
      stopAmbient();
    };
  }, []);

  return null;
}
