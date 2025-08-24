// lib/llm/spec_editor.js
import crypto from 'node:crypto';
import { anthropic, MODEL } from '@/lib/llm/client';
import { getCache, setCache } from '@/lib/cache';

const SPEC_CACHE_VERSION = 'v1';

function cacheKey(spec, userPrompt, briefSummary) {
  const payload = JSON.stringify({ v: SPEC_CACHE_VERSION, spec, userPrompt, briefSummary });
  return 'spec:' + crypto.createHash('sha256').update(payload).digest('hex');
}

const SYSTEM = `You are a JSON Spec Editor for a 2D game compiler.
- Input: current "spec_json" and user's instruction.
- Output: RFC-6902 JSON Patch array ONLY.
- Do not output code. Do not change unrelated fields.
- Prefer minimal edits that the compiler understands:
  fields like meta.title, scene.size, player.controller (topdown|platform), player.speed, goals, rules.difficulty, entities, enemies, etc.`;

export async function proposeSpecPatch({ spec, userPrompt, briefSummary }) {
  const shortSummary = (briefSummary || '').slice(0, 300);
  const key = cacheKey(spec, userPrompt, shortSummary);
  const cached = await getCache(key);
  if (cached) return cached;

  const messages = [
    { role: 'user', content:
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

  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 600,
    system: SYSTEM,
    messages
  });

  const text = msg.content?.[0]?.text || '[]';
  let patch = [];
  try { patch = JSON.parse(text); } catch { patch = []; }

  // Keep cache short — spec evolves frequently
  await setCache(key, patch, /*ttlSeconds*/ 30 * 60); // 30 mins
  return patch;
}
