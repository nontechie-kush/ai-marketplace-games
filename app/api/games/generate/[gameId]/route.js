import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../../lib/supabase'

async function generateHtml(prompt, conversationHistory) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return `
<!DOCTYPE html>
<html><body style="background:#222;color:#fff;text-align:center;padding:20px">
  <h1>${prompt ?? 'Your Game'}</h1>
  <div id="game" style="width:420px;height:300px;border:2px solid #fff;margin:20px auto;position:relative;background:#000">
    <div id="player" style="width:20px;height:20px;background:#0f0;position:absolute;top:140px;left:200px"></div>
  </div>
  <p>Use WASD to move</p>
  <script>
    let x=200,y=140;
    addEventListener('keydown',e=>{
      if(e.key==='w')y=Math.max(0,y-15);
      if(e.key==='s')y=Math.min(280,y+15);
      if(e.key==='a')x=Math.max(0,x-15);
      if(e.key==='d')x=Math.min(400,x+15);
      const p=document.getElementById('player');
      p.style.left=x+'px'; p.style.top=y+'px';
    });
  </script>
</body></html>`
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-latest',
      max_tokens: 4000,
      temperature: 0.2,
      system: 'You are an expert HTML5 game developer. Return ONLY a complete playable HTML document (inline CSS & JS).',
      messages: [
        ...((conversationHistory ?? []).map(m => ({ role: m.role, content: m.content })) || []),
        { role: 'user', content: `Create a complete HTML5 game for: ${prompt}` }
      ]
    })
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Anthropic error: ${t}`)
  }
  const body = await res.json()
  const html = (body?.content?.[0]?.text || '').trim()
  if (!html) throw new Error('Empty HTML from model')
  return html
}

export async function POST(req, { params }) {
  try {
    const { gameId } = params
    const { prompt, conversationHistory = [] } = await req.json()
    if (!gameId) throw new Error('Missing gameId')
    if (!prompt) throw new Error('Missing prompt')

    const html = await generateHtml(prompt, conversationHistory)

    const { data, error } = await supabaseAdmin
      .from('games')
      .update({
        html_content: html,
        game_status: 'generated',
        updated_at: new Date().toISOString(),
        conversation_history: [...conversationHistory, { role: 'user', content: prompt }],
        generation_metadata: {
          model: process.env.ANTHROPIC_API_KEY ? 'claude-3-5-sonnet-latest' : 'mock',
          prompt,
          generated_at: new Date().toISOString()
        }
      })
      .eq('id', gameId)   // update by PRIMARY KEY
      .select('id, html_content, conversation_history')
      .single()
    if (error) throw error

    return NextResponse.json({ success: true, gameCode: data.html_content, conversation: data.conversation_history })
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
