import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

async function generateHtml(prompt, conversationHistory) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return `\n<!DOCTYPE html>\n<html><body style="background:#222;color:#fff;text-align:center;padding:20px">\n  <h1>${prompt ?? 'Your Game'}</h1>\n  <div id="game" style="width:420px;height:300px;border:2px solid #fff;margin:20px auto;position:relative;background:#000">\n    <div id="player" style="width:20px;height:20px;background:#0f0;position:absolute;top:140px;left:200px"></div>\n  </div>\n  <p>Use WASD to move</p>\n  <script>\n    let x=200,y=140;\n    addEventListener('keydown',e=>{\n      if(e.key==='w')y=Math.max(0,y-15);\n      if(e.key==='s')y=Math.min(280,y+15);\n      if(e.key==='a')x=Math.max(0,x-15);\n      if(e.key==='d')x=Math.min(400,x+15);\n      const p=document.getElementById('player');\n      p.style.left=x+'px'; p.style.top=y+'px';\n    });\n  </script>\n</body></html>`
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

    // 1) Authenticate caller from Authorization header (Bearer token)
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false }
    })
    const { data: userData, error: userErr } = userClient.auth.getUser(token)
    if (userErr || !userData?.user) {
      if (userErr) console.error('[generate] getUser error:', userErr)
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    const user = userData.user

    // 2) Optional: enforce ownership — only the creator can generate for this game
    const { data: gameRow, error: fetchErr } = await supabaseAdmin
      .from('games')
      .select('id, creator_id')
      .eq('id', gameId)
      .single()
    if (fetchErr) {
      console.error('[generate] fetch game error:', fetchErr)
      return NextResponse.json({ success: false, error: 'Game not found' }, { status: 404 })
    }
    if (gameRow.creator_id && gameRow.creator_id !== user.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // 3) Generate HTML (with Anthropic or fallback)
    const html = await generateHtml(prompt, conversationHistory)

    // 4) Update the game row with admin client
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
      .eq('id', gameId)
      .select('id, html_content, conversation_history')
      .single()

    if (error) {
      console.error('[generate] update error:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, gameCode: data.html_content, conversation: data.conversation_history })
  } catch (e) {
    console.error('[generate] unexpected error:', e)
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
