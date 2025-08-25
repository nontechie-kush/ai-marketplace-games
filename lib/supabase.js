// lib/supabaseServer.js
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) throw new Error('Missing SUPABASE_URL');
if (!SERVICE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');

// Admin client (server only!)
export const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
// lib/supabase.js
// Browser-only Supabase client. Safe to import from client components.
'use client';

import { createClient } from '@supabase/supabase-js';

// Keep a single instance across HMR in dev
let _supabase = (typeof window !== 'undefined' && globalThis.__supabase) || null;

export function getBrowserSupabase() {
  // Never construct a browser client on the server
  if (typeof window === 'undefined') return null;
  if (_supabase) return _supabase;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
    return null;
  }

  _supabase = createClient(url, anon, {
    auth: { persistSession: true, autoRefreshToken: true }
  });

  // cache on the global to persist through Fast Refresh in dev
  globalThis.__supabase = _supabase;
  return _supabase;
}

// Maintain compatibility with existing imports: `import { supabase } from "@/lib/supabase"`
export const supabase = getBrowserSupabase();
