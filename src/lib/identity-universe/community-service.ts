/**
 * v0.47 Identity Universe — Community + Lifecycle + Coaching Service
 * ------------------------------------------------------------------
 * Communities (Discord+Reddit inside games), Game Lifecycle timelines,
 * enhanced AI Companion coaching, and dynamic achievement context.
 */

import ZAI from 'z-ai-web-dev-sdk';
import { db } from '@/lib/db';
import { getFullPlayerIdentity } from '@/lib/identity/player-identity-service';

// ─── Community Spaces ──────────────────────────────────────────────────────

export async function ensureCommunity(experienceId: string, experienceName: string, creatorId: string): Promise<string> {
  const existing = await db.communitySpaceRecord.findUnique({ where: { experienceId } });
  if (existing) return existing.id;

  const community = await db.communitySpaceRecord.create({
    data: { experienceId, experienceName, creatorId },
  });

  await recordLifecycleEvent(experienceId, experienceName, 'community-formed', 'Community Formed', 'Players can now discuss, share strategies, and connect.', '👥');
  return community.id;
}

export async function joinCommunity(communityId: string, userId: string, displayName: string): Promise<void> {
  await db.communityMemberRecord.upsert({
    where: { communityId_userId: { communityId, userId } },
    create: { communityId, userId, displayName },
    update: {},
  });
  await db.communitySpaceRecord.update({
    where: { id: communityId },
    data: { memberCount: { increment: 1 } },
  });
}

export async function leaveCommunity(communityId: string, userId: string): Promise<void> {
  await db.communityMemberRecord.deleteMany({ where: { communityId, userId } });
  await db.communitySpaceRecord.update({
    where: { id: communityId },
    data: { memberCount: { decrement: 1 } },
  }).catch(() => {});
}

export async function getCommunity(experienceId: string): Promise<any> {
  const community = await db.communitySpaceRecord.findUnique({
    where: { experienceId },
    include: {
      posts: { orderBy: { createdAt: 'desc' }, take: 20 },
      members: { orderBy: { joinedAt: 'desc' }, take: 10 },
    },
  });
  if (!community) return null;

  return {
    id: community.id,
    experienceId: community.experienceId,
    experienceName: community.experienceName,
    memberCount: community.memberCount,
    description: community.description,
    rules: community.rules,
    posts: community.posts.map((p) => ({
      id: p.id,
      userId: p.userId,
      displayName: p.displayName,
      type: p.type,
      title: p.title,
      body: p.body,
      upvotes: p.upvotes,
      commentCount: p.commentCount,
      pinned: p.pinned,
      pollOptions: JSON.parse(p.pollOptionsJson),
      createdAt: p.createdAt.getTime(),
    })),
    members: community.members.map((m) => ({
      userId: m.userId,
      displayName: m.displayName,
      role: m.role,
      joinedAt: m.joinedAt.getTime(),
    })),
  };
}

export async function createCommunityPost(params: {
  communityId: string;
  userId: string;
  displayName: string;
  type: string;
  title: string;
  body: string;
  pollOptions?: string[];
}): Promise<{ postId: string }> {
  const post = await db.communityPostRecord.create({
    data: {
      communityId: params.communityId,
      userId: params.userId,
      displayName: params.displayName,
      type: params.type,
      title: params.title,
      body: params.body,
      pollOptionsJson: JSON.stringify(params.pollOptions?.map((o) => ({ option: o, votes: 0 })) ?? []),
    },
  });
  return { postId: post.id };
}

export async function upvotePost(postId: string): Promise<void> {
  await db.communityPostRecord.update({
    where: { id: postId },
    data: { upvotes: { increment: 1 } },
  });
}

// ─── Game Lifecycle ────────────────────────────────────────────────────────

export async function recordLifecycleEvent(
  experienceId: string,
  experienceName: string,
  milestone: string,
  title: string,
  description: string,
  icon: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  // Check if this milestone already exists
  const existing = await db.gameLifecycleEventRecord.findFirst({
    where: { experienceId, milestone },
  });
  if (existing) return;

  await db.gameLifecycleEventRecord.create({
    data: { experienceId, experienceName, milestone, title, description, icon, metadataJson: JSON.stringify(metadata ?? {}) },
  });
}

export async function getLifecycleTimeline(experienceId: string): Promise<any[]> {
  const events = await db.gameLifecycleEventRecord.findMany({
    where: { experienceId },
    orderBy: { achievedAt: 'asc' },
  });
  return events.map((e) => ({
    id: e.id,
    milestone: e.milestone,
    title: e.title,
    description: e.description,
    icon: e.icon,
    metadata: JSON.parse(e.metadataJson),
    achievedAt: e.achievedAt.getTime(),
  }));
}

/**
 * Check for lifecycle milestones based on current stats.
 */
export async function checkLifecycleMilestones(experienceId: string, experienceName: string): Promise<void> {
  const exp = await db.experienceRecord.findUnique({ where: { id: experienceId } });
  if (!exp) return;

  const metrics = await db.experienceMetrics.findUnique({ where: { experienceId } });
  const playCount = metrics?.totalSessions ?? exp.playCount;
  const forkCount = exp.forkCount;

  if (playCount >= 1) {
    await recordLifecycleEvent(experienceId, experienceName, 'first-play', 'First Play', 'Someone played this Spark for the first time!', '🎮');
  }
  if (playCount >= 10) {
    await recordLifecycleEvent(experienceId, experienceName, '10-players', '10 Players', 'Reached 10 players — the Spark is catching on.', '📈');
  }
  if (playCount >= 50) {
    await recordLifecycleEvent(experienceId, experienceName, '50-players', '50 Players', 'A growing community of players!', '🚀');
  }
  if (playCount >= 100) {
    await recordLifecycleEvent(experienceId, experienceName, '100-players', '100 Players!', 'Hit the 100-player milestone — this Spark is going places.', '🎉');
  }
  if (forkCount >= 1) {
    await recordLifecycleEvent(experienceId, experienceName, 'first-fork', 'First Fork', 'Someone remixed this Spark — creativity spreads!', '🌿');
  }
  if (forkCount >= 10) {
    await recordLifecycleEvent(experienceId, experienceName, '10-forks', '10 Forks', 'The remix ecosystem is growing!', '🔄');
  }
  if (playCount >= 100 && forkCount >= 5) {
    await recordLifecycleEvent(experienceId, experienceName, 'legendary', 'Legendary Status', 'This Spark has achieved legendary status with 100+ plays and 5+ forks.', '👑');
  }
}

// ─── Enhanced AI Companion Coaching ────────────────────────────────────────

export interface CoachingInsight {
  type: 'discovery' | 'coaching' | 'progress' | 'social' | 'creation';
  title: string;
  body: string;
  actionSuggestion: string;
  severity: 'info' | 'suggestion' | 'alert';
}

export async function getCoachingInsights(userId: string): Promise<CoachingInsight[]> {
  const identity = await getFullPlayerIdentity(userId);
  if (!identity) return [];

  const insights: CoachingInsight[] = [];

  // ── Coaching: analyze skill gaps ────────────────────────────────────
  const skills = identity.skills;
  const topSkill = Object.entries(skills).sort(([, a], [, b]) => (b as number) - (a as number))[0];
  const weakSkill = Object.entries(skills).sort(([, a], [, b]) => (a as number) - (b as number))[0];

  if (topSkill && (topSkill[1] as number) > 70) {
    insights.push({
      type: 'coaching',
      title: `Your ${topSkill[0]} is exceptional`,
      body: `At ${topSkill[1]}/100, you're in the top tier for ${topSkill[0]}. Challenge yourself with harder Sparks in this domain.`,
      actionSuggestion: 'Browse high-difficulty Sparks matching your top skill',
      severity: 'info',
    });
  }

  if (weakSkill && (weakSkill[1] as number) < 20 && (weakSkill[1] as number) > 0) {
    insights.push({
      type: 'coaching',
      title: `${weakSkill[0]} needs work`,
      body: `Your ${weakSkill[0]} skill is at ${weakSkill[1]}/100. Focus on Sparks that develop this area.`,
      actionSuggestion: 'Try Sparks that emphasize ' + weakSkill[0],
      severity: 'suggestion',
    });
  }

  // ── Progress: level and achievements ────────────────────────────────
  const xpToNext = identity.xpToNextLevel;
  const xpProgress = Math.round((identity.xp / xpToNext) * 100);
  if (xpProgress > 80) {
    insights.push({
      type: 'progress',
      title: 'Almost there!',
      body: `You're ${100 - xpProgress}% away from Level ${identity.level + 1}. One more good session should do it!`,
      actionSuggestion: 'Play a Spark to level up',
      severity: 'info',
    });
  }

  if (identity.achievements.length >= 5) {
    insights.push({
      type: 'progress',
      title: 'Achievement Hunter',
      body: `You've earned ${identity.achievements.length} achievements. Keep going to unlock rare and legendary ones!`,
      actionSuggestion: 'Check achievement catalog for next unlock',
      severity: 'info',
    });
  }

  // ── Social: connections and challenges ──────────────────────────────
  if (identity.social.followers === 0 && identity.totalSessions > 5) {
    insights.push({
      type: 'social',
      title: 'Build your audience',
      body: 'You\'ve played several Sparks but haven\'t been followed yet. Share your replays to attract followers!',
      actionSuggestion: 'Share your best replay',
      severity: 'suggestion',
    });
  }

  if (identity.worldPassport.totalWorldsVisited === 0 && identity.totalSessions > 3) {
    insights.push({
      type: 'discovery',
      title: 'Explore a World',
      body: 'You haven\'t visited any Worlds yet. Worlds are living simulations with AI citizens — a whole different experience!',
      actionSuggestion: 'Visit the Civilization Engine',
      severity: 'suggestion',
    });
  }

  // ── Creation: suggest becoming a creator ────────────────────────────
  if (identity.reputation.creator < 10 && identity.totalSessions > 10) {
    insights.push({
      type: 'creation',
      title: 'Time to create?',
      body: `You've played ${identity.totalSessions} sessions and understand what makes Sparks fun. Consider creating your own!`,
      actionSuggestion: 'Open the AI Composer',
      severity: 'info',
    });
  }

  // ── Use LLM for a personalized coaching message ─────────────────────
  if (insights.length > 0) {
    try {
      const zai = await ZAI.create();
      const completion = await zai.chat.completions.create({
        messages: [
          {
            role: 'assistant',
            content: `You are a gaming coach for PlayLiquid. Based on the player's data, write ONE personalized coaching insight (2 sentences max). Be specific, warm, and actionable. No markdown.`,
          },
          {
            role: 'user',
            content: `Player: ${identity.displayName}, Level ${identity.level}, Skills: ${JSON.stringify(identity.skills)}, Sessions: ${identity.totalSessions}, Achievements: ${identity.achievements.length}, Reputation: ${JSON.stringify(identity.reputation)}`,
          },
        ],
        thinking: { type: 'disabled' },
      });

      const coaching = completion.choices[0]?.message?.content?.trim();
      if (coaching) {
        insights.unshift({
          type: 'coaching',
          title: 'AI Coach Says',
          body: coaching,
          actionSuggestion: 'Follow the coach\'s advice',
          severity: 'info',
        });
      }
    } catch {
      // Fallback: use rule-based insights only
    }
  }

  return insights;
}

// ─── Dynamic Achievement Context ───────────────────────────────────────────

export interface AchievementContext {
  achievementId: string;
  title: string;
  icon: string;
  rarity: string;
  unlockStory: string;  // "Unlocked because: 100 games, top 1%, average completion <30 seconds"
  progressToNext?: string;  // "3 more wins to unlock Arena Champion"
}

export async function getAchievementContext(userId: string): Promise<AchievementContext[]> {
  const earned = await db.achievementRecord.findMany({
    where: { userId },
    orderBy: { earnedAt: 'desc' },
  });

  const identity = await getFullPlayerIdentity(userId);
  if (!identity) return [];

  return earned.map((a) => {
    const context: AchievementContext = {
      achievementId: a.achievementId,
      title: a.title,
      icon: a.icon,
      rarity: a.rarity,
      unlockStory: generateUnlockStory(a.achievementId, a.title, identity),
    };

    // Add progress to next achievement
    const nextAchievement = getNextAchievement(a.achievementId, identity);
    if (nextAchievement) {
      context.progressToNext = nextAchievement;
    }

    return context;
  });
}

function generateUnlockStory(achievementId: string, title: string, identity: any): string {
  const stories: Record<string, string> = {
    'first-play': `Unlocked after your very first Spark session. The journey begins!`,
    'strategist': `Unlocked by earning 100+ total score across ${identity.totalSessions} sessions. Your strategic thinking is paying off.`,
    'merchant': `Unlocked by earning 50+ tokens through trading and economy gameplay.`,
    'master-player': `Unlocked after ${identity.totalSessions} play sessions. Dedication recognized!`,
    'legend': `Unlocked by earning 500+ total score. You are a Living Legend.`,
    'tycoon': `Unlocked by earning ${(identity.liquidBalance / 1_000_000).toFixed(1)} Liquid. Economic mastery confirmed.`,
  };
  return stories[achievementId] ?? `Earned through your gameplay achievements.`;
}

function getNextAchievement(currentId: string, identity: any): string | undefined {
  // Simple progression hints
  if (currentId === 'first-play') return `Play ${Math.max(0, 5 - identity.totalSessions)} more sessions to unlock "Explorer"`;
  if (currentId === 'strategist') return `Earn ${Math.max(0, 500 - (identity.totalSessions * 25))} more score to unlock "Living Legend"`;
  if (currentId === 'merchant') return `Earn ${Math.max(0, 100 - identity.totalSessions * 3)} more tokens to unlock "Collector"`;
  return undefined;
}

// ─── Creator Posts ─────────────────────────────────────────────────────────

export async function createCreatorPost(params: {
  creatorId: string;
  creatorName: string;
  type: string;
  title: string;
  body: string;
}): Promise<{ postId: string }> {
  const post = await db.creatorPostRecord.create({
    data: {
      creatorId: params.creatorId,
      creatorName: params.creatorName,
      type: params.type,
      title: params.title,
      body: params.body,
    },
  });
  return { postId: post.id };
}

export async function getCreatorPosts(creatorId: string, limit = 20): Promise<any[]> {
  const posts = await db.creatorPostRecord.findMany({
    where: { creatorId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return posts.map((p) => ({
    id: p.id,
    type: p.type,
    title: p.title,
    body: p.body,
    likeCount: p.likeCount,
    commentCount: p.commentCount,
    pinned: p.pinned,
    createdAt: p.createdAt.getTime(),
  }));
}

// ─── Evolved Feed (mix of content types) ───────────────────────────────────

export async function getEvolvedFeed(userId: string, limit = 20): Promise<{
  games: any[];
  players: any[];
  replays: any[];
  creatorPosts: any[];
  communityMoments: any[];
}> {
  // Get a mix of content types
  const [games, replays, creatorPosts, communities] = await Promise.all([
    getRecommendedGames(userId, 4),
    getRecentReplays(4),
    getRecentCreatorPosts(4),
    getCommunityMoments(4),
  ]);

  return {
    games,
    players: [], // would need a player discovery service
    replays,
    creatorPosts,
    communityMoments: communities,
  };
}

async function getRecommendedGames(userId: string, limit: number): Promise<any[]> {
  const { getRecommendations } = await import('@/lib/world/discovery-service');
  const recs = await getRecommendations(userId, limit);
  const result: any[] = [];
  for (const r of recs) {
    const exp = await db.experienceRecord.findUnique({
      where: { id: r.experienceId },
      include: { creator: true },
    });
    if (exp) {
      result.push({
        type: 'game',
        experienceId: exp.id,
        title: exp.title,
        creatorName: exp.creator?.displayName ?? 'Unknown',
        playCount: exp.playCount,
        reputationScore: r.score,
        matchReason: r.reasons[0],
      });
    }
  }
  return result;
}

async function getRecentReplays(limit: number): Promise<any[]> {
  const { getReplays } = await import('@/lib/social/social-service');
  const replays = await getReplays({ limit });
  return replays.map((r) => ({
    type: 'replay',
    ...r,
  }));
}

async function getRecentCreatorPosts(limit: number): Promise<any[]> {
  const posts = await db.creatorPostRecord.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return posts.map((p) => ({
    type: 'creator-post',
    id: p.id,
    creatorName: p.creatorName,
    title: p.title,
    body: p.body.slice(0, 200),
    postType: p.type,
    createdAt: p.createdAt.getTime(),
  }));
}

async function getCommunityMoments(limit: number): Promise<any[]> {
  const posts = await db.communityPostRecord.findMany({
    orderBy: { upvotes: 'desc' },
    take: limit,
    include: { community: true },
  });
  return posts.map((p) => ({
    type: 'community-moment',
    id: p.id,
    communityName: p.community.experienceName,
    title: p.title,
    body: p.body.slice(0, 200),
    upvotes: p.upvotes,
    author: p.displayName,
    createdAt: p.createdAt.getTime(),
  }));
}
