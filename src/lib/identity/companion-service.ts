/**
 * Identity Layer v0.45 — AI Companion Service
 * ---------------------------------------------
 * Every player gets a personal AI companion — not a chatbot, a universe agent.
 *
 * It observes the player's history, reasons about their preferences,
 * and proactively suggests worlds, challenges, friends, and opportunities.
 *
 * Uses z-ai-web-dev-sdk (server-side only).
 */

import ZAI from 'z-ai-web-dev-sdk';
import { db } from '@/lib/db';
import { getFullPlayerIdentity, updateCompanionState } from './player-identity-service';
import { getCuratorRecommendations } from '@/lib/universe/curator-service';
import type { CompanionMessage, AICompanionState } from '@/kernel/types';

const DEMO_USER_ID = 'demo-user';

/**
 * Get the companion's proactive greeting/insight for a player.
 */
export async function getCompanionInsight(userId: string): Promise<{
  insight: string;
  suggestions: string[];
  type: 'suggestion' | 'alert' | 'insight';
}> {
  const identity = await getFullPlayerIdentity(userId);
  if (!identity) {
    return {
      insight: "Welcome to PlayLiquid! I'm your AI companion. Play a Spark to get started.",
      suggestions: ['Browse trending Sparks', 'Create your first experience'],
      type: 'suggestion',
    };
  }

  // Gather context
  const context = {
    name: identity.displayName,
    level: identity.level,
    xp: identity.xp,
    skills: identity.skills,
    reputation: identity.reputation,
    totalSessions: identity.totalSessions,
    favoriteWorlds: identity.favoriteWorlds,
    worldsVisited: identity.worldPassport.totalWorldsVisited,
    achievements: identity.achievements.length,
    liquidBalance: identity.liquidBalance / 1_000_000,
    lastInteraction: identity.companion.lastInteraction,
    conversationCount: identity.companion.conversationCount,
  };

  // Get recommendations
  const recs = await getCuratorRecommendations(userId, 3);

  try {
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content: `You are the personal AI companion for a PlayLiquid player. You observe their play history, skills, and preferences, and proactively suggest what they should do next.

Be warm, direct, and specific. Reference their actual data. Keep it to 1-2 sentences. No markdown.

Respond with JSON:
{
  "insight": "your proactive message",
  "suggestions": ["actionable suggestion 1", "suggestion 2"],
  "type": "suggestion" | "alert" | "insight"
}`,
        },
        {
          role: 'user',
          content: `Player context: ${JSON.stringify(context)}
Top recommendations: ${JSON.stringify(recs.recommendations?.map((r: any) => ({ title: r.title, score: r.score })) ?? [])}

What should I tell this player?`,
        },
      ],
      thinking: { type: 'disabled' },
    });

    const raw = completion.choices[0]?.message?.content ?? '';
    let jsonStr = raw.trim();
    const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) jsonStr = fence[1].trim();

    const parsed = JSON.parse(jsonStr);

    // Update companion state
    await updateCompanionState(userId, {
      lastInteraction: Date.now(),
      conversationCount: identity.companion.conversationCount + 1,
      suggestedActions: parsed.suggestions ?? [],
    });

    // Save as a companion message
    await db.companionMessageRecord.create({
      data: {
        userId,
        role: 'companion',
        content: parsed.insight,
        messageType: parsed.type ?? 'insight',
      },
    });

    return parsed;
  } catch {
    // Fallback: rule-based insight
    const fallback = generateFallbackInsight(identity, recs.recommendations ?? []);
    await updateCompanionState(userId, {
      lastInteraction: Date.now(),
      conversationCount: identity.companion.conversationCount + 1,
      suggestedActions: fallback.suggestions,
    });
    await db.companionMessageRecord.create({
      data: {
        userId,
        role: 'companion',
        content: fallback.insight,
        messageType: fallback.type,
      },
    });
    return fallback;
  }
}

/**
 * Chat with the companion — user sends a message, companion responds.
 */
export async function chatWithCompanion(userId: string, userMessage: string): Promise<{
  response: string;
  suggestions: string[];
}> {
  const identity = await getFullPlayerIdentity(userId);
  if (!identity) {
    return {
      response: "I don't know you yet! Play a Spark first so I can learn about you.",
      suggestions: [],
    };
  }

  // Get conversation history
  const history = await db.companionMessageRecord.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  const context = {
    name: identity.displayName,
    level: identity.level,
    skills: identity.skills,
    totalSessions: identity.totalSessions,
    favoriteWorlds: identity.favoriteWorlds,
    achievements: identity.achievements.length,
  };

  try {
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content: `You are the personal AI companion for ${identity.displayName}, a PlayLiquid player. You are warm, helpful, and specific. You know their play history and preferences.

Player context: ${JSON.stringify(context)}

Respond conversationally. If they ask for recommendations, suggest specific Sparks. Keep responses concise (2-3 sentences). No markdown.`,
        },
        ...history.reverse().map((h) => ({
          role: h.role as 'user' | 'assistant',
          content: h.content,
        })),
        { role: 'user', content: userMessage },
      ],
      thinking: { type: 'disabled' },
    });

    const response = completion.choices[0]?.message?.content?.trim() ?? "I'm here to help! What would you like to do?";

    // Save messages
    await db.companionMessageRecord.create({
      data: { userId, role: 'user', content: userMessage, messageType: 'chat' },
    });
    await db.companionMessageRecord.create({
      data: { userId, role: 'companion', content: response, messageType: 'chat' },
    });

    await updateCompanionState(userId, {
      lastInteraction: Date.now(),
      conversationCount: identity.companion.conversationCount + 1,
    });

    return { response, suggestions: [] };
  } catch {
    const fallback = "I'm here to help! Try playing a Spark or exploring a world.";
    await db.companionMessageRecord.create({
      data: { userId, role: 'user', content: userMessage, messageType: 'chat' },
    });
    await db.companionMessageRecord.create({
      data: { userId, role: 'companion', content: fallback, messageType: 'chat' },
    });
    return { response: fallback, suggestions: [] };
  }
}

/**
 * Get companion message history.
 */
export async function getCompanionMessages(userId: string, limit = 20): Promise<CompanionMessage[]> {
  const records = await db.companionMessageRecord.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return records.reverse().map((r) => ({
    id: r.id,
    userId: r.userId,
    role: r.role as CompanionMessage['role'],
    content: r.content,
    messageType: r.messageType as CompanionMessage['messageType'],
    createdAt: r.createdAt.getTime(),
  }));
}

/**
 * Rule-based fallback insight.
 */
function generateFallbackInsight(identity: any, recs: any[]): { insight: string; suggestions: string[]; type: 'suggestion' | 'alert' | 'insight' } {
  if (identity.totalSessions === 0) {
    return {
      insight: `Welcome, ${identity.displayName}! I'm your AI companion. Let's find your first Spark to play.`,
      suggestions: ['Browse trending Sparks', 'Try the Farm Kingdom demo'],
      type: 'suggestion',
    };
  }

  if (identity.totalSessions < 5) {
    return {
      insight: `You've played ${identity.totalSessions} sessions. Keep going to unlock more achievements and level up!`,
      suggestions: ['Play another Spark', 'Check your achievements'],
      type: 'insight',
    };
  }

  if (recs.length > 0) {
    const top = recs[0];
    return {
      insight: `Based on your play history, you'd love "${top.title}" (${top.score}% match). Your skills are growing!`,
      suggestions: [`Play ${top.title}`, 'Visit a world'],
      type: 'suggestion',
    };
  }

  if (identity.worldPassport.totalWorldsVisited === 0) {
    return {
      insight: `You've played ${identity.totalSessions} Sparks but haven't visited a World yet. Worlds are living simulations with AI citizens!`,
      suggestions: ['Explore the Civilization Engine'],
      type: 'suggestion',
    };
  }

  return {
    insight: `You're a level ${identity.level} player with ${identity.achievements.length} achievements. Your top skill is ${getTopSkill(identity.skills)}.`,
    suggestions: ['Check marketplace for new Sparks', 'Review your inventory'],
    type: 'insight',
  };
}

function getTopSkill(skills: Record<string, number>): string {
  let top = 'none';
  let max = 0;
  for (const [skill, value] of Object.entries(skills)) {
    if (value > max) { max = value; top = skill; }
  }
  return top;
}
