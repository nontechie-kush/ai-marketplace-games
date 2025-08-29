// ---- lightweight in-memory cache (serverless-safe) ----
const __SPEC_CACHE__ = globalThis.__SPEC_CACHE__ || (globalThis.__SPEC_CACHE__ = new Map());

function cacheKey(spec, userPrompt, shortSummary) {
  // keep the key stable but compact; avoid huge strings
  return JSON.stringify([
    spec && spec.meta && spec.meta.id ? String(spec.meta.id) : '',
    spec && spec.meta && spec.meta.version ? String(spec.meta.version) : '',
    (userPrompt || '').slice(0, 400),
    (shortSummary || '').slice(0, 200)
  ]);
}

async function getCache(key) {
  const hit = __SPEC_CACHE__.get(key);
  if (!hit) return null;
  if (hit.expiresAt && hit.expiresAt <= Date.now()) {
    __SPEC_CACHE__.delete(key);
    return null;
  }
  return hit.value;
}

async function setCache(key, value, ttlSeconds = 1800) {
  __SPEC_CACHE__.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}
// -------------------------------------------------------
export async function proposeSpecPatch({ spec, userPrompt, briefSummary }) {
  const shortSummary = (briefSummary || '').slice(0, 300);

  // 🚨 Direct mode override:
  // If the user's message starts with "Kushendra", skip the spec pipeline entirely.
  // We signal this to downstream by returning a small patch that sets meta.direct_mode + meta.raw_prompt.
  if ((userPrompt || '').trim().toLowerCase().startsWith('kushendra')) {
    return [
      { op: 'add', path: '/meta/direct_mode', value: true },
      { op: 'add', path: '/meta/raw_prompt', value: userPrompt }
    ];
  }

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

  // Always append NL overrides (skin + spawn + limit) so user's phrasing wins over defaults
  const overrides = overrideOpsFromPrompt(userPrompt);
  if (overrides.length) {
    patch = [...patch, ...overrides];
  }

  // Keep cache short — spec evolves frequently
  await setCache(key, patch, /*ttlSeconds*/ 30 * 60); // 30 mins
  return patch;
}
