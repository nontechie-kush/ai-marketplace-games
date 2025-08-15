import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST() {
  try {
    const autoDeleteAt = new Date(Date.now() + 72 * 3600 * 1000).toISOString()

    // Insert placeholder to satisfy NOT NULL on html_content
    const { data, error } = await supabaseAdmin
      .from('games')
      .insert({
        title: 'Untitled Game',
        description: '',
        html_content: '<!-- to be generated -->',
        creator_id: null,
        creator_name: null,
        game_status: 'creating',
        auto_delete_at: autoDeleteAt
      })
      .select('id')
      .single()

    if (error) throw error

    // Keep folder id in sync with primary key to avoid mismatches
    const { error: updateErr } = await supabaseAdmin
      .from('games')
      .update({ game_folder_id: data.id })
      .eq('id', data.id)

    if (updateErr) throw updateErr

    return NextResponse.json({
      success: true,
      gameId: data.id,
      status: 'Game session created'
    })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 }
    )
  }
}
