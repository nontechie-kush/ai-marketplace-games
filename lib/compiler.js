// lib/compiler.js
/**
 * Compiler v0.2
 * - Deterministic HTML generator from Game Spec JSON
 * - Template dispatcher (bubble_clicker + sandbox fallback)
 * - No LLM here. Pure string generation.
 */

export function compile(spec = {}) {
  const template = spec?.meta?.template || 'sandbox'
  if (template === 'bubble_clicker') return compileBubbleClicker(spec)
  return compileSandbox(spec)
}

// -------------------- SANDBOX FALLBACK (existing behavior) --------------------
function compileSandbox(spec = {}) {
  const title = spec?.meta?.title || 'Your Game'
  const themeBg = (spec?.meta?.theme === 'light') ? '#fafafa' : '#111'
  const sceneW = spec?.scene?.size?.w ?? 800
  const sceneH = spec?.scene?.size?.h ?? 500
  const playerSpeed = spec?.player?.speed ?? 200
  const controller = spec?.player?.controller || 'topdown'
  const controls = (spec?.controls || ['wasd']).join(', ').toUpperCase()

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
  const step = 15;
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

// -------------------- BUBBLE CLICKER TEMPLATE --------------------
function compileBubbleClicker(spec = {}) {
  const title = spec?.meta?.title || 'Bubble Rush'
  const sceneW = spec?.scene?.size?.w ?? 800
  const sceneH = spec?.scene?.size?.h ?? 500
  const hidpi = spec?.scene?.hidpi ?? true
  const windowMs = spec?.rules?.spawn?.window_ms ?? 2000
  const limit = spec?.rules?.limit?.concurrent_bubbles ?? 100
  const pauseKey = (spec?.hud?.pause_hotkey || 'P').toUpperCase()

  const spawnCfg = spec?.rules?.spawn || {}
  const spawnMode = spawnCfg.mode || 'doubling' // 'doubling' | 'linear'
  const intervalSec = (typeof spawnCfg.intervalSeconds === 'number')
    ? spawnCfg.intervalSeconds
    : ((spec?.rules?.spawn?.window_ms ?? 2000) / 1000)
  const addPerTick = (typeof spawnCfg.addPerTick === 'number') ? spawnCfg.addPerTick : 0

  const helpText = (spawnMode === 'linear')
    ? `Every ${intervalSec}s spawns +${addPerTick} bubbles. Hit ${limit} bubbles on screen and it's game over.`
    : `Every ${intervalSec}s the spawn amount doubles. Hit ${limit} bubbles on screen and it's game over.`

  const hudSpawnInitial = (spawnMode === 'linear')
    ? `+${addPerTick}/${intervalSec}s`
    : `1/${intervalSec}s`

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  :root{--bg:#0b1020;--panel:#121a2b;--text:#e6f0ff;--accent:#6ee7b7;--muted:#9aa6b2}
  html,body{height:100%}
  body{background:var(--bg);color:var(--text);font-family:Inter,system-ui;margin:0;display:flex;flex-direction:column}
  header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:linear-gradient(180deg,rgba(255,255,255,.04),transparent)}
  h1{font-size:18px;margin:0}
  .hud{display:flex;gap:16px;align-items:center;font-size:14px}
  .hud b{color:#fff}
  .btn{background:var(--panel);border:1px solid rgba(255,255,255,.1);color:var(--text);padding:6px 10px;border-radius:8px;cursor:pointer}
  .btn:hover{border-color:rgba(255,255,255,.25)}
  .wrap{max-width:1100px;margin:0 auto;flex:1;display:flex;gap:20px;padding:16px;box-sizing:border-box}
  .stage{flex:1;display:flex;align-items:center;justify-content:center}
  canvas{background:#0a0a0a;border:2px solid rgba(255,255,255,.2);border-radius:6px;cursor:crosshair}
  .panel{width:340px;background:var(--panel);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:12px}
  .title{font-weight:700;margin:8px 0 12px 0}
  .muted{color:var(--muted)}
  .overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;}
  .card{background:rgba(10,12,20,.9);border:1px solid rgba(255,255,255,.12);padding:24px 28px;border-radius:12px;text-align:center;backdrop-filter:blur(4px)}
  .big{font-size:22px;margin:0 0 6px 0}
  .small{font-size:14px;color:var(--muted);margin:0 0 14px 0}
</style>
</head>
<body>
  <header>
    <h1>${escapeHtml(title)}</h1>
    <div class="hud">
      <span>⏱️ Time: <b id="hud-time">0.00s</b></span>
      <span>🫧 Bubbles: <b id="hud-count">0</b></span>
      <span>⚙️ Spawning: <b id="hud-spawn">${escapeHtml(hudSpawnInitial)}</b></span>
      <button id="btn-sound" class="btn">🔊 Sound: On</button>
      <button id="btn-pause" class="btn">⏸ Pause (${escapeHtml(pauseKey)})</button>
    </div>
  </header>
  <div class="wrap">
    <div class="stage">
      <div style="position:relative">
        <canvas id="game" width="${sceneW}" height="${sceneH}"></canvas>
        <div id="overlay" class="overlay">
          <div class="card">
            <p class="big">${escapeHtml(title)}</p>
            <p class="small">Prick bubbles by clicking/tapping. ${escapeHtml(helpText)}</p>
            <button id="btn-start" class="btn">▶ Start</button>
          </div>
        </div>
      </div>
    </div>
    <div class="panel">
      <div class="title">How to Play</div>
      <div class="muted">Click or tap bubbles to pop them. ${escapeHtml(helpText)} Survive as long as possible. Press <b>${escapeHtml(pauseKey)}</b> to pause.</div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,.08);margin:12px 0">
      <div class="muted">Best Time: <b id="best-time">0.00s</b></div>
    </div>
  </div>

<script>
(() => {
  const cfg = {
    cssW:${sceneW}, cssH:${sceneH}, hidpi:${hidpi ? 'true' : 'false'},
    windowMs:${windowMs}, limit:${limit}, pauseKey:'${escapeJs(pauseKey)}',
    spawn: { mode: '${escapeJs(spawnMode)}', intervalMs: ${Math.round(intervalSec * 1000)}, addPerTick: ${addPerTick} }
  };

  // HiDPI canvas
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let dpr = window.devicePixelRatio || 1;
  function resizeCanvas(){
    const scale = cfg.hidpi ? dpr : 1;
    canvas.style.width = cfg.cssW + 'px';
    canvas.style.height = cfg.cssH + 'px';
    canvas.width = Math.floor(cfg.cssW * scale);
    canvas.height = Math.floor(cfg.cssH * scale);
    ctx.setTransform(scale,0,0,scale,0,0);
  }
  resizeCanvas();

  // HUD
  const hudTime = document.getElementById('hud-time');
  const hudCount = document.getElementById('hud-count');
  const hudSpawn = document.getElementById('hud-spawn');
  hudSpawn.textContent = (cfg.spawn.mode === 'linear') ? ('+'+cfg.spawn.addPerTick+'/'+(cfg.spawn.intervalMs/1000)+'s') : ('1/'+(cfg.spawn.intervalMs/1000)+'s')
  const bestEl = document.getElementById('best-time');
  const overlay = document.getElementById('overlay');
  const btnStart = document.getElementById('btn-start');
  const btnPause = document.getElementById('btn-pause');
  const btnSound = document.getElementById('btn-sound');

  // Local best time
  const BEST_KEY = 'bubble_rush_best_v1';
  function fmt(t){ return (t/1000).toFixed(2)+'s'; }
  bestEl.textContent = localStorage.getItem(BEST_KEY) ? fmt(+localStorage.getItem(BEST_KEY)) : '0.00s';

  // WebAudio pop
  let audioCtx=null, muted=false;
  function toggleSound(){
    muted = !muted; btnSound.textContent = muted ? '🔇 Sound: Off' : '🔊 Sound: On';
  }
  btnSound.addEventListener('click', toggleSound);
  function popSound(){
    if(muted) return; try{
      audioCtx = audioCtx || new (window.AudioContext||window.webkitAudioContext)();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type='triangle';
      o.frequency.setValueAtTime(600,audioCtx.currentTime);
      o.frequency.exponentialRampToValueAtTime(80,audioCtx.currentTime+0.08);
      g.gain.setValueAtTime(0.2,audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001,audioCtx.currentTime+0.12);
      o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime+0.13);
    }catch{}
  }

  // Game state
  let running=false, paused=false, startTime=0, elapsed=0, lastTs=0;
  let bubbles=[], spawnWindowIndex=0, spawnedInWindow=0; // doubling schedule

  const pastel = [ '#A7F3D0','#93C5FD','#FDE68A','#FCA5A5','#C4B5FD','#FBCFE8','#99F6E4','#FDE68A' ];

  function rand(min,max){ return Math.random()*(max-min)+min }
  function spawnOne(){
    const r = rand(14,48);
    const x = rand(r, cfg.cssW - r);
    const y = rand(r, cfg.cssH - r);
    const color = pastel[(Math.random()*pastel.length)|0];
    const dir = Math.random()*Math.PI*2;
    const speed = rand(10,40);
    const wobbleAmp = rand(0.5, 2.2);
    const wobbleFreq = rand(1.0, 2.4);
    bubbles.push({x,y,r,color,dir,speed,wobbleAmp,wobbleFreq,phase:Math.random()*Math.PI*2,popT:0})
  }

  function update(dt){
    if(!running||paused) return;
    // deterministic schedule based on elapsed since start
    const sinceStart = elapsed;
    const interval = cfg.spawn.intervalMs || cfg.windowMs; // fallback to windowMs for old specs
    const currentIndex = Math.floor(sinceStart / interval); // 0,1,2...

    // if we rolled into a new window, reset counter
    if(currentIndex !== spawnWindowIndex){
      spawnWindowIndex = currentIndex;
      spawnedInWindow = 0;
    }

    let targetInThisWindow;
    if(cfg.spawn.mode === 'linear'){
      targetInThisWindow = Math.max(0, cfg.spawn.addPerTick|0);
      hudSpawn.textContent = '+' + targetInThisWindow + '/' + (interval/1000) + 's';
    } else { // doubling (default)
      targetInThisWindow = Math.pow(2, currentIndex) | 0; // 1,2,4,8...
      hudSpawn.textContent = targetInThisWindow + '/' + (interval/1000) + 's';
    }

    // catch-up logic within the current window
    const need = targetInThisWindow - spawnedInWindow;
    const toSpawn = Math.max(0, Math.min(need, 50)); // cap per frame to avoid jank
    for(let i=0;i<toSpawn;i++) spawnOne();
    spawnedInWindow += toSpawn;

    // move bubbles
    for(let i=bubbles.length-1;i>=0;i--){
      const b = bubbles[i];
      b.x += Math.cos(b.dir) * b.speed * (dt/1000);
      b.y += Math.sin(b.dir) * b.speed * (dt/1000);
      b.phase += b.wobbleFreq * (dt/1000);
      const wobble = Math.sin(b.phase) * b.wobbleAmp;
      b.x += wobble; b.y -= wobble*0.6;
      // clamp inside bounds
      if(b.x < b.r) { b.x = b.r; b.dir = Math.PI - b.dir; }
      if(b.x > cfg.cssW - b.r) { b.x = cfg.cssW - b.r; b.dir = Math.PI - b.dir; }
      if(b.y < b.r) { b.y = b.r; b.dir = -b.dir; }
      if(b.y > cfg.cssH - b.r) { b.y = cfg.cssH - b.r; b.dir = -b.dir; }
      // pop animation cleanup
      if(b.popT>0){ b.popT += dt; if(b.popT>160){ bubbles.splice(i,1); } }
    }

    // game over condition
    if(bubbles.length >= cfg.limit){ endGame(); }
  }

  function draw(){
    ctx.clearRect(0,0,cfg.cssW,cfg.cssH);
    // bubbles
    for(const b of bubbles){
      const alpha = b.popT>0 ? Math.max(0, 1 - b.popT/160) : 1;
      const scale = b.popT>0 ? (1 + Math.min(0.6, b.popT/200)) : 1;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(b.x, b.y);
      ctx.scale(scale, scale);
      // bubble body
      const grd = ctx.createRadialGradient(-b.r*0.4,-b.r*0.4,b.r*0.2, 0,0,b.r);
      grd.addColorStop(0,'#ffffff');
      grd.addColorStop(0.1,'#ffffff80');
      grd.addColorStop(0.11,b.color);
      grd.addColorStop(1,b.color);
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(0,0,b.r,0,Math.PI*2); ctx.fill();
      // highlight
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.beginPath(); ctx.ellipse(-b.r*0.35,-b.r*0.35,b.r*0.28,b.r*0.18,0,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }
  }

  function loop(ts){
    if(!running){ lastTs = ts; requestAnimationFrame(loop); return; }
    const dt = Math.min(66, ts - lastTs || 16);
    lastTs = ts;
    if(!paused){ elapsed += dt; update(dt); }
    hudTime.textContent = (elapsed/1000).toFixed(2)+'s';
    hudCount.textContent = String(bubbles.length);
    draw();
    requestAnimationFrame(loop);
  }

  function startGame(){
    bubbles.length = 0; spawnWindowIndex = 0; spawnedInWindow = 0;
    running = true; paused = false; startTime = performance.now(); elapsed = 0; lastTs = startTime;
    overlay.style.display = 'none';
  }
  function endGame(){
    if(!running) return; running = false;
    const timeMs = elapsed;
    // Best time
    const best = +(localStorage.getItem(BEST_KEY)||0);
    if(timeMs > best){ localStorage.setItem(BEST_KEY, String(timeMs)); bestEl.textContent = fmt(timeMs); }
    // Show overlay
    overlay.innerHTML = '<div class="card"><p class="big">Game Over</p><p class="small">Final Time: <b>' + (timeMs/1000).toFixed(2) + 's</b></p><button id="btn-again" class="btn">Play Again</button></div>';
    overlay.style.display = 'flex';
    document.getElementById('btn-again').addEventListener('click', startGame);
  }

  function togglePause(){ paused = !paused; btnPause.textContent = paused ? '▶ Resume (${escapeHtml(pauseKey)})' : '⏸ Pause (${escapeHtml(pauseKey)})'; }

  // input: click/tap to pop
  function handlePointer(x,y){
    // check from top-most bubble
    for(let i=bubbles.length-1;i>=0;i--){
      const b = bubbles[i];
      const dx = x - b.x, dy = y - b.y;
      if(dx*dx + dy*dy <= b.r*b.r){
        if(b.popT<=0){ b.popT = 1; popSound(); }
        break;
      }
    }
  }
  canvas.addEventListener('pointerdown', (e)=>{
    const rect = canvas.getBoundingClientRect();
    handlePointer(e.clientX - rect.left, e.clientY - rect.top);
  });

  // Pause hotkey
  window.addEventListener('keydown', (e)=>{
    if(e.key.toUpperCase() === cfg.pauseKey) togglePause();
  });

  btnStart.addEventListener('click', startGame);

  requestAnimationFrame(loop);
})();
</script>
</body></html>`
}

// small helpers
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
}
function escapeJs(s){
  return String(s).replace(/[\\'\n\r\t\u2028\u2029]/g, m => ({'\\':'\\\\','\'':'\\\'','\n':'\\n','\r':'\\r','\t':'\\t','\u2028':'\\u2028','\u2029':'\\u2029'}[m]));
}
