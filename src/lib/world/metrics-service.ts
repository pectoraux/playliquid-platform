/**
 * World Engine — Metrics Engine
 * --------------------------------
 * Aggregates session telemetry into per-experience metrics.
 * Recomputed from the event log; idempotent.
 */

import { db } from '@/lib/db';
import type { ExperienceMetricsAggregate } from '@/kernel/types';

export async function recomputeMetrics(experienceId: string): Promise<ExperienceMetricsAggregate> {
  const sessions = await db.playSession.findMany({
    where: { experienceId },
    include: { telemetry: true, tokenEvents: true },
  });

  if (sessions.length === 0) return emptyMetrics(experienceId);

  const total = sessions.length;
  let totalPlayTimeMs = 0;
  let completedCount = 0;
  let totalScore = 0;
  let dropOffSum = 0;
  let dropOffCount = 0;
  let frustrationEvents = 0;
  let achievementEvents = 0;
  let surpriseEvents = 0;
  let socialMoments = 0;
  let tokensEarned = 0;
  let tokensSpent = 0;
  let marketActions = 0;

  for (const s of sessions) {
    if (s.telemetry) {
      totalPlayTimeMs += s.telemetry.sessionDurationMs;
      if (s.telemetry.completion) completedCount++;
      totalScore += s.telemetry.score ?? 0;
      if (!s.telemetry.completion && s.telemetry.sessionDurationMs > 0) {
        dropOffSum += s.telemetry.sessionDurationMs;
        dropOffCount++;
      }
      const emitted = s.telemetry.tokensEmittedJson ? JSON.parse(s.telemetry.tokensEmittedJson) : {};
      const consumed = s.telemetry.tokensConsumedJson ? JSON.parse(s.telemetry.tokensConsumedJson) : {};
      for (const amt of Object.values(emitted)) tokensEarned += (amt as number);
      for (const amt of Object.values(consumed)) tokensSpent += (amt as number);
    }
    for (const te of s.tokenEvents) {
      if (te.kind === 'EMIT') {
        if (te.symbol === 'GOLD') marketActions++;
        achievementEvents++;
      }
    }
    if (s.score > 0) achievementEvents++;
    if (s.tickCount > 0 && s.tickCount < 10 && s.status === 'ENDED') frustrationEvents++;
    if (s.tickCount > 50) socialMoments++;
  }

  const metrics: ExperienceMetricsAggregate = {
    experienceId,
    totalSessions: total,
    totalPlayTimeMs,
    completionRate: total > 0 ? completedCount / total : 0,
    averageScore: total > 0 ? totalScore / total : 0,
    averageDropOffMs: dropOffCount > 0 ? Math.round(dropOffSum / dropOffCount) : 0,
    retention1d: 0,
    retention7d: 0,
    frustrationEvents,
    achievementEvents,
    surpriseEvents,
    socialMoments,
    tokensEarned,
    tokensSpent,
    marketActions,
    forks: 0,
    shares: 0,
  };

  await db.experienceMetrics.upsert({
    where: { experienceId },
    create: {
      experienceId,
      totalSessions: metrics.totalSessions,
      totalPlayTimeMs: metrics.totalPlayTimeMs,
      completionRate: metrics.completionRate,
      averageScore: metrics.averageScore,
      averageDropOffMs: metrics.averageDropOffMs,
      frustrationEvents,
      achievementEvents,
      surpriseEvents,
      socialMoments,
      tokensEarned,
      tokensSpent,
      marketActions,
    },
    update: {
      totalSessions: metrics.totalSessions,
      totalPlayTimeMs: metrics.totalPlayTimeMs,
      completionRate: metrics.completionRate,
      averageScore: metrics.averageScore,
      averageDropOffMs: metrics.averageDropOffMs,
      frustrationEvents,
      achievementEvents,
      surpriseEvents,
      socialMoments,
      tokensEarned,
      tokensSpent,
      marketActions,
    },
  });

  return metrics;
}

export async function getMetrics(experienceId: string): Promise<ExperienceMetricsAggregate | null> {
  const row = await db.experienceMetrics.findUnique({ where: { experienceId } });
  if (!row) return null;
  return {
    experienceId: row.experienceId,
    totalSessions: row.totalSessions,
    totalPlayTimeMs: row.totalPlayTimeMs,
    completionRate: row.completionRate,
    averageScore: row.averageScore,
    averageDropOffMs: row.averageDropOffMs,
    retention1d: row.retention1d,
    retention7d: row.retention7d,
    frustrationEvents: row.frustrationEvents,
    achievementEvents: row.achievementEvents,
    surpriseEvents: row.surpriseEvents,
    socialMoments: row.socialMoments,
    tokensEarned: row.tokensEarned,
    tokensSpent: row.tokensSpent,
    marketActions: row.marketActions,
    forks: row.forks,
    shares: row.shares,
  };
}

export async function getAllMetrics(): Promise<ExperienceMetricsAggregate[]> {
  const rows = await db.experienceMetrics.findMany({ orderBy: { totalSessions: 'desc' } });
  return rows.map((row) => ({
    experienceId: row.experienceId,
    totalSessions: row.totalSessions,
    totalPlayTimeMs: row.totalPlayTimeMs,
    completionRate: row.completionRate,
    averageScore: row.averageScore,
    averageDropOffMs: row.averageDropOffMs,
    retention1d: row.retention1d,
    retention7d: row.retention7d,
    frustrationEvents: row.frustrationEvents,
    achievementEvents: row.achievementEvents,
    surpriseEvents: row.surpriseEvents,
    socialMoments: row.socialMoments,
    tokensEarned: row.tokensEarned,
    tokensSpent: row.tokensSpent,
    marketActions: row.marketActions,
    forks: row.forks,
    shares: row.shares,
  }));
}

function emptyMetrics(experienceId: string): ExperienceMetricsAggregate {
  return {
    experienceId, totalSessions: 0, totalPlayTimeMs: 0, completionRate: 0,
    averageScore: 0, averageDropOffMs: 0, retention1d: 0, retention7d: 0,
    frustrationEvents: 0, achievementEvents: 0, surpriseEvents: 0, socialMoments: 0,
    tokensEarned: 0, tokensSpent: 0, marketActions: 0, forks: 0, shares: 0,
  };
}
