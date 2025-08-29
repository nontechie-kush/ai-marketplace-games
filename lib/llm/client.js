// lib/llm/client.js
// Minimal Anthropic client (no SDK). Server-only — import only in API routes.

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

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
      system,
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
