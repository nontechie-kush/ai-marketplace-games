'use client';

import { createClient } from '@supabase/supabase-js';

// Browser-only Supabase client (uses public anon key)
let _client;

export function getBrowserSupabase() {
  if (_client) return _client;

  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Don’t crash the UI if envs are missing; log and provide a tiny no-op shim.
  if (!url || !anon) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
    return {
      auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
      from: () => ({ select: async () => ({ data: null, error: new Error('Supabase not configured') }) }),
    };
  }

  _client = createClient(url, anon, {
    auth: { persistSession: true, autoRefreshToken: true },
  });

  return _client;
}

// Backwards-compatible singleton
export const supabase = getBrowserSupabase();
