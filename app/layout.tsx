import type { Metadata, Viewport } from 'next';
import { Inter, Manrope, Lora } from 'next/font/google';
import AnimatedBackground from '@/components/AnimatedBackground';
import SoundController from '@/components/SoundController';
import './globals.css';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
  display: 'swap',
});

const manrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-manrope',
  display: 'swap',
});

const lora = Lora({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-lora',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Daily Journal',
  description: 'Ежедневный дневник задач',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Journal',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

// Resolve theme/accent/background before first paint to avoid a flash.
const themeScript = `(function(){try{var r=document.documentElement;var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}r.dataset.theme=t;r.style.colorScheme=t;r.dataset.accent=localStorage.getItem('accent')||'indigo';r.dataset.bg=localStorage.getItem('bg')||'none';r.dataset.font=localStorage.getItem('font')||'inter';r.dataset.size=localStorage.getItem('size')||'md';r.dataset.surface=localStorage.getItem('surface')||'solid';r.dataset.tilefx=localStorage.getItem('tilefx')||'none';r.dataset.sound=localStorage.getItem('sound')||'sfx';var tc=localStorage.getItem('tzChoice');var tz=(tc&&tc!=='auto')?tc:(Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC');if(!/(?:^|; )tz=/.test(document.cookie)){document.cookie='tz='+tz+'; path=/; max-age=31536000; samesite=lax';}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${inter.variable} ${manrope.variable} ${lora.variable}`} suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <AnimatedBackground />
        <SoundController />
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');`,
          }}
        />
      </body>
    </html>
  );
}
