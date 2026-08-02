// Pixel Quest - a simple collector game
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let score = 0;
let player = { x: 240, y: 160, r: 10 };
let coins = [{ x: 100, y: 100 }, { x: 300, y: 200 }, { x: 200, y: 50 }];

window.addEventListener('message', (e) => {
  if (e.data.type === 'pl:input') {
    const a = e.data.payload.action;
    if (a === 'move-left') player.x -= 5;
    if (a === 'move-right') player.x += 5;
    if (a === 'move-up') player.y -= 5;
    if (a === 'move-down') player.y += 5;
  }
});

function loop() {
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, 480, 320);
  // coins
  ctx.fillStyle = '#facc15';
  coins = coins.filter(c => {
    const dx = c.x - player.x, dy = c.y - player.y;
    if (Math.sqrt(dx*dx + dy*dy) < 15) {
      score += 10;
      window.parent.postMessage({ type: 'pl:telemetry', event: { name: 'score_updated', value: score } }, '*');
      return false;
    }
    ctx.beginPath(); ctx.arc(c.x, c.y, 6, 0, Math.PI*2); ctx.fill();
    return true;
  });
  // player
  ctx.fillStyle = '#3b82f6';
  ctx.beginPath(); ctx.arc(player.x, player.y, 10, 0, Math.PI*2); ctx.fill();
  // score
  ctx.fillStyle = '#fff'; ctx.font = '14px monospace';
  ctx.fillText('Score: ' + score, 10, 20);
  requestAnimationFrame(loop);
}
loop();
window.parent.postMessage({ type: 'pl:telemetry', event: { name: 'game_start' } }, '*');
