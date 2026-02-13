/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Prevent "Failed to find Server Action" errors after redeploy
  // by ensuring proper cache headers on dynamic content
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        {
          key: 'Cache-Control',
          value: 'no-store, must-revalidate',
        },
      ],
    },
    {
      // Static assets CAN be cached (they have content hashes in filenames)
      source: '/_next/static/:path*',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, max-age=31536000, immutable',
        },
      ],
    },
  ],
}

export default nextConfig
