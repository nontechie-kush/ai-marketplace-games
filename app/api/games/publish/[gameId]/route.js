import { NextResponse } from 'next/server'
import { supabase } from '../../../../../lib/supabase'

export async function POST(request, { params }) {
  try {
    const { gameId } = params
    const { title, description } = await request.json()
    
    console.log('Publishing game:', gameId, title)
    
    const { data, error } = await supabase
      .from('games')
      .update({
        title: title || 'Untitled Game',
        description: description || 'A fun AI game',
        game_status: 'published',
        creator_name: 'Anonymous Creator',
        plays: 0,
        rating: 0,
        updated_at: new Date().toISOString()
      })
      .eq('game_folder_id', gameId)
      .select()
    
    if (error) {
      console.error('Publish error:', error)
      throw error
    }
    
    if (!data || data.length === 0) {
      throw new Error('Game not found for publishing')
    }
    
    console.log('Game published:', data[0])
    
    return NextResponse.json({
      success: true,
      message: 'Game published successfully!',
      game: data[0]
    })
    
  } catch (error) {
    console.error('Publish API error:', error)
    return NextResponse.json(
      { error: 'Failed to publish: ' + error.message },
      { status: 500 }
    )
  }
}
