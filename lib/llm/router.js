// lib/llm/router.js
// Minimal feasibility router: map user idea to a template family
export async function routeIdeaToTemplate(userPrompt) {
  const lower = (userPrompt || "").toLowerCase();
  // naive heuristics for MVP
  if (lower.includes("snake")) return { feasible: true, template: "snake", must_ask: [] };
  if (lower.includes("platform")) return { feasible: true, template: "platformer", must_ask: [] };
  if (lower.includes("shooter") || lower.includes("topdown"))
    return { feasible: true, template: "topdown_shooter", must_ask: [] };
  if (lower.includes("dodge") || lower.includes("dodger"))
    return { feasible: true, template: "dodger", must_ask: [] };
  // default starter
  return { feasible: true, template: "topdown_shooter", must_ask: [] };
}
