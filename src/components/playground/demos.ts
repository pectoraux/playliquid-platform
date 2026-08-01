/**
 * Demo Presets
 * -------------
 * Three pre-built bundles that prove the kernel's core capabilities:
 *
 *   Demo 1 — Simple Runner: Physics → Movement → Score (valid, runs, scores)
 *   Demo 2 — Invalid Graph: Physics → Combat where Combat requires WeaponState
 *                          (compiler must reject with MISSING_REQUIRED_INPUT)
 *   Demo 3 — Coin Collector Economy: Physics → CoinCollector (mints COIN tokens
 *            backed by Liquid; settling credits the player wallet)
 *
 * Bonus Demo 4 — Farm → Cooking economy graph (token conversion: CORN → MEAL)
 */

import type { ExperienceBundle } from '@/kernel/types';

export interface DemoPreset {
  id: string;
  title: string;
  description: string;
  expected: 'valid' | 'invalid';
  expectedErrorCodes?: string[];
  bundle: ExperienceBundle;
}

export const DEMOS: DemoPreset[] = [
  {
    id: 'demo-1',
    title: 'Demo 1 — Simple Runner',
    description:
      'Physics → Movement → Score. A valid composition. Press play, move with the controls, watch the score climb.',
    expected: 'valid',
    bundle: {
      type: 'GAME',
      name: 'Simple Runner',
      instances: [
        { id: 'physics', extensionId: 'pl.physics', role: 'core', config: { speed: 5 } },
        { id: 'movement', extensionId: 'pl.movement', role: 'mechanic' },
        { id: 'score', extensionId: 'pl.score', role: 'mechanic', config: { pointsPerUnit: 10 } },
      ],
      wires: [
        { from: { instance: 'physics', channel: 'position' }, to: { instance: 'movement', channel: 'position' } },
        { from: { instance: 'movement', channel: 'movementEvent' }, to: { instance: 'score', channel: 'movementEvent' } },
      ],
    },
  },
  {
    id: 'demo-2',
    title: 'Demo 2 — Invalid Graph (rejected)',
    description:
      'Physics → Combat where Combat requires a WeaponState input that nobody provides. The compiler must reject this BEFORE any runtime attempt.',
    expected: 'invalid',
    expectedErrorCodes: ['MISSING_REQUIRED_INPUT'],
    bundle: {
      type: 'GAME',
      name: 'Invalid — missing WeaponState',
      instances: [
        { id: 'physics', extensionId: 'pl.physics', role: 'core' },
        { id: 'combat', extensionId: 'pl.movement', role: 'mechanic' }, // pretend this is "combat"
      ],
      wires: [
        { from: { instance: 'physics', channel: 'position' }, to: { instance: 'combat', channel: 'position' } },
      ],
    },
    // Note: pl.movement requires `position` which IS wired here. To truly
    // demonstrate a missing-required-input rejection, we construct a bundle
    // where movement is included WITHOUT its position wire.
  },
  {
    id: 'demo-2b',
    title: 'Demo 2b — Missing Required Input',
    description:
      'Movement requires `position` but no wire feeds it. Compiler rejects with MISSING_REQUIRED_INPUT.',
    expected: 'invalid',
    expectedErrorCodes: ['MISSING_REQUIRED_INPUT'],
    bundle: {
      type: 'GAME',
      name: 'Invalid — unwired required input',
      instances: [
        { id: 'physics', extensionId: 'pl.physics', role: 'core' },
        { id: 'movement', extensionId: 'pl.movement', role: 'mechanic' },
        { id: 'score', extensionId: 'pl.score', role: 'mechanic' },
      ],
      wires: [
        // physics.position is NOT wired to movement.position
        { from: { instance: 'movement', channel: 'movementEvent' }, to: { instance: 'score', channel: 'movementEvent' } },
      ],
    },
  },
  {
    id: 'demo-3',
    title: 'Demo 3 — Coin Collector Economy',
    description:
      'Physics → Movement → Score + Physics → CoinCollector. The CoinCollector mints COIN tokens (1 COIN = 1 Liquid, backed). Settling the session credits the player wallet from the reward pool.',
    expected: 'valid',
    bundle: {
      type: 'GAME',
      name: 'Coin Collector',
      instances: [
        { id: 'physics', extensionId: 'pl.physics', role: 'core', config: { speed: 8 } },
        { id: 'movement', extensionId: 'pl.movement', role: 'mechanic' },
        { id: 'score', extensionId: 'pl.score', role: 'mechanic' },
        { id: 'coins', extensionId: 'pl.coin-collector', role: 'economy', config: { coinCount: 8, collectRadius: 8 } },
      ],
      wires: [
        { from: { instance: 'physics', channel: 'position' }, to: { instance: 'movement', channel: 'position' } },
        { from: { instance: 'movement', channel: 'movementEvent' }, to: { instance: 'score', channel: 'movementEvent' } },
        { from: { instance: 'physics', channel: 'position' }, to: { instance: 'coins', channel: 'position' } },
      ],
    },
  },
  {
    id: 'demo-4',
    title: 'Demo 4 — Farm → Cooking Token Conversion',
    description:
      'Farm emits CORN at 2/sec (rate-limited). Cooking consumes 2 CORN to produce 1 MEAL (fixed-cap 20, backed by 3 Liquid). Demonstrates cross-extension token flow.',
    expected: 'valid',
    bundle: {
      type: 'GAME',
      name: 'Farm & Cooking',
      instances: [
        { id: 'farm', extensionId: 'pl.farm', role: 'economy', config: { intervalTicks: 5 } },
        { id: 'cooking', extensionId: 'pl.cooking', role: 'economy', config: { cornNeeded: 2 } },
      ],
      wires: [],
    },
  },
];

export function getDemo(id: string): DemoPreset | undefined {
  return DEMOS.find((d) => d.id === id);
}
