import { NextResponse } from 'next/server'
import { supabase } from '../../../../../lib/supabase'

export async function POST(request, { params }) {
  try {
    const { gameId } = params
    const { prompt } = await request.json()
    
    console.log('Generating game for:', gameId, 'with prompt:', prompt)
    
    const mockGameCode = `<html><body style="margin:0;padding:20px;background:#222;color:white;text-align:center;font-family:Arial"><h1>🎮 ${prompt}</h1><div id="game" style="width:400px;height:300px;border:2px solid #fff;margin:20px auto;position:relative;background:#000;border-radius:8px"><div id="player" style="width:20px;height:20px;background:#00ff00;position:absolute;top:140px;left:190px;border-radius:3px;box-shadow:0 0 10px #00ff00"></div></div><p>Use WASD keys to move the green square!</p><p style="font-size:14px;color:#aaa">W=Up, S=Down, A=Left, D=Right</p><script>const player=document.getElementById('player');let x=190,y=140;document.addEventListener('keydown',e=>{switch(e.key.toLowerCase()){case'w':y=Math.max(0,y-15);break;case's':y=Math.min(280,y+15);break;case'a':x=Math.max(0,x-15);break;case'd':x=Math.min(380,x+15);break;}player.style.left=x+'px';player.style.top=y+'px';});</script></body></html>`
    
    // Update the record using the game_folder_id
    const { data, error } = await supabase
      .from('games')
      .update({
        html_content: mockGameCode,
        title: prompt.length > 50 ? prompt.substring(0, 50) + '...' : prompt,
        description: `A fun game created with AI: ${prompt}`,
        game_status: 'generated',
        updated_at: new Date().toISOString()
      })
      .eq('game_folder_id', gameId)
      .select()
    
    if (error) {
      console.error('Generate API error:', error)
      throw error
    }
    
    if (!data || data.length === 0) {
      throw new Error(`No game found with folder ID: ${gameId}`)
    }
    
    console.log('Game updated successfully:', data[0].title)
    
    return NextResponse.json({
      success: true,
      gameCode: mockGameCode,
      conversation: [
        { role: 'user', content: prompt },
        { role: 'assistant', content: 'Your game is ready! You can play it below. Want me to modify anything?' }
      ]
    })
    
  } catch (error) {
    console.error('Generate error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
