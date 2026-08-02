/**
 * Phase 27 — Social Service
 * --------------------------
 * Real subscribe/follow, comments, and creator channel data.
 */

import { db } from '@/lib/db';

// ─── Creator Follow (Subscribe) ────────────────────────────────────────────

export async function followCreator(viewerId: string, creatorId: string): Promise<{ following: boolean }> {
  await db.creatorFollow.upsert({
    where: { viewerId_creatorId: { viewerId, creatorId } },
    create: { viewerId, creatorId },
    update: {},
  });
  await db.creatorRecord.update({
    where: { id: creatorId },
    data: { followers: { increment: 1 } },
  }).catch(() => {});
  return { following: true };
}

export async function unfollowCreator(viewerId: string, creatorId: string): Promise<{ following: boolean }> {
  await db.creatorFollow.deleteMany({
    where: { viewerId, creatorId },
  });
  await db.creatorRecord.update({
    where: { id: creatorId },
    data: { followers: { decrement: 1 } },
  }).catch(() => {});
  return { following: false };
}

export async function isFollowing(viewerId: string, creatorId: string): Promise<boolean> {
  const follow = await db.creatorFollow.findUnique({
    where: { viewerId_creatorId: { viewerId, creatorId } },
  });
  return !!follow;
}

export async function getFollowerCount(creatorId: string): Promise<number> {
  const creator = await db.creatorRecord.findUnique({
    where: { id: creatorId },
    select: { followers: true },
  });
  return creator?.followers ?? 0;
}

// ─── Comments ──────────────────────────────────────────────────────────────

export interface Comment {
  id: string;
  experienceId: string;
  userId: string;
  displayName: string;
  body: string;
  parentId?: string | null;
  likes: number;
  createdAt: number;
  replies?: Comment[];
}

export async function postComment(params: {
  experienceId: string;
  userId?: string;
  displayName?: string;
  body: string;
  parentId?: string;
}): Promise<Comment> {
  const row = await db.experienceCommentV2.create({
    data: {
      experienceId: params.experienceId,
      userId: params.userId ?? 'demo-user',
      displayName: params.displayName ?? 'Player',
      body: params.body,
      parentId: params.parentId ?? null,
    },
  });
  return rowToComment(row);
}

export async function getComments(experienceId: string, limit = 50): Promise<Comment[]> {
  const rows = await db.experienceCommentV2.findMany({
    where: { experienceId, parentId: null },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  const replies = await db.experienceCommentV2.findMany({
    where: { experienceId, parentId: { not: null } },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });
  const replyMap = new Map<string, Comment[]>();
  for (const r of replies) {
    const comment = rowToComment(r);
    const parentId = r.parentId!;
    if (!replyMap.has(parentId)) replyMap.set(parentId, []);
    replyMap.get(parentId)!.push(comment);
  }
  return rows.map(rowToComment).map((c) => ({
    ...c,
    replies: replyMap.get(c.id) ?? [],
  }));
}

export async function likeComment(commentId: string): Promise<{ likes: number }> {
  const row = await db.experienceCommentV2.update({
    where: { id: commentId },
    data: { likes: { increment: 1 } },
    select: { likes: true },
  });
  return { likes: row.likes };
}

// ─── Creator Channel ───────────────────────────────────────────────────────

export interface CreatorChannel {
  creatorId: string;
  displayName: string;
  handle: string;
  bio: string;
  avatarUrl: string | null;
  followers: number;
  isFollowing: boolean;
  experiences: Array<{
    experienceId: string;
    title: string;
    displayTitle: string | null;
    thumbnailUrl: string | null;
    playCount: number;
    format: string;
    publishedAgo: string;
  }>;
}

export async function getCreatorChannel(creatorId: string, viewerId: string = 'demo-user'): Promise<CreatorChannel | null> {
  const creator = await db.creatorRecord.findUnique({
    where: { id: creatorId },
    include: {
      experiences: {
        where: { status: 'PUBLISHED' },
        orderBy: { playCount: 'desc' },
      },
    },
  });
  if (!creator) return null;

  const following = await isFollowing(viewerId, creatorId);

  return {
    creatorId: creator.id,
    displayName: creator.displayName,
    handle: creator.handle,
    bio: creator.bio ?? '',
    avatarUrl: creator.avatarUrl,
    followers: creator.followers,
    isFollowing: following,
    experiences: creator.experiences.map((exp) => ({
      experienceId: exp.id,
      title: exp.title,
      displayTitle: exp.displayTitle,
      thumbnailUrl: exp.thumbnailUrl,
      playCount: exp.playCount,
      format: exp.format,
      publishedAgo: formatRelativeTime(exp.publishedAt ?? exp.createdAt),
    })),
  };
}

// ─── Search ────────────────────────────────────────────────────────────────

export async function searchExperiences(query: string, limit = 20): Promise<Array<{
  experienceId: string;
  title: string;
  displayTitle: string | null;
  thumbnailUrl: string | null;
  creatorName: string;
  creatorId: string;
  playCount: number;
  format: string;
  publishedAgo: string;
}>> {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const results = await db.experienceRecord.findMany({
    where: {
      status: 'PUBLISHED',
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { displayTitle: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ],
    },
    include: { creator: true },
    orderBy: { playCount: 'desc' },
    take: limit,
  });

  // Also search by creator name
  const creatorResults = await db.experienceRecord.findMany({
    where: {
      status: 'PUBLISHED',
      creator: { displayName: { contains: query, mode: 'insensitive' } },
    },
    include: { creator: true },
    orderBy: { playCount: 'desc' },
    take: limit,
  });

  // Merge + dedupe
  const seen = new Set<string>();
  const merged = [...results, ...creatorResults].filter((exp) => {
    if (seen.has(exp.id)) return false;
    seen.add(exp.id);
    return true;
  });

  return merged.map((exp) => ({
    experienceId: exp.id,
    title: exp.title,
    displayTitle: exp.displayTitle,
    thumbnailUrl: exp.thumbnailUrl,
    creatorName: exp.creator?.displayName ?? 'Unknown',
    creatorId: exp.creatorId,
    playCount: exp.playCount,
    format: exp.format,
    publishedAgo: formatRelativeTime(exp.publishedAt ?? exp.createdAt),
  }));
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function rowToComment(row: any): Comment {
  return {
    id: row.id,
    experienceId: row.experienceId,
    userId: row.userId,
    displayName: row.displayName,
    body: row.body,
    parentId: row.parentId,
    likes: row.likes,
    createdAt: row.createdAt instanceof Date ? row.createdAt.getTime() : new Date(row.createdAt).getTime(),
  };
}

function formatRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}
