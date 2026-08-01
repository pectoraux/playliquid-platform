/**
 * Extension Token Service
 * ------------------------
 * Records token emissions/consumptions as durable events and maintains
 * per-session balances. The runtime enforces policies in-memory; this service
 * persists the audit trail.
 *
 * Tokens are NOT Liquid. They are scoped internal currencies. At session
 * settlement, liquid-backed tokens convert to Liquid via the ledger.
 */

import type { TokenDefinition, TokenEvent, TokenEventKind } from './types';
import type { LiquidLedger } from './ledger';

export interface TokenRepo {
  recordEvent(evt: Omit<TokenEvent, 'id' | 'createdAt'>): Promise<TokenEvent>;
  listEvents(sessionId: string, limit?: number): Promise<TokenEvent[]>;
  getBalance(sessionId: string, symbol: string): Promise<number>;
  setBalance(sessionId: string, symbol: string, balance: number): Promise<void>;
  listBalances(sessionId: string): Promise<Array<{ symbol: string; balance: number; scope: 'session' | 'game' | 'user' }>>;
}

export class TokenService {
  constructor(
    public readonly repo: TokenRepo,
    private ledger: LiquidLedger,
    private tokenRegistry: Map<string, TokenDefinition>,
  ) {}

  async recordEmit(
    sessionId: string,
    symbol: string,
    amount: number,
    instance?: string,
    reason?: string,
    tick?: number,
  ): Promise<TokenEvent> {
    return this.repo.recordEvent({
      sessionId,
      kind: 'EMIT',
      symbol,
      amount,
      instance,
      reason,
      tick,
    });
  }

  async recordConsume(
    sessionId: string,
    symbol: string,
    amount: number,
    instance?: string,
    reason?: string,
    tick?: number,
  ): Promise<TokenEvent> {
    return this.repo.recordEvent({
      sessionId,
      kind: 'CONSUME',
      symbol,
      amount,
      instance,
      reason,
      tick,
    });
  }

  /**
   * Settle a session: convert liquid-backed tokens to Liquid via the ledger.
   * Returns the total Liquid credited to the player.
   */
  async settle(
    sessionId: string,
    userId: string,
    rewardPoolAccount: string,
    playerWalletAccount: string,
  ): Promise<{ settled: Array<{ symbol: string; amount: number; liquidMicro: number }>; totalLiquidMicro: number }> {
    const balances = await this.repo.listBalances(sessionId);
    const settled: Array<{ symbol: string; amount: number; liquidMicro: number }> = [];
    let total = 0;

    for (const b of balances) {
      if (b.balance <= 0) continue;
      const def = this.tokenRegistry.get(b.symbol);
      if (!def?.liquidBackingMicro) {
        // Non-backed token: just settle to zero (consumed in-game)
        await this.repo.recordEvent({
          sessionId,
          kind: 'SETTLE',
          symbol: b.symbol,
          amount: b.balance,
          reason: 'non-backed token discarded at settlement',
        });
        await this.repo.setBalance(sessionId, b.symbol, 0);
        continue;
      }
      const liquidMicro = b.balance * def.liquidBackingMicro;
      total += liquidMicro;
      // Move Liquid from reward pool → player wallet
      await this.ledger.transfer(rewardPoolAccount, playerWalletAccount, liquidMicro, `settle ${b.balance} ${b.symbol}`);
      await this.repo.recordEvent({
        sessionId,
        kind: 'SETTLE',
        symbol: b.symbol,
        amount: b.balance,
        reason: `settled to ${liquidMicro} micro-Liquid`,
      });
      await this.repo.setBalance(sessionId, b.symbol, 0);
      settled.push({ symbol: b.symbol, amount: b.balance, liquidMicro });
    }

    return { settled, totalLiquidMicro: total };
  }

  async listEvents(sessionId: string, limit?: number): Promise<TokenEvent[]> {
    return this.repo.listEvents(sessionId, limit);
  }

  async listBalances(sessionId: string) {
    return this.repo.listBalances(sessionId);
  }
}
