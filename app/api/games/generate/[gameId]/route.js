export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getAdminSupabase } from '../../../../../lib/supabaseServer.server.js';
import { createClient } from '@supabase/supabase-js';
import { compile as compileFromSpec } from '../../../../../lib/compiler';
import { proposeSpecPatch } from '../../../../../lib/llm/spec_editor';
import { anthropic as llmClient, MODEL as LLM_MODEL } from '../../../../../lib/llm/client';

// ---------- Direct mode (bypass spec+compiler) ----------
const DIRECT_SYSTEM = `You are a senior game-dev AI. Build a complete, self-contained HTML/JS/CSS game in a SINGLE file (index.html) — no external libraries.
- Use a <canvas> and requestAnimationFrame.
- Inline all CSS/JS.
- Work offline (no CDN/fonts/sounds).
- Keep code clean and commented.
- If the user mentions exact rules (spawn timing, counts), implement precisely.
- Output ONLY the raw HTML (no backticks).`;

function isDirectModePrompt(p) {
  return /^\s*Kushendra\b/i.test(p || '');
}
function stripDirectPrefix(p) {
  return (p || '').replace(/^\s*Kushendra\s*[:,\-]?\s*/i, '').trim();
}

// ---------- Supabase envs for user client (server needs these even if admin client exists) ----------
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  '';
const SUPABASE_ANON =
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

/** Minimal RFC6902 applier (add/replace/remove) */
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
    scene: { size: { w: 800, h: 500 }, tiles: null },
    player: { controller: 'topdown', speed: 200, hp: 1, weapons: [] },
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

function safeCompile(spec) {
  try {
    if (typeof compileFromSpec === 'function') return compileFromSpec(spec);
  } catch (e) {
    console.error('[compile] error:', e);
  }
  // ultra-safe fallback HTML if compiler throws
  return (
    '<!DOCTYPE html><html><body style="background:#111;color:#fff;font-family:Inter,system-ui;padding:16px;text-align:center">' +
    `<h1>${spec?.meta?.title || 'Your Game'}</h1>` +
    `<div id=game style="width:420px;height:300px;border:2px solid #fff;margin:20px auto;position:relative;background:#000">` +
    `<div id=player style="width:20px;height:20px;background:#0f0;position:absolute;top:140px;left:200px"></div>` +
    `</div><p>Use WASD to move</p>` +
    `<script>let x=200,y=140;addEventListener('keydown',e=>{if(e.key==='w')y=Math.max(0,y-15);if(e.key==='s')y=Math.min(280,y+15);if(e.key==='a')x=Math.max(0,x-15);if(e.key==='d')x=Math.min(400,x+15);const p=document.getElementById('player');p.style.left=x+'px';p.style.top=y+'px';});</script>` +
    '</body></html>'
  );
}

export async function POST(req, { params }) {
  console.time('[generate] total');
  const _startTs = Date.now();
  try {
    console.info('[generate] init');

    const { gameId } = params;
    const { prompt } = await req.json();

    console.info('[generate] params', { gameId, hasPrompt: !!prompt, promptLen: (prompt || '').length });

    const directMode = isDirectModePrompt(prompt);
    const cleanedPrompt = directMode ? stripDirectPrefix(prompt) : prompt;

    console.info('[generate] mode', { directMode, cleanedPromptPreview: (cleanedPrompt || '').slice(0, 120) });

    if (!SUPABASE_URL || !SUPABASE_ANON) {
      console.error('[generate] missing supabase envs', { hasUrl: !!SUPABASE_URL, hasAnon: !!SUPABASE_ANON });
      return NextResponse.json(
        { success: false, error: 'Supabase envs missing' },
        { status: 500 }
      );
    }
    if (!gameId) throw new Error('Missing gameId');
    if (!cleanedPrompt) throw new Error('Missing prompt');

    console.info('[generate] validated inputs');

    // 1) Auth — user client with Bearer token (RLS on)
    const authHeader =
      req.headers.get('authorization') ||
      req.headers.get('Authorization') ||
      req.headers.get('x-supabase-auth') ||
      '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    console.info('[generate] token present', { tokenLen: token ? token.length : 0 });

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false }
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();

    if (!userErr && userData?.user) {
      console.info('[generate] user', { userId: userData.user.id });
    }

    if (userErr || !userData?.user) {
      if (userErr) console.error('[generate] getUser error:', userErr);
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    const user = userData.user;

    // 2) Ownership + fetch current fields via admin (bypass RLS)
    const supabaseAdmin = getAdminSupabase();
    const { data: gameRow, error: fetchErr } = await supabaseAdmin
      .from('games')
      .select('id, creator_id, spec_json, brief_summary, conversation_history')
      .eq('id', gameId)
      .single();
    if (fetchErr || !gameRow)
      return NextResponse.json(
        { success: false, error: 'Game not found' },
        { status: 404 }
      );

    console.info('[generate] loaded game', { hasSpec: !!gameRow.spec_json, creatorId: gameRow.creator_id });

    if (gameRow.creator_id && gameRow.creator_id !== user.id)
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );

    let html = '';
    let nextSpec = null;
    let strategy = 'spec+compile';
    let usedModel = process.env.ANTHROPIC_API_KEY ? LLM_MODEL : 'mock';
    let patch = null;

    console.info('[generate] deciding strategy', { directMode, hasAnthropic: !!process.env.ANTHROPIC_API_KEY });

    // 3) Decide path
    if (directMode) {
      strategy = 'direct-html';
      console.time('[generate][direct] llm');
      console.info('[generate][direct] start', { model: LLM_MODEL });
      try {
        if (!process.env.ANTHROPIC_API_KEY || !llmClient?.messages?.create) {
          // No key or client — fallback to compiler path
          const fallbackSpec = gameRow.spec_json || defaultSpec(cleanedPrompt);
          nextSpec = fallbackSpec;
          html = safeCompile(fallbackSpec);
        } else {
          const msg = await llmClient.messages.create({
            model: LLM_MODEL,
            system: DIRECT_SYSTEM,
            max_tokens: 4000,
            messages: [{ role: 'user', content: cleanedPrompt }]
          });
          const text = msg?.content?.[0]?.text || '';
          html = String(text || '').trim();
          console.info('[generate][direct] html chars', { length: html.length });
          console.timeEnd('[generate][direct] llm');
          // keep prior spec so UI doesn’t break
          nextSpec = gameRow.spec_json || { meta: { title: 'Direct Game' } };
        }
      } catch (err) {
        console.error('[generate][direct-html] error:', err);
        console.info('[generate][direct] fallback to compiler');
        const fallbackSpec = gameRow.spec_json || defaultSpec(cleanedPrompt);
        nextSpec = fallbackSpec;
        html = safeCompile(fallbackSpec);
      }
    } else {
      // LLM -> patch -> compile path
      const currentSpec = gameRow.spec_json || defaultSpec(cleanedPrompt);
      console.time('[generate][spec] propose');
      patch = await proposeSpecPatch({
        spec: currentSpec,
        userPrompt: cleanedPrompt,
        briefSummary: gameRow.brief_summary || ''
      });
      console.timeEnd('[generate][spec] propose');
      console.info('[generate][spec] patch', { ops: Array.isArray(patch) ? patch.length : 0 });
      nextSpec = applyJsonPatch(currentSpec, patch);

      // If user clearly asked for bubbles but template missing, force bubble_clicker for safety
      if (!nextSpec?.meta?.template && /bubble|bubbles|prick|pop/i.test(cleanedPrompt || '')) {
        nextSpec.meta = nextSpec.meta || {};
        if (!nextSpec.meta.title) nextSpec.meta.title = 'Bubble Rush';
        nextSpec.meta.template = 'bubble_clicker';
      }

      html = safeCompile(nextSpec);
      console.info('[generate][spec] compiled html chars', { length: (html || '').length });
    }

    // 4) Persist (rolling summary + conversation)
    const newSummary = summarize(
      ((gameRow.brief_summary || '') + ' ' + cleanedPrompt).trim(),
      300
    );

    console.info('[generate] persisting', { strategy, usedModel, hasHtml: !!html });

    const { data, error } = await supabaseAdmin
      .from('games')
      .update({
        spec_json: nextSpec,
        brief_summary: newSummary,
        conversation_history: [
          ...(gameRow.conversation_history || []),
          { role: 'user', content: cleanedPrompt }
        ],
        html_content: html,
        game_status: 'generated',
        updated_at: new Date().toISOString(),
        generation_metadata: {
          strategy,
          model: usedModel,
          patch_size:
            strategy === 'spec+compile' && Array.isArray(patch) ? patch.length : 0,
          generated_at: new Date().toISOString()
        }
      })
      .eq('id', gameId)
      .select('id, html_content, conversation_history, spec_json')
      .single();

    console.info('[generate] update ok', { id: data?.id });

    if (error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );

    return NextResponse.json({
      success: true,
      gameCode: data.html_content,
      conversation: data.conversation_history,
      spec: data.spec_json,
      used_model: usedModel
    });
  } catch (e) {
    console.error('[generate] unexpected error:', e?.stack || e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  } finally {
    console.timeEnd('[generate] total');
    console.info('[generate] done in ms', Date.now() - _startTs);
  }
}
