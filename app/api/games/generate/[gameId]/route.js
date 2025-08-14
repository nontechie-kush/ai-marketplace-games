import { NextResponse } from 'next/server'
import { supabase } from '../../../../../lib/supabase'

export async function POST(request, { params }) {
  try {
    const { gameId } = params
    const { prompt, conversationHistory } = await request.json()
    
    // TODO: Replace with real AI later - for now using mock
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
          ...data?.generation_metadata,
          last_generated: new Date().toISOString(),
          prompt: prompt
        }
      })
      .eq('game_folder_id', gameId)
      .select()
      .single()
    
    if (error) throw error
    
    return NextResponse.json({
      success: true,
      gameCode: mockGameCode,
      conversation: updatedConversation
    })
    
  } catch (error) {
    console.error('Error generating game:', error)
    return NextResponse.json(
      { error: 'Failed to generate game' },
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
        body { margin: 0; padding: 20px; background: #222; color: white; font-family: Arial; text-align: center; }
        #game { width: 400px; height: 300px; border: 2px solid #fff; margin: 20px auto; position: relative; background: #000; }
        .player { width: 20px; height: 20px; background: #00ff00; position: absolute; top: 140px; left: 190px; }
        .instructions { margin: 20px; }
    </style>
</head>
<body>
    <h1>🎮 ${prompt}</h1>
    <div id="game">
        <div class="player" id="player"></div>
    </div>
    <div class="instructions">
        <p>Use WASD keys to move the green square!</p>
        <p>Game created with AI based on: "${prompt}"</p>
    </div>
    
    <script>
        const player = document.getElementById('player');
        let x = 190, y = 140;
        
        // Focus the window to capture keystrokes
        window.focus();
        
        document.addEventListener('keydown', (e) => {
            e.preventDefault();
            switch(e.key.toLowerCase()) {
                case 'w': y = Math.max(0, y - 10); break;
                case 's': y = Math.min(280, y + 10); break;
                case 'a': x = Math.max(0, x - 10); break;
                case 'd': x = Math.min(380, x + 10); break;
            }
            player.style.left = x + 'px';
            player.style.top = y + 'px';
        });
        
        // Also handle arrow keys
        document.addEventListener('keydown', (e) => {
            switch(e.key) {
                case 'ArrowUp': y = Math.max(0, y - 10); break;
                case 'ArrowDown': y = Math.min(280, y + 10); break;
                case 'ArrowLeft': x = Math.max(0, x - 10); break;
                case 'ArrowRight': x = Math.min(380, x + 10); break;
            }
            player.style.left = x + 'px';
            player.style.top = y + 'px';
        });
    </script>
</body>
</html>`;
}
