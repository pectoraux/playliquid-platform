/**
 * World Engine — Player Identity Service
 * ---------------------------------------
 * Builds a player's evolving identity (genome + scores) from their play history.
 * The player genome captures preferences; the scores reflect reputation.
 */

import { db } from '@/lib/db';
import type { PlayerIdentity, PlayerGenome, ExperienceKind, ExperienceEmotion } from '@/kernel/types';

const DEMO_USER_ID = 'demo-user';

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

export async function getPlayerIdentity(userId: string): Promise<PlayerIdentity | null> {
  const profile = await db.playerProfile.findUnique({ where: { userId } });
  if (!profile) return null;

  // Fetch all sessions for this player
  const sessions = await db.playSession.findMany({
    where: { userId },
    include: { telemetry: true, bundle: true },
  });

  const genome = await computePlayerGenome(userId, sessions);
  const sessionCount = sessions.length;

  // Compute scores
  const completedSessions = sessions.filter((s) => s.telemetry?.completion).length;
  const playerScore = Math.min(100, sessionCount * 2 + completedSessions * 5);
  const creatorScore = profile.creatorScore;
  const collaborationScore = profile.collaborationScore;
  const trustScore = profile.trustScore;

  return {
    userId,
    displayName: profile.displayName,
    playerGenome: genome,
    creatorScore,
    playerScore,
    collaborationScore,
    trustScore,
    achievements: profile.achievementsJson ? JSON.parse(profile.achievementsJson) : [],
    sessionCount,
    createdAt: profile.createdAt.getTime(),
  };
}

async function computePlayerGenome(userId: string, sessions: any[]): Promise<PlayerGenome> {
  if (sessions.length === 0) {
    return {
      favoriteGenres: [],
      emotionPreferences: [],
      playedExtensions: [],
      completionRate: 0,
      averageSessionLength: 0,
      skillLevel: 0,
      socialBehavior: 'solo',
      creatorAffinity: [],
    };
  }

  // Aggregate signals
  const genreCounts: Record<string, number> = {};
  const extensionSet = new Set<string>();
  const creatorSet = new Set<string>();
  let totalDuration = 0;
  let completedCount = 0;
  let totalScore = 0;

  for (const s of sessions) {
    // Genre from experience record
    if (s.experienceId) {
      const exp = await db.experienceRecord.findUnique({ where: { id: s.experienceId } });
      if (exp) {
        const intent = exp.intentJson ? JSON.parse(exp.intentJson) : {};
        const kind = intent.kind as ExperienceKind;
        if (kind) genreCounts[kind] = (genreCounts[kind] ?? 0) + 1;
        creatorSet.add(exp.creatorId);
      }
    }

    if (s.bundle) {
      const bundle = JSON.parse(s.bundle.bundleJson);
      for (const inst of bundle.instances ?? []) {
        extensionSet.add(inst.extensionId);
      }
    }

    if (s.telemetry) {
      totalDuration += s.telemetry.sessionDurationMs;
      if (s.telemetry.completion) completedCount++;
      totalScore += s.telemetry.score ?? 0;
    }
  }

  const favoriteGenres = Object.entries(genreCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([k]) => k as ExperienceKind);

  // Emotion preferences from played experiences
  const emotionCounts: Record<string, number> = {};
  for (const s of sessions) {
    if (s.experienceId) {
      const exp = await db.experienceRecord.findUnique({ where: { id: s.experienceId } });
      if (exp) {
        const intent = exp.intentJson ? JSON.parse(exp.intentJson) : {};
        for (const e of intent.emotions ?? []) {
          emotionCounts[e] = (emotionCounts[e] ?? 0) + 1;
        }
      }
    }
  }
  const emotionPreferences = Object.entries(emotionCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)
    .map(([k]) => k as ExperienceEmotion);

  const completionRate = sessions.length > 0 ? completedCount / sessions.length : 0;
  const averageSessionLength = sessions.length > 0 ? totalDuration / sessions.length : 0;
  const skillLevel = Math.min(100, Math.round((totalScore / Math.max(sessions.length, 1)) * 0.5 + completionRate * 50));

  // Social behavior heuristic
  const hasCompetition = extensionSet.has('pl.competition');
  const socialBehavior: PlayerGenome['socialBehavior'] = hasCompetition
    ? 'competitive'
    : extensionSet.has('pl.marketplace')
    ? 'social'
    : 'solo';

  return {
    favoriteGenres,
    emotionPreferences,
    playedExtensions: Array.from(extensionSet),
    completionRate,
    averageSessionLength,
    skillLevel,
    socialBehavior,
    creatorAffinity: Array.from(creatorSet),
  };
}

export async function updatePlayerScore(userId: string, delta: number): Promise<void> {
  await db.playerProfile.update({
    where: { userId },
    data: { playerScore: { increment: delta } },
  }).catch(() => {});
}

export async function addAchievement(userId: string, achievement: string): Promise<void> {
  const profile = await db.playerProfile.findUnique({ where: { userId } });
  if (!profile) return;
  const achievements = profile.achievementsJson ? JSON.parse(profile.achievementsJson) : [];
  if (!achievements.includes(achievement)) {
    achievements.push(achievement);
    await db.playerProfile.update({
      where: { userId },
      data: { achievementsJson: JSON.stringify(achievements) },
    });
  }
}

/** Ensure the demo user has a profile */
export async function ensureDemoPlayer(): Promise<void> {
  await ensurePlayerProfile(DEMO_USER_ID, 'Demo Player');
}
