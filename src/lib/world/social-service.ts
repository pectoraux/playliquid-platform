/**
 * World Engine — Social Layer
 * ----------------------------
 * Follows, comments, and community features for experiences.
 */

import { db } from '@/lib/db';

// ─── Follows ───────────────────────────────────────────────────────────────

export async function followExperience(userId: string, experienceId: string): Promise<void> {
  await db.experienceFollow.upsert({
    where: { userId_experienceId: { userId, experienceId } },
    create: { userId, experienceId },
    update: {},
  });
  await db.experienceRecord.update({
    where: { id: experienceId },
    data: { likeCount: { increment: 1 } },
  }).catch(() => {});
}

export async function unfollowExperience(userId: string, experienceId: string): Promise<void> {
  await db.experienceFollow.deleteMany({
    where: { userId, experienceId },
  });
  await db.experienceRecord.update({
    where: { id: experienceId },
    data: { likeCount: { decrement: 1 } },
  }).catch(() => {});
}

export async function getFollowers(experienceId: string): Promise<any[]> {
  const follows = await db.experienceFollow.findMany({
    where: { experienceId },
    include: { player: true },
    orderBy: { createdAt: 'desc' },
  });
  return follows.map((f) => ({
    userId: f.userId,
    displayName: f.player?.displayName ?? 'Unknown',
    followedAt: f.createdAt.getTime(),
  }));
}

export async function getFollowing(userId: string): Promise<any[]> {
  const follows = await db.experienceFollow.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  // Fetch experience titles separately
  const expIds = follows.map((f) => f.experienceId);
  const exps = await db.experienceRecord.findMany({ where: { id: { in: expIds } } });
  const expMap = new Map(exps.map((e) => [e.id, e]));
  return follows.map((f) => ({
    experienceId: f.experienceId,
    title: expMap.get(f.experienceId)?.title ?? 'Unknown',
    followedAt: f.createdAt.getTime(),
  }));
}

// ─── Comments ──────────────────────────────────────────────────────────────

export async function addComment(userId: string, experienceId: string, body: string): Promise<any> {
  const comment = await db.experienceComment.create({
    data: { userId, experienceId, body },
    include: { player: true },
  });
  return {
    id: comment.id,
    userId: comment.userId,
    displayName: comment.player?.displayName ?? 'Unknown',
    body: comment.body,
    createdAt: comment.createdAt.getTime(),
  };
}

export async function getComments(experienceId: string, limit = 50): Promise<any[]> {
  const comments = await db.experienceComment.findMany({
    where: { experienceId },
    include: { player: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return comments.map((c) => ({
    id: c.id,
    userId: c.userId,
    displayName: c.player?.displayName ?? 'Unknown',
    body: c.body,
    createdAt: c.createdAt.getTime(),
  }));
}

// ─── Community Summary ─────────────────────────────────────────────────────

export async function getCommunitySummary(experienceId: string): Promise<{
  followerCount: number;
  commentCount: number;
  recentComments: any[];
}> {
  const [followerCount, commentCount, recentComments] = await Promise.all([
    db.experienceFollow.count({ where: { experienceId } }),
    db.experienceComment.count({ where: { experienceId } }),
    getComments(experienceId, 5),
  ]);

  return { followerCount, commentCount, recentComments };
}
