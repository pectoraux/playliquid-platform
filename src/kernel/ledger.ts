/**
 * Liquid Ledger — Double-Entry Accounting
 * ----------------------------------------
 * Every financial transaction in PlayLiquid flows through this ledger. The
 * invariant is absolute: for every transaction, Σ(debit) == Σ(credit).
 *
 * Liquid is the platform's unit of value, denominated in micro-Liquid
 * (1 Liquid = 1,000,000 micro-Liquid). All account balances are integers.
 *
 * The ledger is a pure service over a repository interface, so it can run
 * against Prisma in production or an in-memory store in tests.
 */

import type {
  LedgerAccount,
  LedgerEntry,
  LedgerEntryInput,
  LedgerTransaction,
} from './types';

// ─── Repository Interface ──────────────────────────────────────────────────

export interface LedgerRepo {
  getAccount(id: string): Promise<LedgerAccount | null>;
  upsertAccount(id: string, kind: string): Promise<LedgerAccount>;
  insertEntries(entries: LedgerEntryInput[]): Promise<LedgerEntry[]>;
  listAccounts(): Promise<LedgerAccount[]>;
  listTransactions(limit?: number): Promise<LedgerTransaction[]>;
  getTransaction(txId: string): Promise<LedgerTransaction | null>;
}

// ─── Well-known Accounts ───────────────────────────────────────────────────

export const ACCOUNTS = {
  PLAYER_WALLET: (userId: string) => `player:wallet:${userId}`,
  CREATOR_WALLET: (creatorId: string) => `creator:wallet:${creatorId}`,
  REWARD_POOL: 'pool:reward',
  PRIZE_POOL: 'pool:prize',
  PLATFORM_CLEARING: 'platform:clearing',
  PLATFORM_REVENUE: 'platform:revenue',
  GAME_ESCROW: (gameId: string) => `game:${gameId}:escrow`,
} as const;

// ─── Ledger Service ────────────────────────────────────────────────────────

export class LiquidLedger {
  constructor(private repo: LedgerRepo) {}

  /**
   * Post a transaction. Throws if the invariant is violated.
   */
  async post(lines: Omit<LedgerEntryInput, 'txId'>[], memo?: string): Promise<LedgerTransaction> {
    const txId = `tx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    return this.postWithId(txId, lines, memo);
  }

  async postWithId(
    txId: string,
    lines: Omit<LedgerEntryInput, 'txId'>[],
    memo?: string,
  ): Promise<LedgerTransaction> {
    if (lines.length < 2) {
      throw new Error('A transaction requires at least 2 lines');
    }

    const sumDebit = lines.reduce((s, l) => s + l.debit, 0);
    const sumCredit = lines.reduce((s, l) => s + l.credit, 0);

    if (sumDebit !== sumCredit) {
      throw new Error(
        `Ledger invariant violated: debits ${sumDebit} ≠ credits ${sumCredit}`,
      );
    }

    // Ensure all referenced accounts exist
    for (const line of lines) {
      const existing = await this.repo.getAccount(line.account);
      if (!existing) {
        await this.repo.upsertAccount(line.account, inferKind(line.account));
      }
    }

    const entries = await this.repo.insertEntries(
      lines.map((l) => ({ ...l, txId, memo: l.memo ?? memo })),
    );

    // NOTE: balance updates are performed atomically inside insertEntries.
    // We do not mutate balances here to avoid double-counting.

    return {
      id: txId,
      memo,
      createdAt: Date.now(),
      entries,
      sumDebit,
      sumCredit,
      balanced: sumDebit === sumCredit,
    };
  }

  /** Convenience: credit `to` and debit `from` for `amount` micro-Liquid */
  async transfer(
    from: string,
    to: string,
    amount: number,
    memo?: string,
  ): Promise<LedgerTransaction> {
    if (amount <= 0) throw new Error('Amount must be positive');
    return this.post(
      [
        { account: from, debit: 0, credit: amount, memo },
        { account: to, debit: amount, credit: 0, memo },
      ],
      memo,
    );
  }

  async creditPlayer(userId: string, amount: number, memo?: string): Promise<LedgerTransaction> {
    return this.post(
      [
        { account: ACCOUNTS.REWARD_POOL, debit: 0, credit: amount, memo },
        { account: ACCOUNTS.PLAYER_WALLET(userId), debit: amount, credit: 0, memo },
      ],
      memo,
    );
  }

  async getBalance(accountId: string): Promise<number> {
    const acct = await this.repo.getAccount(accountId);
    return acct?.balance ?? 0;
  }

  async listAccounts(): Promise<LedgerAccount[]> {
    return this.repo.listAccounts();
  }

  async listTransactions(limit?: number): Promise<LedgerTransaction[]> {
    return this.repo.listTransactions(limit);
  }

  async getTransaction(txId: string): Promise<LedgerTransaction | null> {
    return this.repo.getTransaction(txId);
  }
}

function inferKind(accountId: string): string {
  if (accountId.startsWith('player:wallet')) return 'player_wallet';
  if (accountId.startsWith('creator:wallet')) return 'creator_wallet';
  if (accountId.startsWith('pool:')) return 'pool';
  if (accountId.startsWith('platform:')) return 'platform';
  if (accountId.startsWith('game:')) return 'game_escrow';
  return 'generic';
}

/**
 * Nightly reconciliation: confirm every transaction balances and that
 * the sum of all account balances equals zero (closed system).
 */
export async function reconcile(repo: LedgerRepo): Promise<{
  ok: boolean;
  imbalance: number;
  txCount: number;
  unbalancedTx: string[];
}> {
  const txs = await repo.listTransactions(10000);
  const unbalanced: string[] = [];
  let totalImbalance = 0;

  for (const tx of txs) {
    if (tx.sumDebit !== tx.sumCredit) {
      unbalanced.push(tx.id);
      totalImbalance += Math.abs(tx.sumDebit - tx.sumCredit);
    }
  }

  // Sum of all account balances should be zero (double-entry closed system)
  const accounts = await repo.listAccounts();
  const systemTotal = accounts.reduce((s, a) => s + a.balance, 0);

  return {
    ok: unbalanced.length === 0 && systemTotal === 0,
    imbalance: totalImbalance + Math.abs(systemTotal),
    txCount: txs.length,
    unbalancedTx: unbalanced,
  };
}
