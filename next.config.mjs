import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js'

export default function nextConfig(phase) {
  const isDevServer = phase === PHASE_DEVELOPMENT_SERVER
  const connectSrc = [
    "'self'",
    'https://*.stripe.com',
    'https://*.googleapis.com',
    'https://api.telnyx.com',
    'https://api.resend.com',
    'https://*.run.app',
    ...(isDevServer ? [
      'http://127.0.0.1:8080',
      'http://localhost:8080',
      'http://127.0.0.1:5678',
      'http://localhost:5678',
    ] : []),
  ].join(' ')

  return {
    // Keep dev and build artifacts separate so a local `next build`
    // cannot corrupt the live `next dev` runtime during debugging.
    distDir: isDevServer ? '.next-dev' : '.next',
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
              key: 'Permissions-Policy',
              value: 'camera=(), microphone=(), geolocation=(), payment=()',
            },
            {
              key: 'Strict-Transport-Security',
              value: 'max-age=31536000; includeSubDomains; preload',
            },
            {
              key: 'X-XSS-Protection',
              value: '1; mode=block',
            },
            {
              key: 'Content-Security-Policy',
              value: `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://connect.facebook.net https://*.googleapis.com; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob: https: http:; connect-src ${connectSrc}; frame-src https://js.stripe.com https://hooks.stripe.com; object-src 'none'; base-uri 'self'`,
            },
          ],
        },
      ]
    },
  }
}
