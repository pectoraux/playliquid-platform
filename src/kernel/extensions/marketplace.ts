/**
 * Marketplace Extension
 * ----------------------
 * Consumes a token (default: MEAL) and emits GOLD tokens (liquid-backed).
 * Represents the conversion of in-game produce into tradeable currency.
 *
 * The marketplace polls the token balance each tick and converts available
 * input tokens into GOLD at a configurable exchange rate.
 */

import type { ExtensionManifest, TokenDefinition } from '../types';
import { T } from '../types';
import type { ExtensionFactory } from '../runtime';

export const GOLD_TOKEN: TokenDefinition = {
  symbol: 'GOLD',
  name: 'Gold',
  scope: 'session',
  mintPolicy: { kind: 'fixed-cap', cap: 100 },
  liquidBackingMicro: 5_000_000, // 1 GOLD = 5 Liquid
  description: 'Tradeable currency minted by the marketplace from produce.',
};

export const marketplaceManifest: ExtensionManifest = {
  id: 'pl.marketplace',
  version: '0.1.0',
  slug: 'marketplace',
  name: 'Marketplace',
  description: 'Converts MEAL tokens into GOLD currency. The trade hub of the economy.',
  author: 'playliquid',
  category: 'ECONOMY',
  kind: 'native-dsl',
  trustLevel: 'native',
  determinismMode: 'deterministic',
  inputs: [],
  outputs: [
    {
      name: 'tradeCompleted',
      type: T.Record({
        inputToken: T.String(),
        outputToken: T.String(),
        inputAmount: T.Number(),
        outputAmount: T.Number(),
        rate: T.Number(),
      }),
      description: 'Emitted when a trade is executed',
      required: false,
      cardinality: 'single',
    },
  ],
  tokenDefinitions: [GOLD_TOKEN],
  consumesTokens: ['MEAL'],
  permissions: { storage: ['session-state'] },
  capabilities: [],
  icon: '🏪',
  tags: ['economy', 'trade', 'conversion', 'marketplace', 'token'],
  configSchema: [
    { key: 'exchangeRate', label: 'Exchange Rate', type: 'number', min: 0.5, max: 5, step: 0.5, default: 1, unit: 'GOLD/MEAL', description: 'How much GOLD each MEAL is worth.' },
    { key: 'inputToken', label: 'Input Token', type: 'select', options: ['MEAL', 'CORN'], default: 'MEAL', description: 'Which token the marketplace accepts.' },
  ],
};

interface MarketplaceState {
  totalTrades: number;
  totalGoldMinted: number;
  exchangeRate: number;
  inputToken: string;
}

export const marketplaceFactory: ExtensionFactory = (instanceId, config) => {
  const exchangeRate = (config?.exchangeRate as number) ?? 1;
  const inputToken = (config?.inputToken as string) ?? 'MEAL';

  const state: MarketplaceState = {
    totalTrades: 0,
    totalGoldMinted: 0,
    exchangeRate,
    inputToken,
  };

  return {
    instanceId,
    manifest: marketplaceManifest,
    state,
    update: (ctx) => {
      const balance = ctx.tokenBalance(inputToken);
      if (balance >= 1) {
        const inputAmount = Math.floor(balance);
        const outputAmount = Math.floor(inputAmount * exchangeRate);
        if (outputAmount > 0) {
          ctx.consumeToken(inputToken, inputAmount, `marketplace trade: ${inputAmount} ${inputToken} → ${outputAmount} GOLD`);
          ctx.emitToken('GOLD', outputAmount, `marketplace trade`);
          state.totalTrades += 1;
          state.totalGoldMinted += outputAmount;
          ctx.emit('tradeCompleted', {
            inputToken,
            outputToken: 'GOLD',
            inputAmount,
            outputAmount,
            rate: exchangeRate,
          });
          ctx.log(`traded ${inputAmount} ${inputToken} → ${outputAmount} GOLD`);
        }
      }
      ctx.setState({ ...state });
    },
  };
};
