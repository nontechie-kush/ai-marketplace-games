import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin'
import { compile as compileFromSpec } from '../../../../../lib/compiler'
import crypto from 'node:crypto'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_MODEL = 'claude-3-5-haiku-latest' // cost-optimized

/** RFC6902 minimal applier: add/replace/remove */
function applyJsonPatch(target, ops = []) {
  const clone = JSON.parse(JSON.stringify(target || {}))
  const getParentAndKey = (obj, path) => {
    if (!path || path === '/') return [null, null]
    const parts = path.replace(/^\//, '').split('/').map(p => p.replace(/~1/g,'/').replace(/~0/g,'~'))
    const key = parts.pop()
    let parent = obj
    for (const part of parts) {
      if (parent[part] === undefined) parent[part] = {}
      parent = parent[part]
    }
    return [parent, key]
  }
  for (const op of ops) {
    const { op: kind, path } = op
    const [parent, key] = getParentAndKey(clone, path)
    if (!parent) continue
    if (kind === 'add' || kind === 'replace') parent[key] = op.value
    else if (kind === 'remove') delete parent[key]
  }
  return clone
}

function defaultSpec(prompt) {
  return {
    meta: { title: (prompt || 'Untitled Game').slice(0,60), theme: 'dark' },
    scene: { size: { w: 800, h: 500 }, tiles: null },
    player: { controller: 'topdown', speed: 200, hp: 1, weapons: [] },
    entities: [],
    enemies: [],
    goals: ['survive_timer'],
    rules: { difficulty: 'normal' },
    controls: ['wasd'],
    aesthetics: { palette: 'midnight', sfx: [] },
    notes: ''
  }
}

function summarize(s, limit = 300) {
  if (!s) return ''
  return s.length > limit ? s.slice(0, limit-1) + '…' : s
}

function safeCompile(spec) {
  try { if (typeof compileFromSpec === 'function') return compileFromSpec(spec) } catch(e) { console.error('[compile] error:', e) }
  return `<!DOCTYPE html><html><body style="background:#111;color:#fff;font-family:Inter,system-ui;padding:16px;text-align:center">\n`+
    `<h1>${spec?.meta?.title || 'Your Game'}</h1>\n`+
    `<div id=game style="width:420px;height:300px;border:2px solid #fff;margin:20px auto;position:relative;background:#000">`+
    `<div id=player style="width:20px;height:20px;background:#0f0;position:absolute;top:140px;left:200px"></div>`+
    `</div><p>Use WASD to move</p>`+
    `<script>let x=200,y=140;addEventListener('keydown',e=>{if(e.key==='w')y=Math.max(0,y-15);if(e.key==='s')y=Math.min(280,y+15);if(e.key==='a')x=Math.max(0,x-15);if(e.key==='d')x=Math.min(400,x+15);const p=document.getElementById('player');p.style.left=x+'px';p.style.top=y+'px';});</script>`+
    `</body></html>`
}

// -------------------- Simple server-side cache (Supabase table: prompt_cache) --------------------
async function getCache(cache_key) {
  try {
    const { data, error } = await supabaseAdmin
      .from('prompt_cache')
      .select('value, expires_at')
      .eq('cache_key', cache_key)
      .maybeSingle()
    if (error || !data) return null
    if (new Date(data.expires_at) < new Date()) return null
    return data.value
  } catch { return null }
}

async function setCache(cache_key, value, ttlSeconds = 1800) { // 30m default
  try {
    const expires_at = new Date(Date.now() + ttlSeconds * 1000).toISOString()
    await supabaseAdmin
      .from('prompt_cache')
      .upsert({ cache_key, value, expires_at })
  } catch (e) {
    console.warn('[cache] upsert failed (ok if table missing):', e?.message)
  }
}

function hashKey(obj) {
  return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex')
}

async function fetchSpecPatch(userPrompt, currentSpec, briefSummary) {
  const apiKey = process.env.ANTHROPIC_API_KEY

  // Build a versioned cache key using SHORT CONTEXT only (spec + 300-char brief)
  const cachePayload = {
    v: 'spec_v1',
    userPrompt,
    brief: summarize(briefSummary || '', 300),
    spec: {
      meta: currentSpec?.meta,
      scene: currentSpec?.scene,
      player: currentSpec?.player,
      goals: currentSpec?.goals,
      rules: currentSpec?.rules
    }
  }
  const cache_key = 'spec:' + hashKey(cachePayload)

  // Try cache first
  const cached = await getCache(cache_key)
  if (cached) return cached

  // If no API key, provide deterministic fallback and cache briefly
  if (!apiKey) {
    const fallback = [
      { op: 'add', path: '/meta/title', value: (userPrompt || 'Your Game').slice(0,60) },
      { op: 'add', path: '/notes', value: summarize(((briefSummary || '') + ' ' + (userPrompt || '')).trim(), 300) }
    ]
    await setCache(cache_key, fallback, 300)
    return fallback
  }

  const system = [
    'You are a game spec editor. Output ONLY a valid RFC-6902 JSON Patch array.',
    'Schema keys: meta, scene, player, entities, enemies, goals, rules, controls, aesthetics, notes.',
    'No code, no commentary.'
  ].join(' ')

  const shortBrief = summarize(briefSummary || '', 300)
  const shortSpec = JSON.stringify(currentSpec || {})

  const reqBody = {
    model: ANTHROPIC_MODEL,
    max_tokens: 800,
    temperature: 0.2,
    system,
    messages: [
      { role: 'user', content: `BRIEF SUMMARY (<=300 chars):\n${shortBrief}\n\nCURRENT SPEC_JSON:\n${shortSpec}\n\nUSER MESSAGE:\n${userPrompt}\n\nReturn ONLY a JSON array of RFC-6902 operations.` }
    ]
  }

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify(reqBody)
  })

  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Anthropic error: ${t}`)
  }

  const body = await res.json()
  const text = (body?.content?.[0]?.text || '').trim()
  let patch = []
  try { patch = JSON.parse(text); if (!Array.isArray(patch)) patch = [] } catch { patch = [] }

  // Store in cache (short TTL since spec evolves often)
  await setCache(cache_key, patch, 30 * 60)
  return patch
}

export async function POST(req, { params }) {
  try {
    const { gameId } = params
    const { prompt } = await req.json()
    if (!gameId) throw new Error('Missing gameId')
    if (!prompt) throw new Error('Missing prompt')

    // 1) Auth
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

    // 2) Ownership + fetch current fields we need
    const { data: gameRow, error: fetchErr } = await supabaseAdmin
      .from('games')
      .select('id, creator_id, spec_json, brief_summary, conversation_history')
      .eq('id', gameId)
      .single()
    if (fetchErr) return NextResponse.json({ success: false, error: 'Game not found' }, { status: 404 })
    if (gameRow.creator_id && gameRow.creator_id !== user.id) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

    // 3) Patch spec via Anthropic (with caching), then compile
    const currentSpec = gameRow.spec_json || defaultSpec(prompt)
    const patch = await fetchSpecPatch(prompt, currentSpec, gameRow.brief_summary || '')
    const nextSpec = applyJsonPatch(currentSpec, patch)
    const html = safeCompile(nextSpec)

    // 4) Persist updates (rolling 300-char brief)
    const newSummary = summarize(((gameRow.brief_summary || '') + ' ' + prompt).trim(), 300)

    const { data, error } = await supabaseAdmin
      .from('games')
      .update({
        spec_json: nextSpec,
        brief_summary: newSummary,
        conversation_history: [...(gameRow.conversation_history || []), { role: 'user', content: prompt }],
        html_content: html,
        game_status: 'generated',
        updated_at: new Date().toISOString(),
        generation_metadata: {
          strategy: 'spec+compile',
          model: process.env.ANTHROPIC_API_KEY ? ANTHROPIC_MODEL : 'mock',
          patch_size: Array.isArray(patch) ? patch.length : 0,
          generated_at: new Date().toISOString()
        }
      })
      .eq('id', gameId)
      .select('id, html_content, conversation_history, spec_json')
      .single()

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, gameCode: data.html_content, conversation: data.conversation_history, spec: data.spec_json })
  } catch (e) {
    console.error('[generate] unexpected error:', e)
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
