// app/api/games/publish/[gameId]/route.js
export const runtime = 'nodejs'; // Buffer is needed

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../../lib/supabase'

export async function POST(req, { params }) {
  try {
    const { gameId } = params
    const { title, description } = await req.json()

    if (!gameId) throw new Error('Missing gameId')
    if (!title) throw new Error('Missing title')

    // 1) Fetch the generated HTML from DB
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('games')
      .select('id, html_content')
      .eq('id', gameId)
      .single()
    if (fetchErr) throw fetchErr
    if (!existing?.html_content) {
      throw new Error('No generated HTML found for this game')
    }

    // 2) Compute storage path inside the games bucket:
    //    Bucket name = "games", Object path = "games/<id>/index.html"
    //    (First "games" in the public URL is the bucket; this "games/" here is your chosen subfolder.)
    const path = `games/${gameId}/index.html`

    // 2a) Remove any previous object to reset headers/caches
    await supabaseAdmin.storage.from('games').remove([path])

    // 2b) Upload with correct headers (force HTML + disable CDN cache while iterating)
    const file = Buffer.from(existing.html_content, 'utf8')
    const { error: uploadErr } = await supabaseAdmin.storage
      .from('games')
      .upload(path, file, {
        upsert: true,
        contentType: 'text/html; charset=utf-8',
        cacheControl: 'no-cache',
      })
    if (uploadErr) throw uploadErr

    // 3) Update DB metadata
    const { data, error } = await supabaseAdmin
      .from('games')
      .update({
        title,
        description: description ?? '',
        game_status: 'published',
        storage_path: path,                 // "games/<id>/index.html"
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // html_content: null,              // optional: drop DB HTML after publish
      })
      .eq('id', gameId)
      .select('*')
      .single()
    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'Game published!',
      game: data,
      // For convenience, here’s the direct CDN URL you can test:
      cdnUrl: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${path}`,
    })
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
