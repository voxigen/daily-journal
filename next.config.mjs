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
  // Headers for PWA
  async headers() {
    return [
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
