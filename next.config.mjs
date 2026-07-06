/** @type {import('next').NextConfig} */
const nextConfig = {
  // Self-contained build for Docker: emits .next/standalone with a minimal
  // node server + only the deps it actually uses (Vercel ignores this).
  output: 'standalone',
  // - serverActions: photo uploads go through a server action; the default
  //   1MB body limit silently rejected larger compressed JPEGs.
  // - staleTimes.dynamic 0: never serve pages from the client router cache.
  //   With the default 30s, adding a task and hopping Сегодня → Статистика →
  //   Сегодня replayed a stale snapshot and the task "disappeared" until a
  //   hard reload. Data is local Postgres, refetching is cheap.
  experimental: {
    serverActions: { bodySizeLimit: '8mb' },
    staleTimes: { dynamic: 0 },
  },
  // Скрываем «X-Powered-By: Next.js» — не даём сканеру версию стека.
  poweredByHeader: false,
  async headers() {
    // Инлайновые скрипты (themeScript в <head>, регистрация SW) требуют
    // 'unsafe-inline' для script-src; styled-jsx/next — для style-src.
    // Шрифты next/font самохостятся, фото отдаются с того же домена.
    // В dev Next гоняет HMR через eval() — там нужен 'unsafe-eval'. В проде нет.
    const scriptSrc = process.env.NODE_ENV === 'development'
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : "script-src 'self' 'unsafe-inline'";
    const csp = [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self'",
      "manifest-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      'upgrade-insecure-requests',
    ].join('; ');
    const securityHeaders = [
      { key: 'Content-Security-Policy', value: csp },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
    ];
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
    ];
  },
};

export default nextConfig;
