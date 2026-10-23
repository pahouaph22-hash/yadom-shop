// Prefix for raw URLs (window.location, email redirects). next/link and router add it automatically.
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';
export const withBase = (path) => `${BASE}${path}`;
