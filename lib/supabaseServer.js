// lib/supabaseServer.js
// Thin wrapper so imports can use "@/lib/supabaseServer" everywhere.
import supabaseAdmin, { getAdminSupabase } from './supabaseServer.server';

export { supabaseAdmin, getAdminSupabase };
export default supabaseAdmin;
