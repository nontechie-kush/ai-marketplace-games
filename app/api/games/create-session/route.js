import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export async function POST(req) {
  try {
    // 1) Extract Bearer token from Authorization header sent by the browser
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // 2) Resolve the current user using a user-scoped anon client
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    })

    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData?.user) {
      if (userErr) console.error('[create-session] getUser error:', userErr)
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    const user = userData.user

    // 3) Insert draft using the admin client (bypasses RLS safely on server)
    const autoDeleteAt = new Date(Date.now() + 72 * 3600 * 1000).toISOString()
    const { data, error } = await supabaseAdmin
      .from('games')
      .insert({
        title: 'Untitled Game',
        description: '',
        // Spec-first architecture defaults
        spec_json: {},                 // start empty spec
        brief_summary: null,           // optional rolling 300-char summary
        conversation_history: [],      // empty chat history
        html_content: null,            // IMPORTANT: no HTML at creation
        storage_path: null,            // not published yet

        // Creator & lifecycle
        creator_id: user.id,
        creator_name: user.user_metadata?.full_name ?? user.email ?? null,
        game_status: 'creating',       // stays 'creating' until compile succeeds
        auto_delete_at: autoDeleteAt
      })
      .select('id')
      .single()

    if (error) {
      console.error('[create-session] insert error:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, gameId: data.id })
  } catch (e) {
    console.error('[create-session] unexpected error:', e)
    return NextResponse.json({ success: false, error: e.message ?? String(e) }, { status: 500 })
  }
}
