import { NextResponse } from 'next/server'
import { supabase } from '../../../../lib/supabase'

export async function POST(request) {
  try {
    // Generate unique game ID  
    const gameId = crypto.randomUUID()
    
    console.log('Creating game session with ID:', gameId)
    
    // Create game session in database (not published yet)
    const { data, error } = await supabase
      .from('games')
      .insert({
        game_folder_id: gameId,
        title: 'Untitled Game',
        description: 'Game in progress...',
        html_content: '',
        game_status: 'creating',
        conversation_history: [],
        generation_metadata: {
          created_at: new Date().toISOString(),
          session_id: gameId
        },
        auto_delete_at: new Date(Date.now() + 72 * 60 * 60 * 1000) // 72 hours from now
      })
      .select()
      .single()
    
    if (error) {
      console.error('Supabase insert error:', error)
      throw error
    }
    
    console.log('Game session created successfully:', data)
    
    return NextResponse.json({ 
      success: true, 
      gameId: gameId,
      status: 'Game session created',
      data: data
    })
    
  } catch (error) {
    console.error('Error creating game session:', error)
    return NextResponse.json(
      { error: 'Failed to create game session: ' + error.message },
      { status: 500 }
    )
  }
}
