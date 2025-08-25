// app/api/spec/update/[gameId]/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { proposeSpecPatch } from '../../../../lib/llm/spec_editor';

// Two-client pattern: anon for user auth, admin for privileged writes
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// ---------- small helpers ----------
function applyJsonPatch(target, ops = []) {
  const clone = JSON.parse(JSON.stringify(target || {}));
  const getParentAndKey = (obj, path) => {
    if (!path || path === '/') return [null, null];
    const parts = path
      .replace(/^\//, '')
      .split('/')
      .map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'));
    const key = parts.pop();
    let parent = obj;
    for (const part of parts) {
      if (parent[part] === undefined) parent[part] = {};
      parent = parent[part];
    }
    return [parent, key];
  };
  for (const op of ops) {
    const { op: kind, path } = op;
    const [parent, key] = getParentAndKey(clone, path);
    if (!parent) continue;
    if (kind === 'add' || kind === 'replace') parent[key] = op.value;
    else if (kind === 'remove') delete parent[key];
  }
  return clone;
}

function defaultSpec(prompt) {
  return {
    meta: { title: (prompt || 'Untitled Game').slice(0, 60), theme: 'dark' },
    scene: { size: { w: 800, h: 500 }, hidpi: true },
    player: { controller: 'topdown', speed: 200, hp: 1 },
    entities: [],
    enemies: [],
    goals: ['survive_timer'],
    rules: { difficulty: 'normal' },
    controls: ['wasd'],
    aesthetics: { palette: 'midnight', sfx: [] },
    notes: ''
  };
}

function summarize(s, limit = 300) {
  if (!s) return '';
  return s.length > limit ? s.slice(0, limit - 1) + '…' : s;
}

// ---------- route ----------
export async function POST(req, { params }) {
  try {
    const { gameId } = params;
    const { prompt, conversationHistory = [] } = await req.json();

    if (!gameId) return NextResponse.json({ success: false, error: 'Missing gameId' }, { status: 400 });
    if (!prompt) return NextResponse.json({ success: false, error: 'Missing prompt' }, { status: 400 });

    // ---- Authenticate caller using anon client + bearer (RLS context)
    const authHeader =
      req.headers.get('authorization') ||
      req.headers.get('Authorization') ||
      req.headers.get('x-supabase-auth') ||
      '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false }
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user)
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = userData.user;

    // ---- Load game (admin client, server-only)
    const { data: gameRow, error: fetchErr } = await supabaseAdmin
      .from('games')
      .select('id, creator_id, spec_json, brief_summary, conversation_history')
      .eq('id', gameId)
      .single();
    if (fetchErr) return NextResponse.json({ success: false, error: 'Game not found' }, { status: 404 });
    if (gameRow.creator_id && gameRow.creator_id !== user.id)
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    // ---- Build/patch spec via shared LLM editor (with built-in fallbacks)
    const currentSpec = gameRow.spec_json || defaultSpec(prompt);
    const patch = await proposeSpecPatch({
      spec: currentSpec,
      userPrompt: prompt,
      briefSummary: gameRow.brief_summary || ''
    });
    const nextSpec = applyJsonPatch(currentSpec, patch);

    // ---- Persist (no html compilation here)
    const updatedConversation = [
      ...(gameRow.conversation_history || conversationHistory || []),
      { role: 'user', content: prompt }
    ];
    const newSummary = summarize(((gameRow.brief_summary || '') + ' ' + prompt).trim());

    const { data, error } = await supabaseAdmin
      .from('games')
      .update({
        spec_json: nextSpec,
        brief_summary: newSummary,
        conversation_history: updatedConversation,
        updated_at: new Date().toISOString(),
        generation_metadata: {
          strategy: 'patchOnly',
          model: process.env.ANTHROPIC_API_KEY ? 'claude-3-5-haiku-latest' : 'mock',
          patch_size: Array.isArray(patch) ? patch.length : 0,
          generated_at: new Date().toISOString()
        }
      })
      .eq('id', gameId)
      .select('id, conversation_history, spec_json')
      .single();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    return NextResponse.json({
      success: true,
      spec: data.spec_json,
      conversation: data.conversation_history,
      patchApplied: true
    });
  } catch (e) {
    console.error('[spec/update] error:', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
