/**
 * Spark Games — vertical, touch-native, instant mini-experiences
 * --------------------------------------------------------------
 * Each Spark is a complete playable game optimized for 9:16 mobile.
 * Touch-first: tap, swipe, drag. 5-90 second sessions.
 *
 * These are the YouTube Shorts of PlayLiquid — viral, instant, fun.
 */

import { PlayEngine, createEntity, aabb, drawCircle, drawCircleGlow, drawText, drawTextCentered, mulberry32, hashSeed, type Entity, type GameConfig, type GameState, type InputState } from '@/engine/PlayEngine';

export interface SparkDefinition {
  id: string;
  name: string;
  description: string;
  config: GameConfig;
  init: (engine: PlayEngine, seed: string) => void;
  update: (state: GameState, dt: number, input: InputState, engine: PlayEngine) => void;
  render: (ctx: CanvasRenderingContext2D, state: GameState) => void;
  tags: string[];
  format: 'spark';
  duration: number; // max seconds
}

// ─── Spark 1: Catch the Stars ──────────────────────────────────────────────

export const catchTheStars: SparkDefinition = {
  id: 'catch-stars',
  name: 'Catch the Stars',
  description: 'Move your basket to catch falling stars. Miss 3 and it\'s over!',
  format: 'spark',
  tags: ['arcade', 'casual', 'one-thumb'],
  duration: 60,
  config: {
    width: 360,
    height: 640,
    bgColor: '#0c0a1a',
    gravity: 0,
  },
  init: (engine, _seed) => {
    const basket = createEntity('basket', 140, 580, 80, 20, '#fbbf24');
    engine.spawn(basket);
    engine.setState({ spawnTimer: 0.8, missed: 0, maxMissed: 3 });
  },
  update: (state, dt, input, engine) => {
    const basket = engine.findEntities('basket')[0];
    if (!basket) return;

    // Move basket with pointer (drag) or arrow keys
    if (input.pointer && input.pointerDown) {
      basket.pos.x = Math.max(0, Math.min(280, input.pointer.x - 40));
    }
    if (input.left) basket.pos.x = Math.max(0, basket.pos.x - 300 * dt);
    if (input.right) basket.pos.x = Math.min(280, basket.pos.x + 300 * dt);

    // Spawn stars
    let spawnTimer = (state as any).spawnTimer ?? 0.8;
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      const star = createEntity('star', Math.random() * 340, -20, 20, 20, '#fde047');
      star.vel.y = 120 + Math.random() * 80;
      engine.spawn(star);
      spawnTimer = 0.5 + Math.random() * 0.5;
    }
    (state as any).spawnTimer = spawnTimer;

    // Collision: basket catches star
    const stars = engine.findEntities('star');
    for (const star of stars) {
      if (star.pos.y > 640) {
        star.alive = false;
        const missed = ((state as any).missed ?? 0) + 1;
        (state as any).missed = missed;
        if (missed >= (state as any).maxMissed) {
          state.status = 'lost';
          return;
        }
      }
      if (aabb(basket, star)) {
        star.alive = false;
        engine.addScore(10);
        engine.emit({ name: 'star_caught', value: { score: state.score }, ts: Date.now() });
      }
    }
  },
  render: (ctx, state) => {
    // Starfield background
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    for (let i = 0; i < 20; i++) {
      const x = (i * 37) % 360;
      const y = (i * 71) % 640;
      ctx.fillRect(x, y, 2, 2);
    }
    // Render stars as glowing circles
    for (const e of state.entities) {
      if (e.type === 'star' && e.alive) {
        drawCircleGlow(ctx, e.pos.x + 10, e.pos.y + 10, 8, '#fde047', 'rgba(253,224,71,0.4)');
      }
    }
    drawText(ctx, `⭐ ${state.score}`, 10, 25, { size: 18, color: '#fde047' });
    const missed = (state as any).missed ?? 0;
    drawText(ctx, `❌ ${missed}/3`, 350, 25, { size: 14, color: '#ef4444', align: 'right' });
  },
};

// ─── Spark 2: Reaction Challenge ───────────────────────────────────────────

export const reactionChallenge: SparkDefinition = {
  id: 'reaction-challenge',
  name: 'Reaction Challenge',
  description: 'Tap the instant the screen turns green. How fast are your reflexes?',
  format: 'spark',
  tags: ['reflex', 'competitive', 'instant'],
  duration: 45,
  config: {
    width: 360,
    height: 640,
    bgColor: '#1a1a2e',
    gravity: 0,
  },
  init: (engine, _seed) => {
    engine.setState({ phase: 'wait', waitTimer: 1 + Math.random() * 2, reactionTime: 0, streak: 0, bestTime: 999 });
  },
  update: (state, dt, input, engine) => {
    const phase = (state as any).phase as string;
    if (phase === 'wait') {
      let waitTimer = (state as any).waitTimer ?? 1;
      waitTimer -= dt;
      (state as any).waitTimer = waitTimer;
      if (waitTimer <= 0) {
        (state as any).phase = 'go';
        (state as any).goTime = state.time;
      }
      // Tap too early = penalty
      if (input.action || (input.pointerDown)) {
        (state as any).phase = 'early';
        (state as any).streak = 0;
        engine.emit({ name: 'too_early', ts: Date.now() });
      }
    } else if (phase === 'go') {
      // Waiting for tap
      if (input.action || input.pointerDown) {
        const rt = Math.round((state.time - (state as any).goTime) * 1000);
        (state as any).reactionTime = rt;
        const streak = ((state as any).streak ?? 0) + 1;
        (state as any).streak = streak;
        const best = Math.min((state as any).bestTime ?? 999, rt);
        (state as any).bestTime = best;
        engine.addScore(Math.max(0, 500 - rt));
        engine.emit({ name: 'reaction', value: { ms: rt, streak }, ts: Date.now() });
        (state as any).phase = 'result';
        (state as any).resultTimer = 1.5;
      }
    } else if (phase === 'result') {
      let t = (state as any).resultTimer ?? 1.5;
      t -= dt;
      (state as any).resultTimer = t;
      if (t <= 0) {
        (state as any).phase = 'wait';
        (state as any).waitTimer = 1 + Math.random() * 2;
      }
    } else if (phase === 'early') {
      let t = (state as any).resultTimer ?? 1.5;
      t -= dt;
      (state as any).resultTimer = t;
      if (t <= 0) {
        (state as any).phase = 'wait';
        (state as any).waitTimer = 1 + Math.random() * 2;
      }
    }
  },
  render: (ctx, state) => {
    const phase = (state as any).phase as string;
    const W = 360, H = 640;
    if (phase === 'wait') {
      ctx.fillStyle = '#7f1d1d';
      ctx.fillRect(0, 0, W, H);
      drawTextCentered(ctx, 'WAIT...', W / 2, H / 2, { size: 28, color: '#fff' });
      drawTextCentered(ctx, 'Don\'t tap yet!', W / 2, H / 2 + 30, { size: 14, color: '#fca5a5' });
    } else if (phase === 'go') {
      ctx.fillStyle = '#14532d';
      ctx.fillRect(0, 0, W, H);
      drawTextCentered(ctx, 'TAP NOW!', W / 2, H / 2, { size: 32, color: '#4ade80' });
    } else if (phase === 'result') {
      ctx.fillStyle = '#1e3a5f';
      ctx.fillRect(0, 0, W, H);
      const rt = (state as any).reactionTime as number;
      drawTextCentered(ctx, `${rt}ms`, W / 2, H / 2 - 20, { size: 40, color: '#fbbf24' });
      drawTextCentered(ctx, `Streak: ${(state as any).streak}`, W / 2, H / 2 + 20, { size: 16, color: '#fff' });
      drawTextCentered(ctx, `Best: ${(state as any).bestTime}ms`, W / 2, H / 2 + 44, { size: 14, color: '#94a3b8' });
    } else if (phase === 'early') {
      ctx.fillStyle = '#581c87';
      ctx.fillRect(0, 0, W, H);
      drawTextCentered(ctx, 'TOO EARLY!', W / 2, H / 2, { size: 26, color: '#e9d5ff' });
      drawTextCentered(ctx, 'Streak reset', W / 2, H / 2 + 30, { size: 14, color: '#c084fc' });
    }
    drawText(ctx, `SCORE ${state.score}`, 10, 25, { size: 16, color: '#fff' });
  },
};

// ─── Spark 3: Tap Pet ──────────────────────────────────────────────────────

export const tapPet: SparkDefinition = {
  id: 'tap-pet',
  name: 'Tap Pet',
  description: 'Keep your virtual pet happy! Feed it, play with it, watch it grow.',
  format: 'spark',
  tags: ['casual', 'virtual-pet', 'wholesome'],
  duration: 90,
  config: {
    width: 360,
    height: 640,
    bgColor: '#1e1b4b',
    gravity: 0,
  },
  init: (engine, _seed) => {
    const pet = createEntity('pet', 150, 280, 60, 60, '#fbbf24');
    pet.data = { happiness: 50, hunger: 30, bounce: 0 };
    engine.spawn(pet);
    // Food button
    const foodBtn = createEntity('food-btn', 60, 540, 80, 60, '#22c55e');
    engine.spawn(foodBtn);
    // Play button
    const playBtn = createEntity('play-btn', 220, 540, 80, 60, '#3b82f6');
    engine.spawn(playBtn);
    engine.setState({ decayTimer: 1 });
  },
  update: (state, dt, input, engine) => {
    const pet = engine.findEntities('pet')[0];
    if (!pet) return;

    // Bounce animation
    (pet.data as any).bounce = Math.sin(state.time * 3) * 5;
    pet.pos.y = 280 + (pet.data as any).bounce;

    // Decay happiness + increase hunger over time
    let decayTimer = (state as any).decayTimer ?? 1;
    decayTimer -= dt;
    if (decayTimer <= 0) {
      (pet.data as any).happiness = Math.max(0, (pet.data as any).happiness - 2);
      (pet.data as any).hunger = Math.min(100, (pet.data as any).hunger + 3);
      decayTimer = 1;
    }
    (state as any).decayTimer = decayTimer;

    // Feed button
    const foodBtn = engine.findEntities('food-btn')[0];
    const playBtn = engine.findEntities('play-btn')[0];

    if ((input.action || input.pointerDown) && input.pointer) {
      if (foodBtn && aabbPoint(input.pointer, foodBtn)) {
        (pet.data as any).hunger = Math.max(0, (pet.data as any).hunger - 20);
        (pet.data as any).happiness = Math.min(100, (pet.data as any).happiness + 5);
        engine.addScore(5);
        engine.emit({ name: 'fed', ts: Date.now() });
      } else if (playBtn && aabbPoint(input.pointer, playBtn)) {
        (pet.data as any).happiness = Math.min(100, (pet.data as any).happiness + 15);
        engine.addScore(10);
        engine.emit({ name: 'played', ts: Date.now() });
      } else if (aabbPoint(input.pointer, pet)) {
        // Petting
        (pet.data as any).happiness = Math.min(100, (pet.data as any).happiness + 3);
        engine.addScore(2);
      }
    }

    // Win condition: survive 60s with happiness > 30
    if (state.time > 60 && (pet.data as any).happiness > 30) {
      state.status = 'won';
    }
    // Lose: happiness hits 0
    if ((pet.data as any).happiness <= 0) {
      state.status = 'lost';
    }
  },
  render: (ctx, state) => {
    const pet = state.entities.find((e) => e.type === 'pet');
    if (!pet) return;
    const happiness = (pet.data as any).happiness as number;
    const hunger = (pet.data as any).hunger as number;

    // Mood-based pet color
    const petColor = happiness > 60 ? '#fbbf24' : happiness > 30 ? '#fb923c' : '#ef4444';

    // Pet body (circle)
    drawCircleGlow(ctx, pet.pos.x + 30, pet.pos.y + 30, 28, petColor, `${petColor}40`);
    // Eyes
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(pet.pos.x + 20, pet.pos.y + 22, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(pet.pos.x + 40, pet.pos.y + 22, 4, 0, Math.PI * 2); ctx.fill();
    // Mouth (smile or frown)
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (happiness > 40) {
      ctx.arc(pet.pos.x + 30, pet.pos.y + 32, 8, 0, Math.PI);
    } else {
      ctx.arc(pet.pos.x + 30, pet.pos.y + 42, 8, Math.PI, Math.PI * 2);
    }
    ctx.stroke();

    // Status bars
    drawBar(ctx, 20, 20, 150, 12, happiness / 100, '#22c55e', 'Happiness');
    drawBar(ctx, 20, 40, 150, 12, hunger / 100, '#ef4444', 'Hunger');

    drawText(ctx, `Score: ${state.score}`, 250, 30, { size: 14, color: '#fff' });

    // Buttons
    const foodBtn = state.entities.find((e) => e.type === 'food-btn');
    const playBtn = state.entities.find((e) => e.type === 'play-btn');
    if (foodBtn) {
      drawTextCentered(ctx, '🍖', foodBtn.pos.x + 40, foodBtn.pos.y + 38, { size: 24 });
      drawTextCentered(ctx, 'FEED', foodBtn.pos.x + 40, foodBtn.pos.y + 54, { size: 10, color: '#22c55e' });
    }
    if (playBtn) {
      drawTextCentered(ctx, '🎾', playBtn.pos.x + 40, playBtn.pos.y + 38, { size: 24 });
      drawTextCentered(ctx, 'PLAY', playBtn.pos.x + 40, playBtn.pos.y + 54, { size: 10, color: '#3b82f6' });
    }
  },
};

function aabbPoint(p: { x: number; y: number }, e: Entity): boolean {
  return p.x >= e.pos.x && p.x <= e.pos.x + e.size.x && p.y >= e.pos.y && p.y <= e.pos.y + e.size.y;
}

function drawBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, pct: number, color: string, label: string) {
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, pct)), h);
  ctx.fillStyle = '#fff';
  ctx.font = '9px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(label, x, y - 2);
}

// ─── Spark Registry ────────────────────────────────────────────────────────

export const SPARKS: Record<string, SparkDefinition> = {
  'catch-stars': catchTheStars,
  'reaction-challenge': reactionChallenge,
  'tap-pet': tapPet,
};

export function getSpark(id: string): SparkDefinition | undefined {
  return SPARKS[id];
}

export function listSparks(): SparkDefinition[] {
  return Object.values(SPARKS);
}
