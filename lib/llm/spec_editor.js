// lib/llm/spec_editor.js
// Returns RFC-6902 JSON Patch ops to evolve spec_json from the user's prompt.
// MVP shim: only tweaks a few common fields so compile() can produce HTML deterministically.
export async function proposeSpecPatch(currentSpec, userPrompt) {
  const ops = [];
  const lower = (userPrompt || "").toLowerCase();

  // Title from prompt (cheap heuristic)
  if (lower) {
    ops.push({ op: "add", path: "/meta/title", value: userPrompt.slice(0, 60) });
  }

  // Difficulty
  if (lower.includes("hard")) ops.push({ op: "add", path: "/rules/difficulty", value: "hard" });
  if (lower.includes("easy")) ops.push({ op: "add", path: "/rules/difficulty", value: "easy" });

  // Speed (look for "speed 100/200/..." style)
  const speedMatch = lower.match(/speed\\s*(\\d{2,3})/);
  if (speedMatch) ops.push({ op: "add", path: "/player/speed", value: Number(speedMatch[1]) });

  // Controller hint
  if (lower.includes("platform")) ops.push({ op: "add", path: "/player/controller", value: "platform" });
  else if (lower.includes("topdown")) ops.push({ op: "add", path: "/player/controller", value: "topdown" });

  // Simple goal mapping
  if (lower.includes("survive")) ops.push({ op: "add", path: "/goals/0", value: "survive_timer" });
  if (lower.includes("collect")) ops.push({ op: "add", path: "/goals/0", value: "collect_items" });

  // Ensure arrays exist (compiler-friendly)
  if (!currentSpec.entities) ops.push({ op: "add", path: "/entities", value: [] });
  if (!currentSpec.enemies) ops.push({ op: "add", path: "/enemies", value: [] });

  return ops;
}
