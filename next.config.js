/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: true },
  experimental: { turbo: { enabled: false } },
};
module.exports = nextConfig;
