// lib/cache.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY; // server only!

const supabaseSrv = createClient(supabaseUrl, serviceRole, {
  auth: { persistSession: false },
});

export async function getCache(cache_key) {
  const { data, error } = await supabaseSrv
    .from('prompt_cache')
    .select('value, expires_at')
    .eq('cache_key', cache_key)
    .maybeSingle();
  if (error || !data) return null;
  if (new Date(data.expires_at) < new Date()) return null;
  return data.value;
}

export async function setCache(cache_key, value, ttlSeconds = 3600) {
  const expires_at = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  const { error } = await supabaseSrv
    .from('prompt_cache')
    .upsert({ cache_key, value, expires_at });
  if (error) console.error('Cache upsert error:', error);
}
