/** @type {import('next').NextConfig} */
const isGhPages =
  process.env.GH_PAGES === 'true' || process.env.GITHUB_ACTIONS === 'true';

const nextConfig = {
  reactStrictMode: true,
  ...(isGhPages
    ? {
        output: 'export',
        basePath: '/legal-case-tracker',
        assetPrefix: '/legal-case-tracker/',
        trailingSlash: true,
        images: {
          unoptimized: true,
        },
      }
    : {}),
};

export default nextConfig;
