/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['ffkqnjuobzoswrhpyxqj.supabase.co'],
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
