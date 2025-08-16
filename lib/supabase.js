// lib/supabase.js
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Singleton to avoid multiple GoTrueClient instances
let _client
export const supabase = (() => {
  if (!_client) {
    _client = createClient(url, anon, {
      auth: { persistSession: true },
    })
  }
  return _client
})()
