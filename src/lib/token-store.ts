/**
 * Prisma-backed Token Repository + Token Service factory
 * -------------------------------------------------------
 * Adapts the kernel's TokenRepo interface to Prisma. Also builds a
 * TokenService with the registry of declared tokens (sourced from the
 * extension registry).
 */

import { db } from '@/lib/db';
import type { TokenEvent, TokenDefinition } from '@/kernel/types';
import type { TokenRepo } from '@/kernel/tokens';
import { TokenService } from '@/kernel/tokens';
import { LiquidLedger } from '@/kernel/ledger';
import { prismaLedgerRepo } from '@/lib/ledger-store';
import { listExtensions } from '@/kernel/extensions';

// Build the token registry from the extension catalog
const tokenRegistry = new Map<string, TokenDefinition>();
for (const { manifest } of listExtensions()) {
  for (const t of manifest.tokenDefinitions ?? []) {
    tokenRegistry.set(t.symbol, t);
  }
}

export const prismaTokenRepo: TokenRepo = {
  async recordEvent(evt) {
    const row = await db.tokenEventRecord.create({
      data: {
        sessionId: evt.sessionId,
        kind: evt.kind,
        symbol: evt.symbol,
        amount: evt.amount,
        instance: evt.instance,
        reason: evt.reason,
        tick: evt.tick,
      },
    });
    return toTokenEvent(row);
  },

  async listEvents(sessionId, limit = 200) {
    const rows = await db.tokenEventRecord.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map(toTokenEvent);
  },

  async getBalance(sessionId, symbol) {
    const r = await db.tokenBalanceRecord.findUnique({
      where: { sessionId_symbol: { sessionId, symbol } },
    });
    return r?.balance ?? 0;
  },

  async setBalance(sessionId, symbol, balance) {
    await db.tokenBalanceRecord.upsert({
      where: { sessionId_symbol: { sessionId, symbol } },
      create: { sessionId, symbol, balance, scope: 'session' },
      update: { balance },
    });
  },

  async listBalances(sessionId) {
    const rows = await db.tokenBalanceRecord.findMany({ where: { sessionId } });
    return rows.map((r) => ({
      symbol: r.symbol,
      balance: r.balance,
      scope: r.scope as 'session' | 'game' | 'user',
    }));
  },
};

function toTokenEvent(row: {
  id: string;
  sessionId: string;
  kind: string;
  symbol: string;
  amount: number;
  instance: string | null;
  reason: string | null;
  tick: number | null;
  createdAt: Date;
}): TokenEvent {
  return {
    id: row.id,
    sessionId: row.sessionId,
    kind: row.kind as TokenEvent['kind'],
    symbol: row.symbol,
    amount: row.amount,
    instance: row.instance ?? undefined,
    reason: row.reason ?? undefined,
    tick: row.tick ?? undefined,
    createdAt: row.createdAt.getTime(),
  };
}

// Singleton services
const ledger = new LiquidLedger(prismaLedgerRepo);
export const tokenService = new TokenService(prismaTokenRepo, ledger, tokenRegistry);
export { ledger };
