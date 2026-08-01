/**
 * v0.45 Consumer Reality Layer — Play Graph + Discover Feed Service
 * ----------------------------------------------------------------
 * The Play Graph tracks every user interaction with Sparks:
 * liked, played, abandoned, mastered, shared, forked, watched, competed, saved.
 *
 * This is PlayLiquid's equivalent of YouTube's watch history.
 * The recommendation engine optimizes for "probability user has fun"
 * not "probability user clicks."
 */

import { db } from '@/lib/db';

// ─── Play Graph ────────────────────────────────────────────────────────────

export type PlayInteraction =
  | 'liked' | 'played' | 'abandoned' | 'mastered' | 'shared'
  | 'forked' | 'watched' | 'competed' | 'saved' | 'rated';

export async function recordInteraction(params: {
  userId: string;
  experienceId: string;
  interaction: PlayInteraction;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await db.playGraphRecord.create({
    data: {
      userId: params.userId,
      experienceId: params.experienceId,
      interaction: params.interaction,
      metadataJson: JSON.stringify(params.metadata ?? {}),
    },
  });
}

export async function getPlayGraph(userId: string, limit = 100): Promise<any[]> {
  const records = await db.playGraphRecord.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return records.map((r) => ({
    id: r.id,
    experienceId: r.experienceId,
    interaction: r.interaction,
    metadata: r.metadataJson ? JSON.parse(r.metadataJson) : {},
    createdAt: r.createdAt.getTime(),
  }));
}

export async function getInteractionStats(experienceId: string): Promise<Record<string, number>> {
  const records = await db.playGraphRecord.findMany({
    where: { experienceId },
    select: { interaction: true },
  });
  const stats: Record<string, number> = {};
  for (const r of records) {
    stats[r.interaction] = (stats[r.interaction] ?? 0) + 1;
  }
  return stats;
}

// ─── Save / Library ────────────────────────────────────────────────────────

export async function saveSpark(userId: string, experienceId: string): Promise<void> {
  await db.savedSparkRecord.upsert({
    where: { userId_experienceId: { userId, experienceId } },
    create: { userId, experienceId },
    update: {},
  });
  await recordInteraction({ userId, experienceId, interaction: 'saved' });
}

export async function unsaveSpark(userId: string, experienceId: string): Promise<void> {
  await db.savedSparkRecord.deleteMany({ where: { userId, experienceId } });
}

export async function getSavedSparks(userId: string): Promise<any[]> {
  const saved = await db.savedSparkRecord.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  const expIds = saved.map((s) => s.experienceId);
  const exps = await db.experienceRecord.findMany({ where: { id: { in: expIds } }, include: { creator: true } });
  return exps.map((e) => ({
    experienceId: e.id,
    title: e.title,
    description: e.description,
    creatorName: e.creator?.displayName ?? 'Unknown',
    creatorId: e.creatorId,
    playCount: e.playCount,
    forkCount: e.forkCount,
    savedAt: saved.find((s) => s.experienceId === e.id)?.createdAt.getTime() ?? 0,
  }));
}

// ─── Discover Feed (YouTube-style) ─────────────────────────────────────────

export interface DiscoverFeed {
  forYou: FeedSection;
  trending: FeedSection;
  following: FeedSection;
  friends: FeedSection;
  live: LiveSection;
  challenges: ChallengeSection;
}

export interface FeedSection {
  title: string;
  subtitle: string;
  sparks: SparkFeedItem[];
}

export interface SparkFeedItem {
  experienceId: string;
  title: string;
  description: string;
  creatorId: string;
  creatorName: string;
  creatorLevel: number;
  playCount: number;
  forkCount: number;
  likeCount: number;
  reputationScore: number;
  genomeScores?: any;
  intent: any;
  thumbnail?: string;
  isLive?: boolean;
  isNew?: boolean;
  matchReason?: string;
}

export interface LiveSection {
  title: string;
  sessions: Array<{
    id: string;
    experienceId: string;
    experienceName: string;
    streamerName: string;
    viewerCount: number;
    status: string;
  }>;
}

export interface ChallengeSection {
  title: string;
  challenges: any[];
}

export async function getDiscoverFeed(userId: string): Promise<DiscoverFeed> {
  const [forYou, trending, following, friends, live, challenges] = await Promise.all([
    getForYouSection(userId),
    getTrendingSection(),
    getFollowingSection(userId),
    getFriendsSection(userId),
    getLiveSection(),
    getChallengesSection(),
  ]);

  return { forYou, trending, following, friends, live, challenges };
}

async function getForYouSection(userId: string): Promise<FeedSection> {
  // Use the existing discovery engine for personalized recommendations
  const { getRecommendations } = await import('@/lib/world/discovery-service');
  const recs = await getRecommendations(userId, 8);

  const sparks: SparkFeedItem[] = [];
  for (const rec of recs) {
    const exp = await db.experienceRecord.findUnique({
      where: { id: rec.experienceId },
      include: { creator: true },
    });
    if (!exp) continue;

    sparks.push(await toFeedItem(exp, { matchReason: rec.reasons[0] }));
  }

  return {
    title: 'For You',
    subtitle: 'Personalized based on your play history',
    sparks,
  };
}

async function getTrendingSection(): Promise<FeedSection> {
  const { getTrending } = await import('@/lib/world/discovery-service');
  const trending = await getTrending(8);

  const sparks: SparkFeedItem[] = [];
  for (const t of trending) {
    const exp = await db.experienceRecord.findUnique({
      where: { id: t.experienceId },
      include: { creator: true },
    });
    if (!exp) continue;
    sparks.push(await toFeedItem(exp));
  }

  return {
    title: 'Trending',
    subtitle: 'Popular right now',
    sparks,
  };
}

async function getFollowingSection(userId: string): Promise<FeedSection> {
  const profile = await db.playerProfile.findUnique({ where: { userId } });
  if (!profile) return { title: 'Following', subtitle: 'From creators you follow', sparks: [] };

  const following: string[] = JSON.parse(profile.followingJson);
  if (following.length === 0) return { title: 'Following', subtitle: 'Follow creators to see their Sparks here', sparks: [] };

  // Get experiences from followed creators
  const creatorIds = following.filter((id) => id.startsWith('creator_')).map((id) => id.replace('creator_', ''));
  const exps = await db.experienceRecord.findMany({
    where: { creatorId: { in: creatorIds }, status: 'PUBLISHED' },
    include: { creator: true },
    orderBy: { publishedAt: 'desc' },
    take: 8,
  });

  const sparks: SparkFeedItem[] = [];
  for (const exp of exps) {
    sparks.push(await toFeedItem(exp));
  }

  return {
    title: 'Following',
    subtitle: 'New from creators you follow',
    sparks,
  };
}

async function getFriendsSection(userId: string): Promise<FeedSection> {
  const profile = await db.playerProfile.findUnique({ where: { userId } });
  if (!profile) return { title: 'Friends Are Playing', subtitle: 'What your friends are into', sparks: [] };

  const friends: string[] = JSON.parse(profile.friendsJson);
  if (friends.length === 0) {
    // Fall back to following
    const following: string[] = JSON.parse(profile.followingJson);
    if (following.length === 0) return { title: 'Friends Are Playing', subtitle: 'Connect with friends to see what they\'re playing', sparks: [] };
    friends.push(...following);
  }

  // Find experiences these users have played recently
  const sessions = await db.playSession.findMany({
    where: { userId: { in: friends } },
    select: { experienceId: true },
    distinct: ['experienceId'],
    take: 20,
  });

  const sparks: SparkFeedItem[] = [];
  for (const s of sessions.slice(0, 8)) {
    const exp = await db.experienceRecord.findUnique({
      where: { id: s.experienceId },
      include: { creator: true },
    });
    if (exp) sparks.push(await toFeedItem(exp));
  }

  return {
    title: 'Friends Are Playing',
    subtitle: 'What your network is into right now',
    sparks,
  };
}

async function getLiveSection(): Promise<LiveSection> {
  const liveSessions = await db.liveSessionRecord.findMany({
    where: { status: 'LIVE' },
    orderBy: { viewerCount: 'desc' },
    take: 5,
  });

  return {
    title: 'Live Now',
    sessions: liveSessions.map((s) => ({
      id: s.id,
      experienceId: s.experienceId,
      experienceName: s.experienceName,
      streamerName: s.displayName,
      viewerCount: s.viewerCount,
      status: s.status,
    })),
  };
}

async function getChallengesSection(): Promise<ChallengeSection> {
  const challenges = await db.challengeRecord.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  return {
    title: 'Active Challenges',
    challenges: challenges.map((c) => ({
      id: c.id,
      experienceId: c.experienceId,
      title: c.title,
      description: c.description,
      type: c.type,
      rewardLiquid: c.rewardLiquid,
      participants: JSON.parse(c.participantsJson).length,
      endsAt: c.endsAt?.getTime(),
    })),
  };
}

async function toFeedItem(exp: any, opts?: { matchReason?: string }): Promise<SparkFeedItem> {
  const { computeReputation } = await import('@/lib/universe/rating-service');
  const reputation = await computeReputation(exp.id);
  const genome = exp.genomeJson ? JSON.parse(exp.genomeJson) : null;
  const intent = exp.intentJson ? JSON.parse(exp.intentJson) : {};

  const ageHours = (Date.now() - (exp.publishedAt?.getTime() ?? exp.createdAt.getTime())) / (1000 * 60 * 60);

  return {
    experienceId: exp.id,
    title: exp.title,
    description: exp.description,
    creatorId: exp.creatorId,
    creatorName: exp.creator?.displayName ?? 'Unknown',
    creatorLevel: exp.creator?.creatorLevel ?? 1,
    playCount: exp.playCount,
    forkCount: exp.forkCount,
    likeCount: exp.likeCount,
    reputationScore: reputation.overallScore,
    genomeScores: genome ? {
      complexity: genome.complexityScore,
      economy: genome.economyScore,
      social: genome.socialScore,
      retention: genome.retentionPrediction,
    } : undefined,
    intent,
    isNew: ageHours < 24,
    matchReason: opts?.matchReason,
  };
}
