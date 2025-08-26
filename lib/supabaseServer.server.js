import 'server-only';
import { createClient } from '@supabase/supabase-js';

let _admin = null;

/**
 * Server-only Supabase admin client (uses service role key).
 * Safe to call inside API routes and server components only.
 */
export function getAdminSupabase() {
  if (_admin) return _admin;

  const url =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error('Server Supabase env missing: SUPABASE_URL');
  if (!serviceKey) throw new Error('Server Supabase env missing: SUPABASE_SERVICE_ROLE_KEY');

  _admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return _admin;
}


// Named + default singleton export expected by API routes
export const supabaseAdmin = getAdminSupabase();
export default supabaseAdmin;
