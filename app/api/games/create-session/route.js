import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Make a user-bound Supabase client from the auth cookie
function userClientFromCookies() {
  const cookieStore = cookies()
  const token = cookieStore.get('sb-access-token')?.value || ''
  return createClient(url, anon, {
    global: { headers: { Authorization: token ? `Bearer ${token}` : '' } },
    auth: { persistSession: false },
  })
}

export async function POST() {
  try {
    // 1) Require that caller is signed in
    const userClient = userClientFromCookies()
    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr) {
      console.error('[create-session] getUser error:', userErr)
      return NextResponse.json({ success: false, error: userErr.message }, { status: 401 })
    }
    const user = userData?.user
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // 2) Insert a draft using the admin client (bypasses RLS safely on server)
    const autoDeleteAt = new Date(Date.now() + 72 * 3600 * 1000).toISOString()
    const { data, error } = await supabaseAdmin
      .from('games')
      .insert({
        title: 'Untitled Game',
        description: '',
        html_content: '<!-- to be generated -->',
        creator_id: user.id,
        creator_name: user.user_metadata?.full_name ?? user.email ?? null,
        game_status: 'creating',
        auto_delete_at: autoDeleteAt,
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
