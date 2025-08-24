// lib/llm/router.js
import crypto from 'node:crypto';
import { anthropic, MODEL } from '@/lib/llm/client';
import { getCache, setCache } from '@/lib/cache';

const ROUTER_CACHE_VERSION = 'v1';

function cacheKey(userPrompt) {
  const payload = JSON.stringify({ v: ROUTER_CACHE_VERSION, userPrompt });
  return 'router:' + crypto.createHash('sha256').update(payload).digest('hex');
}

const SYSTEM = `You are a feasibility router for a 2D web game generator.
Return JSON with: feasible (true/false), template (one of snake|dodger|platformer|topdown_shooter|puzzle), must_ask (array of missing fields).
Keep responses minimal.`;

export async function routeIdeaToTemplate(userPrompt) {
  const key = cacheKey(userPrompt);
  const cached = await getCache(key);
  if (cached) return cached;

  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 300,
    system: SYSTEM,
    messages: [
      { role: 'user', content: `Idea: ${userPrompt}\nReturn JSON only.` }
    ]
  });

  // Claude returns content as array; first item is text
  const text = msg.content?.[0]?.text || '{}';
  let parsed = {};
  try { parsed = JSON.parse(text); } catch { parsed = { feasible: true, template: 'topdown_shooter', must_ask: [] }; }

  await setCache(key, parsed, /*ttlSeconds*/ 12 * 3600); // 12h
  return parsed;
}
