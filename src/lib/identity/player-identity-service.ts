/**
 * Identity Layer v0.45 — Player Identity Service
 * ------------------------------------------------
 * Computes a player's full persistent identity from their play history,
 * skills, reputation, achievements, inventory, and world passport.
 *
 * This is the canonical identity that persists across every Spark and World.
 */

import { db } from '@/lib/db';
import type {
  FullPlayerIdentity, PlayerReputation, Achievement, InventoryItem,
  WorldPassport, AICompanionState,
} from '@/kernel/types';

export async function ensurePlayerProfile(userId: string, displayName?: string): Promise<void> {
  const existing = await db.playerProfile.findUnique({ where: { userId } });
  if (!existing) {
    await db.playerProfile.create({
      data: {
        userId,
        displayName: displayName ?? `Player_${userId.slice(-4)}`,
      },
    });
  }
}

export async function getFullPlayerIdentity(userId: string): Promise<FullPlayerIdentity | null> {
  const profile = await db.playerProfile.findUnique({ where: { userId } });
  if (!profile) return null;

  // Fetch sessions for play history
  const sessions = await db.playSession.findMany({
    where: { userId },
    include: { telemetry: true },
  });

  const totalSessions = sessions.length;
  const totalPlayTimeMs = sessions.reduce((s, sess) => s + (sess.telemetry?.sessionDurationMs ?? 0), 0);

  // Fetch achievements
  const achievementRecords = await db.achievementRecord.findMany({
    where: { userId },
    orderBy: { earnedAt: 'desc' },
  });
  const achievements: Achievement[] = achievementRecords.map((r) => ({
    id: r.id,
    achievementId: r.achievementId,
    title: r.title,
    description: r.description,
    icon: r.icon,
    category: r.category as Achievement['category'],
    rarity: r.rarity as Achievement['rarity'],
    xpReward: r.xpReward,
    earnedAt: r.earnedAt.getTime(),
  }));

  // Fetch inventory
  const inventoryRecords = await db.inventoryItemRecord.findMany({
    where: { userId },
    orderBy: { acquiredAt: 'desc' },
  });
  const inventory: InventoryItem[] = inventoryRecords.map((r) => ({
    id: r.id,
    itemId: r.itemId,
    name: r.name,
    description: r.description,
    icon: r.icon,
    type: r.type as InventoryItem['type'],
    rarity: r.rarity as InventoryItem['rarity'],
    quantity: r.quantity,
    worldId: r.worldId ?? undefined,
    acquiredAt: r.acquiredAt.getTime(),
  }));

  // Fetch world passport
  const visitRecords = await db.worldVisitRecord.findMany({
    where: { userId },
    orderBy: { lastVisitAt: 'desc' },
  });
  const worldPassport: WorldPassport = {
    visited: visitRecords.map((r) => ({
      worldId: r.worldId,
      worldName: r.worldName,
      visitCount: r.visitCount,
      firstVisitAt: r.firstVisitAt.getTime(),
      lastVisitAt: r.lastVisitAt.getTime(),
      citizenshipStatus: r.citizenshipStatus as WorldPassport['visited'][0]['citizenshipStatus'],
    })),
    citizenships: [], // populated from guild memberships
    totalWorldsVisited: visitRecords.length,
  };

  // Compute skills from play history
  const skills = computeSkills(sessions);

  // Compute reputation
  const reputation = computeReputation(profile, sessions, achievements);

  // Social stats
  const followers = (JSON.parse(profile.followersJson) as string[]).length;
  const following = (JSON.parse(profile.followingJson) as string[]).length;
  const friends = (JSON.parse(profile.friendsJson) as string[]).length;

  // Favorite worlds (most visited)
  const favoriteWorlds = visitRecords
    .sort((a, b) => b.visitCount - a.visitCount)
    .slice(0, 3)
    .map((r) => r.worldName);

  // AI Companion state
  const companion: AICompanionState = profile.companionStateJson
    ? JSON.parse(profile.companionStateJson)
    : defaultCompanionState();

  // Level/XP
  const level = profile.playerLevel;
  const xp = profile.playerXP;
  const xpToNextLevel = level * 100; // simple progression

  return {
    userId,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl ?? undefined,
    bio: profile.bio ?? undefined,
    level,
    xp,
    xpToNextLevel,
    skills,
    reputation,
    achievements,
    inventory,
    worldPassport,
    liquidBalance: profile.liquidBalance,
    social: { followers, following, friends },
    totalSessions,
    totalPlayTimeMs,
    favoriteWorlds,
    companion,
    createdAt: profile.createdAt.getTime(),
  };
}

function computeSkills(sessions: any[]): Record<string, number> {
  const skills: Record<string, number> = {
    farming: 0,
    trading: 0,
    strategy: 0,
    building: 0,
    exploration: 0,
    combat: 0,
  };

  for (const s of sessions) {
    if (s.telemetry) {
      const tokens = s.telemetry.tokensEmittedJson ? JSON.parse(s.telemetry.tokensEmittedJson) : {};
      if (tokens.CORN) skills.farming += tokens.CORN * 2;
      if (tokens.MEAL) skills.cooking = (skills.cooking ?? 0) + tokens.MEAL * 3;
      if (tokens.GOLD) skills.trading += tokens.GOLD * 5;
      if (s.telemetry.score > 0) skills.strategy += Math.floor(s.telemetry.score / 10);
    }
  }

  // Cap at 100 and ensure minimum 0
  for (const k of Object.keys(skills)) {
    skills[k] = Math.min(100, skills[k]);
  }

  return skills;
}

function computeReputation(profile: any, sessions: any[], achievements: Achievement[]): PlayerReputation {
  const base = profile.reputationJson ? JSON.parse(profile.reputationJson) : {};
  const completedSessions = sessions.filter((s) => s.telemetry?.completion).length;
  const completionRate = sessions.length > 0 ? completedSessions / sessions.length : 0;

  return {
    builder: base.builder ?? Math.min(100, achievements.filter((a) => a.category === 'create').length * 15),
    trader: base.trader ?? Math.min(100, sessions.filter((s) => {
      const tokens = s.telemetry?.tokensEmittedJson ? JSON.parse(s.telemetry.tokensEmittedJson) : {};
      return tokens.GOLD > 0;
    }).length * 10),
    explorer: base.explorer ?? Math.min(100, achievements.filter((a) => a.category === 'exploration').length * 20),
    competitor: base.competitor ?? Math.min(100, sessions.filter((s) => s.score > 20).length * 5),
    creator: base.creator ?? Math.min(100, profile.creatorScore),
    social: base.social ?? Math.min(100, (JSON.parse(profile.followersJson) as string[]).length * 5),
    toxicity: base.toxicity ?? 0,
    trust: base.trust ?? profile.trustScore,
  };
}

function defaultCompanionState(): AICompanionState {
  return {
    personality: { warmth: 70, directness: 60, playfulness: 50 },
    memory: [],
    lastInteraction: 0,
    conversationCount: 0,
    knownPreferences: [],
    suggestedActions: [],
  };
}

// ─── Update functions ──────────────────────────────────────────────────────

export async function awardXP(userId: string, xp: number): Promise<void> {
  const profile = await db.playerProfile.findUnique({ where: { userId } });
  if (!profile) return;

  const newXP = profile.playerXP + xp;
  const currentLevel = profile.playerLevel;
  const xpForNext = currentLevel * 100;
  const newLevel = newXP >= xpForNext ? currentLevel + 1 : currentLevel;

  await db.playerProfile.update({
    where: { userId },
    data: {
      playerXP: newXP,
      playerLevel: newLevel,
    },
  });
}

export async function updateSkills(userId: string, skillDelta: Record<string, number>): Promise<void> {
  const profile = await db.playerProfile.findUnique({ where: { userId } });
  if (!profile) return;

  const skills: Record<string, number> = JSON.parse(profile.skillsJson);
  for (const [skill, delta] of Object.entries(skillDelta)) {
    skills[skill] = Math.min(100, (skills[skill] ?? 0) + delta);
  }

  await db.playerProfile.update({
    where: { userId },
    data: { skillsJson: JSON.stringify(skills) },
  });
}

export async function updateReputation(userId: string, repDelta: Partial<PlayerReputation>): Promise<void> {
  const profile = await db.playerProfile.findUnique({ where: { userId } });
  if (!profile) return;

  const rep: PlayerReputation = profile.reputationJson
    ? JSON.parse(profile.reputationJson)
    : { builder: 0, trader: 0, explorer: 0, competitor: 0, creator: 0, social: 0, toxicity: 0, trust: 50 };

  for (const [key, value] of Object.entries(repDelta)) {
    (rep as any)[key] = Math.min(100, Math.max(0, (rep as any)[key] + value));
  }

  await db.playerProfile.update({
    where: { userId },
    data: { reputationJson: JSON.stringify(rep) },
  });
}

export async function updateCompanionState(userId: string, updates: Partial<AICompanionState>): Promise<void> {
  const profile = await db.playerProfile.findUnique({ where: { userId } });
  if (!profile) return;

  const current: AICompanionState = profile.companionStateJson
    ? JSON.parse(profile.companionStateJson)
    : defaultCompanionState();

  const updated = { ...current, ...updates };
  await db.playerProfile.update({
    where: { userId },
    data: { companionStateJson: JSON.stringify(updated) },
  });
}
