// lib/compiler.js
/**
 * Very small starter compiler:
 * - Takes a Spec JSON and returns deterministic inline HTML (CSS+JS)
 * - No LLM here. Expand later with templates/primitives.
 */
export function compile(spec = {}) {
  const title = spec?.meta?.title || 'Your Game'
  const themeBg = (spec?.meta?.theme === 'light') ? '#fafafa' : '#111'
  const sceneW = spec?.scene?.size?.w ?? 800
  const sceneH = spec?.scene?.size?.h ?? 500
  const playerSpeed = spec?.player?.speed ?? 200

  // naive controller mapping
  const controller = spec?.player?.controller || 'topdown'
  const controls = (spec?.controls || ['wasd']).join(', ').toUpperCase()

  // Build a tiny playable placeholder — expand with real primitives later
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  body{background:${themeBg};color:#fff;font-family:Inter,system-ui;margin:0;padding:16px;text-align:center}
  .wrap{max-width:960px;margin:0 auto}
  #game{width:${sceneW}px;height:${sceneH}px;border:2px solid #fff;margin:20px auto;position:relative;background:#000;overflow:hidden}
  #player{width:20px;height:20px;background:#4ade80;position:absolute;top:${(sceneH/2)-10}px;left:${(sceneW/2)-10}px}
  .hud{opacity:.9;font-size:14px;margin-top:8px}
  a, a:visited{color:#93c5fd}
</style>
</head><body><div class="wrap">
  <h1>${escapeHtml(title)}</h1>
  <div id="game"><div id="player"></div></div>
  <div class="hud">Controls: ${escapeHtml(controls)} · Controller: ${escapeHtml(controller)} · Speed: ${playerSpeed}</div>
</div>
<script>
(function(){
  const box = document.getElementById('game');
  const p = document.getElementById('player');
  let x = ${Math.floor(sceneW/2)-10}, y = ${Math.floor(sceneH/2)-10};
  const maxX = ${sceneW-20}, maxY = ${sceneH-20};
  const step = 15; // pixel step per keypress to keep it simple here

  addEventListener('keydown', (e) => {
    if (e.key === 'w' || e.key === 'ArrowUp')    y = Math.max(0, y - step);
    if (e.key === 's' || e.key === 'ArrowDown')  y = Math.min(maxY, y + step);
    if (e.key === 'a' || e.key === 'ArrowLeft')  x = Math.max(0, x - step);
    if (e.key === 'd' || e.key === 'ArrowRight') x = Math.min(maxX, x + step);
    p.style.left = x + 'px';
    p.style.top  = y + 'px';
  });
})();
</script>
</body></html>`;
}

// small HTML escaper to be safe
function escapeHtml(s){
  return String(s).replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
