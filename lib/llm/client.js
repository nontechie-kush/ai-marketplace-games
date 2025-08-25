// lib/llm/spec_editor.js
import crypto from 'node:crypto';
import { anthropic, MODEL } from './client';
import { getCache, setCache } from '../cache';

const SPEC_CACHE_VERSION = 'v3-skin-aware';

function cacheKey(spec, userPrompt, briefSummary) {
  const payload = JSON.stringify({ v: SPEC_CACHE_VERSION, spec, userPrompt, briefSummary });
  return 'spec:' + crypto.createHash('sha256').update(payload).digest('hex');
}

// Detect "skin" (visual theme) nouns in the user's prompt without changing mechanics
function detectSkin(userPrompt = '') {
  const p = String(userPrompt).toLowerCase();
  if (/\bchickens?\b/.test(p)) return 'chicken';
  if (/\bballoons?\b/.test(p)) return 'balloon';
  if (/\bslimes?\b/.test(p)) return 'slime';
  if (/\basteroids?\b/.test(p)) return 'asteroid';
  // default skin for this template family
  return 'bubble';
}

// ---------- Deterministic fallback for common "bubble popper" pattern (defaults to doubling) ----------
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
- meta: { title, template, skin }
- scene: { size: { w,h }, hidpi: boolean }
- input: { desktop: 'pointerdown'|'keyboard'|..., mobile: 'tap'|'none' }
- interactions: click: { target: 'bubble'|'enemy'|..., removes: boolean, effect: 'pop'|'none' }
- entities: bubble: { radius_range:[min,max], color_palette, motion:{ drift_px_per_s:[min,max], wobble:'sine'|'none' } }
- rules:
  - spawn: { window_ms: number, mode:'doubling'|'linear', amount?: number }
  - limit: { concurrent_bubbles:number, end_on_limit:boolean }
- scoring: { mode:'survival_time_ms'|'score' }
- hud: { show_timer:boolean, show_bubble_count:boolean, show_spawn_label:boolean, sound_toggle:boolean, pause_hotkey:string }

Mapping guidance for common phrases:
- "bubbles double every 2 seconds" => rules.spawn.window_ms=2000, rules.spawn.mode='doubling'.
- "add N every M seconds" (e.g., "add 4 every 3 seconds") => rules.spawn.window_ms=M*1000, rules.spawn.mode='linear', rules.spawn.amount=N.
- "game over at 100 bubbles" => rules.limit.concurrent_bubbles=100, end_on_limit=true.
- "click/tap bubble" => input.desktop='pointerdown', input.mobile='tap', interactions.click.target='bubble', removes=true, effect='pop'.
- "score is time until game over" => scoring.mode='survival_time_ms'.
- "bubbles vary in color and size" => entities.bubble.radius_range=[14,48], color_palette='pastel'.
- Phrases like "2 more every 3s", "spawn 4 per 3 seconds", "every 3s add 4" map to the same linear rule above.
- Prefer meta.template='bubble_clicker' when user mentions bubbles to prick/pop.
- "use X instead of bubbles" → set meta.skin='x' (singular, lowercase); keep template as 'bubble_clicker'.
- Words like "chickens", "balloons", "slimes", "asteroids" imply a skin change only; DO NOT alter mechanics solely due to a skin change.

Defaults if missing: scene.size=800x500, scene.hidpi=true, hud.show_* = true, pause_hotkey='P', meta.skin='bubble'.
`;

function parseLinearSpawn(userPrompt = '') {
  // Matches forms like "add 4 every 3 seconds", "2 more every 3s", "spawn 5 per 2 sec"
  const p = String(userPrompt).toLowerCase();
  const re = /\b(?:add|spawn)?\s*(\d+)\s*(?:more\s*)?(?:every|per)\s*(\d+)\s*(?:seconds|second|secs|sec|s)\b/;
  const m = p.match(re);
  if (!m) return null;
  const amount = parseInt(m[1], 10);
  const secs = parseInt(m[2], 10);
  if (!Number.isFinite(amount) || !Number.isFinite(secs) || amount <= 0 || secs <= 0) return null;
  return { amount, window_ms: secs * 1000 };
}

export async function proposeSpecPatch({ spec, userPrompt, briefSummary }) {
  const shortSummary = (briefSummary || '').slice(0, 300);
  const key = cacheKey(spec, userPrompt, shortSummary);
  const cached = await getCache(key);
  if (cached) return cached;

  const linearIntent = parseLinearSpawn(userPrompt);

  const looksLikeBubble = /bubble|bubbles|prick|pop|balloon|balloons|chicken|chickens|slime|slimes|asteroid|asteroids/i.test(userPrompt || '');

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
    if (linearIntent) {
      const alreadySetsSpawn = Array.isArray(patch) && patch.some(op => String(op?.path || '').startsWith('/rules/spawn'));
      if (!alreadySetsSpawn) {
        patch = [
          ...(Array.isArray(patch) ? patch : []),
          { op: 'add', path: '/rules/spawn', value: { window_ms: linearIntent.window_ms, mode: 'linear', amount: linearIntent.amount } }
        ];
      }
    }
  } catch (e) {
    if (looksLikeBubble) {
      patch = bubbleFallbackPatch(userPrompt);
      if (linearIntent) {
        // replace spawn to linear for the fallback
        patch = patch.filter(op => op.path !== '/rules/spawn');
        patch.push({ op: 'add', path: '/rules/spawn', value: { window_ms: linearIntent.window_ms, mode: 'linear', amount: linearIntent.amount } });
      }
    } else {
      patch = [];
    }
  }

  if ((!Array.isArray(patch) || patch.length === 0) && looksLikeBubble) {
    patch = bubbleFallbackPatch(userPrompt);
  }

  if (linearIntent && Array.isArray(patch) && patch.length) {
    const setsSpawn = patch.some(op => String(op?.path || '').startsWith('/rules/spawn'));
    if (!setsSpawn) {
      patch.push({ op: 'add', path: '/rules/spawn', value: { window_ms: linearIntent.window_ms, mode: 'linear', amount: linearIntent.amount } });
    }
  }

  await setCache(key, patch, /*ttlSeconds*/ 30 * 60); // 30 mins
  return patch;
}
