/**
 * Universe v0.4 — Rating Service
 * --------------------------------
 * Computes the Experience Reputation Score — a multi-signal score
 * (NOT simple stars). Combines completion rate, return rate, social
 * sharing, player emotions, economy health, and community sentiment.
 */

import { db } from '@/lib/db';

export interface ExperienceReputation {
  experienceId: string;
  overallScore: number;       // 0-100
  completionScore: number;    // from metrics
  returnScore: number;        // from session data
  socialScore: number;        // from follows + comments + forks
  emotionScore: number;       // from telemetry signals
  economyScore: number;       // from token activity
  reviewCount: number;
  averageReviewScore: number;
  aiSummary?: string;         // "Why players love this Spark"
}

export async function computeReputation(experienceId: string): Promise<ExperienceReputation> {
  // Get experience metrics
  const metrics = await db.experienceMetrics.findUnique({ where: { experienceId } });
  const experience = await db.experienceRecord.findUnique({ where: { id: experienceId } });

  // Completion score (0-100)
  const completionScore = metrics ? Math.round(metrics.completionRate * 100) : 0;

  // Return score: how many players played more than once?
  const sessions = await db.playSession.findMany({
    where: { experienceId },
    select: { userId: true },
  });
  const playerCounts: Record<string, number> = {};
  for (const s of sessions) {
    if (s.userId) playerCounts[s.userId] = (playerCounts[s.userId] ?? 0) + 1;
  }
  const totalPlayers = Object.keys(playerCounts).length;
  const returningPlayers = Object.values(playerCounts).filter((c) => c > 1).length;
  const returnScore = totalPlayers > 0 ? Math.round((returningPlayers / totalPlayers) * 100) : 0;

  // Social score: follows + comments + forks
  const [followCount, commentCount] = await Promise.all([
    db.experienceFollow.count({ where: { experienceId } }),
    db.experienceComment.count({ where: { experienceId } }),
  ]);
  const forkCount = experience?.forkCount ?? 0;
  const socialScore = Math.min(100, followCount * 5 + commentCount * 3 + forkCount * 10);

  // Emotion score: from achievement events vs frustration events
  const emotionScore = metrics
    ? Math.min(100, Math.max(0, Math.round(
        ((metrics.achievementEvents - metrics.frustrationEvents) / Math.max(metrics.totalSessions, 1)) * 50 + 50
      )))
    : 50;

  // Economy score: from token activity + market actions
  const economyScore = metrics
    ? Math.min(100, Math.round((metrics.tokensEarned + metrics.marketActions * 5) / Math.max(metrics.totalSessions, 1) * 10))
    : 0;

  // Reviews
  const reviews = await db.experienceRatingRecord.findMany({ where: { experienceId } });
  const reviewCount = reviews.length;
  const averageReviewScore = reviewCount > 0
    ? Math.round(reviews.reduce((s, r) => s + r.overallScore, 0) / reviewCount)
    : 50;

  // Overall: weighted combination
  const overallScore = Math.round(
    completionScore * 0.2 +
    returnScore * 0.2 +
    socialScore * 0.15 +
    emotionScore * 0.15 +
    economyScore * 0.1 +
    averageReviewScore * 0.2
  );

  return {
    experienceId,
    overallScore,
    completionScore,
    returnScore,
    socialScore,
    emotionScore,
    economyScore,
    reviewCount,
    averageReviewScore,
  };
}

export async function submitRating(params: {
  experienceId: string;
  userId: string;
  overallScore: number;
  reviewText?: string;
}): Promise<void> {
  // Compute sub-scores from the user's perception
  await db.experienceRatingRecord.upsert({
    where: { experienceId_userId: { experienceId: params.experienceId, userId: params.userId } },
    create: {
      experienceId: params.experienceId,
      userId: params.userId,
      overallScore: params.overallScore,
      completionScore: params.overallScore,
      returnScore: params.overallScore,
      socialScore: params.overallScore,
      emotionScore: params.overallScore,
      economyScore: params.overallScore,
      reviewText: params.reviewText,
    },
    update: {
      overallScore: params.overallScore,
      reviewText: params.reviewText,
    },
  });

  // Record activity
  const { recordActivity } = await import('./social-service');
  await recordActivity({
    userId: params.userId,
    type: 'rated',
    targetType: 'experience',
    targetId: params.experienceId,
    detail: `rated ${params.overallScore}/100`,
  });
}

export async function getRating(experienceId: string): Promise<ExperienceReputation | null> {
  return computeReputation(experienceId);
}
