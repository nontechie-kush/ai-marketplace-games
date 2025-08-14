import { NextResponse } from 'next/server'
import { supabase } from '../../../../../lib/supabase'

export async function POST(request, { params }) {
  try {
    const { gameId } = params
    const { prompt, conversationHistory } = await request.json()
    
    console.log('=== GENERATE API DEBUG ===')
    console.log('Game ID:', gameId)
    console.log('Prompt:', prompt)
    console.log('Conversation History:', conversationHistory)
    
    // Find the existing game record first
    const { data: existingGames, error: findError } = await supabase
      .from('games')
      .select('*')
      .eq('game_folder_id', gameId)
    
    console.log('Found games:', existingGames)
    console.log('Find error:', findError)

    if (findError) {
      console.error('Could not find game with ID:', gameId, findError)
      throw new Error('Game session not found: ' + findError.message)
    }

    if (!existingGames || existingGames.length === 0) {
      throw new Error('No game found with ID: ' + gameId)
    }

    if (existingGames.length > 1) {
      console.warn('Multiple games found with same ID:', existingGames.length)
    }

    const existingGame = existingGames[0]
    console.log('Using game:', existingGame)
    
    // Generate mock game code
    const mockGameCode = generateMockGame(prompt)
    
    // Update conversation history
    const updatedConversation = [
      ...(conversationHistory || []),
      { role: 'user', content: prompt, timestamp: new Date().toISOString() },
      { role: 'assistant', content: 'Your game is ready! You can play it below.', timestamp: new Date().toISOString() }
    ]
    
    console.log('About to update game with ID:', gameId)
    
    // Update game in database - REMOVED .single() temporarily
    const { data, error, count } = await supabase
      .from('games')
      .update({
        html_content: mockGameCode,
        conversation_history: updatedConversation,
        title: prompt.length > 50 ? prompt.substring(0, 50) + '...' : prompt,
        description: `A fun game created with AI: ${prompt}`,
        generation_metadata: {
          last_generated: new Date().toISOString(),
          prompt: prompt,
          session_id: gameId
        },
        updated_at: new Date().toISOString()
      })
      .eq('game_folder_id', gameId)
      .select()
    
    console.log('Update result:', { data, error, count })
    console.log('Updated rows:', data?.length)
    
    if (error) {
      console.error('Supabase update error:', error)
      throw new Error('Failed to update game: ' + error.message)
    }
    
    if (!data || data.length === 0) {
      throw new Error('No rows updated - game not found')
    }
    
    console.log('Game updated successfully:', data[0])
    
    return NextResponse.json({
      success: true,
      gameCode: mockGameCode,
      conversation: updatedConversation,
      gameData: data[0]
    })
    
  } catch (error) {
    console.error('=== GENERATE API ERROR ===')
    console.error('Error:', error.message)
    console.error('Stack:', error.stack)
    return NextResponse.json(
      { error: 'Failed to generate game: ' + error.message },
      { status: 500 }
    )
  }
}

// Mock game generator
function generateMockGame(prompt) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${prompt}</title>
    <style>
        body { margin: 0; padding: 20px; background: #222; color: white; font-family: Arial; text-align: center; }
        #game { width: 400px; height: 300px; border: 2px solid #fff; margin: 20px auto; position: relative; background: #000; }
        .player { width: 20px; height: 20px; background: #00ff00; position: absolute; top: 140px; left: 190px; }
    </style>
</head>
<body>
    <h1>🎮 ${prompt}</h1>
    <div id="game"><div class="player" id="player"></div></div>
    <p>Use WASD keys to move!</p>
    <script>
        const player = document.getElementById('player');
        let x = 190, y = 140;
        document.addEventListener('keydown', (e) => {
            switch(e.key.toLowerCase()) {
                case 'w': y = Math.max(0, y - 10); break;
                case 's': y = Math.min(280, y + 10); break;
                case 'a': x = Math.max(0, x - 10); break;
                case 'd': x = Math.min(380, x + 10); break;
            }
            player.style.left = x + 'px';
            player.style.top = y + 'px';
        });
    </script>
</body>
</html>`;
}
