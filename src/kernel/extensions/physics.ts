/**
 * Physics Extension
 * ------------------
 * Maintains player position with velocity. Outputs PlayerPosition each tick.
 * Accepts movement actions (up/down/left/right) via handleAction.
 *
 * State:
 *   { x, y, vx, vy, speed, handleAction }
 */

import type { ExtensionManifest } from '../types';
import { T } from '../types';
import type { ExtensionFactory } from '../runtime';

export const physicsManifest: ExtensionManifest = {
  id: 'pl.physics',
  version: '0.1.0',
  slug: 'physics',
  name: 'Physics',
  description: 'Maintains player position with velocity. Outputs PlayerPosition every tick.',
  author: 'playliquid',
  category: 'PHYSICS',
  kind: 'native-dsl',
  trustLevel: 'native',
  determinismMode: 'deterministic',
  inputs: [],
  outputs: [
    {
      name: 'position',
      type: T.Record({ x: T.Number(), y: T.Number(), vx: T.Number(), vy: T.Number() }),
      description: 'Current player position and velocity',
      required: false,
      cardinality: 'single',
    },
  ],
  permissions: { storage: ['session-state'] },
  capabilities: ['pause', 'saveState', 'restoreState'],
};

interface PhysicsState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  pendingDx: number;
  pendingDy: number;
  handleAction: (action: string, payload?: unknown) => void;
}

export const physicsFactory: ExtensionFactory = (instanceId, config) => {
  const startSpeed = (config?.speed as number) ?? 1;

  const state: PhysicsState = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    speed: startSpeed,
    pendingDx: 0,
    pendingDy: 0,
    handleAction: (action: string) => {
      if (action === 'move') {
        // payload = { dx, dy }
      } else if (action === 'move-up') state.pendingDy -= 1;
      else if (action === 'move-down') state.pendingDy += 1;
      else if (action === 'move-left') state.pendingDx -= 1;
      else if (action === 'move-right') state.pendingDx += 1;
    },
  };

  return {
    instanceId,
    manifest: physicsManifest,
    state,
    update: (ctx) => {
      // Apply pending movement as velocity
      state.vx = state.pendingDx * state.speed;
      state.vy = state.pendingDy * state.speed;
      state.x += state.vx;
      state.y += state.vy;
      // Reset pending (consumed this tick)
      state.pendingDx = 0;
      state.pendingDy = 0;

      // Keep within a virtual world bounds
      if (state.x < 0) state.x = 0;
      if (state.x > 100) state.x = 100;
      if (state.y < 0) state.y = 0;
      if (state.y > 100) state.y = 100;

      ctx.setState({ ...state });
      ctx.emit('position', { x: state.x, y: state.y, vx: state.vx, vy: state.vy });
    },
  };
};
