/**
 * Cooking Extension
 * ------------------
 * Consumes CORN tokens and produces MEAL tokens. Demonstrates cross-extension
 * token flow: Farm emits CORN → Cooking consumes CORN → Cooking emits MEAL.
 */

import type { ExtensionManifest, TokenDefinition } from '../types';
import { T } from '../types';
import type { ExtensionFactory } from '../runtime';

export const MEAL_TOKEN: TokenDefinition = {
  symbol: 'MEAL',
  name: 'Meal',
  scope: 'session',
  mintPolicy: { kind: 'fixed-cap', cap: 20 },
  liquidBackingMicro: 3_000_000, // 1 MEAL = 3 Liquid
  description: 'Cooked meal. Backed by 3 Liquid.',
};

export const cookingManifest: ExtensionManifest = {
  id: 'pl.cooking',
  version: '0.1.0',
  slug: 'cooking',
  name: 'Cooking',
  description: 'Consumes 2 CORN to produce 1 MEAL. Demonstrates token conversion.',
  author: 'playliquid',
  category: 'ECONOMY',
  kind: 'native-dsl',
  trustLevel: 'native',
  determinismMode: 'deterministic',
  inputs: [],
  outputs: [
    {
      name: 'mealCooked',
      type: T.Record({ mealId: T.Number(), cornUsed: T.Number() }),
      description: 'Emitted when a meal is cooked',
      required: false,
      cardinality: 'single',
    },
  ],
  tokenDefinitions: [MEAL_TOKEN],
  consumesTokens: ['CORN'],
  permissions: { storage: ['session-state'] },
  capabilities: [],
};

interface CookingState {
  mealsCooked: number;
  cornUsed: number;
  cornNeeded: number;
  mealIdCounter: number;
}

export const cookingFactory: ExtensionFactory = (instanceId, config) => {
  const cornNeeded = (config?.cornNeeded as number) ?? 2;
  const state: CookingState = {
    mealsCooked: 0,
    cornUsed: 0,
    cornNeeded,
    mealIdCounter: 0,
  };

  return {
    instanceId,
    manifest: cookingManifest,
    state,
    update: (ctx) => {
      const balance = ctx.tokenBalance('CORN');
      if (balance >= state.cornNeeded) {
        ctx.consumeToken('CORN', state.cornNeeded, `cooking meal #${state.mealIdCounter + 1}`);
        state.mealIdCounter += 1;
        state.mealsCooked += 1;
        state.cornUsed += state.cornNeeded;
        ctx.emitToken('MEAL', 1, `cooked meal #${state.mealIdCounter}`);
        ctx.emit('mealCooked', { mealId: state.mealIdCounter, cornUsed: state.cornNeeded });
        ctx.log(`cooked meal #${state.mealIdCounter} (used ${state.cornNeeded} CORN)`);
      }
      ctx.setState({ ...state });
    },
  };
};
