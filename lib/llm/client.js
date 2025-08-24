// lib/llm/client.js
// Lightweight Anthropic client using fetch (no external SDK needed)

export const MODEL = 'claude-3-5-haiku-latest';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const API_KEY = process.env.ANTHROPIC_API_KEY || '';

async function createMessage({ model, system, messages, max_tokens = 800, temperature = 0.2 }) {
  // If no key, behave like a mock to keep the app flowing (spec editor will fallback)
  if (!API_KEY) {
    return { content: [{ text: '[]' }] };
  }
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({ model, system, messages, max_tokens, temperature })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic ${res.status}: ${body}`);
  }
  return await res.json();
}

export const anthropic = {
  messages: { create: createMessage }
};
