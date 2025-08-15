// app/api/games/publish/[gameId]/route.js
export const runtime = 'nodejs'; // ensure Node (Buffer available)

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../../lib/supabase'

export async function POST(req, { params }) {
  try {
    const { gameId } = params
    const { title, description } = await req.json()
    if (!gameId) throw new Error('Missing gameId')
    if (!title) throw new Error('Missing title')

    // 1) Fetch generated HTML from DB
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('games')
      .select('id, html_content')
      .eq('id', gameId)
      .single()
    if (fetchErr) throw fetchErr
    if (!existing?.html_content) throw new Error('No generated HTML found for this game')

    // 2) Upload to Storage:
    //    IMPORTANT: Path is relative to the *bucket* named "games".
    //    So it should be "<id>/index.html", NOT "games/<id>/index.html".
    const path = `${gameId}/index.html`

    // Upload with proper content-type so the browser renders the file
    const file = Buffer.from(existing.html_content, 'utf8')
    const { error: uploadErr } = await supabaseAdmin.storage
      .from('games')
      .upload(path, file, {
        upsert: true,
        contentType: 'text/html; charset=utf-8',
      })
    if (uploadErr) throw uploadErr

    // 3) Update DB metadata (store the relative path only)
    const { data, error } = await supabaseAdmin
      .from('games')
      .update({
        title,
        description: description ?? '',
        game_status: 'published',
        storage_path: path,               // e.g. "<id>/index.html"
        published_at: new Date().toISOString(),
        // html_content: null,            // optional: uncomment to drop big HTML from DB
        updated_at: new Date().toISOString()
      })
      .eq('id', gameId)
      .select('*')
      .single()
    if (error) throw error

    return NextResponse.json({ success: true, message: 'Game published!', game: data })
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
