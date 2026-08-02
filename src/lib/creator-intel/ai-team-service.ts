/**
 * v0.48 Creator Intelligence Universe — AI Team Service
 * -------------------------------------------------------
 * 6 specialized AI agents that analyze creator games and provide
 * actionable insights. Each agent has a domain expertise.
 *
 * Uses z-ai-web-dev-sdk for LLM-powered analysis.
 */

import ZAI from 'z-ai-web-dev-sdk';
import { db } from '@/lib/db';
import { computeReputation } from '@/lib/universe/rating-service';

export type AgentType = 'designer' | 'economy' | 'balance' | 'community' | 'growth' | 'narrative';

export interface CreatorInsight {
  id?: string;
  agentType: AgentType;
  insightType: 'observation' | 'suggestion' | 'alert' | 'opportunity' | 'prediction';
  title: string;
  body: string;
  actionSuggestion?: string;
  expectedImpact?: string;
  severity: 'info' | 'suggestion' | 'warning' | 'critical';
}

const AGENT_CONFIG: Record<AgentType, { name: string; icon: string; role: string; expertise: string }> = {
  designer: { name: 'Game Designer', icon: '🎨', role: 'Designs player experience', expertise: 'player behavior, retention curves, difficulty, engagement, game feel' },
  economy: { name: 'Economy Agent', icon: '💰', role: 'Manages game economy', expertise: 'minute pricing, rewards, leaderboard health, inflation, prize pools' },
  balance: { name: 'Balance Agent', icon: '⚖️', role: 'Ensures fair gameplay', expertise: 'score distributions, win rates, strategy diversity, competitive fairness' },
  community: { name: 'Community Agent', icon: '👥', role: 'Manages player community', expertise: 'discussions, sentiment, requests, events, community health' },
  growth: { name: 'Growth Agent', icon: '📈', role: 'Drives discovery and audience', expertise: 'thumbnails, titles, discovery optimization, audience targeting, trends' },
  narrative: { name: 'Narrative Agent', icon: '📖', role: 'Crafts world stories', expertise: 'lore, characters, events, player-created stories, world-building' },
};

/**
 * Run all 6 agents for a creator's game and generate insights.
 */
export async function runCreatorAITeam(creatorId: string, experienceId: string): Promise<CreatorInsight[]> {
  const exp = await db.experienceRecord.findUnique({
    where: { id: experienceId },
    include: { creator: true },
  });
  if (!exp) return [];

  // Gather context
  const metrics = await db.experienceMetrics.findUnique({ where: { experienceId } });
  const reputation = await computeReputation(experienceId);
  const interactionStats = await getInteractionStats(experienceId);
  const communityPosts = await db.communityPostRecord.count({
    where: { community: { experienceId } },
  });

  const context = {
    game: {
      title: exp.title,
      description: exp.description,
      playCount: metrics?.totalSessions ?? exp.playCount,
      forkCount: exp.forkCount,
      likeCount: exp.likeCount,
      completionRate: metrics ? Math.round(metrics.completionRate * 100) : 0,
      averageScore: Math.round(metrics?.averageScore ?? 0),
      averageDropOffMs: metrics?.averageDropOffMs ?? 0,
      tokensEarned: metrics?.tokensEarned ?? 0,
      marketActions: metrics?.marketActions ?? 0,
      frustrationEvents: metrics?.frustrationEvents ?? 0,
      achievementEvents: metrics?.achievementEvents ?? 0,
      reputationScore: reputation.overallScore,
      socialScore: reputation.socialScore,
      economyScore: reputation.economyScore,
      emotionScore: reputation.emotionScore,
    },
    community: {
      postCount: communityPosts,
      memberCount: 0,
    },
    interactionStats,
  };

  // Run each agent
  const allInsights: CreatorInsight[] = [];

  for (const agentType of Object.keys(AGENT_CONFIG) as AgentType[]) {
    const insights = await runAgent(agentType, context, creatorId, experienceId);
    allInsights.push(...insights);
  }

  // Persist insights
  for (const insight of allInsights) {
    const record = await db.creatorInsightRecord.create({
      data: {
        creatorId,
        experienceId,
        category: insight.agentType, // agentType maps to category
        problem: insight.title,
        evidence: insight.body,
        recommendation: insight.actionSuggestion ?? '',
        expectedImpact: insight.expectedImpact ?? '',
        severity: insight.severity,
        reportType: 'daily',
      },
    });
    insight.id = record.id;
  }

  return allInsights;
}

/**
 * Run a single agent with LLM-powered analysis.
 */
async function runAgent(agentType: AgentType, context: any, creatorId: string, experienceId: string): Promise<CreatorInsight[]> {
  const config = AGENT_CONFIG[agentType];

  // First try rule-based insights (fast, reliable)
  const ruleBased = generateRuleBasedInsights(agentType, context);
  if (ruleBased.length > 0) {
    // Enhance the top insight with LLM
    try {
      const enhanced = await enhanceWithLLM(agentType, config, context, ruleBased[0]);
      if (enhanced) {
        ruleBased[0] = enhanced;
      }
    } catch {
      // Keep rule-based
    }
  }

  return ruleBased;
}

function generateRuleBasedInsights(agentType: AgentType, ctx: any): CreatorInsight[] {
  const insights: CreatorInsight[] = [];
  const g = ctx.game;
  const config = AGENT_CONFIG[agentType];

  switch (agentType) {
    case 'designer':
      if (g.completionRate < 30 && g.playCount > 5) {
        insights.push({
          agentType: 'designer',
          insightType: 'alert',
          title: 'Players drop early',
          body: `Only ${g.completionRate}% of players complete the game. The average drop-off happens at ${Math.round(g.averageDropOffMs / 1000)}s. This suggests early-game friction.`,
          actionSuggestion: 'Reduce early difficulty or add a tutorial phase. Use the Evolution Agent to auto-tune.',
          expectedImpact: '+15-25% completion rate',
          severity: 'warning',
        });
      }
      if (g.frustrationEvents > g.playCount * 0.3) {
        insights.push({
          agentType: 'designer',
          insightType: 'observation',
          title: 'High frustration detected',
          body: `${g.frustrationEvents} frustration events across ${g.playCount} sessions. Players may find the game too difficult.`,
          actionSuggestion: 'Consider adding difficulty options or a "relaxed" mode.',
          severity: 'suggestion',
        });
      }
      if (g.playCount > 20 && g.completionRate > 70) {
        insights.push({
          agentType: 'designer',
          insightType: 'opportunity',
          title: 'Players love the pacing',
          body: `${g.completionRate}% completion rate is excellent. The difficulty curve is well-tuned.`,
          actionSuggestion: 'Consider adding harder challenges or a "master" mode for experienced players.',
          severity: 'info',
        });
      }
      break;

    case 'economy':
      if (g.marketActions < g.playCount * 0.5 && g.tokensEarned > 0) {
        insights.push({
          agentType: 'economy',
          insightType: 'suggestion',
          title: 'Economy underutilized',
          body: `Only ${g.marketActions} market actions across ${g.playCount} sessions. The trading economy isn't being fully used.`,
          actionSuggestion: 'Add trade incentives or reduce marketplace friction. Consider lowering entry fees.',
          expectedImpact: '+30% economic engagement',
          severity: 'suggestion',
        });
      }
      if (g.tokensEarned > 100 && g.marketActions > 10) {
        insights.push({
          agentType: 'economy',
          insightType: 'opportunity',
          title: 'Economy is thriving',
          body: `${g.tokensEarned} tokens earned with ${g.marketActions} market actions. The economy is active and healthy.`,
          actionSuggestion: 'Launch a tournament with a Liquid prize pool to capitalize on economic activity.',
          expectedImpact: '+40% competitive engagement',
          severity: 'info',
        });
      }
      break;

    case 'balance':
      if (g.averageScore > 0) {
        const scoreSpread = g.averageScore;
        insights.push({
          agentType: 'balance',
          insightType: 'observation',
          title: 'Score distribution analysis',
          body: `Average score is ${g.averageScore}. ${g.completionRate}% of players complete the game.`,
          actionSuggestion: g.averageScore < 20 ? 'Scores are low — consider increasing reward opportunities.' : 'Scores are healthy — the challenge level is well-calibrated.',
          severity: 'info',
        });
      }
      break;

    case 'community':
      if (ctx.community.postCount > 0) {
        insights.push({
          agentType: 'community',
          insightType: 'observation',
          title: 'Community is active',
          body: `${ctx.community.postCount} community posts. Players are engaging with each other.`,
          actionSuggestion: 'Pin high-quality posts and consider hosting a community event.',
          severity: 'info',
        });
      } else if (g.playCount > 10) {
        insights.push({
          agentType: 'community',
          insightType: 'suggestion',
          title: 'No community engagement yet',
          body: `${g.playCount} players but no community posts. Consider seeding discussions or creating a challenge.`,
          actionSuggestion: 'Create a community challenge or post a development update.',
          severity: 'suggestion',
        });
      }
      break;

    case 'growth':
      if (g.playCount > 50) {
        insights.push({
          agentType: 'growth',
          insightType: 'opportunity',
          title: 'Strong growth trajectory',
          body: `${g.playCount} plays with ${g.forkCount} forks. Your game is being discovered and remixed.`,
          actionSuggestion: 'Create a "remix contest" to capitalize on the fork trend and attract more creators.',
          expectedImpact: '+25% discovery rate',
          severity: 'info',
        });
      }
      if (g.likeCount < g.playCount * 0.1 && g.playCount > 10) {
        insights.push({
          agentType: 'growth',
          insightType: 'suggestion',
          title: 'Low like-to-play ratio',
          body: `${g.likeCount} likes for ${g.playCount} plays (${Math.round(g.likeCount / Math.max(g.playCount, 1) * 100)}%). Players aren't converting to followers.`,
          actionSuggestion: "Improve the first 30 seconds of gameplay — that's when players decide to follow.",
          expectedImpact: '+15% follower conversion',
          severity: 'warning',
        });
      }
      break;

    case 'narrative':
      insights.push({
        agentType: 'narrative',
        insightType: 'suggestion',
        title: 'World story potential',
        body: 'Your game has the foundation for a rich world narrative. Consider adding lore elements or character backgrounds.',
        actionSuggestion: 'Use the Civilization Engine to spawn AI citizens with backstories that emerge from gameplay.',
        severity: 'info',
      });
      break;
  }

  // Ensure at least one insight per agent
  if (insights.length === 0) {
    insights.push({
      agentType,
      insightType: 'observation',
      title: `${config.name} standing by`,
      body: `I'm monitoring your game. As more data comes in, I'll provide ${config.expertise} insights.`,
      severity: 'info',
    });
  }

  return insights;
}

async function enhanceWithLLM(agentType: AgentType, config: any, context: any, insight: CreatorInsight): Promise<CreatorInsight | null> {
  try {
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content: `You are the ${config.name} for a PlayLiquid creator. Your expertise: ${config.expertise}. Enhance this insight with specific, actionable detail. Keep the title and structure. Respond with JSON: {"title": "...", "body": "...", "actionSuggestion": "...", "expectedImpact": "..."}. No markdown.`,
        },
        {
          role: 'user',
          content: `Game data: ${JSON.stringify(context.game)}\n\nBase insight: ${JSON.stringify(insight)}\n\nEnhance it:`,
        },
      ],
      thinking: { type: 'disabled' },
    });

    const raw = completion.choices[0]?.message?.content ?? '';
    const jsonStr = raw.trim().replace(/```json\s*([\s\S]*?)```/, '$1').trim();
    const parsed = JSON.parse(jsonStr);

    return {
      ...insight,
      title: parsed.title ?? insight.title,
      body: parsed.body ?? insight.body,
      actionSuggestion: parsed.actionSuggestion ?? insight.actionSuggestion,
      expectedImpact: parsed.expectedImpact ?? insight.expectedImpact,
    };
  } catch {
    return null;
  }
}

async function getInteractionStats(experienceId: string): Promise<Record<string, number>> {
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

// ─── Insight Management ────────────────────────────────────────────────────

export async function getInsights(creatorId: string, experienceId?: string): Promise<any[]> {
  const where: any = { creatorId };
  if (experienceId) where.experienceId = experienceId;

  const records = await db.creatorInsightRecord.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  return records.map((r) => ({
    id: r.id,
    agentType: r.category,
    insightType: r.reportType,
    title: r.problem,
    body: r.evidence,
    actionSuggestion: r.recommendation,
    expectedImpact: r.expectedImpact,
    severity: r.severity,
    status: r.status,
    experienceId: r.experienceId,
    createdAt: r.createdAt.getTime(),
  }));
}

export async function acceptInsight(insightId: string): Promise<void> {
  await db.creatorInsightRecord.update({
    where: { id: insightId },
    data: { status: 'ACCEPTED' },
  });
}

export async function dismissInsight(insightId: string): Promise<void> {
  await db.creatorInsightRecord.update({
    where: { id: insightId },
    data: { status: 'DISMISSED' },
  });
}

export function getAgentConfig() {
  return AGENT_CONFIG;
}
