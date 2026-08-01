/**
 * Farm Extension
 * ---------------
 * Periodically emits CORN tokens (every N ticks). Demonstrates an
 * unbounded-rate-limited mint policy.
 */

import type { ExtensionManifest, TokenDefinition } from '../types';
import { T } from '../types';
import type { ExtensionFactory } from '../runtime';

export const CORN_TOKEN: TokenDefinition = {
  symbol: 'CORN',
  name: 'Corn',
  scope: 'session',
  mintPolicy: { kind: 'unbounded-rate-limited', perSecond: 2 },
  description: 'Farm-produced corn. Rate-limited to 2/sec.',
};

export const farmManifest: ExtensionManifest = {
  id: 'pl.farm',
  version: '0.1.0',
  slug: 'farm',
  name: 'Farm',
  description: 'Produces CORN tokens at a steady rate. Demonstrates rate-limited minting.',
  author: 'playliquid',
  category: 'ECONOMY',
  kind: 'native-dsl',
  trustLevel: 'native',
  determinismMode: 'deterministic',
  inputs: [],
  outputs: [
    {
      name: 'farmTick',
      type: T.Record({ produced: T.Number(), total: T.Number() }),
      description: 'Emitted each production cycle',
      required: false,
      cardinality: 'single',
    },
  ],
  tokenDefinitions: [CORN_TOKEN],
  consumesTokens: [],
  permissions: { storage: ['session-state'] },
  capabilities: [],
  icon: '🌾',
  tags: ['economy', 'production', 'farming', 'token'],
  configSchema: [
    { key: 'intervalTicks', label: 'Production Interval', type: 'number', min: 1, max: 30, step: 1, default: 5, unit: 'ticks', description: 'How often the farm produces one CORN.' },
  ],
};

interface FarmState {
  totalProduced: number;
  lastProduceTick: number;
  intervalTicks: number;
}

export const farmFactory: ExtensionFactory = (instanceId, config) => {
  const interval = (config?.intervalTicks as number) ?? 5; // every 5 ticks
  const state: FarmState = {
    totalProduced: 0,
    lastProduceTick: 0,
    intervalTicks: interval,
  };

  return {
    instanceId,
    manifest: farmManifest,
    state,
    update: (ctx) => {
      if (ctx.tick - state.lastProduceTick >= state.intervalTicks) {
        state.lastProduceTick = ctx.tick;
        state.totalProduced += 1;
        ctx.emitToken('CORN', 1, `farm produced corn at tick ${ctx.tick}`);
        ctx.emit('farmTick', { produced: 1, total: state.totalProduced });
        ctx.log(`harvested corn (total: ${state.totalProduced})`);
      }
      ctx.setState({ ...state });
    },
  };
};
