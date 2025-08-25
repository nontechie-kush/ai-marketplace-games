// lib/supabaseServer.js
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) throw new Error('Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL');
if (!SERVICE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');

// Admin client for API routes (server-only)
export const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
