import { NextResponse } from 'next/server'
import { supabase } from '../../../../../lib/supabase'

export async function POST(request, { params }) {
  try {
    const { gameId } = params
    const { prompt, conversationHistory } = await request.json()
    
    console.log('Generating game for ID:', gameId, 'Prompt:', prompt)
    
    // Find the existing game record first
    const { data: existingGame, error: findError } = await supabase
      .from('games')
      .select('*')
      .eq('game_folder_id', gameId)
      .single()

    if (findError) {
      console.error('Could not find game with ID:', gameId, findError)
      throw new Error('Game session not found: ' + findError.message)
    }

    console.log('Found existing game:', existingGame)
    
    // Generate mock game code
    const mockGameCode = generateMockGame(prompt)
    
    // Update conversation history
    const updatedConversation = [
      ...conversationHistory,
      { role: 'user', content: prompt, timestamp: new Date().toISOString() },
      { role: 'assistant', content: 'Your game is ready! You can play it below.', timestamp: new Date().toISOString() }
    ]
    
    // Update game in database
    const { data, error } = await supabase
      .from('games')
      .update({
        html_content: mockGameCode,
        conversation_history: updatedConversation,
        title: prompt.length > 50 ? prompt.substring(0, 50) + '...' : prompt,
        description: `A fun game created with AI: ${prompt}`,
        generation_metadata: {
          last_generated: new Date().toISOString(),
          prompt: prompt,
          session_id: gameId,
          original_metadata: existingGame.generation_metadata || {}
        },
        updated_at: new Date().toISOString()
      })
      .eq('game_folder_id', gameId)
      .select()
      .single()
    
    if (error) {
      console.error('Supabase update error:', error)
      throw new Error('Failed to update game: ' + error.message)
    }
    
    console.log('Game updated successfully:', data)
    
    return NextResponse.json({
      success: true,
      gameCode: mockGameCode,
      conversation: updatedConversation,
      gameData: data
    })
    
  } catch (error) {
    console.error('Error generating game:', error)
    return NextResponse.json(
      { error: 'Failed to generate game: ' + error.message },
      { status: 500 }
    )
  }
}

// Mock game generator (replace with AI later)
function generateMockGame(prompt) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${prompt}</title>
    <style>
        body { 
            margin: 0; 
            padding: 20px; 
            background: #222; 
            color: white; 
            font-family: Arial, sans-serif; 
            text-align: center; 
        }
        #game { 
            width: 400px; 
            height: 300px; 
            border: 2px solid #fff; 
            margin: 20px auto; 
            position: relative; 
            background: #000; 
            border-radius: 8px;
        }
        .player { 
            width: 20px; 
            height: 20px; 
            background: #00ff00; 
            position: absolute; 
            top: 140px; 
            left: 190px; 
            transition: all 0.1s ease;
            border-radius: 3px;
            box-shadow: 0 0 10px #00ff00;
        }
        .instructions { 
            margin: 20px; 
            background: #333;
            padding: 15px;
            border-radius: 8px;
            max-width: 500px;
            margin: 20px auto;
        }
        .controls {
            margin: 10px 0;
            font-size: 14px;
            color: #aaa;
        }
        h1 {
            color: #00ff00;
            text-shadow: 0 0 10px #00ff00;
        }
    </style>
</head>
<body>
    <h1>🎮 ${prompt}</h1>
    <div id="game">
        <div class="player" id="player"></div>
    </div>
    <div class="instructions">
        <p><strong>Use WASD keys or Arrow keys to move the green square!</strong></p>
        <div class="controls">
            <strong>Controls:</strong><br>
            W/↑ = Up | S/↓ = Down | A/← = Left | D/→ = Right
        </div>
        <p><em>Game created with AI based on: "${prompt}"</em></p>
        <p style="font-size: 12px; color: #666;">Click on the game area first, then use controls</p>
    </div>
    
    <script>
        const player = document.getElementById('player');
        const gameArea = document.getElementById('game');
        let x = 190, y = 140;
        let gameActive = false;
        
        // Click to activate game
        gameArea.addEventListener('click', () => {
            gameActive = true;
            gameArea.style.borderColor = '#00ff00';
            console.log('Game activated! Use WASD or arrow keys.');
        });
        
        function updatePosition() {
            player.style.left = x + 'px';
            player.style.top = y + 'px';
        }
        
        // Handle keyboard input
        document.addEventListener('keydown', (e) => {
            if (!gameActive) return;
            
            e.preventDefault();
            
            const speed = 15;
            
            switch(e.key.toLowerCase()) {
                case 'w':
                case 'arrowup':
                    y = Math.max(0, y - speed);
                    break;
                case 's':
                case 'arrowdown':
                    y = Math.min(280, y + speed);
                    break;
                case 'a':
                case 'arrowleft':
                    x = Math.max(0, x - speed);
                    break;
                case 'd':
                case 'arrowright':
                    x = Math.min(380, x + speed);
                    break;
                default:
                    return; // Don't update position for other keys
            }
            
            updatePosition();
        });
        
        // Show initial instructions
        console.log('Game loaded! Click the game area and use WASD or arrow keys to move.');
    </script>
</body>
</html>`;
}
