// lib/llm/client.js
// Centralized Anthropic client + model selection used by spec_editor and direct generation.
// Safe for server-only usage in API routes. Never import this in client components.

import Anthropic from '@anthropic-ai/sdk';

// Prefer server-side key; fall back to NEXT_PUBLIC_* only if present (for local dev).
const API_KEY = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || '';

// Allow overriding via env; otherwise pick a sensible default.
// Use a fast/cheap model by default; routes that need higher quality can override.
export const MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';

// Export a singleton client when a key exists; otherwise export null and let callers gate on it.
export const anthropic = API_KEY ? new Anthropic({ apiKey: API_KEY }) : null;

// Small helpers used by routes for feature gating & logging.
export function hasAnthropic() {
  return !!API_KEY;
}

export function getModel() {
  return MODEL;
}

// For convenience in routes that want both the client and model in one call.
export function getAnthropicClientAndModel() {
  return { anthropic, model: MODEL };
}
