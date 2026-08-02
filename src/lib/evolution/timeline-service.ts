/**
 * Phase 20.7 — Evolution Timeline
 * -------------------------------
 * Every experience gets an Evolution History:
 *
 *   Neon Runner v1.0 — Created
 *     ↓
 *   v1.1 — Added Competition Extension (Retention +14%)
 *     ↓
 *   v1.2 — Weather balanced (Completion +9%)
 *     ↓
 *   v1.3 — AI recommended movement change (DAU +22%)
 *
 * Composed from:
 *   - ExperienceVersionRecord (manual + applied mutations)
 *   - ExperienceMutationRecord (graph mutations, applied/rolled-back)
 *   - EvolutionProposal (DISCOVERED → APPROVED history)
 *   - EvolutionRunRecord (A/B experiment winners)
 */

import { db } from '@/lib/db';
import type { EvolutionTimelineEntry } from './evolution-types';
import { diffBundles } from './mutation-service';

export async function getEvolutionTimeline(experienceId: string): Promise<{
  timeline: EvolutionTimelineEntry[];
  currentVersion: number;
  totalMutations: number;
  appliedMutations: number;
  rolledBackMutations: number;
  experimentWins: number;
}> {
  const [versions, mutations, proposals, runs] = await Promise.all([
    db.experienceVersionRecord.findMany({
      where: { experienceId },
      orderBy: { version: 'asc' },
      take: 50,
    }),
    db.experienceMutationRecord.findMany({
      where: { experienceId },
      orderBy: { createdAt: 'asc' },
      take: 50,
    }),
    db.evolutionProposal.findMany({
      where: { experienceId },
      orderBy: { createdAt: 'asc' },
      take: 50,
    }),
    db.evolutionRunRecord.findMany({
      where: { experienceId, winner: 'B' },
      orderBy: { createdAt: 'asc' },
      take: 50,
    }),
  ]);

  const exp = await db.experienceRecord.findUnique({ where: { id: experienceId } });

  const timeline: EvolutionTimelineEntry[] = [];

  // v1.0: creation
  if (exp) {
    timeline.push({
      version: 'v1.0',
      versionNumber: 1,
      changeSummary: 'Created',
      changeType: 'CREATED',
      impact: 'Initial publish',
      bundleHash: exp.bundleHash ?? undefined,
      createdBy: exp.creatorId,
      createdAt: exp.createdAt.getTime(),
    });
  }

  // Versions (each represents an applied change)
  for (const v of versions) {
    const isAppliedMutation = mutations.some((m) => m.appliedExperienceId === experienceId && m.appliedAt && Math.abs(m.appliedAt.getTime() - v.createdAt.getTime()) < 60_000);
    const matchingProposal = proposals.find((p) => {
      // match by approximate time of approval
      if (!p.reviewedAt) return false;
      return Math.abs(p.reviewedAt.getTime() - v.createdAt.getTime()) < 120_000;
    });
    timeline.push({
      version: `v${v.version}.0`,
      versionNumber: v.version,
      changeSummary: v.changeSummary,
      changeType: isAppliedMutation ? 'EVOLUTION' : 'MANUAL_FORK',
      impact: matchingProposal?.expectedImpact ?? undefined,
      mutationId: mutations.find((m) => m.proposalId === matchingProposal?.id)?.id,
      proposalId: matchingProposal?.id,
      bundleHash: v.bundleHash ?? undefined,
      createdBy: v.createdBy,
      createdAt: v.createdAt.getTime(),
    });
  }

  // Experiment wins (B won → led to an evolution)
  for (const r of runs) {
    const mutation = mutations.find((m) => m.id === r.mutationId);
    const proposal = proposals.find((p) => p.id === mutation?.proposalId);
    timeline.push({
      version: `experiment-${r.id.slice(-4)}`,
      versionNumber: 0,
      changeSummary: `A/B experiment: ${r.variantB} beat ${r.variantA}`,
      changeType: 'EXPERIMENT_WIN',
      impact: proposal?.expectedImpact ?? 'Variant B won',
      mutationId: r.mutationId ?? undefined,
      proposalId: mutation?.proposalId ?? undefined,
      createdBy: 'evolution-engine',
      createdAt: r.createdAt.getTime(),
    });
  }

  // Sort by time ascending
  timeline.sort((a, b) => a.createdAt - b.createdAt);

  // Renumber versions sequentially for display (keep original as versionNumber)
  const appliedMutations = mutations.filter((m) => m.status === 'APPLIED').length;
  const rolledBackMutations = mutations.filter((m) => m.status === 'ROLLED_BACK').length;

  return {
    timeline,
    currentVersion: versions.length > 0 ? Math.max(...versions.map((v) => v.version)) : 1,
    totalMutations: mutations.length,
    appliedMutations,
    rolledBackMutations,
    experimentWins: runs.length,
  };
}

// ─── Health snapshot (for the dashboard "Current Health" section) ──────────

export interface ExperienceHealth {
  experienceId: string;
  experienceName: string;
  overall: number; // 0-100
  retention: { score: number; label: string };
  competition: { score: number; label: string };
  economy: { score: number; label: string };
  community: { score: number; label: string };
  evolution: { score: number; label: string };
  signals: string[];
}

export async function getExperienceHealth(experienceId: string): Promise<ExperienceHealth | null> {
  const exp = await db.experienceRecord.findUnique({ where: { id: experienceId } });
  if (!exp) return null;

  const metrics = await db.experienceMetrics.findUnique({ where: { experienceId } });
  const feedbackCount = await db.experienceFeedbackRecord.count({ where: { experienceId } });
  const mutationCount = await db.experienceMutationRecord.count({ where: { experienceId, status: 'APPLIED' } });
  const leaderboardEntries = await db.leaderboardEntryRecord.count({ where: { experienceId } });
  const competitiveSessions = await db.playSession.count({ where: { experienceId, competitiveMode: true } });

  const completionRate = metrics?.completionRate ?? 0;
  const frustrationRate = metrics && metrics.totalSessions > 0 ? metrics.frustrationEvents / metrics.totalSessions : 0;

  // Retention: completion rate + frustration
  const retentionScore = Math.round(Math.max(0, Math.min(100, completionRate * 100 - frustrationRate * 30)));
  const retentionLabel = retentionScore >= 70 ? 'Strong' : retentionScore >= 40 ? 'Moderate' : 'At risk';

  // Competition: leaderboard + competitive sessions
  const competitionScore = Math.round(Math.min(100, leaderboardEntries * 5 + competitiveSessions * 10));
  const competitionLabel = competitionScore >= 50 ? 'Active' : competitionScore > 0 ? 'Emerging' : 'Inactive';

  // Economy: tokens flowing
  const tokensEarned = metrics?.tokensEarned ?? 0;
  const tokensSpent = metrics?.tokensSpent ?? 0;
  const economyScore = Math.round(Math.min(100, (tokensEarned + tokensSpent) / 5));
  const economyLabel = economyScore >= 50 ? 'Healthy' : economyScore > 0 ? 'Thin' : 'Empty';

  // Community: feedback + likes + forks
  const communityScore = Math.round(Math.min(100, feedbackCount * 8 + exp.likeCount * 2 + exp.forkCount * 5));
  const communityLabel = communityScore >= 40 ? 'Engaged' : communityScore > 0 ? 'Forming' : 'Quiet';

  // Evolution: how many mutations applied
  const evolutionScore = Math.round(Math.min(100, mutationCount * 20));
  const evolutionLabel = evolutionScore >= 60 ? 'Evolving' : evolutionScore > 0 ? 'Iterating' : 'Static';

  const overall = Math.round(
    (retentionScore + competitionScore + economyScore + communityScore + evolutionScore) / 5,
  );

  const signals: string[] = [];
  if (retentionScore < 40) signals.push('Low retention — run AI evolution analysis');
  if (frustrationRate > 0.3) signals.push('High frustration — consider difficulty tuning');
  if (competitionScore === 0) signals.push('No competitive activity — enable competitive mode');
  if (economyScore === 0) signals.push('No economy activity — simulate players to seed');
  if (communityScore === 0) signals.push('No community signals yet');
  if (evolutionScore === 0) signals.push('No evolutions yet — AI can propose the first one');
  if (signals.length === 0) signals.push('All systems healthy');

  return {
    experienceId,
    experienceName: exp.title,
    overall,
    retention: { score: retentionScore, label: retentionLabel },
    competition: { score: competitionScore, label: competitionLabel },
    economy: { score: economyScore, label: economyLabel },
    community: { score: communityScore, label: communityLabel },
    evolution: { score: evolutionScore, label: evolutionLabel },
    signals,
  };
}
