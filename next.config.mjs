/** @type {import('next').NextConfig} */
const nextConfig = {
  // Self-contained build for Docker: emits .next/standalone with a minimal
  // node server + only the deps it actually uses (Vercel ignores this).
  output: 'standalone',
  // Photo uploads go through a server action; the default 1MB body limit
  // silently rejected larger compressed JPEGs.
  experimental: { serverActions: { bodySizeLimit: '8mb' } },
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
