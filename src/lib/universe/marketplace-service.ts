/**
 * Universe v0.4 — Marketplace Service
 * -------------------------------------
 * Assembles the marketplace home feed: trending, new releases,
 * recommended, friends playing, AI curated collections.
 */

import { db } from '@/lib/db';
import { getRecommendations, getTrending } from '@/lib/world/discovery-service';
import { computeReputation } from './rating-service';

export interface SparkCard {
  experienceId: string;
  title: string;
  description: string;
  creatorId: string;
  creatorName: string;
  playCount: number;
  forkCount: number;
  likeCount: number;
  reputationScore: number;
  genome?: any;
  intent: any;
  isFork: boolean;
  publishedAt: number;
}

export interface MarketplaceHome {
  trending: SparkCard[];
  newReleases: SparkCard[];
  recommended: SparkCard[];
  friendsPlaying: SparkCard[];
  worldsPopular: any[];
}

export async function getMarketplaceHome(userId: string): Promise<MarketplaceHome> {
  const [trending, newReleases, recommended, friendsPlaying, worldsPopular] = await Promise.all([
    getTrendingSparks(),
    getNewReleases(),
    getRecommendedSparks(userId),
    getFriendsPlaying(userId),
    getPopularWorlds(),
  ]);

  return { trending, newReleases, recommended, friendsPlaying, worldsPopular };
}

async function getTrendingSparks(limit = 10): Promise<SparkCard[]> {
  const trending = await getTrending(limit);
  const cards: SparkCard[] = [];
  for (const t of trending) {
    const card = await toSparkCard(t.experienceId);
    if (card) cards.push(card);
  }
  return cards;
}

async function getNewReleases(limit = 10): Promise<SparkCard[]> {
  const experiences = await db.experienceRecord.findMany({
    where: { status: 'PUBLISHED' },
    include: { creator: true },
    orderBy: { publishedAt: 'desc' },
    take: limit,
  });
  const cards: SparkCard[] = [];
  for (const exp of experiences) {
    const card = await toSparkCard(exp.id);
    if (card) cards.push(card);
  }
  return cards;
}

async function getRecommendedSparks(userId: string, limit = 10): Promise<SparkCard[]> {
  const recs = await getRecommendations(userId, limit);
  const cards: SparkCard[] = [];
  for (const r of recs) {
    const card = await toSparkCard(r.experienceId);
    if (card) cards.push(card);
  }
  return cards;
}

async function getFriendsPlaying(userId: string, limit = 10): Promise<SparkCard[]> {
  // Get the user's friend list
  const profile = await db.playerProfile.findUnique({ where: { userId } });
  if (!profile) return [];

  const friends: string[] = JSON.parse(profile.friendsJson);
  const following: string[] = JSON.parse(profile.followingJson);
  const socialConnections = [...new Set([...friends, ...following])];

  if (socialConnections.length === 0) return [];

  // Find experiences these users have played recently
  const sessions = await db.playSession.findMany({
    where: { userId: { in: socialConnections } },
    select: { experienceId: true },
    distinct: ['experienceId'],
    take: 20,
  });

  const cards: SparkCard[] = [];
  for (const s of sessions.slice(0, limit)) {
    const card = await toSparkCard(s.experienceId);
    if (card) cards.push(card);
  }
  return cards;
}

async function getPopularWorlds(limit = 5): Promise<any[]> {
  const worlds = await db.worldRecord.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { population: 'desc' },
    take: limit,
  });
  return worlds.map((w) => ({
    id: w.id,
    name: w.name,
    population: w.population,
    tickCount: w.tickCount,
    description: w.description,
  }));
}

async function toSparkCard(experienceId: string): Promise<SparkCard | null> {
  const exp = await db.experienceRecord.findUnique({
    where: { id: experienceId },
    include: { creator: true },
  });
  if (!exp) return null;

  const reputation = await computeReputation(experienceId);
  const genome = exp.genomeJson ? JSON.parse(exp.genomeJson) : null;
  const intent = exp.intentJson ? JSON.parse(exp.intentJson) : {};

  return {
    experienceId: exp.id,
    title: exp.title,
    description: exp.description,
    creatorId: exp.creatorId,
    creatorName: exp.creator?.displayName ?? 'Unknown',
    playCount: exp.playCount,
    forkCount: exp.forkCount,
    likeCount: exp.likeCount,
    reputationScore: reputation.overallScore,
    genome,
    intent,
    isFork: !!exp.parentExperienceId,
    publishedAt: exp.publishedAt?.getTime() ?? exp.createdAt.getTime(),
  };
}
