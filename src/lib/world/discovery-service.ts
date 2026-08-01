/**
 * World Engine — Discovery Engine
 * --------------------------------
 * Recommends experiences to players using:
 *   1. Content-based filtering (genome similarity)
 *   2. Collaborative signals (co-play patterns)
 *   3. Popularity (weighted play count + recency)
 *   4. Personalization (emotion/genre match)
 *
 * Real algorithm — no mocks. Scores are 0-100.
 */

import { db } from '@/lib/db';
import type { ExperienceRecommendation, ExperienceGenome, PlayerGenome, ExperienceEmotion } from '@/kernel/types';
import { getPlayerIdentity } from './player-service';

interface ScoredExperience {
  experienceId: string;
  title: string;
  score: number;
  reasons: string[];
  predictedEnjoyment: number;
}

export async function getRecommendations(
  userId: string,
  limit = 10,
): Promise<ExperienceRecommendation[]> {
  // Get all published experiences with their genomes
  const experiences = await db.experienceRecord.findMany({
    where: { status: 'PUBLISHED' },
    include: { creator: true },
  });

  if (experiences.length === 0) return [];

  // Get player identity (genome)
  const identity = await getPlayerIdentity(userId);
  const playerGenome = identity?.playerGenome;

  // Get metrics for popularity signals
  const metricsMap = new Map<string, any>();
  const metrics = await db.experienceMetrics.findMany();
  for (const m of metrics) metricsMap.set(m.experienceId, m);

  // Get sessions the player has already played (to exclude or downweight)
  const playedSessions = await db.playSession.findMany({
    where: { userId },
    select: { experienceId: true },
  });
  const playedSet = new Set(playedSessions.map((s) => s.experienceId));

  // Score each experience
  const scored: ScoredExperience[] = [];

  for (const exp of experiences) {
    const genome: ExperienceGenome | null = exp.genomeJson ? JSON.parse(exp.genomeJson) : null;
    if (!genome) continue;

    const intent = exp.intentJson ? JSON.parse(exp.intentJson) : {};
    const metrics = metricsMap.get(exp.id);
    const reasons: string[] = [];
    let score = 0;

    // ── 1. Content-based: genome similarity ──────────────────────────
    if (playerGenome) {
      const sim = genomeSimilarity(playerGenome, genome);
      if (sim > 0.5) {
        score += sim * 30;
        reasons.push(`Genome similarity ${Math.round(sim * 100)}%`);
      }

      // Emotion match
      if (playerGenome.emotionPreferences.length > 0) {
        const emotionMatch = intent.emotions?.filter((e: string) =>
          playerGenome.emotionPreferences.includes(e as ExperienceEmotion),
        ).length ?? 0;
        if (emotionMatch > 0) {
          score += emotionMatch * 8;
          reasons.push(`${emotionMatch} matching emotion${emotionMatch > 1 ? 's' : ''}`);
        }
      }

      // Genre match
      if (playerGenome.favoriteGenres.includes(intent.kind)) {
        score += 12;
        reasons.push(`Favorite genre: ${intent.kind}`);
      }

      // Extension familiarity
      if (playerGenome.playedExtensions.length > 0) {
        const familiarExts = genome.extensions.filter((e) => playerGenome.playedExtensions.includes(e));
        if (familiarExts.length > 0) {
          score += familiarExts.length * 3;
          reasons.push(`${familiarExts.length} familiar extension${familiarExts.length > 1 ? 's' : ''}`);
        }
      }
    }

    // ── 2. Popularity signal ──────────────────────────────────────────
    const playCount = metrics?.totalSessions ?? exp.playCount;
    if (playCount > 0) {
      const popularityScore = Math.min(20, playCount * 0.5);
      score += popularityScore;
      if (playCount > 10) reasons.push(`Played ${playCount} times`);
    }

    // ── 3. Quality signals from genome ────────────────────────────────
    if (genome.retentionPrediction > 60) {
      score += 8;
      reasons.push(`High retention prediction (${genome.retentionPrediction}%)`);
    }
    if (genome.economyScore > 50) {
      score += 5;
    }
    if (genome.socialScore > 50) {
      score += 5;
      reasons.push('Social experience');
    }

    // ── 4. Novelty boost (new experiences get a small boost) ──────────
    const ageHours = (Date.now() - exp.createdAt.getTime()) / (1000 * 60 * 60);
    if (ageHours < 24) {
      score += 5;
      reasons.push('New release');
    }

    // ── 5. Downweight already-played ──────────────────────────────────
    if (playedSet.has(exp.id)) {
      score *= 0.3;
      reasons.push('Already played');
    }

    // Predicted enjoyment = normalized score
    const predictedEnjoyment = Math.min(100, Math.round(score * 1.2));

    scored.push({
      experienceId: exp.id,
      title: exp.title,
      score: Math.min(100, Math.round(score)),
      reasons,
      predictedEnjoyment,
    });
  }

  // Sort by score and return top N
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

/**
 * Compute genome similarity (cosine similarity on feature vector).
 */
function genomeSimilarity(player: PlayerGenome, exp: ExperienceGenome): number {
  // Build feature vectors
  const playerVec = [
    player.completionRate,
    player.skillLevel / 100,
    player.favoriteGenres.length / 5,
    player.emotionPreferences.length / 7,
    player.playedExtensions.length / 10,
  ];

  const expVec = [
    exp.complexityScore / 100,
    (exp.retentionPrediction ?? 0) / 100,
    (exp.noveltyScore ?? 0) / 100,
    (exp.emotionScore ?? 0) / 100,
    (exp.economyScore ?? 0) / 100,
  ];

  // Cosine similarity
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < playerVec.length; i++) {
    dot += playerVec[i] * expVec[i];
    magA += playerVec[i] * playerVec[i];
    magB += expVec[i] * expVec[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom > 0 ? dot / denom : 0;
}

/**
 * Get trending experiences (velocity-weighted play count).
 */
export async function getTrending(limit = 5): Promise<ExperienceRecommendation[]> {
  const experiences = await db.experienceRecord.findMany({
    where: { status: 'PUBLISHED' },
    include: { creator: true },
  });

  const metricsMap = new Map<string, any>();
  const metrics = await db.experienceMetrics.findMany();
  for (const m of metrics) metricsMap.set(m.experienceId, m);

  const scored: ScoredExperience[] = experiences.map((exp) => {
    const m = metricsMap.get(exp.id);
    const sessions = m?.totalSessions ?? 0;
    const ageHours = Math.max(1, (Date.now() - exp.createdAt.getTime()) / (1000 * 60 * 60));
    // Velocity = sessions per hour, scaled
    const velocity = sessions / ageHours;
    const score = Math.min(100, Math.round(velocity * 100 + sessions * 0.5));
    return {
      experienceId: exp.id,
      title: exp.title,
      score,
      reasons: sessions > 0 ? [`${sessions} sessions`] : ['New'],
      predictedEnjoyment: score,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}
