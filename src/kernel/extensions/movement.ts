/**
 * Movement Extension
 * -------------------
 * Consumes PlayerPosition, detects movement events (started, moved, stopped),
 * emits MovementEvent.
 */

import type { ExtensionManifest } from '../types';
import { T } from '../types';
import type { ExtensionFactory } from '../runtime';

export const movementManifest: ExtensionManifest = {
  id: 'pl.movement',
  version: '0.1.0',
  slug: 'movement',
  name: 'Movement',
  description: 'Observes position and emits movement events (started/moved/stopped).',
  author: 'playliquid',
  category: 'MECHANIC',
  kind: 'native-dsl',
  trustLevel: 'native',
  determinismMode: 'deterministic',
  inputs: [
    {
      name: 'position',
      type: T.Record({ x: T.Number(), y: T.Number(), vx: T.Number(), vy: T.Number() }),
      description: 'Player position from physics',
      required: true,
      cardinality: 'single',
    },
  ],
  outputs: [
    {
      name: 'movementEvent',
      type: T.Record({ type: T.Enum(['started', 'moved', 'stopped']), distance: T.Number(), dx: T.Number(), dy: T.Number() }),
      description: 'Movement event with distance traveled',
      required: false,
      cardinality: 'single',
    },
  ],
  permissions: { storage: ['session-state'] },
  capabilities: [],
  icon: '🚶',
  tags: ['movement', 'mechanic', 'detection'],
};

interface MovementState {
  lastX: number;
  lastY: number;
  wasMoving: boolean;
  totalDistance: number;
}

export const movementFactory: ExtensionFactory = () => {
  const state: MovementState = {
    lastX: 0,
    lastY: 0,
    wasMoving: false,
    totalDistance: 0,
  };

  return {
    instanceId: '',
    manifest: movementManifest,
    state,
    update: (ctx) => {
      const pos = ctx.inputs.position as { x: number; y: number; vx: number; vy: number } | undefined;
      if (!pos) return;

      const dx = pos.x - state.lastX;
      const dy = pos.y - state.lastY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const isMoving = Math.abs(pos.vx) > 0.001 || Math.abs(pos.vy) > 0.001;

      let type: 'started' | 'moved' | 'stopped' | null = null;
      if (isMoving && !state.wasMoving) type = 'started';
      else if (isMoving && state.wasMoving) type = 'moved';
      else if (!isMoving && state.wasMoving) type = 'stopped';

      if (type) {
        state.totalDistance += distance;
        ctx.emit('movementEvent', { type, distance, dx, dy });
      }

      state.lastX = pos.x;
      state.lastY = pos.y;
      state.wasMoving = isMoving;
      ctx.setState({ ...state });
    },
  };
};
