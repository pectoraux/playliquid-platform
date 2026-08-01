/**
 * v0.46 Social Universe — Social Services
 * -----------------------------------------
 * Following feed, Live gameplay, Replays, Challenges, Collections,
 * Notifications, and Wallet surfaces.
 */

import { db } from '@/lib/db';
import { ledger } from '@/lib/token-store';
import { ACCOUNTS } from '@/kernel/ledger';

// ─── Following Feed ────────────────────────────────────────────────────────

export interface FollowingFeedItem {
  id: string;
  userId: string;
  displayName: string;
  type: string;
  targetType: string;
  targetId?: string;
  targetName?: string;
  detail?: string;
  createdAt: number;
}

export async function getFollowingFeed(userId: string, limit = 30): Promise<FollowingFeedItem[]> {
  const profile = await db.playerProfile.findUnique({ where: { userId } });
  if (!profile) return [];

  const following: string[] = JSON.parse(profile.followingJson);
  following.push(userId);

  const records = await db.activityFeedRecord.findMany({
    where: { userId: { in: following } },
    include: { player: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return records.map((r) => ({
    id: r.id,
    userId: r.userId,
    displayName: r.player?.displayName ?? 'Unknown',
    type: r.type,
    targetType: r.targetType,
    targetId: r.targetId ?? undefined,
    targetName: r.targetName ?? undefined,
    detail: r.detail ?? undefined,
    createdAt: r.createdAt.getTime(),
  }));
}

// ─── Live Gameplay ─────────────────────────────────────────────────────────

export async function goLive(params: {
  userId: string;
  displayName: string;
  experienceId: string;
  experienceName: string;
  sessionId: string;
}): Promise<{ liveId: string }> {
  // End any existing live sessions for this user
  await db.liveSessionRecord.updateMany({
    where: { userId: params.userId, status: 'LIVE' },
    data: { status: 'ENDED', endedAt: new Date() },
  });

  const live = await db.liveSessionRecord.create({
    data: {
      experienceId: params.experienceId,
      experienceName: params.experienceName,
      userId: params.userId,
      displayName: params.displayName,
      sessionId: params.sessionId,
      status: 'LIVE',
      viewerCount: Math.floor(Math.random() * 50) + 1, // simulated viewers
    },
  });

  return { liveId: live.id };
}

export async function endLive(liveId: string): Promise<void> {
  await db.liveSessionRecord.update({
    where: { id: liveId },
    data: { status: 'ENDED', endedAt: new Date() },
  });
}

export async function getLiveSessions(limit = 10): Promise<any[]> {
  const sessions = await db.liveSessionRecord.findMany({
    where: { status: 'LIVE' },
    orderBy: { viewerCount: 'desc' },
    take: limit,
  });
  return sessions.map((s) => ({
    id: s.id,
    experienceId: s.experienceId,
    experienceName: s.experienceName,
    streamerName: s.displayName,
    viewerCount: s.viewerCount,
    peakViewers: s.peakViewers,
    startedAt: s.startedAt.getTime(),
  }));
}

// ─── Replays ───────────────────────────────────────────────────────────────

export async function createReplay(params: {
  sessionId: string;
  experienceId: string;
  experienceName: string;
  userId: string;
  displayName: string;
  score: number;
  durationMs: number;
  eventLog?: any[];
}): Promise<{ replayId: string }> {
  // Determine highlight type
  let highlightType: string | null = null;
  let highlightLabel: string | null = null;

  if (params.score > 200) {
    highlightType = 'world-record';
    highlightLabel = 'Potential world record!';
  } else if (params.score > 100) {
    highlightType = 'clutch';
    highlightLabel = 'High-scoring run';
  } else if (params.durationMs < 3000 && params.score > 0) {
    highlightType = 'speedrun';
    highlightLabel = 'Lightning fast';
  }

  const replay = await db.replayRecord.create({
    data: {
      sessionId: params.sessionId,
      experienceId: params.experienceId,
      experienceName: params.experienceName,
      userId: params.userId,
      displayName: params.displayName,
      score: params.score,
      durationMs: params.durationMs,
      highlightType,
      highlightLabel,
      eventLogJson: JSON.stringify(params.eventLog ?? []),
    },
  });

  return { replayId: replay.id };
}

export async function getReplays(params: {
  experienceId?: string;
  highlightType?: string;
  limit?: number;
}): Promise<any[]> {
  const where: any = { isPublic: true };
  if (params.experienceId) where.experienceId = params.experienceId;
  if (params.highlightType) where.highlightType = params.highlightType;

  const replays = await db.replayRecord.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: params.limit ?? 20,
  });

  return replays.map((r) => ({
    id: r.id,
    experienceId: r.experienceId,
    experienceName: r.experienceName,
    userId: r.userId,
    displayName: r.displayName,
    score: r.score,
    durationMs: r.durationMs,
    highlightType: r.highlightType,
    highlightLabel: r.highlightLabel,
    viewCount: r.viewCount,
    likeCount: r.likeCount,
    createdAt: r.createdAt.getTime(),
  }));
}

export async function viewReplay(replayId: string): Promise<void> {
  await db.replayRecord.update({
    where: { id: replayId },
    data: { viewCount: { increment: 1 } },
  });
}

// ─── Challenges (player-to-player) ─────────────────────────────────────────

export async function createChallenge(params: {
  fromUserId: string;
  toUserId?: string;
  experienceId: string;
  experienceName: string;
  type: string;
  description: string;
  fromScore?: number;
  targetScore?: number;
  rewardLiquid?: number;
  durationHours?: number;
}): Promise<{ challengeId: string }> {
  const challenge = await db.playerChallengeRecord.create({
    data: {
      fromUserId: params.fromUserId,
      toUserId: params.toUserId,
      experienceId: params.experienceId,
      experienceName: params.experienceName,
      type: params.type,
      description: params.description,
      fromScore: params.fromScore,
      targetScore: params.targetScore,
      rewardLiquid: params.rewardLiquid ?? 0,
      expiresAt: params.durationHours ? new Date(Date.now() + params.durationHours * 3600000) : null,
    },
  });

  // Notify the challenged player
  if (params.toUserId) {
    await createNotification({
      userId: params.toUserId,
      type: 'challenge',
      title: 'New Challenge!',
      body: `Someone challenged you to "${params.description}" on ${params.experienceName}`,
      icon: '⚔️',
      targetType: 'challenge',
      targetId: challenge.id,
    });
  }

  return { challengeId: challenge.id };
}

export async function getChallenges(userId?: string): Promise<any[]> {
  const where: any = { status: { in: ['PENDING', 'ACCEPTED'] } };
  if (userId) {
    where.OR = [{ fromUserId: userId }, { toUserId: userId }, { toUserId: null }];
  }

  const challenges = await db.playerChallengeRecord.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return challenges.map((c) => ({
    id: c.id,
    fromUserId: c.fromUserId,
    toUserId: c.toUserId,
    experienceId: c.experienceId,
    experienceName: c.experienceName,
    type: c.type,
    description: c.description,
    fromScore: c.fromScore,
    targetScore: c.targetScore,
    rewardLiquid: c.rewardLiquid,
    status: c.status,
    entries: JSON.parse(c.entriesJson),
    expiresAt: c.expiresAt?.getTime(),
    createdAt: c.createdAt.getTime(),
  }));
}

export async function acceptChallenge(challengeId: string, userId: string): Promise<void> {
  await db.playerChallengeRecord.update({
    where: { id: challengeId },
    data: { status: 'ACCEPTED', toUserId: userId },
  });
}

export async function submitChallengeEntry(challengeId: string, userId: string, score: number): Promise<{ won: boolean }> {
  const challenge = await db.playerChallengeRecord.findUnique({ where: { id: challengeId } });
  if (!challenge) return { won: false };

  const entries = JSON.parse(challenge.entriesJson);
  entries.push({ userId, score, at: Date.now() });
  await db.playerChallengeRecord.update({
    where: { id: challengeId },
    data: { entriesJson: JSON.stringify(entries) },
  });

  // Check if challenge is won
  let won = false;
  if (challenge.type === 'beat-score' && score > (challenge.fromScore ?? 0)) {
    won = true;
  } else if (challenge.type === 'high-score' && entries.length >= 2) {
    won = score === Math.max(...entries.map((e: any) => e.score));
  } else if (challenge.targetScore && score >= challenge.targetScore) {
    won = true;
  }

  if (won) {
    await db.playerChallengeRecord.update({
      where: { id: challengeId },
      data: { status: 'COMPLETED', winnerId: userId },
    });

    // Reward the winner
    if (challenge.rewardLiquid > 0) {
      await ledger.post([
        { account: ACCOUNTS.REWARD_POOL, debit: 0, credit: challenge.rewardLiquid, memo: 'challenge reward' },
        { account: `entity:${userId}:wallet`, debit: challenge.rewardLiquid, credit: 0, memo: 'challenge won' },
      ], `challenge: ${challenge.experienceName}`);
    }

    await createNotification({
      userId,
      type: 'reward',
      title: 'Challenge Won! 🎉',
      body: `You won the challenge "${challenge.description}" and earned ${challenge.rewardLiquid / 1_000_000} Liquid!`,
      icon: '🏆',
      targetType: 'challenge',
      targetId: challengeId,
    });
  }

  return { won };
}

// ─── Collections ───────────────────────────────────────────────────────────

export async function createCollection(params: {
  userId: string;
  title: string;
  description?: string;
  coverEmoji?: string;
}): Promise<{ collectionId: string }> {
  const collection = await db.collectionRecord.create({
    data: {
      userId: params.userId,
      title: params.title,
      description: params.description,
      coverEmoji: params.coverEmoji ?? '📁',
    },
  });
  return { collectionId: collection.id };
}

export async function addToCollection(collectionId: string, experienceId: string): Promise<void> {
  const collection = await db.collectionRecord.findUnique({ where: { id: collectionId } });
  if (!collection) return;

  const items: string[] = JSON.parse(collection.itemsJson);
  if (!items.includes(experienceId)) {
    items.push(experienceId);
    await db.collectionRecord.update({
      where: { id: collectionId },
      data: { itemsJson: JSON.stringify(items) },
    });
  }
}

export async function getCollections(userId?: string, limit = 20): Promise<any[]> {
  const where: any = userId ? { userId } : { isPublic: true };
  const collections = await db.collectionRecord.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: limit,
  });

  return collections.map((c) => ({
    id: c.id,
    userId: c.userId,
    title: c.title,
    description: c.description,
    coverEmoji: c.coverEmoji,
    itemCount: (JSON.parse(c.itemsJson) as string[]).length,
    isPublic: c.isPublic,
    followerCount: c.followerCount,
    updatedAt: c.updatedAt.getTime(),
  }));
}

export async function getCollectionItems(collectionId: string): Promise<any[]> {
  const collection = await db.collectionRecord.findUnique({ where: { id: collectionId } });
  if (!collection) return [];

  const itemIds: string[] = JSON.parse(collection.itemsJson);
  const exps = await db.experienceRecord.findMany({
    where: { id: { in: itemIds } },
    include: { creator: true },
  });

  return exps.map((e) => ({
    experienceId: e.id,
    title: e.title,
    creatorName: e.creator?.displayName ?? 'Unknown',
    playCount: e.playCount,
  }));
}

// ─── Notifications ─────────────────────────────────────────────────────────

export async function createNotification(params: {
  userId: string;
  type: string;
  title: string;
  body: string;
  icon?: string;
  targetType?: string;
  targetId?: string;
}): Promise<void> {
  await db.notificationRecord.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      icon: params.icon ?? '🔔',
      targetType: params.targetType,
      targetId: params.targetId,
    },
  });
}

export async function getNotifications(userId: string, limit = 30): Promise<any[]> {
  const records = await db.notificationRecord.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return records.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body,
    icon: r.icon,
    targetType: r.targetType,
    targetId: r.targetId,
    isRead: r.isRead,
    createdAt: r.createdAt.getTime(),
  }));
}

export async function getUnreadCount(userId: string): Promise<number> {
  return db.notificationRecord.count({ where: { userId, isRead: false } });
}

export async function markAllRead(userId: string): Promise<void> {
  await db.notificationRecord.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
}

// ─── Wallet & Revenue ──────────────────────────────────────────────────────

export async function getPlayerWallet(userId: string): Promise<{
  balance: number;
  earnedToday: number;
  earnedSources: Array<{ source: string; amount: number; time: number }>;
  withdrawable: number;
}> {
  const profile = await db.playerProfile.findUnique({ where: { userId } });
  const balance = profile?.liquidBalance ?? 0;

  // Get recent ledger credits to the player wallet
  const transactions = await ledger.listTransactions(20);
  const earnedSources: Array<{ source: string; amount: number; time: number }> = [];

  for (const tx of transactions) {
    for (const entry of tx.entries) {
      if (entry.account === `player:wallet:${userId}` && entry.debit > 0) {
        earnedSources.push({
          source: tx.memo ?? 'Unknown',
          amount: entry.debit,
          time: tx.createdAt,
        });
      }
    }
  }

  const now = Date.now();
  const earnedToday = earnedSources
    .filter((s) => now - s.time < 86400000)
    .reduce((sum, s) => sum + s.amount, 0);

  return {
    balance,
    earnedToday,
    earnedSources: earnedSources.slice(0, 5),
    withdrawable: Math.floor(balance * 0.8), // 80% withdrawable, 20% reserved
  };
}

export async function getCreatorRevenue(creatorId: string): Promise<{
  totalEarned: number;
  earnedToday: number;
  earnedThisWeek: number;
  topEarningSparks: Array<{ title: string; revenue: number; players: number }>;
  projectedMonthly: number;
}> {
  const creator = await db.creatorRecord.findUnique({ where: { id: creatorId } });
  const totalEarned = creator?.totalLiquid ?? 0;

  // Get creator's experiences
  const exps = await db.experienceRecord.findMany({
    where: { creatorId, status: 'PUBLISHED' },
  });

  const topEarningSparks: Array<{ title: string; revenue: number; players: number }> = [];
  for (const exp of exps) {
    const metrics = await db.experienceMetrics.findUnique({ where: { experienceId: exp.id } });
    topEarningSparks.push({
      title: exp.title,
      revenue: Math.floor(totalEarned / Math.max(exps.length, 1)), // approx per-spark
      players: metrics?.totalSessions ?? exp.playCount,
    });
  }

  topEarningSparks.sort((a, b) => b.revenue - a.revenue);

  const earnedToday = Math.floor(totalEarned * 0.05); // approx
  const earnedThisWeek = Math.floor(totalEarned * 0.2);
  const projectedMonthly = earnedThisWeek * 4;

  return {
    totalEarned,
    earnedToday,
    earnedThisWeek,
    topEarningSparks,
    projectedMonthly,
  };
}
