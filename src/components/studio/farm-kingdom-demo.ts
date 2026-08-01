/**
 * Farm Kingdom Demo
 * ------------------
 * The canonical Studio demo experience. A complete farming economy + competition
 * graph that can be loaded, compiled, played, and published entirely through
 * Studio — no coding required.
 *
 * Graph:
 *   Weather → (affects) Farm → Cooking → Marketplace → Competition
 *
 * Token flow:
 *   CORN → MEAL → GOLD → leaderboard
 */

import type { ExperienceBundle, ExperienceIntent } from '@/kernel/types';

export const FARM_KINGDOM_BUNDLE: ExperienceBundle = {
  type: 'GAME',
  name: 'Farm Kingdom',
  instances: [
    { id: 'weather', extensionId: 'pl.weather', role: 'render', config: { cycleTicks: 8 } },
    { id: 'farm', extensionId: 'pl.farm', role: 'economy', config: { intervalTicks: 4 } },
    { id: 'cooking', extensionId: 'pl.cooking', role: 'economy', config: { cornNeeded: 2 } },
    { id: 'marketplace', extensionId: 'pl.marketplace', role: 'economy', config: { exchangeRate: 1, inputToken: 'MEAL' } },
    { id: 'competition', extensionId: 'pl.competition', role: 'social', config: { entryFee: 1, scorePerTrade: 15 } },
  ],
  wires: [
    { from: { instance: 'marketplace', channel: 'tradeCompleted' }, to: { instance: 'competition', channel: 'tradeEvent' } },
  ],
};

export const FARM_KINGDOM_INTENT: ExperienceIntent = {
  kind: 'GAME',
  emotions: ['mastery', 'strategy', 'competition'],
  goals: ['Build a thriving farm economy', 'Trade produce for gold', 'Climb the leaderboard'],
  audience: 'casual strategy players',
  description: 'A farming game where players grow crops, cook meals, trade at the marketplace, and compete for the highest score. Weather changes affect production. The economy flows: CORN → MEAL → GOLD → leaderboard.',
};

export const FARM_KINGDOM_DESCRIPTION = `Build a farming empire in Farm Kingdom!

Grow corn 🌾, cook meals 🍳, trade at the marketplace 🏪 for gold 🪙, and climb the competition leaderboard ⚔️.

Dynamic weather 🌦️ keeps every session fresh. The economy is fully on-chain via the Liquid ledger — every token has real value.

Created entirely with PlayLiquid Studio. No code.`;
