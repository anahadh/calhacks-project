/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["three"],
  // Lets the app import data/hospitals/demo.json from the repo root.
  experimental: { externalDir: true },
};

export default nextConfig;
