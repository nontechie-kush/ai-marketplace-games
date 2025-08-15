// app/api/games/publish/[gameId]/route.js
export const runtime = 'nodejs'; // for Buffer

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../../lib/supabase'

export async function POST(req, { params }) {
  try {
    const { gameId } = params
    const { title, description } = await req.json()
    if (!gameId) throw new Error('Missing gameId')
    if (!title) throw new Error('Missing title')

    // 1) Fetch generated HTML
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('games')
      .select('id, html_content')
      .eq('id', gameId)
      .single()
    if (fetchErr) throw fetchErr
    if (!existing?.html_content) throw new Error('No generated HTML found for this game')

    // 2) Write to subfolder inside the bucket:
    //    bucket = "games", path = "games/<id>/index.html"
    const path = `games/${gameId}/index.html`

    // Remove any old object to avoid stale headers
    await supabaseAdmin.storage.from('games').remove([path])

    // Upload with correct headers
    const file = Buffer.from(existing.html_content, 'utf8')
    const { error: uploadErr } = await supabaseAdmin.storage
      .from('games')
      .upload(path, file, {
        upsert: true,
        contentType: 'text/html; charset=utf-8',
        cacheControl: 'no-cache',
      })
    if (uploadErr) throw uploadErr

    // 3) Update DB metadata (store relative path inside bucket)
    const { data, error } = await supabaseAdmin
      .from('games')
      .update({
        title,
        description: description ?? '',
        game_status: 'published',
        storage_path: path,               // "games/<id>/index.html"
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // html_content: null,             // optional: drop DB HTML after publish
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
