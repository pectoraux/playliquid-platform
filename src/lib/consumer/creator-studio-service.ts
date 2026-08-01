/**
 * v0.45 Consumer Reality Layer — Creator Studio Service
 * -------------------------------------------------------
 * YouTube Studio equivalent for PlayLiquid creators.
 * Analytics dashboard with AI improvement suggestions.
 */

import { db } from '@/lib/db';
import { computeReputation } from '@/lib/universe/rating-service';
import { getInteractionStats } from './discover-service';

export interface CreatorStudio {
  creator: {
    id: string;
    handle: string;
    displayName: string;
    level: number;
    xp: number;
    followers: number;
    totalLiquid: number;
    creatorGenome: any;
    reputation: any;
  };
  overview: {
    totalSparks: number;
    totalPlayers: number;
    totalPlayTimeMs: number;
    totalForks: number;
    totalLikes: number;
    averageReputation: number;
    liquidToday: number;
    playersToday: number;
    followersToday: number;
  };
  topSparks: Array<{
    experienceId: string;
    title: string;
    playCount: number;
    forkCount: number;
    likeCount: number;
    reputationScore: number;
    completionRate: number;
    averageScore: number;
    interactionStats: Record<string, number>;
    publishedAt: number;
  }>;
  aiSuggestions: Array<{
    type: 'retention' | 'economy' | 'social' | 'quality' | 'opportunity';
    sparkTitle?: string;
    insight: string;
    suggestion: string;
    severity: 'info' | 'warning' | 'critical';
  }>;
  audience: {
    byGenre: Record<string, number>;
    byEmotion: Record<string, number>;
    topRegions: string[];
    retentionCurve: Array<{ tick: string; percentage: number }>;
  };
}

export async function getCreatorStudio(creatorId: string): Promise<CreatorStudio | null> {
  const creator = await db.creatorRecord.findUnique({
    where: { id: creatorId },
    include: { experiences: true },
  });
  if (!creator) return null;

  const publishedExps = creator.experiences.filter((e) => e.status === 'PUBLISHED');

  // Build top sparks with detailed stats
  const topSparks: CreatorStudio['topSparks'] = [];
  let totalPlayers = 0;
  let totalPlayTimeMs = 0;
  let totalForks = 0;
  let totalLikes = 0;
  let reputationSum = 0;

  for (const exp of publishedExps) {
    const metrics = await db.experienceMetrics.findUnique({ where: { experienceId: exp.id } });
    const reputation = await computeReputation(exp.id);
    const interactionStats = await getInteractionStats(exp.id);

    totalPlayers += metrics?.totalSessions ?? exp.playCount;
    totalPlayTimeMs += metrics?.totalPlayTimeMs ?? 0;
    totalForks += exp.forkCount;
    totalLikes += exp.likeCount;
    reputationSum += reputation.overallScore;

    topSparks.push({
      experienceId: exp.id,
      title: exp.title,
      playCount: metrics?.totalSessions ?? exp.playCount,
      forkCount: exp.forkCount,
      likeCount: exp.likeCount,
      reputationScore: reputation.overallScore,
      completionRate: Math.round((metrics?.completionRate ?? 0) * 100),
      averageScore: Math.round(metrics?.averageScore ?? 0),
      interactionStats,
      publishedAt: exp.publishedAt?.getTime() ?? exp.createdAt.getTime(),
    });
  }

  topSparks.sort((a, b) => b.playCount - a.playCount);

  const averageReputation = publishedExps.length > 0 ? Math.round(reputationSum / publishedExps.length) : 0;

  // Generate AI suggestions (rule-based for speed, LLM could enhance)
  const aiSuggestions = generateSuggestions(topSparks);

  // Audience breakdown
  const audience = await buildAudienceBreakdown(publishedExps);

  return {
    creator: {
      id: creator.id,
      handle: creator.handle,
      displayName: creator.displayName,
      level: creator.creatorLevel,
      xp: creator.creatorXP,
      followers: creator.followers,
      totalLiquid: creator.totalLiquid,
      creatorGenome: creator.creatorGenomeJson ? JSON.parse(creator.creatorGenomeJson) : {},
      reputation: creator.reputationJson ? JSON.parse(creator.reputationJson) : {},
    },
    overview: {
      totalSparks: publishedExps.length,
      totalPlayers,
      totalPlayTimeMs,
      totalForks,
      totalLikes,
      averageReputation,
      liquidToday: Math.floor(creator.totalLiquid * 0.05), // approx 5% earned today
      playersToday: Math.floor(totalPlayers * 0.1),
      followersToday: Math.floor(creator.followers * 0.02),
    },
    topSparks: topSparks.slice(0, 10),
    aiSuggestions,
    audience,
  };
}

function generateSuggestions(sparks: any[]): CreatorStudio['aiSuggestions'] {
  const suggestions: CreatorStudio['aiSuggestions'] = [];

  if (sparks.length === 0) {
    suggestions.push({
      type: 'opportunity',
      insight: 'You haven\'t published any Sparks yet.',
      suggestion: 'Use the AI Composer to create your first Spark — it takes 2 minutes.',
      severity: 'info',
    });
    return suggestions;
  }

  for (const spark of sparks.slice(0, 5)) {
    // Retention issue
    if (spark.completionRate < 30 && spark.playCount > 5) {
      suggestions.push({
        type: 'retention',
        sparkTitle: spark.title,
        insight: `Players leave "${spark.title}" early — only ${spark.completionRate}% complete it.`,
        suggestion: 'Use the AI Evolution Agent to analyze and improve early-game pacing.',
        severity: 'warning',
      });
    }

    // High abandonment
    const abandoned = spark.interactionStats.abandoned ?? 0;
    const played = spark.interactionStats.played ?? 1;
    if (abandoned / played > 0.5 && played > 3) {
      suggestions.push({
        type: 'quality',
        sparkTitle: spark.title,
        insight: `${Math.round((abandoned / played) * 100)}% of players abandon "${spark.title}".`,
        suggestion: 'Consider reducing difficulty or adding a tutorial phase.',
        severity: 'critical',
      });
    }

    // High reputation
    if (spark.reputationScore > 80) {
      suggestions.push({
        type: 'opportunity',
        sparkTitle: spark.title,
        insight: `"${spark.title}" has excellent reputation (${spark.reputationScore}/100).`,
        suggestion: 'Promote this Spark with a challenge or tournament to grow its audience.',
        severity: 'info',
      });
    }

    // Low engagement
    if ((spark.interactionStats.liked ?? 0) < 2 && spark.playCount > 10) {
      suggestions.push({
        type: 'social',
        sparkTitle: spark.title,
        insight: `"${spark.title}" has ${spark.playCount} plays but few likes.`,
        suggestion: 'Add social features or competitive elements to increase engagement.',
        severity: 'warning',
      });
    }

    // Fork success
    if (spark.forkCount > 3) {
      suggestions.push({
        type: 'opportunity',
        sparkTitle: spark.title,
        insight: `"${spark.title}" has been forked ${spark.forkCount} times — it's inspiring remixes!`,
        suggestion: 'Consider creating a template version that\'s easier to remix.',
        severity: 'info',
      });
    }
  }

  if (suggestions.length === 0) {
    suggestions.push({
      type: 'opportunity',
      insight: 'Your Sparks are performing well overall.',
      suggestion: 'Keep creating! Try a new genre or experiment with the AI Composer.',
      severity: 'info',
    });
  }

  return suggestions;
}

async function buildAudienceBreakdown(exps: any[]): Promise<CreatorStudio['audience']> {
  const byGenre: Record<string, number> = {};
  const byEmotion: Record<string, number> = {};

  for (const exp of exps) {
    const intent = exp.intentJson ? JSON.parse(exp.intentJson) : {};
    if (intent.kind) byGenre[intent.kind] = (byGenre[intent.kind] ?? 0) + (exp.playCount || 1);
    for (const e of intent.emotions ?? []) {
      byEmotion[e] = (byEmotion[e] ?? 0) + (exp.playCount || 1);
    }
  }

  // Simulated retention curve
  const retentionCurve = [
    { tick: '0-1min', percentage: 100 },
    { tick: '1-3min', percentage: 72 },
    { tick: '3-5min', percentage: 58 },
    { tick: '5-10min', percentage: 41 },
    { tick: '10+min', percentage: 28 },
  ];

  return {
    byGenre,
    byEmotion,
    topRegions: ['Global', 'North America', 'Europe'],
    retentionCurve,
  };
}
