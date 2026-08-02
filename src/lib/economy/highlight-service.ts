/**
 * ADR-011: Highlight Service
 * ----------------------------
 * AI-generated highlights from replays.
 * Triggers: leaderboard first, podium, world record, comeback, exceptional, high score.
 * Highlights are first-class discoverable content.
 */

import { db } from '@/lib/db';

const HIGHLIGHT_TRIGGERS = {
  leaderboard_first: { label: '🏆 Leaderboard First Place', icon: '🏆', description: 'Reached #1 on the leaderboard' },
  podium: { label: '🥉 Podium Finish', icon: '🥉', description: 'Finished in top 3' },
  world_record: { label: '🌍 World Record', icon: '🌍', description: 'Set a new world record' },
  comeback: { label: '🔄 Epic Comeback', icon: '🔄', description: 'Impossible comeback victory' },
  exceptional: { label: '✨ Exceptional Play', icon: '✨', description: 'Exceptional gameplay moment' },
  high_score: { label: '📈 Personal Best', icon: '📈', description: 'Achieved personal best score' },
};

/**
 * Generate a highlight from a replay based on trigger type.
 */
export async function generateHighlight(params: {
  replayId: string;
  experienceId: string;
  experienceName: string;
  userId: string;
  displayName: string;
  triggerType: keyof typeof HIGHLIGHT_TRIGGERS;
  score: number;
  durationMs: number;
}): Promise<{ highlightId: string }> {
  const trigger = HIGHLIGHT_TRIGGERS[params.triggerType];

  const highlight = await db.highlightRecord.create({
    data: {
      replayId: params.replayId,
      experienceId: params.experienceId,
      experienceName: params.experienceName,
      userId: params.userId,
      displayName: params.displayName,
      triggerType: params.triggerType,
      title: `${trigger.label} — ${params.experienceName}`,
      description: `${params.displayName} ${trigger.description.toLowerCase()} with a score of ${params.score}!`,
      durationMs: params.durationMs,
      scoreAtHighlight: params.score,
      isAiGenerated: true,
    },
  });

  return { highlightId: highlight.id };
}

/**
 * Get highlights for the discover feed.
 */
export async function getHighlights(experienceId?: string, limit = 20): Promise<any[]> {
  const where: any = {};
  if (experienceId) where.experienceId = experienceId;

  const highlights = await db.highlightRecord.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return highlights.map((h) => ({
    id: h.id,
    experienceId: h.experienceId,
    experienceName: h.experienceName,
    userId: h.userId,
    displayName: h.displayName,
    triggerType: h.triggerType,
    triggerLabel: HIGHLIGHT_TRIGGERS[h.triggerType as keyof typeof HIGHLIGHT_TRIGGERS]?.label ?? h.triggerType,
    triggerIcon: HIGHLIGHT_TRIGGERS[h.triggerType as keyof typeof HIGHLIGHT_TRIGGERS]?.icon ?? '📊',
    title: h.title,
    description: h.description,
    durationMs: h.durationMs,
    scoreAtHighlight: h.scoreAtHighlight,
    viewCount: h.viewCount,
    likeCount: h.likeCount,
    createdAt: h.createdAt.getTime(),
  }));
}

/**
 * Get highlights for a specific experience (for game page).
 */
export async function getExperienceHighlights(experienceId: string, limit = 10): Promise<any[]> {
  return getHighlights(experienceId, limit);
}

/**
 * Check if a replay should generate a highlight.
 */
export function shouldGenerateHighlight(params: {
  score: number;
  rank: number;
  isWorldRecord: boolean;
  previousBest: number;
}): keyof typeof HIGHLIGHT_TRIGGERS | null {
  if (params.isWorldRecord) return 'world_record';
  if (params.rank === 1) return 'leaderboard_first';
  if (params.rank <= 3) return 'podium';
  if (params.score > params.previousBest * 1.5) return 'comeback';
  if (params.score > params.previousBest) return 'high_score';
  if (params.score > 200) return 'exceptional';
  return null;
}

/**
 * View a highlight (increment view count).
 */
export async function viewHighlight(highlightId: string): Promise<void> {
  await db.highlightRecord.update({
    where: { id: highlightId },
    data: { viewCount: { increment: 1 } },
  });
}
