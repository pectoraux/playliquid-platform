/**
 * Universe v0.4 — Creator Analytics Service
 * -------------------------------------------
 * Dashboard data for creators: players, retention, economy, genome,
 * evolution suggestions, community feedback.
 */

import { db } from '@/lib/db';
import { getAllMetrics } from '@/lib/world/metrics-service';
import { computeReputation } from './rating-service';

export interface CreatorAnalytics {
  creatorId: string;
  creatorName: string;
  totalSparks: number;
  totalPlayers: number;
  totalPlayTimeMs: number;
  totalLiquidEarned: number;
  totalForks: number;
  totalFollowers: number;
  topSparks: Array<{
    experienceId: string;
    title: string;
    playCount: number;
    reputationScore: number;
    completionRate: number;
    forks: number;
    liquidEarned: number;
  }>;
  aiInsights: string[];
}

export async function getCreatorAnalytics(creatorId: string): Promise<CreatorAnalytics | null> {
  const creator = await db.creatorRecord.findUnique({
    where: { id: creatorId },
    include: { experiences: true },
  });
  if (!creator) return null;

  const publishedExps = creator.experiences.filter((e) => e.status === 'PUBLISHED');

  const topSparks: CreatorAnalytics['topSparks'] = [];
  let totalPlayers = 0;
  let totalPlayTimeMs = 0;
  let totalForks = 0;

  for (const exp of publishedExps) {
    const metrics = await db.experienceMetrics.findUnique({ where: { experienceId: exp.id } });
    const reputation = await computeReputation(exp.id);
    const playCount = metrics?.totalSessions ?? exp.playCount;
    totalPlayers += playCount;
    totalPlayTimeMs += metrics?.totalPlayTimeMs ?? 0;
    totalForks += exp.forkCount;

    topSparks.push({
      experienceId: exp.id,
      title: exp.title,
      playCount,
      reputationScore: reputation.overallScore,
      completionRate: Math.round((metrics?.completionRate ?? 0) * 100),
      forks: exp.forkCount,
      liquidEarned: 0, // would need to aggregate from ledger
    });
  }

  topSparks.sort((a, b) => b.playCount - a.playCount);

  // Generate AI insights (rule-based for speed)
  const aiInsights = generateInsights(topSparks, totalPlayers, totalForks);

  return {
    creatorId,
    creatorName: creator.displayName,
    totalSparks: publishedExps.length,
    totalPlayers,
    totalPlayTimeMs,
    totalLiquidEarned: creator.totalLiquid,
    totalForks,
    totalFollowers: creator.followers,
    topSparks: topSparks.slice(0, 10),
    aiInsights,
  };
}

function generateInsights(sparks: any[], totalPlayers: number, totalForks: number): string[] {
  const insights: string[] = [];

  if (sparks.length === 0) {
    insights.push('Publish your first Spark to start gathering analytics.');
    return insights;
  }

  const topSpark = sparks[0];
  if (topSpark.playCount > 50) {
    insights.push(`"${topSpark.title}" is your most popular Spark with ${topSpark.playCount} plays.`);
  }

  const lowCompletion = sparks.find((s) => s.completionRate < 30 && s.playCount > 5);
  if (lowCompletion) {
    insights.push(`Players leave "${lowCompletion.title}" early (${lowCompletion.completionRate}% completion). Consider reducing early difficulty.`);
  }

  const highReputation = sparks.find((s) => s.reputationScore > 70);
  if (highReputation) {
    insights.push(`"${highReputation.title}" has excellent reputation (${highReputation.reputationScore}/100). Players love it.`);
  }

  if (totalForks > 5) {
    insights.push(`${totalForks} forks of your Sparks — your creations are inspiring remixes!`);
  }

  const lowReputation = sparks.find((s) => s.reputationScore < 40 && s.playCount > 10);
  if (lowReputation) {
    insights.push(`"${lowReputation.title}" needs improvement. Use the AI Evolution Agent to analyze and improve it.`);
  }

  if (insights.length === 0) {
    insights.push('Keep creating! More data will unlock deeper insights.');
  }

  return insights;
}
