/**
 * Game Definitions — real playable games using PlayEngine
 * -------------------------------------------------------
 * Each game is a self-contained module that configures the PlayEngine
 * with spawn logic, update rules, rendering, and win/lose conditions.
 *
 * These are NOT "canvas with numbers" — they are real interactive games
 * with entities, physics, collisions, and mechanics.
 */

import { PlayEngine, createEntity, aabb, drawCircle, drawCircleGlow, drawText, drawTextCentered, mulberry32, hashSeed, type Entity, type GameConfig, type GameState, type InputState } from './PlayEngine';

export interface GameDefinition {
  id: string;
  name: string;
  description: string;
  config: GameConfig;
  init: (engine: PlayEngine, seed: string) => void;
  update: (state: GameState, dt: number, input: InputState, engine: PlayEngine) => void;
  render: (ctx: CanvasRenderingContext2D, state: GameState) => void;
  tags: string[];
  format: 'game';
}

// ─── Game 1: Neon Runner (real endless runner) ─────────────────────────────

export const neonRunner: GameDefinition = {
  id: 'neon-runner',
  name: 'Neon Runner',
  description: 'A fast-paced cyberpunk endless runner. Jump over obstacles, collect coins, survive as long as possible.',
  format: 'game',
  tags: ['action', 'runner', 'competitive'],
  config: {
    width: 800,
    height: 300,
    bgColor: '#0a0e1a',
    gravity: 1200,
    groundY: 250,
    speed: 300,
    spawnInterval: 1.5,
  },
  init: (engine, seed) => {
    const rng = mulberry32(hashSeed(seed));
    const cfg = engine['config' as keyof PlayEngine] as GameConfig;
    // Player
    const player = createEntity('player', 100, 200, 30, 40, '#3b82f6');
    player.data = { onGround: true, jumping: false };
    engine.spawn(player);
    // Ground line entity (for rendering reference)
    const ground = createEntity('ground', 0, 250, 800, 50, '#1a1a2e');
    engine.spawn(ground);
    // Initial coins
    for (let i = 0; i < 3; i++) {
      const coin = createEntity('coin', 400 + i * 150, 180 + rng() * 40, 16, 16, '#facc15');
      engine.spawn(coin);
    }
    engine.setState({ spawnTimer: 1.5, coinTimer: 2, distance: 0 });
  },
  update: (state, dt, input, engine) => {
    const player = engine.findEntities('player')[0];
    if (!player) return;
    const cfg = engine['config' as keyof PlayEngine] as GameConfig;
    const groundY = (cfg as any).groundY as number;
    const speed = (cfg as any).speed as number;

    // Jump
    if ((input.up || input.action) && player.data?.onGround) {
      player.vel.y = -550;
      (player.data as any).onGround = false;
      (player.data as any).jumping = true;
      engine.emit({ name: 'jump', ts: Date.now() });
    }

    // Ground collision
    if (player.pos.y + player.size.y >= groundY) {
      player.pos.y = groundY - player.size.y;
      player.vel.y = 0;
      (player.data as any).onGround = true;
    }

    // Distance + score
    const distance = ((state as any).distance ?? 0) + speed * dt;
    (state as any).distance = distance;
    engine.addScore(Math.floor(speed * dt * 0.1));

    // Spawn obstacles
    let spawnTimer = (state as any).spawnTimer ?? 1.5;
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      const obstacle = createEntity('obstacle', 850, groundY - 40, 25, 40, '#ef4444');
      obstacle.vel.x = -speed;
      engine.spawn(obstacle);
      spawnTimer = 1.2 + Math.random() * 1.5;
    }
    (state as any).spawnTimer = spawnTimer;

    // Spawn coins
    let coinTimer = (state as any).coinTimer ?? 2;
    coinTimer -= dt;
    if (coinTimer <= 0) {
      const coin = createEntity('coin', 850, 150 + Math.random() * 80, 16, 16, '#facc15');
      coin.vel.x = -speed;
      engine.spawn(coin);
      coinTimer = 1.5 + Math.random() * 2;
    }
    (state as any).coinTimer = coinTimer;

    // Move obstacles + coins leftward (they already have vel.x from spawn)
    // Physics handles movement; just check collisions
    const obstacles = engine.findEntities('obstacle');
    const coins = engine.findEntities('coin');
    for (const obs of obstacles) {
      if (aabb(player, obs)) {
        state.status = 'lost';
        return;
      }
      if (obs.pos.x < -50) obs.alive = false;
    }
    for (const coin of coins) {
      if (aabb(player, coin)) {
        coin.alive = false;
        engine.addScore(50);
        engine.addCoin();
        engine.emit({ name: 'coin_collected', value: { score: state.score }, ts: Date.now() });
      }
      if (coin.pos.x < -50) coin.alive = false;
    }

    // Increase speed over time
    (cfg as any).speed = speed + dt * 5;
  },
  render: (ctx, state) => {
    // Grid background
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < 800; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 300); ctx.stroke();
    }
    // Neon ground line
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 250);
    ctx.lineTo(800, 250);
    ctx.stroke();
    // Score
    drawText(ctx, `SCORE ${state.score}`, 10, 20, { size: 16, color: '#facc15' });
    drawText(ctx, `DIST ${Math.floor((state as any).distance ?? 0)}`, 10, 38, { size: 12, color: '#6b7280' });
    // Coins collected
    drawText(ctx, `🪙 ${state.coins}`, 700, 20, { size: 16, color: '#facc15', align: 'right' });
  },
};

// ─── Game 2: Sky Defender (tower defense shooter) ──────────────────────────

export const skyDefender: GameDefinition = {
  id: 'sky-defender',
  name: 'Sky Defender',
  description: 'Defend your city from waves of drones. Aim and shoot to survive increasing waves.',
  format: 'game',
  tags: ['action', 'shooter', 'defense', 'competitive'],
  config: {
    width: 600,
    height: 400,
    bgColor: '#0f172a',
    gravity: 0,
    waveTimer: 3,
    fireRate: 0.3,
  },
  init: (engine, _seed) => {
    // Player turret at bottom center
    const turret = createEntity('player', 280, 360, 40, 40, '#22d3ee');
    turret.data = { fireTimer: 0, angle: -Math.PI / 2 };
    engine.spawn(turret);
    engine.setState({ wave: 1, enemiesRemaining: 5, fireTimer: 0, spawnTimer: 2 });
  },
  update: (state, dt, input, engine) => {
    const turret = engine.findEntities('player')[0];
    if (!turret) return;

    // Aim turret toward pointer
    if (input.pointer) {
      const dx = input.pointer.x - (turret.pos.x + turret.size.x / 2);
      const dy = input.pointer.y - (turret.pos.y + turret.size.y / 2);
      (turret.data as any).angle = Math.atan2(dy, dx);
    }

    // Fire
    let fireTimer = (state as any).fireTimer ?? 0;
    fireTimer -= dt;
    if ((input.action || input.pointerDown) && fireTimer <= 0) {
      const angle = (turret.data as any).angle as number;
      const bullet = createEntity('bullet', turret.pos.x + 20, turret.pos.y + 20, 8, 8, '#fbbf24');
      bullet.vel.x = Math.cos(angle) * 500;
      bullet.vel.y = Math.sin(angle) * 500;
      engine.spawn(bullet);
      fireTimer = 0.25;
      engine.emit({ name: 'shot_fired', ts: Date.now() });
    }
    (state as any).fireTimer = fireTimer;

    // Spawn enemies (drones from top)
    let spawnTimer = (state as any).spawnTimer ?? 2;
    spawnTimer -= dt;
    const enemiesRemaining = (state as any).enemiesRemaining ?? 5;
    if (spawnTimer <= 0 && enemiesRemaining > 0) {
      const enemy = createEntity('enemy', Math.random() * 560, -30, 28, 28, '#ef4444');
      enemy.vel.y = 50 + state.wave * 10;
      enemy.vel.x = (Math.random() - 0.5) * 40;
      enemy.data = { hp: 1 + Math.floor(state.wave / 3) };
      engine.spawn(enemy);
      spawnTimer = Math.max(0.5, 2 - state.wave * 0.1);
      (state as any).enemiesRemaining = enemiesRemaining - 1;
    }
    (state as any).spawnTimer = spawnTimer;

    // Next wave
    if (enemiesRemaining <= 0 && engine.findEntities('enemy').length === 0) {
      state.wave += 1;
      (state as any).enemiesRemaining = 5 + state.wave * 2;
      (state as any).spawnTimer = 2;
      engine.emit({ name: 'wave_complete', value: { wave: state.wave }, ts: Date.now() });
    }

    // Bullet-enemy collisions
    const bullets = engine.findEntities('bullet');
    const enemies = engine.findEntities('enemy');
    for (const bullet of bullets) {
      if (bullet.pos.x < 0 || bullet.pos.x > 600 || bullet.pos.y < 0 || bullet.pos.y > 400) {
        bullet.alive = false;
        continue;
      }
      for (const enemy of enemies) {
        if (aabb(bullet, enemy)) {
          bullet.alive = false;
          const hp = ((enemy.data as any).hp ?? 1) - 1;
          if (hp <= 0) {
            enemy.alive = false;
            engine.addScore(100);
            engine.emit({ name: 'enemy_destroyed', value: { score: state.score }, ts: Date.now() });
          } else {
            (enemy.data as any).hp = hp;
          }
          break;
        }
      }
    }

    // Enemy reaches turret = game over
    for (const enemy of enemies) {
      if (enemy.pos.y > 380) {
        state.status = 'lost';
        return;
      }
    }
  },
  render: (ctx, state) => {
    // City silhouette
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 380, 600, 20);
    for (let i = 0; i < 8; i++) {
      const h = 15 + (i * 7) % 25;
      ctx.fillRect(i * 80, 380 - h, 50, h);
    }
    // Wave + score
    drawText(ctx, `WAVE ${state.wave}`, 10, 20, { size: 16, color: '#22d3ee' });
    drawText(ctx, `SCORE ${state.score}`, 10, 38, { size: 14, color: '#fbbf24' });
    drawText(ctx, `Enemies: ${engine_findEnemiesRemaining(state)}`, 490, 20, { size: 12, color: '#ef4444', align: 'right' });
  },
};

function engine_findEnemiesRemaining(state: GameState): number {
  return (state as any).enemiesRemaining ?? 0;
}

// ─── Game 3: Coin Rush (collectible collector) ─────────────────────────────

export const coinRush: GameDefinition = {
  id: 'coin-rush',
  name: 'Coin Rush',
  description: 'Collect as many coins as possible in 30 seconds. Avoid the bombs!',
  format: 'game',
  tags: ['arcade', 'collector', 'timed'],
  config: {
    width: 500,
    height: 400,
    bgColor: '#0a0a1a',
    gravity: 0,
    duration: 30,
  },
  init: (engine, _seed) => {
    const player = createEntity('player', 230, 180, 30, 30, '#3b82f6');
    engine.spawn(player);
    engine.setState({ spawnTimer: 0.5, timeLeft: 30 });
  },
  update: (state, dt, input, engine) => {
    const player = engine.findEntities('player')[0];
    if (!player) return;

    // Move player with input
    const speed = 250;
    if (input.left) player.pos.x -= speed * dt;
    if (input.right) player.pos.x += speed * dt;
    if (input.up) player.pos.y -= speed * dt;
    if (input.down) player.pos.y += speed * dt;
    // Clamp
    player.pos.x = Math.max(0, Math.min(470, player.pos.x));
    player.pos.y = Math.max(0, Math.min(370, player.pos.y));

    // Pointer follow
    if (input.pointer && input.pointerDown) {
      const dx = input.pointer.x - player.pos.x;
      const dy = input.pointer.y - player.pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 5) {
        player.pos.x += (dx / dist) * speed * dt;
        player.pos.y += (dy / dist) * speed * dt;
      }
    }

    // Timer
    let timeLeft = (state as any).timeLeft ?? 30;
    timeLeft -= dt;
    (state as any).timeLeft = timeLeft;
    if (timeLeft <= 0) {
      state.status = 'won';
      return;
    }

    // Spawn coins + bombs
    let spawnTimer = (state as any).spawnTimer ?? 0.5;
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      const isBomb = Math.random() < 0.2;
      const item = createEntity(
        isBomb ? 'bomb' : 'coin',
        Math.random() * 470,
        Math.random() * 370,
        20, 20,
        isBomb ? '#ef4444' : '#facc15',
      );
      item.data = { life: 5 };
      engine.spawn(item);
      spawnTimer = 0.4 + Math.random() * 0.6;
    }
    (state as any).spawnTimer = spawnTimer;

    // Collisions
    const coins = engine.findEntities('coin');
    const bombs = engine.findEntities('bomb');
    for (const coin of coins) {
      (coin.data as any).life -= dt;
      if ((coin.data as any).life <= 0) coin.alive = false;
      if (aabb(player, coin)) {
        coin.alive = false;
        engine.addScore(10);
        engine.addCoin();
      }
    }
    for (const bomb of bombs) {
      (bomb.data as any).life -= dt;
      if ((bomb.data as any).life <= 0) bomb.alive = false;
      if (aabb(player, bomb)) {
        bomb.alive = false;
        engine.addScore(-30);
        engine.emit({ name: 'bomb_hit', ts: Date.now() });
      }
    }
  },
  render: (ctx, state) => {
    const timeLeft = Math.ceil((state as any).timeLeft ?? 30);
    drawText(ctx, `⏱ ${timeLeft}s`, 10, 20, { size: 18, color: timeLeft <= 5 ? '#ef4444' : '#22d3ee' });
    drawText(ctx, `SCORE ${state.score}`, 10, 42, { size: 14, color: '#facc15' });
    drawText(ctx, `🪙 ${state.coins}`, 490, 20, { size: 14, color: '#facc15', align: 'right' });
  },
};

// ─── Game Registry ─────────────────────────────────────────────────────────

export const GAMES: Record<string, GameDefinition> = {
  'neon-runner': neonRunner,
  'sky-defender': skyDefender,
  'coin-rush': coinRush,
};

export function getGame(id: string): GameDefinition | undefined {
  return GAMES[id];
}

export function listGames(): GameDefinition[] {
  return Object.values(GAMES);
}
