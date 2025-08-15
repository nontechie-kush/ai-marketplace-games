import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../../lib/supabase'

export async function POST(req, { params }) {
  try {
    const { gameId } = params
    const { title, description } = await req.json()
    if (!gameId) throw new Error('Missing gameId')
    if (!title) throw new Error('Missing title')

    const { data, error } = await supabaseAdmin
      .from('games')
      .update({
        title,
        description: description ?? '',
        game_status: 'published',
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
