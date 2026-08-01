/**
 * Coin Collector Extension
 * -------------------------
 * Consumes PlayerPosition, emits a CoinCollected event whenever the player
 * crosses a "coin" location, and mints a COIN token.
 *
 * Coins are deterministic positions derived from the session seed, so attested
 * replays produce identical coin pickups.
 */

import type { ExtensionManifest, TokenDefinition } from '../types';
import { T } from '../types';
import type { ExtensionFactory } from '../runtime';

export const COIN_TOKEN: TokenDefinition = {
  symbol: 'COIN',
  name: 'Coin',
  scope: 'session',
  mintPolicy: { kind: 'fixed-cap', cap: 100 },
  liquidBackingMicro: 1_000_000, // 1 COIN = 1 Liquid (1,000,000 micro)
  description: 'In-session coin collected by the player. Settles to Liquid at session end.',
};

export const coinCollectorManifest: ExtensionManifest = {
  id: 'pl.coin-collector',
  version: '0.1.0',
  slug: 'coin-collector',
  name: 'Coin Collector',
  description: 'Spawns coins at deterministic positions; awards COIN tokens when collected.',
  author: 'playliquid',
  category: 'ECONOMY',
  kind: 'native-dsl',
  trustLevel: 'native',
  determinismMode: 'deterministic',
  inputs: [
    {
      name: 'position',
      type: T.Record({ x: T.Number(), y: T.Number(), vx: T.Number(), vy: T.Number() }),
      description: 'Player position',
      required: true,
      cardinality: 'single',
    },
  ],
  outputs: [
    {
      name: 'coinCollected',
      type: T.Record({ coinId: T.Number(), x: T.Number(), y: T.Number() }),
      description: 'Emitted when a coin is collected',
      required: false,
      cardinality: 'single',
    },
  ],
  tokenDefinitions: [COIN_TOKEN],
  consumesTokens: [],
  permissions: { storage: ['session-state'] },
  capabilities: [],
  icon: '🪙',
  tags: ['economy', 'collectible', 'reward', 'coins'],
  configSchema: [
    { key: 'coinCount', label: 'Coin Count', type: 'number', min: 1, max: 50, step: 1, default: 10, description: 'How many coins to spawn in the world.' },
    { key: 'collectRadius', label: 'Collect Radius', type: 'number', min: 1, max: 20, step: 1, default: 5, unit: 'units', description: 'How close the player must be to collect a coin.' },
  ],
};

interface Coin {
  id: number;
  x: number;
  y: number;
  collected: boolean;
}

interface CoinCollectorState {
  coins: Coin[];
  collected: number;
  handleAction: (action: string, payload?: unknown) => void;
}

/** Deterministic PRNG (mulberry32) — seeded so coin positions are reproducible */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h, 31) + seed.charCodeAt(i) | 0;
  }
  return h >>> 0;
}

export const coinCollectorFactory: ExtensionFactory = (instanceId, config) => {
  const coinCount = (config?.coinCount as number) ?? 10;
  const collectRadius = (config?.collectRadius as number) ?? 5;

  const state: CoinCollectorState = {
    coins: [],
    collected: 0,
    handleAction: () => {},
  };

  let initialized = false;

  return {
    instanceId,
    manifest: coinCollectorManifest,
    state,
    update: (ctx) => {
      // Lazy-init coins using the seed (deterministic)
      if (!initialized) {
        const seedNum = hashSeed(ctx.seed);
        const rng = mulberry32(seedNum);
        for (let i = 0; i < coinCount; i++) {
          state.coins.push({
            id: i,
            x: Math.floor(rng() * 90) + 5,
            y: Math.floor(rng() * 90) + 5,
            collected: false,
          });
        }
        initialized = true;
        ctx.log(`spawned ${coinCount} coins`, { seed: ctx.seed });
      }

      const pos = ctx.inputs.position as { x: number; y: number } | undefined;
      if (!pos) {
        ctx.setState({ ...state, coins: state.coins.map((c) => ({ ...c })) });
        return;
      }

      for (const coin of state.coins) {
        if (coin.collected) continue;
        const dx = pos.x - coin.x;
        const dy = pos.y - coin.y;
        if (Math.sqrt(dx * dx + dy * dy) <= collectRadius) {
          coin.collected = true;
          state.collected += 1;
          ctx.emit('coinCollected', { coinId: coin.id, x: coin.x, y: coin.y });
          ctx.emitToken('COIN', 1, `collected coin #${coin.id}`);
          ctx.log(`collected coin #${coin.id} at (${coin.x}, ${coin.y})`);
        }
      }

      ctx.setState({ ...state, coins: state.coins.map((c) => ({ ...c })) });
    },
  };
};
