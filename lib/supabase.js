import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const service = process.env.SUPABASE_SERVICE_ROLE_KEY

// Public client (browser-side usage)
export const supabase = createClient(url, anon)

// Admin client (server-side API routes only) – bypasses RLS
export const supabaseAdmin = createClient(url, service, {
  auth: { persistSession: false }
})
