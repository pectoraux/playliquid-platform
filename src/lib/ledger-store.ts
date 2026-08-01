/**
 * Prisma-backed Ledger Repository
 * ---------------------------------
 * Adapts the kernel's pure LedgerRepo interface to Prisma + SQLite.
 *
 * IMPORTANT: SQLite doesn't support atomic balance updates in a single
 * statement the way Postgres does, so we use a transaction with explicit
 * read-modify-write. For production, switch to Postgres with
 * `UPDATE ... SET balance = balance + :delta`.
 */

import { db } from '@/lib/db';
import type {
  LedgerAccount,
  LedgerEntry,
  LedgerEntryInput,
  LedgerTransaction,
} from '@/kernel/types';
import type { LedgerRepo } from '@/kernel/ledger';

export const prismaLedgerRepo: LedgerRepo = {
  async getAccount(id) {
    const r = await db.ledgerAccountRecord.findUnique({ where: { id } });
    if (!r) return null;
    return { id: r.id, kind: r.kind, balance: Number(r.balance), createdAt: r.createdAt.getTime() };
  },

  async upsertAccount(id, kind) {
    const r = await db.ledgerAccountRecord.upsert({
      where: { id },
      create: { id, kind, balance: 0 },
      update: {},
    });
    return { id: r.id, kind: r.kind, balance: Number(r.balance), createdAt: r.createdAt.getTime() };
  },

  async insertEntries(entries) {
    if (entries.length === 0) return [];

    // Use the first entry's txId; all entries in one call share it
    const txId = entries[0].txId;
    const memo = entries[0].memo;

    return db.$transaction(async (tx) => {
      // Ensure tx record exists
      await tx.ledgerTxRecord.upsert({
        where: { id: txId },
        create: { id: txId, memo },
        update: { memo: memo ?? undefined },
      });

      const created: LedgerEntry[] = [];
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        // Ensure account exists
        await tx.ledgerAccountRecord.upsert({
          where: { id: e.account },
          create: { id: e.account, kind: inferKind(e.account) },
          update: {},
        });
        // Insert entry
        const row = await tx.ledgerEntryRecord.create({
          data: {
            txId,
            account: e.account,
            debit: BigInt(e.debit),
            credit: BigInt(e.credit),
            memo: e.memo,
            lineNo: i,
          },
        });
        // Update balance atomically
        const delta = BigInt(e.debit) - BigInt(e.credit);
        await tx.ledgerAccountRecord.update({
          where: { id: e.account },
          data: { balance: { increment: delta } },
        });
        created.push({
          id: row.id,
          txId: row.txId,
          account: row.account,
          debit: Number(row.debit),
          credit: Number(row.credit),
          memo: row.memo ?? undefined,
          lineNo: row.lineNo,
          createdAt: row.createdAt.getTime(),
        });
      }
      return created;
    });
  },

  async listAccounts() {
    const rows = await db.ledgerAccountRecord.findMany({ orderBy: { id: 'asc' } });
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      balance: Number(r.balance),
      createdAt: r.createdAt.getTime(),
    }));
  },

  async listTransactions(limit = 100) {
    const txs = await db.ledgerTxRecord.findMany({
      include: { entries: { orderBy: { lineNo: 'asc' } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return txs.map((t) => toTransaction(t.id, t.memo ?? undefined, t.createdAt.getTime(), t.entries));
  },

  async getTransaction(txId) {
    const t = await db.ledgerTxRecord.findUnique({
      where: { id: txId },
      include: { entries: { orderBy: { lineNo: 'asc' } } },
    });
    if (!t) return null;
    return toTransaction(t.id, t.memo ?? undefined, t.createdAt.getTime(), t.entries);
  },
};

function toTransaction(
  id: string,
  memo: string | undefined,
  createdAt: number,
  rows: Array<{
    id: string;
    txId: string;
    account: string;
    debit: bigint;
    credit: bigint;
    memo: string | null;
    lineNo: number;
    createdAt: Date;
  }>,
): LedgerTransaction {
  const entries: LedgerEntry[] = rows.map((r) => ({
    id: r.id,
    txId: r.txId,
    account: r.account,
    debit: Number(r.debit),
    credit: Number(r.credit),
    memo: r.memo ?? undefined,
    lineNo: r.lineNo,
    createdAt: r.createdAt.getTime(),
  }));
  const sumDebit = entries.reduce((s, e) => s + e.debit, 0);
  const sumCredit = entries.reduce((s, e) => s + e.credit, 0);
  return { id, memo, createdAt, entries, sumDebit, sumCredit, balanced: sumDebit === sumCredit };
}

function inferKind(accountId: string): string {
  if (accountId.startsWith('player:wallet')) return 'player_wallet';
  if (accountId.startsWith('creator:wallet')) return 'creator_wallet';
  if (accountId.startsWith('pool:')) return 'pool';
  if (accountId.startsWith('platform:')) return 'platform';
  if (accountId.startsWith('game:')) return 'game_escrow';
  return 'generic';
}
