// app/api/games/publish/[gameId]/route.js
export const runtime = 'nodejs'; // Blob is available in Node 18+

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

    // 2) Path inside *bucket* "games": we store under a subfolder "games/<id>/index.html"
    const path = `games/${gameId}/index.html`

    // 2a) Remove any previous version to clear stale metadata
    await supabaseAdmin.storage.from('games').remove([path])

    // 2b) Upload as an HTML Blob so Supabase sets/keeps correct Content-Type
    const blob = new Blob([existing.html_content], { type: 'text/html; charset=utf-8' })
    const { error: uploadErr } = await supabaseAdmin.storage
      .from('games')
      .upload(path, blob, {
        upsert: true,
        contentType: 'text/html; charset=utf-8', // explicit, in addition to Blob type
        cacheControl: 'no-cache',                // avoid stale CDN
      })
    if (uploadErr) throw uploadErr

    // 3) Update DB metadata
    const { data, error } = await supabaseAdmin
      .from('games')
      .update({
        title,
        description: description ?? '',
        game_status: 'published',
        storage_path: path,                       // "games/<id>/index.html"
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // html_content: null,                    // optional: drop DB HTML after publish
      })
      .eq('id', gameId)
      .select('*')
      .single()
    if (error) throw error

    // Convenience: return the exact CDN URL
    const cdnUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${path}`

    return NextResponse.json({ success: true, message: 'Game published!', game: data, cdnUrl })
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
