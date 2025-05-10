/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['ffkqnjuobzoswrhpyxqj.supabase.co'],
    path: '/_next/image',
    loader: 'default',
    unoptimized: false,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ffkqnjuobzoswrhpyxqj.supabase.co',
        pathname: '/**',
      },
    ],
  },
}

module.exports = nextConfig
