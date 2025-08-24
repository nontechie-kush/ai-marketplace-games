// lib/llm/spec_editor.js
import crypto from 'node:crypto';
import { anthropic, MODEL } from './client';
import { getCache, setCache } from '../cache';

const SPEC_CACHE_VERSION = 'v2-bubble-aware';

function cacheKey(spec, userPrompt, briefSummary) {
  const payload = JSON.stringify({ v: SPEC_CACHE_VERSION, spec, userPrompt, briefSummary });
  return 'spec:' + crypto.createHash('sha256').update(payload).digest('hex');
}

// ---------- Deterministic fallback for common "bubble popper" pattern ----------
function bubbleFallbackPatch(userPrompt) {
  const title = (userPrompt || 'Bubble Rush').slice(0, 60);
  return [
    { op: 'add', path: '/meta/title', value: title },
    { op: 'add', path: '/meta/template', value: 'bubble_clicker' },

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

    // Rules – doubling spawns every 2s, limit 100 concurrent, end immediately
    { op: 'add', path: '/rules/spawn', value: { window_ms: 2000, mode: 'doubling' } },
    { op: 'add', path: '/rules/limit', value: { concurrent_bubbles: 100, end_on_limit: true } },

    // Scoring – survival time in ms
    { op: 'add', path: '/scoring', value: { mode: 'survival_time_ms' } },

    // HUD & UX
    { op: 'add', path: '/hud', value: { show_timer: true, show_bubble_count: true, show_spawn_label: true, 
      sound_toggle: true, pause_hotkey: 'P' } },
  ];
}

const SYSTEM = `You are a JSON Spec Editor for a 2D web game compiler.
Return ONLY a valid RFC-6902 JSON Patch array that minimally updates the provided spec.
NEVER output prose or code. If a field is unspecified, apply sensible defaults.

Schema (partial):
- meta: { title, template }
- scene: { size: { w,h }, hidpi: boolean }
- input: { desktop: 'pointerdown'|'keyboard'|..., mobile: 'tap'|'none' }
- interactions: click: { target: 'bubble'|'enemy'|..., removes: boolean, effect: 'pop'|'none' }
- entities: bubble: { radius_range:[min,max], color_palette, motion:{ drift_px_per_s:[min,max], wobble:'sine'|'none' } }
- rules:
  - spawn: { window_ms: number, mode:'doubling'|'fixed' }
  - limit: { concurrent_bubbles:number, end_on_limit:boolean }
- scoring: { mode:'survival_time_ms'|'score' }
- hud: { show_timer:boolean, show_bubble_count:boolean, show_spawn_label:boolean, sound_toggle:boolean, pause_hotkey:string }

Mapping guidance for common phrases:
- "bubbles double every 2 seconds" => rules.spawn.window_ms=2000, rules.spawn.mode='doubling'.
- "game over at 100 bubbles" => rules.limit.concurrent_bubbles=100, end_on_limit=true.
- "click/tap bubble" => input.desktop='pointerdown', input.mobile='tap', interactions.click.target='bubble', removes=true, effect='pop'.
- "score is time until game over" => scoring.mode='survival_time_ms'.
- "bubbles vary in color and size" => entities.bubble.radius_range=[14,48], color_palette='pastel'.
- Prefer meta.template='bubble_clicker' when user mentions bubbles to prick/pop.

Defaults if missing: scene.size=800x500, scene.hidpi=true, hud.show_* = true, pause_hotkey='P'.
`;

export async function proposeSpecPatch({ spec, userPrompt, briefSummary }) {
  const shortSummary = (briefSummary || '').slice(0, 300);
  const key = cacheKey(spec, userPrompt, shortSummary);
  const cached = await getCache(key);
  if (cached) return cached;

  const looksLikeBubble = /bubble|bubbles|prick|pop/i.test(userPrompt || '');

  const messages = [
    { role: 'user', content:
`BRIEF SUMMARY (<=300 chars):\n${shortSummary}\n\nCURRENT SPEC_JSON:\n${JSON.stringify(spec)}\n\nUSER MESSAGE:\n${userPrompt}\n\nReturn ONLY a JSON array of RFC-6902 operations.\n` }
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
    patch = looksLikeBubble ? bubbleFallbackPatch(userPrompt) : [];
  }

  if ((!Array.isArray(patch) || patch.length === 0) && looksLikeBubble) {
    patch = bubbleFallbackPatch(userPrompt);
  }

  await setCache(key, patch, /*ttlSeconds*/ 30 * 60); // 30 mins
  return patch;
}
