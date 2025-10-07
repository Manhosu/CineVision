/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    optimizeCss: true,
    optimizeServerReact: true,
  },

  // Performance optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.gstatic.com https://www.google.com https://ssl.gstatic.com https://cast.googleapis.com http://www.gstatic.com https://gstatic.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: https: blob:",
              "media-src 'self' https: blob:",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self' https: wss: http://localhost:3000 http://localhost:3001 https://clients3.google.com https://ssl.gstatic.com",
              "frame-src https://www.google.com https://cast.googleapis.com",
              "worker-src 'self' blob:",
            ].join('; '),
          },
        ],
      },
    ];
  },

  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    unoptimized: false,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'image.tmdb.org',
        pathname: '/t/p/**',
      },
      {
        protocol: 'https',
        hostname: 'szghyvnbmjlquznxhqum.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
        pathname: '/images/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3001',
        pathname: '/images/**',
      },
    ],
    domains: [
      'localhost',
      'image.tmdb.org',
      // CDN domains will be added here
      process.env.CDN_DOMAIN,
      process.env.S3_BUCKET_DOMAIN,
    ].filter(Boolean),
  },

  // Environment variables available to client
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
    NEXT_PUBLIC_CDN_URL: process.env.NEXT_PUBLIC_CDN_URL,
    NEXT_PUBLIC_CAST_APP_ID: process.env.NEXT_PUBLIC_CAST_APP_ID,
  },

  // Webpack configuration
  webpack: (config, { dev }) => {
    // Only apply optimizations in production
    if (!dev) {
      // Let Next.js handle chunk splitting with default config
      // Custom splitChunks can cause ChunkLoadError timeouts
    }
    return config;
  },

  // Rewrites disabled - frontend calls backend directly at localhost:3001
  // No proxy needed, avoiding conflicts and loops
  // async rewrites() {
  //   return [];
  // },

  // PWA and offline support
  swcMinify: true,
  poweredByHeader: false,
};

module.exports = nextConfig;