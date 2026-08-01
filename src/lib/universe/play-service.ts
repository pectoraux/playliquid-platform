/**
 * Universe v0.4 — Play Flow Service
 * -----------------------------------
 * The universal player runtime. When a user clicks PLAY:
 *   1. Load the Spark's bundle
 *   2. Create a PlaySession via the kernel
 *   3. Run the runtime
 *   4. Capture telemetry
 *   5. Update player genome + reputation
 *   6. Reward the creator via the economy
 *
 * The player never knows which engine runs underneath.
 */

import { db } from '@/lib/db';
import { startSession, tick, endSession } from '@/lib/session-registry';
import { recordActivity } from './social-service';
import { ensurePlayerProfile } from '@/lib/world/player-service';
import { recomputeMetrics } from '@/lib/world/metrics-service';
import { rewardEngagement } from '@/lib/world/economy-service';
import type { ExperienceBundle } from '@/kernel/types';

export interface PlayResult {
  sessionId: string;
  experienceId: string;
  ticks: number;
  score: number;
  tokensEarned: Record<string, number>;
  durationMs: number;
  completed: boolean;
  rewardLiquid: number;
}

/**
 * One-click play: starts a session, runs some ticks, ends + rewards.
 * For interactive play, the client should use the session APIs directly.
 * This function provides a "quick play" that auto-runs a short session.
 */
export async function quickPlay(params: {
  experienceId: string;
  userId: string;
  ticks?: number;
}): Promise<{ result: PlayResult | null; error?: string }> {
  const { experienceId, userId } = params;
  const ticks = params.ticks ?? 30;

  // Fetch the experience + bundle
  const exp = await db.experienceRecord.findUnique({
    where: { id: experienceId },
    include: { creator: true },
  });
  if (!exp) return { result: null, error: 'Experience not found' };

  const bundleRecord = exp.bundleHash
    ? await db.bundleRecord.findUnique({ where: { contentHash: exp.bundleHash } })
    : null;
  if (!bundleRecord) return { result: null, error: 'Bundle not found' };

  const bundle: ExperienceBundle = JSON.parse(bundleRecord.bundleJson);

  // Ensure player profile exists
  await ensurePlayerProfile(userId);

  // Start session
  const startResult = await startSession({
    experienceId,
    bundle,
    mode: 'PREVIEW',
    userId,
  });

  if (!startResult.valid || !startResult.sessionId) {
    return { result: null, error: startResult.errors.join(', ') };
  }

  const sessionId = startResult.sessionId;
  const startTime = Date.now();

  // Auto-tick (simulate a play session)
  // Send a few random actions if there's a physics instance
  const physicsInstance = bundle.instances.find((i) =>
    i.extensionId === 'pl.physics' || i.extensionId === 'pl.coin-collector',
  );
  const ACTIONS = ['move-up', 'move-down', 'move-left', 'move-right'];

  for (let t = 0; t < ticks; t++) {
    if (physicsInstance && t % 3 === 0) {
      const action = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
      const { sendAction } = await import('@/lib/session-registry');
      sendAction(sessionId, physicsInstance.id, action);
    }
    tick(sessionId, 1);
  }

  // End session — captures telemetry + settles tokens
  await endSession(sessionId, 'completed');

  // Get the session result
  const session = await db.playSession.findUnique({
    where: { id: sessionId },
    include: { telemetry: true },
  });

  if (!session) return { result: null, error: 'Session not found after end' };

  // Reward the creator
  const durationMs = Date.now() - startTime;
  const rewardResult = await rewardEngagement({
    experienceId,
    userId,
    sessionDurationMs: durationMs,
    score: session.score,
  }).catch(() => ({ totalReward: 0, shares: [] }));

  // Recompute metrics
  await recomputeMetrics(experienceId).catch(() => {});

  // Update player's liquid balance
  await db.playerProfile.update({
    where: { userId },
    data: { liquidBalance: { increment: rewardResult.totalReward } },
  }).catch(() => {});

  // Record activity
  await recordActivity({
    userId,
    type: 'played',
    targetType: 'experience',
    targetId: experienceId,
    targetName: exp.title,
    detail: `scored ${session.score}`,
    metadata: { sessionId, durationMs, score: session.score },
  });

  // Extract token earnings from telemetry
  const tokensEarned: Record<string, number> = session.telemetry?.tokensEmittedJson
    ? JSON.parse(session.telemetry.tokensEmittedJson)
    : {};

  // ── Identity Layer integration ──────────────────────────────────────
  // Award XP, skills, and check achievements
  const { processPlaySessionRewards } = await import('@/lib/identity/achievement-service');
  await processPlaySessionRewards({
    userId,
    score: session.score,
    tokensEarned,
    durationMs,
  }).catch(() => {});

  // ── Consumer Layer: Play Graph + Leaderboard ─────────────────────────
  const { recordInteraction } = await import('@/lib/consumer/discover-service');
  const { submitLeaderboardEntry } = await import('@/lib/consumer/game-page-service');

  // Record play interaction
  const interaction = session.score > 0 ? 'played' : 'abandoned';
  await recordInteraction({
    userId,
    experienceId,
    interaction: interaction as any,
    metadata: { score: session.score, durationMs, sessionId },
  }).catch(() => {});

  // Submit to leaderboard if score > 0
  if (session.score > 0) {
    const profile = await db.playerProfile.findUnique({ where: { userId } });
    const displayName = profile?.displayName ?? 'Unknown';

    await submitLeaderboardEntry({
      experienceId,
      userId,
      displayName,
      score: session.score,
      sessionId,
    }).catch(() => {});

    // Create a replay
    const { createReplay } = await import('@/lib/social/social-service');
    await createReplay({
      sessionId,
      experienceId,
      experienceName: exp.title,
      userId,
      displayName,
      score: session.score,
      durationMs,
    }).catch(() => {});
  }

  // ── Identity Universe: check lifecycle milestones ──────────────────
  const { checkLifecycleMilestones } = await import('@/lib/identity-universe/community-service');
  await checkLifecycleMilestones(experienceId, exp.title).catch(() => {});

  return {
    result: {
      sessionId,
      experienceId,
      ticks,
      score: session.score,
      tokensEarned,
      durationMs,
      completed: true,
      rewardLiquid: rewardResult.totalReward,
    },
  };
}
