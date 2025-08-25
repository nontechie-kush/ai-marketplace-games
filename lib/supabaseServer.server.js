// lib/supabaseServer.js
import { createClient } from '@supabase/supabase-js';

let _admin = null;

/**
 * Lazily create the server-side Supabase admin client.
 * This avoids throwing at module import time.
 */
export function getAdminSupabase() {
  if (_admin) return _admin;

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    // Throw only when a server route actually tries to use it.
    throw new Error(
      'Server Supabase envs missing: SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY'
    );
  }

  _admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return _admin;
}
