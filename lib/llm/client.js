// lib/llm/client.js
// Minimal Anthropic client (no SDK). Server-only — import only in API routes.

export const BASE_SYSTEM_PROMPT = `You are an expert HTML5 game developer.
When given a game idea in natural language, output ONE complete, polished, single-file HTML game that runs instantly in a browser.

### OUTPUT FORMAT (non-negotiable)
- Return ONLY a full <!DOCTYPE html> document with <html>, <head>, <body>.
- Include EXACTLY one <style> block (inline CSS) and one <script> block (inline JS).
- No explanations, no markdown fences, no external files (CDN assets only if explicitly requested).

### GAMEPLAY & PERFORMANCE
- ~60 FPS via requestAnimationFrame; efficient update/render loops.
- Clear game states: Start → Playing → Game Over → Restart.
- Use Canvas for action games; DOM is OK for simple/puzzle UI.
- Responsive layout and centered viewport; loads instantly.

### VISUALS & UX
- Modern, cartoony look (shadows, subtle gradients, easing).
- HUD shows score, health/lives, timer/progress as relevant.
- Start screen includes 1–2 line instructions; Game Over screen has Restart CTA.
- Add satisfying moment-to-moment feedback (wobble on hit, sparkle on pickup).

### FEATURES TO INCLUDE (as relevant)
- Player controls (keyboard/mouse/touch).
- Collisions and interactions (enemies, pickups, projectiles).
- Win/lose conditions and scoring.
- Restart logic that fully resets state.
- Optional audio via Web Audio API if user asks.

### CODE QUALITY
- Clean structure, small helper functions, clear names.
- Deterministic logic (avoid randomness causing unwinnable states).
- Pause when window is unfocused; resume cleanly.
- No unused variables, no dead listeners, no console spam.

### SCOPE MANAGEMENT
If the request implies 3D/AAA scope, **downscope** to a fun 2D arcade interpretation and proceed.

### FINAL CHECK (do silently, do not print the checklist)
- [ ] Exactly one <style> and one <script>
- [ ] Visible instructions on Start
- [ ] HUD during play
- [ ] 60fps loop using rAF
- [ ] Start → Playing → Game Over → Restart works
- [ ] Restart fully resets entities, timers, and score
- [ ] No missing tags, no external code required
`;

export const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

// Prefer server key; allow NEXT_PUBLIC_* only for local dev fallback.
const API_KEY =
  process.env.ANTHROPIC_API_KEY ||
  process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY ||
  '';

// Default to a fast/cheap model; routes can override via env.
export const MODEL =
  process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';

// Helpful flags for routes
export function hasAnthropic() {
  return !!API_KEY;
}
export function getModel() {
  return MODEL;
}

export function buildSystemPrompt(ops = {}) {
  const {
    forceSingleFile = true,
    inlineCSS = true,
    inlineJS = true,
    preferCanvas = true,
    requireGameStates = true,
    targetFPS = 60,
  } = ops;

  const lines = [
    BASE_SYSTEM_PROMPT,
    // Flag-driven reinforcements (keep short; they stack with the base prompt)
    forceSingleFile ? 'Always output one complete single-file HTML document with <!DOCTYPE html> and exactly one <style> and one <script>.' : '',
    inlineCSS ? 'All CSS must be inside a single <style> tag.' : '',
    inlineJS ? 'All JavaScript must be inside a single <script> tag.' : '',
    preferCanvas ? 'Prefer HTML5 Canvas for rendering and animations.' : '',
    requireGameStates ? 'Implement clear game states: start → playing → game over → restart.' : '',
    `Target smooth gameplay around ${targetFPS} FPS using requestAnimationFrame.`,
    'Output only the final HTML. No explanations or markdown fences.',
  ].filter(Boolean);

  return lines.join('\n');
}

/**
 * Always export a defined client shape so callers can do:
 *   const res = await anthropic.messages.create(...)
 * If the API key is missing, we return a SAFE STUB response ('[]') instead of
 * throwing, so your routes won't crash with "reading 'messages' of undefined".
 */
async function createMessage({
  model = MODEL,
  system,
  messages,
  max_tokens = 800,
  temperature = 0.2,
}) {
  // Auto-add our base system prompt if none provided
  const finalSystem = system || buildSystemPrompt();

  // No key? Return a benign empty JSON Patch so upstream falls back gracefully.
  if (!API_KEY) {
    return { content: [{ text: '[]' }] };
  }

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      system: finalSystem,
      messages,
      max_tokens,
      temperature,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic ${res.status}: ${body}`);
  }

  return await res.json();
}

export const anthropic = {
  messages: { create: createMessage },
};

export async function callLLMWithSystem({
  model = MODEL,
  system = buildSystemPrompt(),
  user,
  max_tokens = 4000,
  temperature = 0.2,
}) {
  const resp = await anthropic.messages.create({
    model,
    system,
    messages: [{ role: 'user', content: user }],
    max_tokens,
    temperature,
  });
  const text = Array.isArray(resp?.content)
    ? resp.content.map(c => (c?.text ?? '')).join('\n')
    : (resp?.output_text || '');
  return text;
}
