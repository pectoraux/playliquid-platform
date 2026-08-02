/**
 * Phase 21.1 — Experience Genome Service
 * --------------------------------------
 * Computes the enriched Experience Genome: a structured profile with
 *   - mechanics (from bundle)
 *   - emotional profile (from feedback + telemetry)
 *   - economy profile (from metrics + pricing)
 *   - audience profile (from player sessions)
 *   - intelligence scores (novelty, quality, maturity)
 *
 * Complements the existing ExperienceGenomeRecord (bundle-derived) with
 * audience/economy dimensions that only emerge after players interact.
 */

import { db } from '@/lib/db';
import { computeReputation } from '@/lib/universe/rating-service';
import type { ExperienceIntelligence } from './intelligence-types';
import type { ExperienceBundle } from '@/kernel/types';

const EMOTION_KEYWORDS: Record<string, string[]> = {
  mastery: ['skill', 'master', 'learn', 'improve', 'challenge', 'hard', 'difficulty'],
  excitement: ['fast', 'speed', 'rush', 'exciting', 'intense', 'adrenaline', 'action'],
  creativity: ['build', 'create', 'design', 'craft', 'farm', 'cook', 'custom'],
  relaxation: ['calm', 'relax', 'chill', 'peaceful', 'zen', 'slow'],
  competition: ['compete', 'win', 'score', 'leaderboard', 'rank', 'best', 'tournament'],
};

export async function computeExperienceIntelligence(experienceId: string): Promise<ExperienceIntelligence | null> {
  const exp = await db.experienceRecord.findUnique({
    where: { id: experienceId },
    include: { creator: true },
  });
  if (!exp) return null;

  // Fetch bundle for mechanics
  const bundleRecord = exp.bundleHash
    ? await db.bundleRecord.findUnique({ where: { contentHash: exp.bundleHash } })
    : null;
  let bundle: ExperienceBundle | null = null;
  let mechanics: string[] = [];
  if (bundleRecord) {
    bundle = JSON.parse(bundleRecord.bundleJson);
    mechanics = Array.from(new Set(bundle.instances.map((i) => i.extensionId)));
  }

  // Metrics
  const metrics = await db.experienceMetrics.findUnique({ where: { experienceId } });
  const totalSessions = metrics?.totalSessions ?? 0;

  // Feedback for emotional profile
  const feedback = await db.experienceFeedbackRecord.findMany({ where: { experienceId } });
  const emotionalProfile = computeEmotionalProfile(feedback, metrics);

  // Sessions for audience profile
  const sessions = await db.playSession.findMany({
    where: { experienceId },
    select: { userId: true, tickCount: true, score: true, competitiveMode: true },
  });
  const audienceProfile = computeAudienceProfile(sessions, totalSessions);

  // Economy profile
  const intent = exp.intentJson ? JSON.parse(exp.intentJson) : {};
  const economyProfile = {
    entryPriceXof: exp.pricePerMinuteXof ?? 0,
    monetization: exp.competitiveEligible ? 'competitive' : exp.pricePerMinuteXof && exp.pricePerMinuteXof > 0 ? 'paid' : 'free',
    retention: metrics?.completionRate ?? 0,
    tokenVelocity: totalSessions > 0 ? (metrics?.tokensEarned ?? 0) / totalSessions : 0,
  };

  // Intelligence scores
  const reputation = await computeReputation(experienceId);
  const allExperiences = await db.experienceRecord.findMany({
    where: { status: 'PUBLISHED' },
    select: { id: true },
  });
  const noveltyScore = computeNovelty(mechanics, allExperiences.length);
  const qualityScore = Math.round(
    (reputation.overallScore * 0.5) + ((metrics?.completionRate ?? 0) * 100 * 0.5),
  );
  const maturityScore = computeMaturity(totalSessions, feedback.length);

  const record = await db.experienceIntelligenceRecord.upsert({
    where: { experienceId },
    create: {
      experienceId,
      experienceName: exp.title,
      mechanicsJson: JSON.stringify(mechanics),
      compositionDepth: mechanics.length,
      hasEconomy: mechanics.some((m) => m.includes('farm') || m.includes('marketplace') || m.includes('cooking')),
      hasCompetition: mechanics.includes('pl.competition') || exp.competitiveEligible,
      hasAI: mechanics.some((m) => m.includes('ai') || m.includes('weather')),
      emotionalProfileJson: JSON.stringify(emotionalProfile),
      dominantEmotion: pickDominantEmotion(emotionalProfile),
      economyProfileJson: JSON.stringify(economyProfile),
      audienceProfileJson: JSON.stringify(audienceProfile),
      noveltyScore,
      qualityScore,
      maturityScore,
    },
    update: {
      experienceName: exp.title,
      mechanicsJson: JSON.stringify(mechanics),
      compositionDepth: mechanics.length,
      hasEconomy: mechanics.some((m) => m.includes('farm') || m.includes('marketplace') || m.includes('cooking')),
      hasCompetition: mechanics.includes('pl.competition') || exp.competitiveEligible,
      hasAI: mechanics.some((m) => m.includes('ai') || m.includes('weather')),
      emotionalProfileJson: JSON.stringify(emotionalProfile),
      dominantEmotion: pickDominantEmotion(emotionalProfile),
      economyProfileJson: JSON.stringify(economyProfile),
      audienceProfileJson: JSON.stringify(audienceProfile),
      noveltyScore,
      qualityScore,
      maturityScore,
      computedAt: new Date(),
    },
  });

  return rowToIntelligence(record);
}

export async function getExperienceIntelligence(experienceId: string): Promise<ExperienceIntelligence | null> {
  const row = await db.experienceIntelligenceRecord.findUnique({ where: { experienceId } });
  if (!row) return computeExperienceIntelligence(experienceId);
  return rowToIntelligence(row);
}

export async function getAllExperienceIntelligence(limit = 30): Promise<ExperienceIntelligence[]> {
  const rows = await db.experienceIntelligenceRecord.findMany({
    orderBy: { qualityScore: 'desc' },
    take: limit,
  });
  return rows.map(rowToIntelligence);
}

// ─── helpers ───────────────────────────────────────────────────────────────

function computeEmotionalProfile(feedback: any[], metrics: any): ExperienceIntelligence['emotionalProfile'] {
  const profile = { mastery: 0, excitement: 0, creativity: 0, relaxation: 0, competition: 0 };
  if (feedback.length === 0) {
    // Fallback: infer from telemetry
    profile.competition = metrics && metrics.achievementEvents > metrics.totalSessions ? 0.6 : 0.3;
    profile.mastery = metrics && metrics.frustrationEvents > 0 ? 0.5 : 0.3;
    return normalizeProfile(profile);
  }

  let totalWeight = 0;
  for (const f of feedback) {
    const text = `${f.type} ${f.comment ?? ''}`.toLowerCase();
    const weight = f.funScore > 3 ? 1.5 : 1;
    for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
      const matches = keywords.filter((k) => text.includes(k)).length;
      if (matches > 0) {
        (profile as any)[emotion] += matches * weight;
        totalWeight += matches * weight;
      }
    }
    // type-based emotion mapping
    if (f.type === 'FUN') profile.excitement += 0.5 * weight;
    if (f.type === 'TOO_HARD') profile.mastery += 0.4 * weight;
    if (f.type === 'SUGGESTION') profile.creativity += 0.3 * weight;
  }

  return normalizeProfile(profile);
}

function normalizeProfile(p: Record<string, number>): ExperienceIntelligence['emotionalProfile'] {
  const max = Math.max(...Object.values(p), 1);
  return {
    mastery: round(Math.min(1, p.mastery / max)),
    excitement: round(Math.min(1, p.excitement / max)),
    creativity: round(Math.min(1, p.creativity / max)),
    relaxation: round(Math.min(1, p.relaxation / max)),
    competition: round(Math.min(1, p.competition / max)),
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function pickDominantEmotion(p: ExperienceIntelligence['emotionalProfile']): string | null {
  const entries = Object.entries(p) as [string, number][];
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0] && entries[0][1] > 0 ? entries[0][0] : null;
}

function computeAudienceProfile(sessions: any[], totalSessions: number): ExperienceIntelligence['audienceProfile'] {
  if (sessions.length === 0) {
    return { avgSkill: 0, socialBehavior: 'solo', segment: 'casual', size: 0 };
  }
  const competitive = sessions.filter((s) => s.competitiveMode).length;
  const avgScore = sessions.reduce((sum, s) => sum + (s.score ?? 0), 0) / sessions.length;
  const avgSkill = Math.min(100, Math.round(avgScore / 5));
  const competitiveRatio = competitive / sessions.length;
  const socialBehavior = competitiveRatio > 0.4 ? 'competitive' : competitiveRatio > 0.1 ? 'social' : 'solo';
  const segment = avgSkill > 60 ? 'hardcore' : avgSkill > 30 ? 'regular' : 'casual';
  const uniquePlayers = new Set(sessions.map((s) => s.userId).filter(Boolean)).size;
  return { avgSkill, socialBehavior, segment, size: uniquePlayers || totalSessions };
}

function computeNovelty(mechanics: string[], totalExperiences: number): number {
  // Novelty = how rare this exact mechanic combination is.
  // Without scanning all compositions (expensive), approximate by:
  //   - fewer mechanics used together → higher novelty
  //   - rare extension ids (non-physics/movement) → higher novelty
  const commonExtensions = new Set(['pl.physics', 'pl.movement', 'pl.score']);
  const rareCount = mechanics.filter((m) => !commonExtensions.has(m)).length;
  const depth = mechanics.length;
  // deeper compositions with rare extensions are more novel
  const depthScore = Math.min(50, depth * 8);
  const rareScore = Math.min(50, rareCount * 15);
  return Math.min(100, depthScore + rareScore);
}

function computeMaturity(totalSessions: number, feedbackCount: number): number {
  // Maturity = how much data we have. 0 sessions = 0, 50+ sessions = 100.
  const sessionScore = Math.min(70, totalSessions * 1.4);
  const feedbackScore = Math.min(30, feedbackCount * 3);
  return Math.round(sessionScore + feedbackScore);
}

function rowToIntelligence(row: any): ExperienceIntelligence {
  return {
    experienceId: row.experienceId,
    experienceName: row.experienceName,
    mechanics: JSON.parse(row.mechanicsJson),
    compositionDepth: row.compositionDepth,
    hasEconomy: row.hasEconomy,
    hasCompetition: row.hasCompetition,
    hasAI: row.hasAI,
    emotionalProfile: JSON.parse(row.emotionalProfileJson),
    dominantEmotion: row.dominantEmotion,
    economyProfile: JSON.parse(row.economyProfileJson),
    audienceProfile: JSON.parse(row.audienceProfileJson),
    noveltyScore: row.noveltyScore,
    qualityScore: row.qualityScore,
    maturityScore: row.maturityScore,
    computedAt: row.computedAt instanceof Date ? row.computedAt.getTime() : new Date(row.computedAt).getTime(),
  };
}
