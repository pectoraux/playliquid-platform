/**
 * Competition Extension
 * ----------------------
 * Tracks player scores from token activity and emits leaderboard updates.
 * Consumes GOLD as an entry fee on first activation, then tracks the
 * player's total GOLD earned as their competitive score.
 *
 * Emits LeaderboardUpdate whenever the rank changes.
 */

import type { ExtensionManifest } from '../types';
import { T } from '../types';
import type { ExtensionFactory } from '../runtime';

export const competitionManifest: ExtensionManifest = {
  id: 'pl.competition',
  version: '0.1.0',
  slug: 'competition',
  name: 'Competition',
  description: 'Tracks player achievements and emits leaderboard updates. The competitive layer of any experience.',
  author: 'playliquid',
  category: 'SOCIAL',
  kind: 'native-dsl',
  trustLevel: 'native',
  determinismMode: 'deterministic',
  inputs: [
    {
      name: 'tradeEvent',
      type: T.Record({
        inputToken: T.String(),
        outputToken: T.String(),
        inputAmount: T.Number(),
        outputAmount: T.Number(),
        rate: T.Number(),
      }),
      description: 'Trade events from the marketplace to track for scoring',
      required: false,
      cardinality: 'single',
    },
  ],
  outputs: [
    {
      name: 'leaderboardUpdate',
      type: T.Record({
        playerId: T.String(),
        rank: T.Number(),
        totalTrades: T.Number(),
        totalGold: T.Number(),
        score: T.Number(),
      }),
      description: 'Emitted when the leaderboard changes',
      required: false,
      cardinality: 'single',
    },
  ],
  consumesTokens: ['GOLD'],
  permissions: { storage: ['session-state'] },
  capabilities: [],
  icon: '⚔️',
  tags: ['social', 'competition', 'leaderboard', 'scoring', 'pvp'],
  configSchema: [
    { key: 'entryFee', label: 'Entry Fee', type: 'number', min: 0, max: 10, step: 1, default: 1, unit: 'GOLD', description: 'GOLD consumed to enter the competition.' },
    { key: 'scorePerTrade', label: 'Score Per Trade', type: 'number', min: 1, max: 100, step: 1, default: 10, description: 'Points awarded per completed trade.' },
  ],
};

interface CompetitionState {
  entered: boolean;
  entryFee: number;
  scorePerTrade: number;
  totalTrades: number;
  totalGoldEarned: number;
  score: number;
  rank: number;
  playerId: string;
}

export const competitionFactory: ExtensionFactory = (instanceId, config) => {
  const entryFee = (config?.entryFee as number) ?? 1;
  const scorePerTrade = (config?.scorePerTrade as number) ?? 10;

  const state: CompetitionState = {
    entered: false,
    entryFee,
    scorePerTrade,
    totalTrades: 0,
    totalGoldEarned: 0,
    score: 0,
    rank: 1,
    playerId: instanceId,
  };

  return {
    instanceId,
    manifest: competitionManifest,
    state,
    update: (ctx) => {
      // Pay entry fee once
      if (!state.entered) {
        const goldBalance = ctx.tokenBalance('GOLD');
        if (goldBalance >= state.entryFee) {
          ctx.consumeToken('GOLD', state.entryFee, 'competition entry fee');
          state.entered = true;
          state.score = 10; // entry bonus
          ctx.log('entered competition (paid entry fee)');
          ctx.emit('leaderboardUpdate', {
            playerId: state.playerId,
            rank: state.rank,
            totalTrades: 0,
            totalGold: 0,
            score: state.score,
          });
        }
        ctx.setState({ ...state });
        return;
      }

      // Track trades
      const trade = ctx.inputs.tradeEvent as
        | { outputAmount: number; outputToken: string }
        | undefined;
      if (trade && trade.outputToken === 'GOLD') {
        state.totalTrades += 1;
        state.totalGoldEarned += trade.outputAmount;
        state.score = 10 + state.totalTrades * state.scorePerTrade; // entry bonus + trades
        ctx.emit('leaderboardUpdate', {
          playerId: state.playerId,
          rank: state.rank,
          totalTrades: state.totalTrades,
          totalGold: state.totalGoldEarned,
          score: state.score,
        });
        ctx.log(`trade #${state.totalTrades}: score ${state.score} (rank ${state.rank})`);
      }
      ctx.setState({ ...state });
    },
  };
};
