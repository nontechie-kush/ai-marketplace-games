import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAdminSupabase } from '../../../../lib/supabaseServer'
import { compile as compileFromSpec } from '../../../../lib/compiler'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function defaultSpec() {
  return {
    meta: { title: 'Untitled Game', theme: 'dark' },
    scene: { size: { w: 800, h: 500 }, tiles: null },
    player: { controller: 'topdown', speed: 200, hp: 1, weapons: [] },
    entities: [], enemies: [],
    goals: ['survive_timer'],
    rules: { difficulty: 'normal' },
    controls: ['wasd'],
    aesthetics: { palette: 'midnight', sfx: [] },
    notes: ''
  }
}

function safeCompile(spec) {
  try { if (typeof compileFromSpec === 'function') return compileFromSpec(spec) } catch(e) { console.error('[compile] error:', e) }
  return `<!DOCTYPE html><html><body style="background:#111;color:#fff;font-family:Inter,system-ui;padding:16px;text-align:center">
<h1>${spec?.meta?.title || 'Your Game'}</h1>
<div id=game style="width:420px;height:300px;border:2px solid #fff;margin:20px auto;position:relative;background:#000">
<div id=player style="width:20px;height:20px;background:#0f0;position:absolute;top:140px;left:200px"></div>
</div><p>Use WASD to move</p>
<script>let x=200,y=140;addEventListener('keydown',e=>{if(e.key==='w')y=Math.max(0,y-15);if(e.key==='s')y=Math.min(280,y+15);if(e.key==='a')x=Math.max(0,x-15);if(e.key==='d')x=Math.min(400,x+15);const p=document.getElementById('player');p.style.left=x+'px';p.style.top=y+'px';});</script>
</body></html>`
}

export async function POST(req, { params }) {
  try {
    const supabaseAdmin = getAdminSupabase();
    const { gameId } = params
    const { specOverride = null } = await req.json().catch(() => ({ specOverride: null }))
    if (!gameId) throw new Error('Missing gameId')

    // Auth
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || req.headers.get('x-supabase-auth') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false }
    })
    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    const user = userData.user

    // Ownership + fetch
    const { data: gameRow, error: fetchErr } = await supabaseAdmin
      .from('games')
      .select('id, creator_id, spec_json')
      .eq('id', gameId).single()
    if (fetchErr) return NextResponse.json({ success: false, error: 'Game not found' }, { status: 404 })
    if (gameRow.creator_id && gameRow.creator_id !== user.id) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

    // Compile
    const spec = specOverride || gameRow.spec_json || defaultSpec()
    const html = safeCompile(spec)

    // Persist html_content only
    const { data, error } = await supabaseAdmin
      .from('games')
      .update({
        html_content: html,
        game_status: 'generated',
        updated_at: new Date().toISOString(),
        generation_metadata: {
          strategy: 'compileOnly',
          model: 'none',
          patch_size: 0,
          generated_at: new Date().toISOString()
        }
      })
      .eq('id', gameId)
      .select('id, html_content')
      .single()

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, gameCode: data.html_content })
  } catch (e) {
    console.error('[compile] error:', e)
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
