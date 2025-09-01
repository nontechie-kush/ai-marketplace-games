// lib/llm/client.js
// Minimal Anthropic client (no SDK). Server-only — import only in API routes.

// Base system prompt that should always be included (auto-added)
export const BASE_SYSTEM_PROMPT = `You are an expert game developer specializing in creating complete, playable HTML games. When a user describes a game concept, you must create a fully functional single-file HTML game that includes all necessary HTML, CSS, and JavaScript.

## Game Development Requirements:
- Create complete, playable games in a single HTML file
- Include all styling inline with <style> tags
- Include all JavaScript inline with <script> tags
- Make games immediately playable without external dependencies
- Use only vanilla JavaScript (no external libraries unless from CDN)
- Ensure smooth 60fps gameplay with requestAnimationFrame
- Include proper game states (start, playing, game over, restart)

## Visual and UI Standards:
- Create visually appealing, modern game interfaces
- Include HUD elements showing score, health, timer, etc.
- Add smooth animations and visual feedback
- Use CSS for attractive styling and layouts
- Include clear instructions for players
- Make games responsive and well-centered on screen

## Code Quality:
- Write clean, well-organized JavaScript
- Use proper game loop architecture
- Handle user input efficiently
- Include collision detection where needed
- Implement proper game state management
- Add sound effects using Web Audio API if requested

## Game Features to Include:
- Player movement/controls
- Score system
- Win/lose conditions
- Restart functionality
- Visual effects and animations
- Responsive design
- Clear gameplay feedback

## Canvas Games:
- Use HTML5 Canvas for action games
- Implement proper rendering pipeline
- Handle game objects efficiently
- Include particle effects where appropriate

Always create complete, polished games that are immediately playable. Focus on fun gameplay mechanics and smooth user experience.`;

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

// Base system prompt that should always be included (auto-added)
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
