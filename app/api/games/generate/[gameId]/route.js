import { NextResponse } from 'next/server'
import { supabase } from '../../../../../lib/supabase'

export async function POST(request, { params }) {
  try {
    const { gameId } = params
    const { prompt } = await request.json()
    
    const mockGameCode = `<html><body><h1>${prompt}</h1><p>WASD: <div id="p" style="width:20px;height:20px;background:green;position:relative;"></div></p><script>let x=0,y=0;document.onkeydown=e=>{if(e.key=='w')y-=10;if(e.key=='s')y+=10;if(e.key=='a')x-=10;if(e.key=='d')x+=10;p.style.left=x+'px';p.style.top=y+'px'}</script></body></html>`
    
    const { error } = await supabase
      .from('games')
      .update({ 
        html_content: mockGameCode,
        title: prompt,
        description: `Game: ${prompt}`
      })
      .eq('game_folder_id', gameId)
    
    if (error) throw error
    
    return NextResponse.json({
      success: true,
      gameCode: mockGameCode,
      conversation: [
        { role: 'user', content: prompt },
        { role: 'assistant', content: 'Game ready!' }
      ]
    })
    
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
