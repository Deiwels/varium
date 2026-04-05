/** @type {import('next').NextConfig} */
const nextConfig = {
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
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://connect.facebook.net https://*.googleapis.com; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob: https: http:; connect-src 'self' https://*.stripe.com https://*.googleapis.com https://api.telnyx.com https://api.resend.com https://*.run.app; frame-src https://js.stripe.com https://hooks.stripe.com; object-src 'none'; base-uri 'self'",
          },
        ],
      },
    ]
  },
}
export default nextConfig
