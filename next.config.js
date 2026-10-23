/** @type {import('next').NextConfig} */
// Fully static build: works on GitHub Pages (NEXT_PUBLIC_BASE_PATH=/yadom-shop) and on Vercel (no base path).
// All data access goes straight from the browser to Supabase and is protected by Row Level Security.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
module.exports = {
  output: 'export',
  trailingSlash: true,
  basePath,
  images: { unoptimized: true },
};
