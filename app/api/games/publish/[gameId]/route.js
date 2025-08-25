// app/api/games/publish/[gameId]/route.js
export const runtime = 'nodejs' // Blob is available in Node 18+

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabaseServer'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export async function POST(req, { params }) {
  try {
    // Ensure server envs are present (works with either private or NEXT_PUBLIC names)
    if (!SUPABASE_URL || !SUPABASE_ANON) {
      console.error('[publish] Missing Supabase envs');
      return NextResponse.json({ success: false, error: 'Supabase envs missing' }, { status: 500 })
    }
    const { gameId } = params
    const { title, description } = await req.json()

    if (!gameId) throw new Error('Missing gameId')
    if (!title) throw new Error('Missing title')

    // 0) Auth: read bearer token from headers (case-insensitive); allow fallback header
    const authHeader =
      req.headers.get('authorization') ||
      req.headers.get('Authorization') ||
      req.headers.get('x-supabase-auth') ||
      ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'missing_authorization_header' },
        { status: 401 }
      )
    }

    // 0a) Resolve current user with a token-scoped anon client
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    })
    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData?.user) {
      if (userErr) console.error('[publish] auth.getUser error:', userErr)
      return NextResponse.json(
        { success: false, error: 'auth_get_user_failed' },
        { status: 401 }
      )
    }
    const user = userData.user

    // 1) Fetch game and enforce ownership (creator publishes their own game)
    const { data: gameRow, error: fetchErr } = await supabaseAdmin
      .from('games')
      .select('id, creator_id, html_content')
      .eq('id', gameId)
      .single()
    if (fetchErr) {
      console.error('[publish] fetch game error:', fetchErr)
      return NextResponse.json({ success: false, error: 'game_not_found' }, { status: 404 })
    }
    if (gameRow.creator_id && gameRow.creator_id !== user.id) {
      return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 })
    }
    if (!gameRow?.html_content) {
      return NextResponse.json(
        { success: false, error: 'no_generated_html' },
        { status: 400 }
      )
    }

    // 2) Path inside bucket "games": store under "games/<id>/index.html"
    const path = `games/${gameId}/index.html`

    // 2a) Remove any previous version to clear stale metadata
    await supabaseAdmin.storage.from('games').remove([path])

    // 2b) Upload as HTML Blob so Supabase sets correct Content-Type
    const blob = new Blob([gameRow.html_content], { type: 'text/html; charset=utf-8' })
    const { error: uploadErr } = await supabaseAdmin.storage
      .from('games')
      .upload(path, blob, {
        upsert: true,
        contentType: 'text/html; charset=utf-8',
        cacheControl: 'no-cache',
      })
    if (uploadErr) {
      console.error('[publish] upload error:', uploadErr)
      return NextResponse.json(
        { success: false, error: uploadErr.message },
        { status: 500 }
      )
    }

    // 3) Update DB metadata
    const { data, error } = await supabaseAdmin
      .from('games')
      .update({
        title,
        description: description ?? '',
        game_status: 'published',
        storage_path: path,
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', gameId)
      .select('*')
      .single()
    if (error) {
      console.error('[publish] update error:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    const cdnUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${path}`

    return NextResponse.json({ success: true, message: 'Game published!', game: data, cdnUrl })
  } catch (e) {
    console.error('[publish] unexpected error:', e)
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
