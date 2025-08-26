// lib/llm/spec_editor.js
import crypto from 'node:crypto';
import { anthropic, MODEL } from './client';
import { getCache, setCache } from '../cache';

const SPEC_CACHE_VERSION = 'v4-spawn-override+skin';

function cacheKey(spec, userPrompt, briefSummary) {
  const payload = JSON.stringify({ v: SPEC_CACHE_VERSION, spec, userPrompt, briefSummary });
  return 'spec:' + crypto.createHash('sha256').update(payload).digest('hex');
}

// ---------------------- Skin detection (visual theme only) ----------------------
function detectSkin(userPrompt = '') {
  const p = String(userPrompt).toLowerCase();
  if (/\bchickens?\b/.test(p)) return 'chicken';
  if (/\bballoons?\b/.test(p)) return 'balloon';
  if (/\bslimes?\b/.test(p)) return 'slime';
  if (/\basteroids?\b/.test(p)) return 'asteroid';
  return 'bubble'; // default skin for this template family
}

// ---------------------- Deterministic "bubble popper" fallback ------------------
function bubbleFallbackPatch(userPrompt) {
  const skin = detectSkin(userPrompt);
  const title = (userPrompt || 'Bubble Rush').slice(0, 60);
  return [
    { op: 'add', path: '/meta/title', value: title },
    { op: 'add', path: '/meta/template', value: 'bubble_clicker' },
    { op: 'add', path: '/meta/skin', value: skin },

    // Canvas & scene
    { op: 'add', path: '/scene/size', value: { w: 800, h: 500 } },
    { op: 'add', path: '/scene/hidpi', value: true },

    // Input & interactions
    { op: 'add', path: '/input/desktop', value: 'pointerdown' },
    { op: 'add', path: '/input/mobile', value: 'tap' },
    { op: 'add', path: '/interactions/click', value: { target: 'bubble', removes: true, effect: 'pop' } },

    // Entities – bubble visuals & motion
    { op: 'add', path: '/entities/bubble', value: {
      radius_range: [14, 48],
      color_palette: 'pastel',
      motion: { drift_px_per_s: [10, 40], wobble: 'sine' }
    } },

    // Rules – default: doubling spawns every 2s, limit 100 concurrent, end immediately
    { op: 'add', path: '/rules/spawn', value: { window_ms: 2000, mode: 'doubling' } },
    { op: 'add', path: '/rules/limit', value: { concurrent_bubbles: 100, end_on_limit: true } },

    // Scoring – survival time in ms
    { op: 'add', path: '/scoring', value: { mode: 'survival_time_ms' } },

    // HUD & UX
    { op: 'add', path: '/hud', value: { show_timer: true, show_bubble_count: true, show_spawn_label: true,
      sound_toggle: true, pause_hotkey: 'P' } },
  ];
}

// ---------------------- NL spawn parsing (lightweight, deterministic) -----------
function parseSpawnFromPrompt(userPrompt = '') {
  const p = String(userPrompt).toLowerCase();

  // Case A: "double every 2 seconds" / "doubling each 3 sec"
  const m1 = p.match(/\b(doubl(?:e|es|ing))\b.*?\b(?:every|each)\s+(\d+(?:\.\d+)?)\s*(?:seconds?|secs?|sec|s)\b/);
  if (m1) {
    const sec = parseFloat(m1[2]);
    if (sec > 0) {
      return { mode: 'doubling', window_ms: Math.round(sec * 1000) };
    }
  }

  // Case B: "add 4 (bubbles|chickens|...) every 3 seconds"
  let m2 = p.match(/\b(?:add|adds|added|spawn|spawns|create|creates|enter|enters|increase|increases)\b[^0-9]{0,12}(\d+)[^\d]{0,40}\b(?:every|each|per|after\s+every)\s+(\d+(?:\.\d+)?)\s*(?:seconds?|secs?|sec|s)\b/);

  // Case C: "after every 3 seconds, 4 new X are added"
  if (!m2) {
    const m3 = p.match(/\b(?:after\s+)?(?:every|each)\s+(\d+(?:\.\d+)?)\s*(?:seconds?|secs?|sec|s)[^0-9]{0,30}?\b(?:add|adds|added|spawn|spawns|create|creates|enter|enters|increase|increases)\b[^0-9]{0,12}(\d+)\b/);
    if (m3) {
      m2 = [m3[0], m3[2], m3[1]]; // normalize to (n, sec)
    }
  }

  if (m2) {
    const n = parseInt(m2[1], 10);
    const sec = parseFloat(m2[2]);
    if (n > 0 && sec > 0) {
      return { mode: 'fixed', add_per_window: n, window_ms: Math.round(sec * 1000) };
    }
  }

  return null;
}

function overrideOpsFromPrompt(userPrompt = '') {
  const ops = [];
  const skin = detectSkin(userPrompt);
  if (skin) {
    ops.push({ op: 'add', path: '/meta/skin', value: skin });
  }
  const spawn = parseSpawnFromPrompt(userPrompt);
  if (spawn) {
    ops.push({ op: 'add', path: '/rules/spawn', value: spawn });
  }
  return ops;
}

const SYSTEM = `You are a JSON Spec Editor for a 2D web game compiler.
Return ONLY a valid RFC-6902 JSON Patch array that minimally updates the provided spec.
NEVER output prose or code. If a field is unspecified, apply sensible defaults.

Schema (partial):
- meta: { title, template, skin }
- scene: { size: { w,h }, hidpi: boolean }
- input: { desktop: 'pointerdown'|'keyboard'|..., mobile: 'tap'|'none' }
- interactions: click: { target: 'bubble'|'enemy'|..., removes: boolean, effect: 'pop'|'none' }
- entities: bubble: { radius_range:[min,max], color_palette, motion:{ drift_px_per_s:[min,max], wobble:'sine'|'none' } }
- rules:
  - spawn: { window_ms: number, mode:'doubling'|'fixed', add_per_window?: number }
  - limit: { concurrent_bubbles:number, end_on_limit:boolean }
- scoring: { mode:'survival_time_ms'|'score' }
- hud: { show_timer:boolean, show_bubble_count:boolean, show_spawn_label:boolean, sound_toggle:boolean, pause_hotkey:string }

Mapping guidance for common phrases:
- "bubbles double every 2 seconds" => rules.spawn.window_ms=2000, rules.spawn.mode='doubling'.
- "add N every X seconds" => rules.spawn.mode='fixed', rules.spawn.add_per_window=N, rules.spawn.window_ms=X*1000.
- "game over at 100 bubbles" => rules.limit.concurrent_bubbles=100, end_on_limit=true.
- "click/tap bubble" => input.desktop='pointerdown', input.mobile='tap', interactions.click.target='bubble', removes=true, effect='pop'.
- "score is time until game over" => scoring.mode='survival_time_ms'.
- "bubbles vary in color and size" => entities.bubble.radius_range=[14,48], color_palette='pastel'.
- Prefer meta.template='bubble_clicker' when user mentions bubbles to prick/pop.
- "use X instead of bubbles" → set meta.skin='x' (singular, lowercase); keep template as 'bubble_clicker'.
- Words like "chickens", "balloons", "slimes", "asteroids" imply a skin change only; DO NOT alter mechanics solely due to a skin change.

Defaults if missing: scene.size=800x500, scene.hidpi=true, hud.show_* = true, pause_hotkey='P', meta.skin='bubble'.
`;

export async function proposeSpecPatch({ spec, userPrompt, briefSummary }) {
  const shortSummary = (briefSummary || '').slice(0, 300);
  const key = cacheKey(spec, userPrompt, shortSummary);
  const cached = await getCache(key);
  if (cached) return cached;

  const looksLikeBubble = /bubble|bubbles|prick|pop|balloon|balloons|chicken|chickens|slime|slimes|asteroid|asteroids/i.test(userPrompt || '');

  const messages = [
    {
      role: 'user',
      content:
`BRIEF SUMMARY (<=300 chars):
${shortSummary}

CURRENT SPEC_JSON:
${JSON.stringify(spec)}

USER MESSAGE:
${userPrompt}

Return ONLY a JSON array of RFC-6902 operations.
`
    }
  ];

  let patch = [];
  try {
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 800,
      temperature: 0.2,
      system: SYSTEM,
      messages
    });
    const text = msg.content?.[0]?.text || '[]';
    try { patch = JSON.parse(text); } catch { patch = []; }
  } catch (e) {
    // LLM not reachable or API key missing → deterministic fallback
    patch = looksLikeBubble ? bubbleFallbackPatch(userPrompt) : [];
  }

  // If LLM returned nothing useful, still ensure we have a baseline for bubble-like prompts
  if ((!Array.isArray(patch) || patch.length === 0) && looksLikeBubble) {
    patch = bubbleFallbackPatch(userPrompt);
  }

  // Always append NL overrides (skin + spawn) so user's phrasing wins over defaults
  const overrides = overrideOpsFromPrompt(userPrompt);
  if (overrides.length) {
    patch = [...patch, ...overrides];
  }

  // Keep cache short — spec evolves frequently
  await setCache(key, patch, /*ttlSeconds*/ 30 * 60); // 30 mins
  return patch;
}
