/**
 * Civilization Engine — World Discovery
 * --------------------------------------
 * Recommends worlds to players based on:
 *   - Player genome (preferences, skills, behavior)
 *   - World genome (complexity, economy, social)
 *   - Social graph (friends in the world)
 *   - Economic opportunities (wealth potential)
 */

import { db } from '@/lib/db';
import type { ExperienceRecommendation } from '@/kernel/types';

export interface WorldRecommendation {
  worldId: string;
  name: string;
  score: number;
  reasons: string[];
  predictedEnjoyment: number;
  population: number;
  mood: number;
}

export async function getWorldRecommendations(
  userId: string,
  limit = 10,
): Promise<WorldRecommendation[]> {
  // Get all active worlds
  const worlds = await db.worldRecord.findMany({
    where: { status: { in: ['ACTIVE', 'DORMANT'] } },
  });

  if (worlds.length === 0) return [];

  // Get player identity (genome)
  const { getPlayerIdentity } = await import('@/lib/world/player-service');
  const identity = await getPlayerIdentity(userId);
  const playerGenome = identity?.playerGenome;

  // Get player's played experiences (for social graph)
  const playedSessions = await db.playSession.findMany({
    where: { userId },
    select: { experienceId: true },
  });
  const playedExperiences = new Set(playedSessions.map((s) => s.experienceId));

  const recommendations: WorldRecommendation[] = [];

  for (const world of worlds) {
    const worldGenome = JSON.parse(world.worldGenomeJson);
    const macroState = JSON.parse(world.macroStateJson);
    const reasons: string[] = [];
    let score = 30; // base score

    // ── 1. Population signal ───────────────────────────────────────────
    if (world.population > 50) {
      score += 15;
      reasons.push(`${world.population} citizens active`);
    } else if (world.population > 0) {
      score += 5;
      reasons.push(`${world.population} citizens`);
    }

    // ── 2. Mood signal ─────────────────────────────────────────────────
    if (macroState.mood > 30) {
      score += 10;
      reasons.push('Thriving economy');
    } else if (macroState.mood < -30) {
      score -= 10;
      reasons.push('Economic challenges (opportunity?)');
    }

    // ── 3. Player genome match ─────────────────────────────────────────
    if (playerGenome) {
      // Skill match
      if (playerGenome.skillLevel > 50 && worldGenome.complexity > 50) {
        score += 12;
        reasons.push('Matches your skill level');
      }
      // Behavior match
      if (playerGenome.socialBehavior === 'competitive' && worldGenome.agentDiversity > 50) {
        score += 10;
        reasons.push('Competitive world');
      } else if (playerGenome.socialBehavior === 'social' && worldGenome.socialDensity > 40) {
        score += 10;
        reasons.push('Active social scene');
      }

      // Emotion preferences
      if (playerGenome.emotionPreferences.includes('strategy') && worldGenome.economyDepth > 50) {
        score += 8;
        reasons.push('Strategic depth');
      }
      if (playerGenome.emotionPreferences.includes('discovery') && worldGenome.eventFrequency > 30) {
        score += 8;
        reasons.push('Frequent discoveries');
      }
    }

    // ── 4. Economic opportunity ────────────────────────────────────────
    const resources = macroState.resources ?? {};
    const cheapResources = Object.entries(macroState.prices ?? {})
      .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] < 2)
      .map(([r]) => r);
    if (cheapResources.length > 0) {
      score += 5;
      reasons.push(`Cheap ${cheapResources.slice(0, 2).join(', ')} — trade opportunity`);
    }

    // ── 5. Experience connection ───────────────────────────────────────
    if (playedExperiences.has(world.experienceId)) {
      score += 15;
      reasons.push('You\'ve played the source experience');
    }

    // ── 6. Freshness ───────────────────────────────────────────────────
    if (world.tickCount < 100) {
      score += 8;
      reasons.push('New world — early opportunities');
    }

    recommendations.push({
      worldId: world.id,
      name: world.name,
      score: Math.min(100, Math.round(score)),
      reasons: reasons.slice(0, 4),
      predictedEnjoyment: Math.min(100, Math.round(score * 1.1)),
      population: world.population,
      mood: macroState.mood ?? 0,
    });
  }

  recommendations.sort((a, b) => b.score - a.score);
  return recommendations.slice(0, limit);
}
