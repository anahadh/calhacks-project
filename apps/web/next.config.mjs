/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Two dev servers on one checkout (e.g. mock and live) need separate build dirs.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  transpilePackages: ["three"],
  // Lets the app import data/hospitals/demo.json from the repo root.
  experimental: { externalDir: true },
};

export default nextConfig;
