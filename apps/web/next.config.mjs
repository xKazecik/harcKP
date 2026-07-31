/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@harc/contracts', '@harc/ui'],
};

export default nextConfig;
