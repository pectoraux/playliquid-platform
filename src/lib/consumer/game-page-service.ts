/**
 * v0.45 Consumer Reality Layer — Game Page Service
 * --------------------------------------------------
 * The YouTube watch page equivalent for Sparks.
 * Assembles: runtime info, leaderboard, comments, remixes, related, reputation.
 */

import { db } from '@/lib/db';
import { computeReputation } from '@/lib/universe/rating-service';
import { getInteractionStats } from './discover-service';

export interface GamePage {
  experience: {
    id: string;
    title: string;
    description: string;
    creatorId: string;
    creatorName: string;
    creatorHandle: string;
    creatorLevel: number;
    isFork: boolean;
    parentExperienceId?: string;
    publishedAt: number;
    intent: any;
    genome: any;
  };
  stats: {
    playCount: number;
    forkCount: number;
    likeCount: number;
    reputationScore: number;
    reputationBreakdown: any;
    interactionStats: Record<string, number>;
  };
  leaderboard: Array<{
    rank: number;
    userId: string;
    displayName: string;
    score: number;
    achievedAt: number;
  }>;
  comments: Array<{
    id: string;
    userId: string;
    displayName: string;
    body: string;
    createdAt: number;
  }>;
  remixes: Array<{
    id: string;
    title: string;
    creatorName: string;
    playCount: number;
  }>;
  related: Array<{
    experienceId: string;
    title: string;
    creatorName: string;
    playCount: number;
    reputationScore: number;
  }>;
  challenges: any[];
  isSaved: boolean;
}

export async function getGamePage(experienceId: string, userId?: string): Promise<GamePage | null> {
  const exp = await db.experienceRecord.findUnique({
    where: { id: experienceId },
    include: { creator: true, parent: true },
  });
  if (!exp) return null;

  const reputation = await computeReputation(experienceId);
  const interactionStats = await getInteractionStats(experienceId);
  const genome = exp.genomeJson ? JSON.parse(exp.genomeJson) : null;
  const intent = exp.intentJson ? JSON.parse(exp.intentJson) : {};

  // Leaderboard
  const leaderboardEntries = await db.leaderboardEntryRecord.findMany({
    where: { experienceId },
    orderBy: { score: 'desc' },
    take: 10,
  });
  const leaderboard = leaderboardEntries.map((e, i) => ({
    rank: i + 1,
    userId: e.userId,
    displayName: e.displayName,
    score: e.score,
    achievedAt: e.achievedAt.getTime(),
  }));

  // Comments
  const commentRecords = await db.experienceComment.findMany({
    where: { experienceId },
    include: { player: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  const comments = commentRecords.map((c) => ({
    id: c.id,
    userId: c.userId,
    displayName: c.player?.displayName ?? 'Unknown',
    body: c.body,
    createdAt: c.createdAt.getTime(),
  }));

  // Remixes (forks)
  const forks = await db.experienceRecord.findMany({
    where: { parentExperienceId: experienceId, status: 'PUBLISHED' },
    include: { creator: true },
    take: 5,
  });
  const remixes = forks.map((f) => ({
    id: f.id,
    title: f.title,
    creatorName: f.creator?.displayName ?? 'Unknown',
    playCount: f.playCount,
  }));

  // Related (same creator or similar genome)
  const relatedExps = await db.experienceRecord.findMany({
    where: { status: 'PUBLISHED', creatorId: exp.creatorId, id: { not: experienceId } },
    include: { creator: true },
    take: 4,
  });
  const related: Array<{
    experienceId: string;
    title: string;
    creatorName: string;
    playCount: number;
    reputationScore: number;
  }> = [];
  for (const r of relatedExps) {
    const rep = await computeReputation(r.id);
    related.push({
      experienceId: r.id,
      title: r.title,
      creatorName: r.creator?.displayName ?? 'Unknown',
      playCount: r.playCount,
      reputationScore: rep.overallScore,
    });
  }

  // Challenges
  const challenges = await db.challengeRecord.findMany({
    where: { experienceId, status: 'ACTIVE' },
    take: 3,
  });

  // Check if saved
  let isSaved = false;
  if (userId) {
    const saved = await db.savedSparkRecord.findUnique({
      where: { userId_experienceId: { userId, experienceId } },
    });
    isSaved = !!saved;
  }

  return {
    experience: {
      id: exp.id,
      title: exp.title,
      description: exp.description,
      creatorId: exp.creatorId,
      creatorName: exp.creator?.displayName ?? 'Unknown',
      creatorHandle: exp.creator?.handle ?? 'unknown',
      creatorLevel: exp.creator?.creatorLevel ?? 1,
      isFork: !!exp.parentExperienceId,
      parentExperienceId: exp.parentExperienceId ?? undefined,
      publishedAt: exp.publishedAt?.getTime() ?? exp.createdAt.getTime(),
      intent,
      genome,
    },
    stats: {
      playCount: exp.playCount,
      forkCount: exp.forkCount,
      likeCount: exp.likeCount,
      reputationScore: reputation.overallScore,
      reputationBreakdown: reputation,
      interactionStats,
    },
    leaderboard,
    comments,
    remixes,
    related,
    challenges: challenges.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      rewardLiquid: c.rewardLiquid,
      participants: JSON.parse(c.participantsJson).length,
    })),
    isSaved,
  };
}

/**
 * Submit a leaderboard entry after a play session.
 */
export async function submitLeaderboardEntry(params: {
  experienceId: string;
  userId: string;
  displayName: string;
  score: number;
  sessionId?: string;
}): Promise<void> {
  const existing = await db.leaderboardEntryRecord.findUnique({
    where: { experienceId_userId: { experienceId: params.experienceId, userId: params.userId } },
  });

  if (existing) {
    // Only update if new score is higher
    if (params.score > existing.score) {
      await db.leaderboardEntryRecord.update({
        where: { id: existing.id },
        data: { score: params.score, sessionId: params.sessionId, achievedAt: new Date() },
      });
    }
  } else {
    await db.leaderboardEntryRecord.create({
      data: {
        experienceId: params.experienceId,
        userId: params.userId,
        displayName: params.displayName,
        score: params.score,
        sessionId: params.sessionId,
      },
    });
  }

  // Recompute ranks
  const entries = await db.leaderboardEntryRecord.findMany({
    where: { experienceId: params.experienceId },
    orderBy: { score: 'desc' },
  });
  for (let i = 0; i < entries.length; i++) {
    await db.leaderboardEntryRecord.update({
      where: { id: entries[i].id },
      data: { rank: i + 1 },
    });
  }
}

/**
 * Get the global leaderboard across all experiences.
 */
export async function getGlobalLeaderboard(limit = 20): Promise<any[]> {
  const entries = await db.leaderboardEntryRecord.findMany({
    orderBy: { score: 'desc' },
    take: limit,
  });

  // Get experience titles
  const expIds = [...new Set(entries.map((e) => e.experienceId))];
  const exps = await db.experienceRecord.findMany({ where: { id: { in: expIds } } });
  const expMap = new Map(exps.map((e) => [e.id, e.title]));

  return entries.map((e, i) => ({
    rank: i + 1,
    userId: e.userId,
    displayName: e.displayName,
    score: e.score,
    experienceId: e.experienceId,
    experienceName: expMap.get(e.experienceId) ?? 'Unknown',
    achievedAt: e.achievedAt.getTime(),
  }));
}
