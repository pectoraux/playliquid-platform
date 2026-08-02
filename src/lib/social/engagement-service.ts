/**
 * Phase 28 — Engagement Service
 * ------------------------------
 * Likes, saves, play history, and real notifications.
 * Connects the social graph to the consumer experience.
 */

import { db } from '@/lib/db';

// ─── Likes ─────────────────────────────────────────────────────────────────

export async function toggleLike(experienceId: string, userId: string = 'demo-user'): Promise<{ liked: boolean; likeCount: number }> {
  const existing = await db.experienceLikeRecord.findUnique({
    where: { experienceId_userId: { experienceId, userId } },
  });

  if (existing) {
    await db.experienceLikeRecord.delete({ where: { id: existing.id } });
    await db.experienceRecord.update({
      where: { id: experienceId },
      data: { likeCount: { decrement: 1 } },
    }).catch(() => {});
    const likeCount = await db.experienceLikeRecord.count({ where: { experienceId } });
    return { liked: false, likeCount };
  }

  await db.experienceLikeRecord.create({ data: { experienceId, userId } });
  await db.experienceRecord.update({
    where: { id: experienceId },
    data: { likeCount: { increment: 1 } },
  }).catch(() => {});
  const likeCount = await db.experienceLikeRecord.count({ where: { experienceId } });
  return { liked: true, likeCount };
}

export async function isLiked(experienceId: string, userId: string = 'demo-user'): Promise<boolean> {
  const like = await db.experienceLikeRecord.findUnique({
    where: { experienceId_userId: { experienceId, userId } },
  });
  return !!like;
}

export async function getLikedExperiences(userId: string = 'demo-user'): Promise<Array<{
  experienceId: string;
  title: string;
  displayTitle: string | null;
  thumbnailUrl: string | null;
  creatorName: string;
  format: string;
}>> {
  const likes = await db.experienceLikeRecord.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { experience: { include: { creator: true } } },
  });
  return likes
    .filter((l) => l.experience)
    .map((l) => ({
      experienceId: l.experience.id,
      title: l.experience.title,
      displayTitle: l.experience.displayTitle,
      thumbnailUrl: l.experience.thumbnailUrl,
      creatorName: l.experience.creator?.displayName ?? 'Unknown',
      format: l.experience.format,
    }));
}

// ─── Saved (Watch Later / Playlists) ───────────────────────────────────────

export async function toggleSave(experienceId: string, listType: string = 'watch-later', userId: string = 'demo-user'): Promise<{ saved: boolean }> {
  const existing = await db.savedExperienceRecord.findUnique({
    where: { experienceId_userId_listType: { experienceId, userId, listType } },
  });

  if (existing) {
    await db.savedExperienceRecord.delete({ where: { id: existing.id } });
    return { saved: false };
  }

  await db.savedExperienceRecord.create({ data: { experienceId, userId, listType } });
  return { saved: true };
}

export async function isSaved(experienceId: string, listType: string = 'watch-later', userId: string = 'demo-user'): Promise<boolean> {
  const saved = await db.savedExperienceRecord.findUnique({
    where: { experienceId_userId_listType: { experienceId, userId, listType } },
  });
  return !!saved;
}

export async function getSavedExperiences(listType: string, userId: string = 'demo-user'): Promise<Array<{
  experienceId: string;
  title: string;
  displayTitle: string | null;
  thumbnailUrl: string | null;
  creatorName: string;
  format: string;
}>> {
  const saves = await db.savedExperienceRecord.findMany({
    where: { userId, listType },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { experience: { include: { creator: true } } },
  });
  return saves
    .filter((s) => s.experience)
    .map((s) => ({
      experienceId: s.experience.id,
      title: s.experience.title,
      displayTitle: s.experience.displayTitle,
      thumbnailUrl: s.experience.thumbnailUrl,
      creatorName: s.experience.creator?.displayName ?? 'Unknown',
      format: s.experience.format,
    }));
}

// ─── Play History ──────────────────────────────────────────────────────────

export async function recordPlay(params: {
  experienceId: string;
  experienceTitle: string;
  userId?: string;
  score?: number;
  durationMs?: number;
}): Promise<void> {
  await db.playHistoryRecord.create({
    data: {
      experienceId: params.experienceId,
      experienceTitle: params.experienceTitle,
      userId: params.userId ?? 'demo-user',
      score: params.score ?? 0,
      durationMs: params.durationMs ?? 0,
    },
  });
}

export async function getPlayHistory(userId: string = 'demo-user', limit = 50): Promise<Array<{
  experienceId: string;
  experienceTitle: string;
  score: number;
  durationMs: number;
  playedAt: number;
}>> {
  const history = await db.playHistoryRecord.findMany({
    where: { userId },
    orderBy: { playedAt: 'desc' },
    take: limit,
  });
  return history.map((h) => ({
    experienceId: h.experienceId,
    experienceTitle: h.experienceTitle,
    score: h.score,
    durationMs: h.durationMs,
    playedAt: h.playedAt.getTime(),
  }));
}

// ─── Notifications ─────────────────────────────────────────────────────────

export async function getNotifications(userId: string = 'demo-user', limit = 20): Promise<Array<{
  id: string;
  type: string;
  title: string;
  body: string;
  icon: string;
  targetType: string | null;
  targetId: string | null;
  isRead: boolean;
  createdAt: number;
}>> {
  const notifications = await db.notificationRecord.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  // If no real notifications, seed some sample ones
  if (notifications.length === 0) {
    const samples = [
      { type: 'follow', title: 'New follower', body: 'Alex Rivers started following you', icon: '👥' },
      { type: 'challenge', title: 'Challenge accepted', body: 'Maya Chen accepted your Neon Runner challenge', icon: '⚔️' },
      { type: 'comment', title: 'Comment reply', body: 'Diego Torres replied to your comment', icon: '💬' },
      { type: 'leaderboard', title: 'Leaderboard update', body: 'You dropped to #3 on Sky Defender', icon: '📊' },
      { type: 'tournament', title: 'Tournament starts soon', body: 'Neon Runner Championship begins in 30 minutes', icon: '🏆' },
    ];
    for (const s of samples) {
      await db.notificationRecord.create({
        data: { userId, ...s, targetType: null, targetId: null },
      }).catch(() => {});
    }
    const seeded = await db.notificationRecord.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return seeded.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      icon: n.icon,
      targetType: n.targetType,
      targetId: n.targetId,
      isRead: n.isRead,
      createdAt: n.createdAt.getTime(),
    }));
  }

  return notifications.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    icon: n.icon,
    targetType: n.targetType,
    targetId: n.targetId,
    isRead: n.isRead,
    createdAt: n.createdAt.getTime(),
  }));
}

export async function markNotificationsRead(userId: string = 'demo-user'): Promise<void> {
  await db.notificationRecord.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
}

export async function getUnreadCount(userId: string = 'demo-user'): Promise<number> {
  return db.notificationRecord.count({
    where: { userId, isRead: false },
  });
}
