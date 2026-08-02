/**
 * Orb Collector — HTML5 Game for PlayLiquid ContainmentFrame
 * ----------------------------------------------------------
 * A standalone HTML5 canvas game that runs inside the PlayLiquid frame.
 *
 * Communication bridges:
 *   - Receives pl:input messages from the parent (keyboard/touch forwarded)
 *   - Sends pl:telemetry messages to the parent (score, events)
 *
 * Pure Canvas API + vanilla JavaScript. No frameworks.
 */

(function () {
  'use strict';

  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var scoreEl = document.getElementById('score');
  var timerEl = document.getElementById('timer');
  var overlay = document.getElementById('overlay');
  var overlayTitle = document.getElementById('overlay-title');
  var overlayText = document.getElementById('overlay-text');
  var startBtn = document.getElementById('start-btn');

  var W = canvas.width;
  var H = canvas.height;

  // ── Game state ──────────────────────────────────────────────────────────
  var player = { x: W / 2, y: H - 40, r: 12, vx: 0, speed: 5 };
  var orbs = [];
  var score = 0;
  var timeLeft = 30;
  var running = false;
  var rafId = null;
  var timerInterval = null;
  var spawnInterval = null;
  var keys = {};

  // ── PlayLiquid bridge: send telemetry to parent ────────────────────────
  function sendTelemetry(eventName, data) {
    try {
      window.parent.postMessage({
        type: 'pl:telemetry',
        event: { name: eventName, value: data, ts: Date.now() }
      }, '*');
    } catch (e) { /* not in iframe */ }
  }

  // ── PlayLiquid bridge: receive input from parent ────────────────────────
  window.addEventListener('message', function (event) {
    var msg = event.data;
    if (!msg || msg.type !== 'pl:input') return;
    var payload = msg.payload || {};
    if (payload.action === 'move-left') keys.left = payload.pressed !== false;
    if (payload.action === 'move-right') keys.right = payload.pressed !== false;
    if (payload.action === 'move-up') keys.up = payload.pressed !== false;
    if (payload.action === 'move-down') keys.down = payload.pressed !== false;
    if (payload.action === 'start' && !running) startGame();
  });

  // ── Keyboard input (direct, for standalone play) ───────────────────────
  window.addEventListener('keydown', function (e) {
    var k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a') keys.left = true;
    if (k === 'arrowright' || k === 'd') keys.right = true;
    if (k === 'arrowup' || k === 'w') keys.up = true;
    if (k === 'arrowdown' || k === 's') keys.down = true;
    if (k === ' ' && !running) startGame();
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].indexOf(e.key) >= 0) e.preventDefault();
  });
  window.addEventListener('keyup', function (e) {
    var k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a') keys.left = false;
    if (k === 'arrowright' || k === 'd') keys.right = false;
    if (k === 'arrowup' || k === 'w') keys.up = false;
    if (k === 'arrowdown' || k === 's') keys.down = false;
  });

  // ── Touch input (drag to move) ──────────────────────────────────────────
  var touchX = null;
  canvas.addEventListener('touchstart', function (e) {
    e.preventDefault();
    var rect = canvas.getBoundingClientRect();
    touchX = (e.touches[0].clientX - rect.left) * (W / rect.width);
  }, { passive: false });
  canvas.addEventListener('touchmove', function (e) {
    e.preventDefault();
    var rect = canvas.getBoundingClientRect();
    touchX = (e.touches[0].clientX - rect.left) * (W / rect.width);
  }, { passive: false });
  canvas.addEventListener('touchend', function () { touchX = null; });

  // ── Game logic ──────────────────────────────────────────────────────────
  function spawnOrb() {
    orbs.push({
      x: 20 + Math.random() * (W - 40),
      y: -10,
      r: 8,
      vy: 1.5 + Math.random() * 2,
      hue: 40 + Math.random() * 60, // yellow-orange
      collected: false
    });
  }

  function update() {
    // Player movement
    if (keys.left) player.vx = -player.speed;
    else if (keys.right) player.vx = player.speed;
    else player.vx *= 0.8;

    player.x += player.vx;
    if (touchX !== null) {
      var dx = touchX - player.x;
      player.x += dx * 0.2;
    }

    // Clamp
    if (player.x < player.r) player.x = player.r;
    if (player.x > W - player.r) player.x = W - player.r;

    // Orbs
    for (var i = 0; i < orbs.length; i++) {
      var orb = orbs[i];
      if (orb.collected) continue;
      orb.y += orb.vy;
      // Collision
      var ddx = orb.x - player.x;
      var ddy = orb.y - player.y;
      var dist = Math.sqrt(ddx * ddx + ddy * ddy);
      if (dist < orb.r + player.r) {
        orb.collected = true;
        score += 10;
        scoreEl.textContent = 'Score: ' + score;
        sendTelemetry('score_updated', score);
        sendTelemetry('orb_collected', { x: orb.x, y: orb.y });
      }
      // Missed (fell off bottom)
      if (orb.y > H + 20) {
        orb.collected = true;
        sendTelemetry('orb_missed', { x: orb.x });
      }
    }
    // Clean up
    orbs = orbs.filter(function (o) { return !o.collected; });
  }

  function draw() {
    // Background
    ctx.fillStyle = '#0a0e1a';
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.06)';
    ctx.lineWidth = 1;
    for (var x = 0; x <= W; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (var y = 0; y <= H; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Orbs
    for (var i = 0; i < orbs.length; i++) {
      var orb = orbs[i];
      // Glow
      var grad = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, 16);
      grad.addColorStop(0, 'hsla(' + orb.hue + ', 90%, 60%, 0.5)');
      grad.addColorStop(1, 'hsla(' + orb.hue + ', 90%, 60%, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(orb.x, orb.y, 16, 0, Math.PI * 2); ctx.fill();
      // Orb
      ctx.fillStyle = 'hsl(' + orb.hue + ', 90%, 55%)';
      ctx.beginPath(); ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'hsl(' + orb.hue + ', 90%, 35%)';
      ctx.lineWidth = 1.5; ctx.stroke();
    }

    // Player
    // Trail
    ctx.fillStyle = 'rgba(59, 130, 246, 0.12)';
    ctx.beginPath(); ctx.arc(player.x, player.y, 18, 0, Math.PI * 2); ctx.fill();
    // Body
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath(); ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1d4ed8';
    ctx.lineWidth = 2; ctx.stroke();
    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath(); ctx.arc(player.x - 3, player.y - 3, 4, 0, Math.PI * 2); ctx.fill();
  }

  function loop() {
    update();
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function startGame() {
    score = 0;
    timeLeft = 30;
    orbs = [];
    player.x = W / 2;
    running = true;
    overlay.classList.add('hidden');
    scoreEl.textContent = 'Score: 0';
    timerEl.textContent = 'Time: 30';
    sendTelemetry('game_start', { timestamp: Date.now() });

    // Start loops
    loop();
    timerInterval = setInterval(function () {
      timeLeft--;
      timerEl.textContent = 'Time: ' + timeLeft;
      if (timeLeft <= 0) endGame();
    }, 1000);
    spawnInterval = setInterval(spawnOrb, 600);
  }

  function endGame() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    if (timerInterval) clearInterval(timerInterval);
    if (spawnInterval) clearInterval(spawnInterval);
    sendTelemetry('game_over', { score: score, orbs: orbs.length });
    overlayTitle.textContent = 'Game Over';
    overlayText.textContent = 'Final score: ' + score;
    startBtn.textContent = 'Play Again';
    overlay.classList.remove('hidden');
  }

  // ── Init ────────────────────────────────────────────────────────────────
  draw(); // draw initial frame
  startBtn.addEventListener('click', startGame);

  // Notify parent that we're ready
  sendTelemetry('ready', { game: 'Orb Collector', version: '1.0.0' });

  // If inside PlayLiquid frame, auto-start after a short delay
  if (window.parent !== window) {
    setTimeout(function () {
      if (!running) startGame();
    }, 800);
  }
})();
