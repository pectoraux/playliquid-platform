/**
 * Phase 20.3 — Mutation persistence layer
 * ---------------------------------------
 * Persists ExperienceMutationRecord rows. The AI creates mutations; the
 * creator approves them; the apply step is the only thing that touches
 * production (and only after approval).
 */

import { db } from '@/lib/db';
import type { ExperienceBundle } from '@/kernel/types';
import type { MutationRecord, MutationStatus, MutationType } from './evolution-types';

export async function createMutation(params: {
  experienceId: string;
  proposalId?: string;
  mutationType: MutationType;
  beforeGraph: ExperienceBundle;
  afterGraph: ExperienceBundle;
}): Promise<MutationRecord> {
  const row = await db.experienceMutationRecord.create({
    data: {
      experienceId: params.experienceId,
      proposalId: params.proposalId,
      mutationType: params.mutationType,
      beforeGraphJson: JSON.stringify(params.beforeGraph),
      afterGraphJson: JSON.stringify(params.afterGraph),
      status: 'PENDING',
      creatorApproved: false,
    },
  });
  return rowToRecord(row);
}

export async function getMutation(id: string): Promise<MutationRecord | null> {
  const row = await db.experienceMutationRecord.findUnique({ where: { id } });
  return row ? rowToRecord(row) : null;
}

export async function getMutationsForExperience(experienceId: string, limit = 20): Promise<MutationRecord[]> {
  const rows = await db.experienceMutationRecord.findMany({
    where: { experienceId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return rows.map(rowToRecord);
}

export async function getMutationsForProposal(proposalId: string): Promise<MutationRecord[]> {
  const rows = await db.experienceMutationRecord.findMany({
    where: { proposalId },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(rowToRecord);
}

export async function setMutationStatus(id: string, status: MutationStatus, creatorApproved?: boolean): Promise<void> {
  const data: Record<string, unknown> = { status };
  if (creatorApproved !== undefined) data.creatorApproved = creatorApproved;
  if (status === 'APPLIED') data.appliedAt = new Date();
  await db.experienceMutationRecord.update({ where: { id }, data });
}

export async function markApplied(id: string, appliedExperienceId: string): Promise<void> {
  await db.experienceMutationRecord.update({
    where: { id },
    data: {
      status: 'APPLIED',
      creatorApproved: true,
      appliedExperienceId,
      appliedAt: new Date(),
    },
  });
}

function rowToRecord(row: any): MutationRecord {
  return {
    id: row.id,
    experienceId: row.experienceId,
    proposalId: row.proposalId ?? undefined,
    mutationType: row.mutationType as MutationType,
    beforeGraph: JSON.parse(row.beforeGraphJson),
    afterGraph: JSON.parse(row.afterGraphJson),
    creatorApproved: row.creatorApproved,
    status: row.status as MutationStatus,
    appliedExperienceId: row.appliedExperienceId ?? undefined,
    createdAt: row.createdAt instanceof Date ? row.createdAt.getTime() : new Date(row.createdAt).getTime(),
    appliedAt: row.appliedAt ? (row.appliedAt instanceof Date ? row.appliedAt.getTime() : new Date(row.appliedAt).getTime()) : undefined,
  };
}
