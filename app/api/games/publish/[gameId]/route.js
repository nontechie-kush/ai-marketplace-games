import { NextResponse } from 'next/server'
import { supabase } from '../../../../../lib/supabase'

export async function POST(request, { params }) {
  try {
    const { gameId } = params
    const { title, description } = await request.json()
    
    console.log('Publishing game:', gameId, 'with title:', title)
    
    // First check if the game exists and has content
    const { data: existingGame, error: findError } = await supabase
      .from('games')
      .select('*')
      .eq('game_folder_id', gameId)
      .single()
    
    if (findError || !existingGame) {
      throw new Error('Game not found')
    }
    
    if (!existingGame.html_content) {
      throw new Error('Cannot publish game without content. Please generate the game first.')
    }
    
    // Update to published status
    const { data, error } = await supabase
      .from('games')
      .update({
        title: title || existingGame.title,
        description: description || existingGame.description,
        game_status: 'published',
        creator_name: 'Anonymous Creator',
        plays: 0,
        rating: 0,
        updated_at: new Date().toISOString()
      })
      .eq('game_folder_id', gameId)
      .select()
      .single()
    
    if (error) {
      console.error('Publish error:', error)
      throw error
    }
    
    console.log('Game published successfully:', data.title)
    
    return NextResponse.json({
      success: true,
      message: 'Game published successfully! 🎉',
      game: data
    })
    
  } catch (error) {
    console.error('Publish API error:', error)
    return NextResponse.json(
      { error: 'Failed to publish: ' + error.message },
      { status: 500 }
    )
  }
}
