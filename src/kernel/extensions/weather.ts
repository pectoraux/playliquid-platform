/**
 * Weather Extension
 * ------------------
 * Cycles through weather states (sunny / rainy / stormy) at a configurable
 * interval. Outputs WeatherState each cycle. Other extensions (e.g. Farm)
 * can consume this to modify their behavior.
 *
 * Deterministic: the cycle is seeded by the session seed.
 */

import type { ExtensionManifest } from '../types';
import { T } from '../types';
import type { ExtensionFactory } from '../runtime';

export const weatherManifest: ExtensionManifest = {
  id: 'pl.weather',
  version: '0.1.0',
  slug: 'weather',
  name: 'Weather System',
  description: 'Cycles through sunny / rainy / stormy weather. Other extensions can react to weather changes.',
  author: 'playliquid',
  category: 'PHYSICS',
  kind: 'native-dsl',
  trustLevel: 'native',
  determinismMode: 'deterministic',
  inputs: [],
  outputs: [
    {
      name: 'weatherState',
      type: T.Record({
        condition: T.Enum(['sunny', 'rainy', 'stormy']),
        intensity: T.Number(),
        tick: T.Number(),
      }),
      description: 'Current weather conditions',
      required: false,
      cardinality: 'single',
    },
  ],
  permissions: { storage: ['session-state'] },
  capabilities: [],
  icon: '🌦️',
  tags: ['environment', 'weather', 'physics', 'atmosphere'],
  configSchema: [
    { key: 'cycleTicks', label: 'Weather Cycle', type: 'number', min: 3, max: 30, step: 1, default: 8, unit: 'ticks', description: 'How often the weather changes.' },
  ],
};

interface WeatherState {
  condition: 'sunny' | 'rainy' | 'stormy';
  intensity: number;
  tick: number;
  lastChangeTick: number;
  cycleTicks: number;
}

const CONDITIONS = ['sunny', 'rainy', 'stormy'] as const;

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(h, 31) + seed.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

export const weatherFactory: ExtensionFactory = (instanceId, config) => {
  const cycleTicks = (config?.cycleTicks as number) ?? 8;
  const seedNum = hashSeed(instanceId + 'weather');
  const startCondition = CONDITIONS[seedNum % 3];

  const state: WeatherState = {
    condition: startCondition,
    intensity: 0.5 + (seedNum % 10) / 20,
    tick: 0,
    lastChangeTick: 0,
    cycleTicks,
  };

  let rng = seedNum;
  function nextRand() {
    rng = (Math.imul(rng ^ (rng >>> 15), 1 | rng) | 0) + 0x6d2b79f5;
    rng = Math.imul(rng ^ (rng >>> 7), 61 | rng) ^ rng;
    return ((rng ^ (rng >>> 14)) >>> 0) / 4294967296;
  }

  return {
    instanceId,
    manifest: weatherManifest,
    state,
    update: (ctx) => {
      if (ctx.tick - state.lastChangeTick >= state.cycleTicks) {
        state.lastChangeTick = ctx.tick;
        const idx = Math.floor(nextRand() * 3);
        state.condition = CONDITIONS[idx];
        state.intensity = 0.3 + nextRand() * 0.7;
        ctx.emit('weatherState', {
          condition: state.condition,
          intensity: state.intensity,
          tick: ctx.tick,
        });
        ctx.log(`weather changed to ${state.condition} (intensity ${state.intensity.toFixed(2)})`);
      }
      state.tick = ctx.tick;
      ctx.setState({ ...state });
    },
  };
};
