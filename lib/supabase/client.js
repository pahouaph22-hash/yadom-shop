'use client';
import { createBrowserClient } from '@supabase/ssr';

let client;
export function getSupabase() {
  if (!client) {
    client = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: {
        // The default cross-tab lock (navigator.locks) can stay held by another open tab of the
        // site and make every request in this tab wait forever. A simple per-call lock avoids that.
        lock: async (_name, _acquireTimeout, fn) => fn(),
      },
    });
  }
  return client;
}
