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
    if (!existing?.html_content) throw new Error('No generated HTML found for this game')

    // 2) Upload to Storage as games/{id}/index.html
    const path = `games/${gameId}/index.html`
    // upsert so re-publish overwrites
    const { error: uploadErr } = await supabaseAdmin.storage
      .from('games')
      .upload(path, new Blob([existing.html_content], { type: 'text/html' }), { upsert: true })
    if (uploadErr && uploadErr.message?.includes('The resource already exists')) {
      // In some environments upsert still throws; ignore that specific case.
    } else if (uploadErr) {
      throw uploadErr
    }

    // 3) Update DB metadata; optional: drop inline HTML after publish
    const { data, error } = await supabaseAdmin
      .from('games')
      .update({
        title,
        description: description ?? '',
        game_status: 'published',
        storage_path: path,
        published_at: new Date().toISOString(),
        // If you want to keep srcDoc preview for edits, keep html_content.
        // To reduce DB size, uncomment the next line to drop it post-publish:
        // html_content: null,
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
