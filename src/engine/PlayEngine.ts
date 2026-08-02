/**
 * PlayEngine — PlayLiquid Game Engine
 * ------------------------------------
 * A real entity-component game engine for native PlayLiquid experiences.
 * Runs client-side on canvas. Powers actual playable games (not "canvas
 * with numbers").
 *
 * Capabilities:
 *   - Entity system (position, velocity, collider, sprite, lifetime)
 *   - Physics (gravity, velocity integration, AABB collision detection)
 *   - Sprite rendering (shapes, colors, gradients, particles)
 *   - Input (keyboard + touch, normalized to game-space)
 *   - Game loop (requestAnimationFrame, fixed timestep)
 *   - Spawning (entities created/destroyed during play)
 *   - Scoring + telemetry hooks
 *
 * The engine is pure TypeScript — no React, no DOM beyond canvas.
 * A React wrapper (GameCanvas) mounts it and handles lifecycle.
 */

// ─── Core Types ────────────────────────────────────────────────────────────

export interface Vec2 { x: number; y: number; }

export interface Entity {
  id: string;
  type: string;            // "player" | "enemy" | "collectible" | "obstacle" | "particle" | "ui"
  pos: Vec2;
  vel: Vec2;
  size: Vec2;              // width, height (AABB collider)
  color: string;
  visible: boolean;
  alive: boolean;
  // Custom per-entity data (spritesheet frame, health, spawn time, etc.)
  data?: Record<string, unknown>;
}

export interface GameConfig {
  width: number;           // game world width
  height: number;          // game world height
  bgColor: string;
  gravity?: number;
  // Spawn / difficulty parameters
  [key: string]: unknown;
}

export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  action: boolean;         // space / tap
  pointer: Vec2 | null;    // touch/mouse position in game space
  pointerDown: boolean;
}

export interface GameState {
  entities: Entity[];
  score: number;
  time: number;            // seconds elapsed
  status: 'loading' | 'playing' | 'won' | 'lost' | 'ended';
  coins: number;
  [key: string]: unknown;
}

export interface TelemetryEvent {
  name: string;
  value?: unknown;
  ts: number;
}

// ─── Entity factory helpers ────────────────────────────────────────────────

let entityIdCounter = 0;
export function createEntity(type: string, x: number, y: number, w: number, h: number, color = '#fff'): Entity {
  return {
    id: `e${entityIdCounter++}`,
    type,
    pos: { x, y },
    vel: { x: 0, y: 0 },
    size: { x: w, y: h },
    color,
    visible: true,
    alive: true,
  };
}

// ─── Collision detection (AABB) ────────────────────────────────────────────

export function aabb(a: Entity, b: Entity): boolean {
  return (
    a.pos.x < b.pos.x + b.size.x &&
    a.pos.x + a.size.x > b.pos.x &&
    a.pos.y < b.pos.y + b.size.y &&
    a.pos.y + a.size.y > b.pos.y
  );
}

// ─── The Engine ────────────────────────────────────────────────────────────

export interface GameCallbacks {
  onUpdate?: (state: GameState, dt: number, input: InputState, engine: PlayEngine) => void;
  onRender?: (ctx: CanvasRenderingContext2D, state: GameState) => void;
  onScore?: (score: number) => void;
  onEvent?: (event: TelemetryEvent) => void;
  onEnd?: (state: GameState) => void;
}

export class PlayEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config: GameConfig;
  private callbacks: GameCallbacks;
  private state: GameState;
  private input: InputState;
  private rafId: number | null = null;
  private lastTime = 0;
  private accumulator = 0;
  private readonly FIXED_DT = 1 / 60; // 60fps physics
  private running = false;
  private keyHandlers: { down: (e: KeyboardEvent) => void; up: (e: KeyboardEvent) => void };
  private pointerHandlers: { down: (e: PointerEvent) => void; move: (e: PointerEvent) => void; up: (e: PointerEvent) => void };

  constructor(canvas: HTMLCanvasElement, config: GameConfig, callbacks: GameCallbacks = {}) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot get 2D context');
    this.ctx = ctx;
    this.config = config;
    this.callbacks = callbacks;
    this.state = {
      entities: [],
      score: 0,
      time: 0,
      status: 'loading',
      coins: 0,
    };
    this.input = {
      left: false, right: false, up: false, down: false,
      action: false, pointer: null, pointerDown: false,
    };

    // Input handlers
    this.keyHandlers = {
      down: (e) => this.handleKey(e, true),
      up: (e) => this.handleKey(e, false),
    };
    this.pointerHandlers = {
      down: (e) => this.handlePointer(e, true),
      move: (e) => this.handlePointer(e, false),
      up: (e) => { this.input.pointerDown = false; },
    };
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────

  start() {
    if (this.running) return;
    this.running = true;
    this.state.status = 'playing';
    this.lastTime = performance.now();
    this.accumulator = 0;

    // Bind input
    window.addEventListener('keydown', this.keyHandlers.down);
    window.addEventListener('keyup', this.keyHandlers.up);
    this.canvas.addEventListener('pointerdown', this.pointerHandlers.down);
    this.canvas.addEventListener('pointermove', this.pointerHandlers.move);
    this.canvas.addEventListener('pointerup', this.pointerHandlers.up);

    this.emit({ name: 'game_start', ts: Date.now() });
    this.loop(this.lastTime);
  }

  stop() {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    window.removeEventListener('keydown', this.keyHandlers.down);
    window.removeEventListener('keyup', this.keyHandlers.up);
    this.canvas.removeEventListener('pointerdown', this.pointerHandlers.down);
    this.canvas.removeEventListener('pointermove', this.pointerHandlers.move);
    this.canvas.removeEventListener('pointerup', this.pointerHandlers.up);
  }

  // ── Game loop (fixed timestep) ─────────────────────────────────────────

  private loop = (now: number) => {
    if (!this.running) return;
    const frameTime = Math.min((now - this.lastTime) / 1000, 0.25);
    this.lastTime = now;
    this.accumulator += frameTime;

    while (this.accumulator >= this.FIXED_DT) {
      this.update(this.FIXED_DT);
      this.accumulator -= this.FIXED_DT;
    }

    this.render();
    this.rafId = requestAnimationFrame(this.loop);
  };

  private update(dt: number) {
    if (this.state.status !== 'playing') return;
    this.state.time += dt;

    // Physics: integrate velocity + gravity
    const gravity = this.config.gravity ?? 0;
    for (const e of this.state.entities) {
      if (!e.alive) continue;
      e.vel.y += gravity * dt;
      e.pos.x += e.vel.x * dt;
      e.pos.y += e.vel.y * dt;
    }

    // Custom update (wrapped in try/catch so a game bug doesn't kill the loop)
    try {
      this.callbacks.onUpdate?.(this.state, dt, this.input, this);
    } catch (err) {
      // Log but don't crash the loop
      console.error('[PlayEngine] update error:', err);
    }

    // Remove dead entities
    this.state.entities = this.state.entities.filter((e) => e.alive);

    // Check end conditions
    if (this.state.status === 'won' || this.state.status === 'lost') {
      this.end();
    }
  }

  private render() {
    const ctx = this.ctx;
    const { width, height } = this.config;
    // Scale canvas to match game world
    const scaleX = this.canvas.width / width;
    const scaleY = this.canvas.height / height;
    ctx.save();
    ctx.scale(scaleX, scaleY);

    // Background
    ctx.fillStyle = this.config.bgColor;
    ctx.fillRect(0, 0, width, height);

    // Render entities (default rendering)
    for (const e of this.state.entities) {
      if (!e.visible || !e.alive) continue;
      ctx.fillStyle = e.color;
      ctx.fillRect(e.pos.x, e.pos.y, e.size.x, e.size.y);
    }

    // Custom render overlay
    this.callbacks.onRender?.(ctx, this.state);

    ctx.restore();
  }

  // ── Entity management ──────────────────────────────────────────────────

  spawn(entity: Entity) {
    this.state.entities.push(entity);
  }

  spawnMany(entities: Entity[]) {
    this.state.entities.push(...entities);
  }

  findEntities(type: string): Entity[] {
    return this.state.entities.filter((e) => e.type === type && e.alive);
  }

  getEntity(id: string): Entity | undefined {
    return this.state.entities.find((e) => e.id === id);
  }

  // ── State helpers ──────────────────────────────────────────────────────

  addScore(delta: number) {
    this.state.score += delta;
    this.callbacks.onScore?.(this.state.score);
  }

  addCoin() {
    this.state.coins += 1;
  }

  emit(event: TelemetryEvent) {
    this.callbacks.onEvent?.(event);
  }

  end() {
    if (this.state.status === 'ended') return;
    this.state.status = 'ended';
    this.emit({ name: 'game_over', value: { score: this.state.score, time: this.state.time }, ts: Date.now() });
    this.callbacks.onEnd?.(this.state);
  }

  setState(updates: Partial<GameState>) {
    Object.assign(this.state, updates);
  }

  get currentState(): GameState {
    return this.state;
  }

  get currentInput(): InputState {
    return this.input;
  }

  // ── Input handlers ─────────────────────────────────────────────────────

  private handleKey(e: KeyboardEvent, pressed: boolean) {
    const k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a') { this.input.left = pressed; e.preventDefault(); }
    else if (k === 'arrowright' || k === 'd') { this.input.right = pressed; e.preventDefault(); }
    else if (k === 'arrowup' || k === 'w') { this.input.up = pressed; e.preventDefault(); }
    else if (k === 'arrowdown' || k === 's') { this.input.down = pressed; e.preventDefault(); }
    else if (k === ' ') { this.input.action = pressed; e.preventDefault(); }
  }

  private handlePointer(e: PointerEvent, isDown: boolean) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.config.width / rect.width;
    const scaleY = this.config.height / rect.height;
    this.input.pointer = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
    if (isDown) this.input.pointerDown = true;
  }
}

// ─── Rendering helpers ────────────────────────────────────────────────────

export function drawCircle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

export function drawCircleGlow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, glowColor?: string) {
  if (glowColor) {
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 2);
    grad.addColorStop(0, glowColor);
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

export function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, opts: { size?: number; color?: string; align?: CanvasTextAlign; font?: string } = {}) {
  ctx.fillStyle = opts.color ?? '#fff';
  ctx.font = `${opts.size ?? 14}px ${opts.font ?? 'monospace'}`;
  ctx.textAlign = opts.align ?? 'left';
  ctx.fillText(text, x, y);
}

export function drawTextCentered(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, opts: { size?: number; color?: string } = {}) {
  drawText(ctx, text, cx, y, { ...opts, align: 'center' });
}

// ─── RNG (seedable for deterministic experiences) ─────────────────────────

export function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h >>> 0;
}
