/**
 * Phase 20.5 — Native Runtime Adapter (client-side)
 * -----------------------------------------------
 * Manages a kernel session from the browser. The kernel itself runs
 * server-side (in-memory session registry); this adapter drives it via
 * the HTTP API and exposes a simple game-loop interface to the renderer.
 *
 *   initialize()  → POST /api/kernel/sessions        (compile + start)
 *   tick()        → POST /api/kernel/sessions/:id/tick (advance + snapshot)
 *   sendInput()   → POST /api/kernel/sessions/:id/action
 *   getSnapshot() → GET  /api/kernel/sessions/:id/inspector
 *   destroy()     → POST /api/kernel/sessions/:id/settle
 *
 * The adapter is runtime-agnostic about WHAT it renders — it just
 * exposes the inspector snapshot (instance states + score + tick).
 */

import type { ExperienceBundle } from '@/kernel/types';

export interface InstanceState {
  id: string;
  extensionId: string;
  name: string;
  category: string;
  state: unknown;
}

export interface InspectorSnapshot {
  sessionId: string;
  tick: number;
  status: 'ACTIVE' | 'ENDED' | 'SUSPENDED';
  instances: InstanceState[];
  tokenBalances: Record<string, number>;
  recentEvents: unknown[];
  executionOrder: string[];
  score: number;
}

export class NativeRuntimeAdapter {
  private sessionId: string | null = null;
  private experienceId: string;
  private bundle: ExperienceBundle;
  private userId?: string;
  private mode: 'PREVIEW' | 'EARN';

  constructor(params: {
    experienceId: string;
    bundle: ExperienceBundle;
    userId?: string;
    mode?: 'PREVIEW' | 'EARN';
  }) {
    this.experienceId = params.experienceId;
    this.bundle = params.bundle;
    this.userId = params.userId;
    this.mode = params.mode ?? 'PREVIEW';
  }

  /** Start the kernel session. Returns the sessionId. */
  async initialize(): Promise<{ sessionId: string; valid: boolean; error?: string }> {
    const res = await fetch('/api/kernel/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        experienceId: this.experienceId,
        bundle: this.bundle,
        mode: this.mode,
        userId: this.userId,
      }),
    });
    const data = await res.json();
    if (!data.valid) {
      return { sessionId: '', valid: false, error: data.errors?.[0]?.message ?? 'compile failed' };
    }
    this.sessionId = data.sessionId;
    return { sessionId: data.sessionId, valid: true };
  }

  /** Advance the session by N ticks and return the snapshot. */
  async tick(ticks = 1): Promise<InspectorSnapshot | null> {
    if (!this.sessionId) return null;
    const res = await fetch(`/api/kernel/sessions/${this.sessionId}/tick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticks }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.snapshot ?? null;
  }

  /** Send a user input action (e.g. move-up) to a specific instance. */
  async sendInput(instanceId: string, action: string, payload?: unknown): Promise<void> {
    if (!this.sessionId) return;
    await fetch(`/api/kernel/sessions/${this.sessionId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instanceId, action, payload }),
    });
  }

  /** Get the current snapshot without ticking. */
  async getSnapshot(): Promise<InspectorSnapshot | null> {
    if (!this.sessionId) return null;
    const res = await fetch(`/api/kernel/sessions/${this.sessionId}/inspector`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.snapshot ?? null;
  }

  /** End the session and settle telemetry. */
  async destroy(reason: 'completed' | 'manual' = 'manual'): Promise<void> {
    if (!this.sessionId) return;
    try {
      await fetch(`/api/kernel/sessions/${this.sessionId}/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
    } catch { /* ignore */ }
    this.sessionId = null;
  }

  get isRunning(): boolean {
    return this.sessionId !== null;
  }

  get currentSessionId(): string | null {
    return this.sessionId;
  }
}

// ─── Helpers: extract game state from the inspector snapshot ───────────────

export interface NativeGameState {
  player: { x: number; y: number; vx: number; vy: number } | null;
  coins: Array<{ id: number; x: number; y: number; collected: boolean }>;
  score: number;
  tick: number;
  tokenBalances: Record<string, number>;
  status: 'ACTIVE' | 'ENDED' | 'SUSPENDED';
}

/** Extract a renderable game state from the inspector snapshot. */
export function extractGameState(snapshot: InspectorSnapshot): NativeGameState {
  let player: NativeGameState['player'] = null;
  let coins: NativeGameState['coins'] = [];

  for (const inst of snapshot.instances) {
    const state = inst.state as Record<string, unknown> | null;
    if (!state) continue;

    if (inst.extensionId === 'pl.physics') {
      player = {
        x: Number(state.x ?? 0),
        y: Number(state.y ?? 0),
        vx: Number(state.vx ?? 0),
        vy: Number(state.vy ?? 0),
      };
    }

    if (inst.extensionId === 'pl.coin-collector') {
      const coinArr = state.coins as Array<{ id: number; x: number; y: number; collected: boolean }> | undefined;
      if (Array.isArray(coinArr)) {
        coins = coinArr;
      }
    }
  }

  return {
    player,
    coins,
    score: snapshot.score,
    tick: snapshot.tick,
    tokenBalances: snapshot.tokenBalances,
    status: snapshot.status,
  };
}
