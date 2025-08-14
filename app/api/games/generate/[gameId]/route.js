import { NextResponse } from 'next/server'
import { supabase } from '../../../../../lib/supabase'

export async function POST(request, { params }) {
  try {
    const { gameId } = params
    const { prompt, conversationHistory } = await request.json()
    
    console.log('GENERATE API - Game ID received:', gameId)
    console.log('GENERATE API - Game ID type:', typeof gameId)
    console.log('GENERATE API - Game ID length:', gameId?.length)
    
    // First, let's see ALL games in the database
    const { data: allGames, error: allError } = await supabase
      .from('games')
      .select('game_folder_id, title, created_at')
      .order('created_at', { ascending: false })
      .limit(5)
    
    console.log('ALL RECENT GAMES:', allGames)
    
    // Now find our specific game
    const { data: foundGames, error: findError } = await supabase
      .from('games')
      .select('*')
      .eq('game_folder_id', gameId)
    
    console.log('FOUND GAMES FOR ID:', foundGames)
    console.log('FIND ERROR:', findError)

    if (!foundGames || foundGames.length === 0) {
      // Let's try to find by partial match
      const { data: partialMatch } = await supabase
        .from('games')
        .select('game_folder_id, title')
        .ilike('game_folder_id', `%${gameId.substring(0, 8)}%`)
      
      console.log('PARTIAL MATCHES:', partialMatch)
      
      throw new Error(`No game found with ID: ${gameId}. Recent games: ${JSON.stringify(allGames)}`)
    }

    const existingGame = foundGames[0]
    console.log('USING GAME:', existingGame.id, existingGame.title)
    
    // Simple mock game
    const mockGameCode = `<html><body><h1>${prompt}</h1><p>Test game works!</p></body></html>`
    
    // Update using the database ID instead of game_folder_id
    const { data, error } = await supabase
      .from('games')
      .update({
        html_content: mockGameCode,
        title: prompt,
        description: `Game: ${prompt}`,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingGame.id)  // Use database ID instead of game_folder_id
      .select()
    
    console.log('UPDATE RESULT:', { data, error })
    
    if (error) throw error
    if (!data || data.length === 0) throw new Error('Update failed - no rows affected')
    
    return NextResponse.json({
      success: true,
      gameCode: mockGameCode,
      conversation: [
        ...conversationHistory,
        { role: 'user', content: prompt },
        { role: 'assistant', content: 'Game created!' }
      ]
    })
    
  } catch (error) {
    console.error('GENERATE ERROR:', error.message)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
