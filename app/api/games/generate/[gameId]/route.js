import { NextResponse } from 'next/server'
import { supabase } from '../../../../../lib/supabase'

export async function POST(request, { params }) {
  try {
    const { gameId } = params
    const { prompt } = await request.json()
    
    // Simple mock game
    const mockGameCode = `<html><body><h1>${prompt}</h1><p>WASD to move: <div id="p" style="width:20px;height:20px;background:green;position:relative;"></div></p><script>let x=0,y=0;document.onkeydown=e=>{if(e.key=='w')y-=10;if(e.key=='s')y+=10;if(e.key=='a')x-=10;if(e.key=='d')x+=10;document.getElementById('p').style.left=x+'px';document.getElementById('p').style.top=y+'px'}</script></body></html>`
    
    // Update using game_folder_id with upsert approach
    const { data, error } = await supabase
      .from('games')
      .upsert({
        game_folder_id: gameId,
        html_content: mockGameCode,
        title: prompt,
        description: `Game: ${prompt}`,
        creator_name: 'Anonymous Creator',
        plays: 0,
        rating: 0,
        game_status: 'creating',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'game_folder_id'
      })
      .select()
    
    if (error) throw error
    
    return NextResponse.json({
      success: true,
      gameCode: mockGameCode,
      conversation: [
        { role: 'user', content: prompt },
        { role: 'assistant', content: 'Game created!' }
      ]
    })
    
  } catch (error) {
    console.error('GENERATE ERROR:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
