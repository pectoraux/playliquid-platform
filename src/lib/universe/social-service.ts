/**
 * Universe v0.4 — Activity Feed + Social Graph Service
 * ----------------------------------------------------
 * Records social events and builds the activity feed.
 * Manages follows (creators, sparks, worlds) and friends.
 */

import { db } from '@/lib/db';

// ─── Activity Feed ─────────────────────────────────────────────────────────

export interface ActivityEvent {
  id: string;
  userId: string;
  displayName: string;
  type: 'played' | 'forked' | 'published' | 'followed' | 'earned' | 'evolved' | 'rated' | 'joined' | 'world_created' | 'milestone';
  targetType: 'experience' | 'creator' | 'world' | 'spark';
  targetId?: string;
  targetName?: string;
  detail?: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
}

export async function recordActivity(params: {
  userId: string;
  type: ActivityEvent['type'];
  targetType: ActivityEvent['targetType'];
  targetId?: string;
  targetName?: string;
  detail?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const profile = await db.playerProfile.findUnique({ where: { userId: params.userId } });
  if (!profile) return;

  await db.activityFeedRecord.create({
    data: {
      userId: params.userId,
      type: params.type,
      targetType: params.targetType,
      targetId: params.targetId,
      targetName: params.targetName,
      detail: params.detail,
      metadataJson: JSON.stringify(params.metadata ?? {}),
    },
  });
}

export async function getActivityFeed(limit = 50): Promise<ActivityEvent[]> {
  const records = await db.activityFeedRecord.findMany({
    include: { player: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return records.map((r) => ({
    id: r.id,
    userId: r.userId,
    displayName: r.player?.displayName ?? 'Unknown',
    type: r.type as ActivityEvent['type'],
    targetType: r.targetType as ActivityEvent['targetType'],
    targetId: r.targetId ?? undefined,
    targetName: r.targetName ?? undefined,
    detail: r.detail ?? undefined,
    metadata: r.metadataJson ? JSON.parse(r.metadataJson) : undefined,
    createdAt: r.createdAt.getTime(),
  }));
}

export async function getUserFeed(userId: string, limit = 50): Promise<ActivityEvent[]> {
  // Get the user's following list
  const profile = await db.playerProfile.findUnique({ where: { userId } });
  if (!profile) return getActivityFeed(limit);

  const following: string[] = JSON.parse(profile.followingJson);
  following.push(userId); // include self

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
    type: r.type as ActivityEvent['type'],
    targetType: r.targetType as ActivityEvent['targetType'],
    targetId: r.targetId ?? undefined,
    targetName: r.targetName ?? undefined,
    detail: r.detail ?? undefined,
    metadata: r.metadataJson ? JSON.parse(r.metadataJson) : undefined,
    createdAt: r.createdAt.getTime(),
  }));
}

// ─── Social Graph ──────────────────────────────────────────────────────────

export async function followUser(followerId: string, targetUserId: string): Promise<void> {
  if (followerId === targetUserId) return;

  const [follower, target] = await Promise.all([
    db.playerProfile.findUnique({ where: { userId: followerId } }),
    db.playerProfile.findUnique({ where: { userId: targetUserId } }),
  ]);
  if (!follower || !target) return;

  const following: string[] = JSON.parse(follower.followingJson);
  if (!following.includes(targetUserId)) {
    following.push(targetUserId);
    await db.playerProfile.update({
      where: { userId: followerId },
      data: { followingJson: JSON.stringify(following) },
    });
  }

  const followers: string[] = JSON.parse(target.followersJson);
  if (!followers.includes(followerId)) {
    followers.push(followerId);
    await db.playerProfile.update({
      where: { userId: targetUserId },
      data: { followersJson: JSON.stringify(followers) },
    });
  }

  await recordActivity({
    userId: followerId,
    type: 'followed',
    targetType: 'creator',
    targetId: targetUserId,
    targetName: target.displayName,
  });
}

export async function unfollowUser(followerId: string, targetUserId: string): Promise<void> {
  const [follower, target] = await Promise.all([
    db.playerProfile.findUnique({ where: { userId: followerId } }),
    db.playerProfile.findUnique({ where: { userId: targetUserId } }),
  ]);
  if (!follower || !target) return;

  const following: string[] = JSON.parse(follower.followingJson).filter((id: string) => id !== targetUserId);
  await db.playerProfile.update({
    where: { userId: followerId },
    data: { followingJson: JSON.stringify(following) },
  });

  const followers: string[] = JSON.parse(target.followersJson).filter((id: string) => id !== followerId);
  await db.playerProfile.update({
    where: { userId: targetUserId },
    data: { followersJson: JSON.stringify(followers) },
  });
}

export async function sendFriendRequest(fromUserId: string, toUserId: string): Promise<void> {
  if (fromUserId === toUserId) return;
  await db.friendRequestRecord.upsert({
    where: { fromUserId_toUserId: { fromUserId, toUserId } },
    create: { fromUserId, toUserId },
    update: {},
  });
}

export async function acceptFriendRequest(fromUserId: string, toUserId: string): Promise<void> {
  await db.friendRequestRecord.update({
    where: { fromUserId_toUserId: { fromUserId, toUserId } },
    data: { status: 'ACCEPTED' },
  });

  // Add to both users' friend lists
  for (const [a, b] of [[fromUserId, toUserId], [toUserId, fromUserId]] as const) {
    const profile = await db.playerProfile.findUnique({ where: { userId: a } });
    if (profile) {
      const friends: string[] = JSON.parse(profile.friendsJson);
      if (!friends.includes(b)) {
        friends.push(b);
        await db.playerProfile.update({
          where: { userId: a },
          data: { friendsJson: JSON.stringify(friends) },
        });
      }
    }
  }

  await recordActivity({
    userId: toUserId,
    type: 'joined',
    targetType: 'creator',
    targetId: fromUserId,
    detail: 'is now friends with',
  });
}

export async function getSocialStats(userId: string): Promise<{
  followers: number;
  following: number;
  friends: number;
}> {
  const profile = await db.playerProfile.findUnique({ where: { userId } });
  if (!profile) return { followers: 0, following: 0, friends: 0 };
  return {
    followers: (JSON.parse(profile.followersJson) as string[]).length,
    following: (JSON.parse(profile.followingJson) as string[]).length,
    friends: (JSON.parse(profile.friendsJson) as string[]).length,
  };
}
