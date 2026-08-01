/**
 * Universe v0.4 — AI Curator Service
 * ------------------------------------
 * Every player gets a personal AI guide that learns their preferences
 * and recommends experiences with rich, personalized reasoning.
 *
 * Uses z-ai-web-dev-sdk (server-side only).
 */

import ZAI from 'z-ai-web-dev-sdk';
import { db } from '@/lib/db';
import { getRecommendations } from '@/lib/world/discovery-service';
import { computeReputation } from './rating-service';

export interface CuratorRecommendation {
  experienceId: string;
  title: string;
  score: number;
  reasoning: string;        // AI-generated personalized explanation
  matchFactors: string[];   // bullet points of why
  predictedEnjoyment: number;
}

export async function getCuratorRecommendations(
  userId: string,
  limit = 5,
): Promise<{ recommendations: CuratorRecommendation[]; error?: string }> {
  // Get existing recommendations from the Discovery Engine
  const baseRecs = await getRecommendations(userId, limit * 2);

  if (baseRecs.length === 0) {
    return { recommendations: [], error: 'No experiences to recommend yet' };
  }

  // Get player identity for context
  const { getPlayerIdentity } = await import('@/lib/world/player-service');
  const identity = await getPlayerIdentity(userId);

  // Get top recommendations with reputation data
  const topRecs = baseRecs.slice(0, limit);
  const recommendations: CuratorRecommendation[] = [];

  for (const rec of topRecs) {
    const exp = await db.experienceRecord.findUnique({
      where: { id: rec.experienceId },
      include: { creator: true },
    });
    if (!exp) continue;

    const reputation = await computeReputation(rec.experienceId);
    const genome = exp.genomeJson ? JSON.parse(exp.genomeJson) : null;

    // Generate personalized reasoning with LLM
    const reasoning = await generateReasoning(identity, exp, rec, reputation, genome);

    recommendations.push({
      experienceId: rec.experienceId,
      title: exp.title,
      score: rec.score,
      reasoning: reasoning.summary,
      matchFactors: reasoning.factors,
      predictedEnjoyment: rec.predictedEnjoyment,
    });
  }

  return { recommendations };
}

async function generateReasoning(
  identity: any,
  exp: any,
  rec: any,
  reputation: any,
  genome: any,
): Promise<{ summary: string; factors: string[] }> {
  const factors: string[] = rec.reasons.slice(0, 3);

  // Add reputation-based factor
  if (reputation.overallScore > 70) {
    factors.push(`High reputation (${reputation.overallScore}/100)`);
  }
  if (reputation.returnScore > 40) {
    factors.push(`${reputation.returnScore}% of players return`);
  }

  // Build context for LLM
  const context = {
    player: identity ? {
      name: identity.displayName,
      skillLevel: identity.playerGenome.skillLevel,
      favoriteGenres: identity.playerGenome.favoriteGenres,
      emotions: identity.playerGenome.emotionPreferences,
      socialBehavior: identity.playerGenome.socialBehavior,
      sessionCount: identity.sessionCount,
    } : { name: 'New Player', sessionCount: 0 },
    experience: {
      title: exp.title,
      creator: exp.creator?.displayName,
      genome: genome ? {
        complexity: genome.complexityScore,
        economy: genome.economyScore,
        social: genome.socialScore,
        retention: genome.retentionPrediction,
      } : null,
      reputation: {
        overall: reputation.overallScore,
        completion: reputation.completionScore,
        return: reputation.returnScore,
      },
      playCount: exp.playCount,
    },
    matchScore: rec.score,
    matchReasons: factors,
  };

  try {
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content: `You are the PlayLiquid AI Curator. Write a personalized 1-sentence recommendation for why this player would enjoy this experience. Be specific and warm. No markdown.`,
        },
        {
          role: 'user',
          content: `Player: ${JSON.stringify(context.player)}\nExperience: ${JSON.stringify(context.experience)}\nMatch: ${context.matchScore}% — ${context.matchReasons.join(', ')}\n\nWrite the recommendation:`,
        },
      ],
      thinking: { type: 'disabled' },
    });

    const summary = completion.choices[0]?.message?.content?.trim() ?? `${exp.title} matches your preferences (${rec.score}% fit).`;
    return { summary, factors };
  } catch {
    // Fallback: use the match reasons directly
    return {
      summary: `${exp.title} is a ${rec.score}% match for you because ${factors.slice(0, 2).join(' and ').toLowerCase()}.`,
      factors,
    };
  }
}

/**
 * Get the AI curator's "why players love this" summary for an experience.
 */
export async function getExperienceSummary(experienceId: string): Promise<string> {
  const exp = await db.experienceRecord.findUnique({
    where: { id: experienceId },
    include: { creator: true },
  });
  if (!exp) return 'Experience not found.';

  const reputation = await computeReputation(experienceId);
  const metrics = await db.experienceMetrics.findUnique({ where: { experienceId } });
  const genome = exp.genomeJson ? JSON.parse(exp.genomeJson) : null;

  const context = {
    title: exp.title,
    creator: exp.creator?.displayName,
    playCount: exp.playCount,
    forkCount: exp.forkCount,
    reputation,
    metrics: metrics ? {
      totalSessions: metrics.totalSessions,
      completionRate: Math.round(metrics.completionRate * 100),
      tokensEarned: metrics.tokensEarned,
      achievementEvents: metrics.achievementEvents,
    } : null,
    genome: genome ? {
      economy: genome.economyScore,
      social: genome.socialScore,
      retention: genome.retentionPrediction,
    } : null,
  };

  try {
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content: `You are the PlayLiquid AI Curator. Write a 1-2 sentence summary of "why players love this experience" based on the data. Be specific about what makes it special. No markdown.`,
        },
        {
          role: 'user',
          content: `Experience data: ${JSON.stringify(context)}\n\nWrite the summary:`,
        },
      ],
      thinking: { type: 'disabled' },
    });
    return completion.choices[0]?.message?.content?.trim() ?? `${exp.title} has a ${reputation.overallScore}/100 reputation score.`;
  } catch {
    return `${exp.title} has a ${reputation.overallScore}/100 reputation with ${metrics?.totalSessions ?? 0} sessions played.`;
  }
}
