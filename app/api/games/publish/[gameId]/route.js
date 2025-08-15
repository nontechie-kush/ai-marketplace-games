import { NextResponse } from 'next/server'
import { supabase } from '../../../../../lib/supabase'

export async function POST(request, { params }) {
  try {
    const { gameId } = params
    const { title, description } = await request.json()
    
    // STEP 1: See what games exist
    const { data: allGames } = await supabase
      .from('games')
      .select('game_folder_id, title, game_status')
      .order('created_at', { ascending: false })
      .limit(3)
    
    console.log('ALL RECENT GAMES:', allGames)
    console.log('LOOKING FOR GAME ID:', gameId)
    
    // STEP 2: Try to find our game
    const { data: foundGame } = await supabase
      .from('games')
      .select('*')
      .eq('game_folder_id', gameId)
    
    console.log('FOUND GAME:', foundGame)
    
    if (!foundGame || foundGame.length === 0) {
      return NextResponse.json({
        error: `Game not found. Looking for: ${gameId}. Recent games: ${JSON.stringify(allGames)}`,
        allGames: allGames,
        searchedFor: gameId
      }, { status: 404 })
    }
    
    // STEP 3: Update to published
    const { data, error } = await supabase
      .from('games')
      .update({
        title: title,
        description: description,
        game_status: 'published'
      })
      .eq('id', foundGame[0].id)  // Use the actual database ID
      .select()
    
    if (error) throw error
    
    return NextResponse.json({
      success: true,
      message: 'Game published!',
      game: data[0]
    })
    
  } catch (error) {
    console.error('Publish error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
