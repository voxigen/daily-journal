import type { Metadata, Viewport } from 'next';
import { Inter, Manrope, Lora } from 'next/font/google';
import AnimatedBackground from '@/components/AnimatedBackground';
import SoundController from '@/components/SoundController';
import CursorFx from '@/components/CursorFx';
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
  title: 'Almanax',
  description: 'Личный дневник дня: задачи, планы, питание, вес и слова',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Almanax',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

// Resolve theme/accent/background before first paint to avoid a flash.
const themeScript = `(function(){try{var r=document.documentElement;var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}r.dataset.theme=t;r.style.colorScheme=t;var acc=localStorage.getItem('accent')||'indigo';r.dataset.accent=acc;if(acc==='custom'){var ac=localStorage.getItem('accentCustom'),ah=localStorage.getItem('accentCustomH');if(ac){r.style.setProperty('--accent',ac);r.style.setProperty('--accent-hover',ah||ac);}}r.dataset.logo=localStorage.getItem('logo')||'mark';r.dataset.logofx=localStorage.getItem('logofx')||'anim';r.dataset.bg=localStorage.getItem('bg')||'none';r.dataset.font=localStorage.getItem('font')||'inter';r.dataset.size=localStorage.getItem('size')||'md';r.dataset.surface=localStorage.getItem('surface')||'solid';r.dataset.tilefx=localStorage.getItem('tilefx')||'none';r.dataset.sound=localStorage.getItem('sound')||'sfx';r.dataset.cursor=localStorage.getItem('cursor')||'system';r.dataset.cursorfx=localStorage.getItem('cursorfx')||'none';var tc=localStorage.getItem('tzChoice');var tz=(tc&&tc!=='auto')?tc:(Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC');if(!/(?:^|; )tz=/.test(document.cookie)){document.cookie='tz='+tz+'; path=/; max-age=31536000; samesite=lax';}}catch(e){}})();`;

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
        <CursorFx />
        {children}
        <script
          dangerouslySetInnerHTML={{
            // SW registration + self-healing: after a deploy a stale tab references
            // chunks that no longer exist; on ChunkLoadError we clear caches, update
            // the SW and reload once (session-guarded so it can't loop).
            __html: `if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
(function(){
  var KEY='chunk-recover-at';
  var ran=false;
  function isChunkErr(x){ if(!x) return false; var s=(x.message||''+x); return /Loading chunk|ChunkLoadError|Failed to fetch dynamically imported|Importing a module script failed/.test(s); }
  function recover(){
    if(ran) return; ran=true;
    try{ var last=+sessionStorage.getItem(KEY)||0; if(Date.now()-last<15000) return; sessionStorage.setItem(KEY,''+Date.now()); }catch(e){}
    var done=function(){ location.reload(); };
    try{
      var ps=[];
      if(window.caches&&caches.keys) ps.push(caches.keys().then(function(ks){ return Promise.all(ks.map(function(k){ return caches.delete(k); })); }));
      if(navigator.serviceWorker&&navigator.serviceWorker.getRegistrations) ps.push(navigator.serviceWorker.getRegistrations().then(function(rs){ return Promise.all(rs.map(function(r){ return r.update(); })); }));
      Promise.all(ps).then(done,done);
    }catch(e){ done(); }
  }
  window.addEventListener('unhandledrejection',function(e){ if(isChunkErr(e.reason)) recover(); });
  window.addEventListener('error',function(e){ if(isChunkErr(e.error)) recover(); }, true);
})();`,
          }}
        />
      </body>
    </html>
  );
}
