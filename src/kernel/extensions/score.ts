/**
 * Score Extension
 * ----------------
 * Consumes MovementEvent, accumulates score based on distance traveled.
 * Emits ScoreChanged.
 */

import type { ExtensionManifest } from '../types';
import { T } from '../types';
import type { ExtensionFactory } from '../runtime';

export const scoreManifest: ExtensionManifest = {
  id: 'pl.score',
  version: '0.1.0',
  slug: 'score',
  name: 'Score',
  description: 'Accumulates score from movement events. Score = floor(distance * 10).',
  author: 'playliquid',
  category: 'MECHANIC',
  kind: 'native-dsl',
  trustLevel: 'native',
  determinismMode: 'deterministic',
  inputs: [
    {
      name: 'movementEvent',
      type: T.Record({
        type: T.Enum(['started', 'moved', 'stopped']),
        distance: T.Number(),
        dx: T.Number(),
        dy: T.Number(),
      }),
      description: 'Movement events to score',
      required: true,
      cardinality: 'single',
    },
  ],
  outputs: [
    {
      name: 'scoreChanged',
      type: T.Record({ score: T.Number(), delta: T.Number() }),
      description: 'Emitted whenever the score changes',
      required: false,
      cardinality: 'single',
    },
  ],
  permissions: { storage: ['session-state'] },
  capabilities: [],
};

interface ScoreState {
  score: number;
  events: number;
}

export const scoreFactory: ExtensionFactory = (instanceId, config) => {
  const pointsPerUnit = (config?.pointsPerUnit as number) ?? 10;
  const state: ScoreState = { score: 0, events: 0 };

  return {
    instanceId,
    manifest: scoreManifest,
    state,
    update: (ctx) => {
      const evt = ctx.inputs.movementEvent as
        | { type: string; distance: number; dx: number; dy: number }
        | undefined;
      if (!evt) return;

      state.events += 1;
      const delta = Math.floor(evt.distance * pointsPerUnit);
      if (delta > 0) {
        state.score += delta;
        ctx.emit('scoreChanged', { score: state.score, delta });
        ctx.log(`score +${delta} (now ${state.score})`, { event: evt.type, distance: evt.distance });
      }
      ctx.setState({ ...state });
    },
  };
};
