import { NextResponse } from 'next/server'
import { supabase } from '../../../../../../lib/supabase'

export async function POST(request, { params }) {
  try {
    const { gameId } = params
    const { title, description } = await request.json()
    
    // Update game status to published
    const { data, error } = await supabase
      .from('games')
      .update({
        title: title,
        description: description,
        game_status: 'published',
        creator_name: 'Anonymous Creator', // TODO: Add real user system later
        plays: 0,
        rating: 0,
        updated_at: new Date().toISOString()
      })
      .eq('game_folder_id', gameId)
      .select()
      .single()
    
    if (error) throw error
    
    return NextResponse.json({
      success: true,
      message: 'Game published successfully!',
      game: data
    })
    
  } catch (error) {
    console.error('Error publishing game:', error)
    return NextResponse.json(
      { error: 'Failed to publish game' },
      { status: 500 }
    )
  }
}
