/**
 * Phase 16 — Competitive Session Service
 * ---------------------------------------
 * The complete competitive gameplay loop:
 *   Start session → Submit scores → End session → Revenue flows
 *
 * This is the first REAL economic loop in PlayLiquid.
 */

import { db } from '@/lib/db';
import { startSession, tick, endSession } from '@/lib/session-registry';
import { consumeMinutes } from '@/lib/economy/minutes-service';
import { submitLeaderboardEntry } from '@/lib/consumer/game-page-service';
import type { ExperienceBundle } from '@/kernel/types';

const MICRO_XOF_PER_LIQUID = 1_000_000;

/**
 * Start a competitive session.
 * Validates: user owns minutes, experience is competitive, minutes remaining.
 */
export async function startCompetitiveSession(params: {
  userId: string;
  experienceId: string;
  minutePurchaseId: string;
}): Promise<{ sessionId: string; error?: string }> {
  const { userId, experienceId, minutePurchaseId } = params;

  // Validate experience is competitive
  const exp = await db.experienceRecord.findUnique({ where: { id: experienceId } });
  if (!exp) return { sessionId: '', error: 'Experience not found' };
  if (!exp.competitiveEligible) return { sessionId: '', error: 'Experience is not competitive' };

  // Validate minute purchase
  const purchase = await db.minutePurchaseRecord.findUnique({ where: { id: minutePurchaseId } });
  if (!purchase) return { sessionId: '', error: 'Minute purchase not found' };
  if (purchase.userId !== userId) return { sessionId: '', error: 'You do not own this purchase' };
  if (purchase.status !== 'ACTIVE') return { sessionId: '', error: 'Purchase is not active' };
  const minutesRemaining = purchase.minutesPurchased - purchase.minutesUsed;
  if (minutesRemaining <= 0) return { sessionId: '', error: 'No minutes remaining' };

  // Get bundle
  const bundleRecord = exp.bundleHash
    ? await db.bundleRecord.findUnique({ where: { contentHash: exp.bundleHash } })
    : null;
  if (!bundleRecord) return { sessionId: '', error: 'Bundle not found' };
  const bundle: ExperienceBundle = JSON.parse(bundleRecord.bundleJson);

  // Start kernel session
  const startResult = await startSession({
    experienceId,
    bundle,
    mode: 'EARN',
    userId,
  });

  if (!startResult.valid || !startResult.sessionId) {
    return { sessionId: '', error: startResult.errors.join(', ') };
  }

  const sessionId = startResult.sessionId;

  // Update PlaySession to competitive mode
  await db.playSession.update({
    where: { id: sessionId },
    data: {
      competitiveMode: true,
      minutePurchaseId,
      timerStartedAt: new Date(),
      attempts: 1,
      highestScore: 0,
    },
  });

  return { sessionId };
}

/**
 * Submit a competitive score (one attempt).
 * Only the highest score across all attempts counts.
 */
export async function submitCompetitiveScore(params: {
  sessionId: string;
  score: number;
}): Promise<{ accepted: boolean; newHighest: boolean; highestScore: number; error?: string }> {
  const { sessionId, score } = params;

  const session = await db.playSession.findUnique({ where: { id: sessionId } });
  if (!session) return { accepted: false, newHighest: false, highestScore: 0, error: 'Session not found' };
  if (!session.competitiveMode) return { accepted: false, newHighest: false, highestScore: 0, error: 'Not a competitive session' };
  if (session.status !== 'ACTIVE') return { accepted: false, newHighest: false, highestScore: 0, error: 'Session is not active' };

  // Increment attempts
  const newAttempts = session.attempts + 1;

  // Check if this is a new high score
  const isNewHigh = score > session.highestScore;
  const newHighest = isNewHigh ? score : session.highestScore;

  await db.playSession.update({
    where: { id: sessionId },
    data: {
      attempts: newAttempts,
      highestScore: newHighest,
      score: newHighest, // session.score reflects highest
    },
  });

  // Submit to leaderboard (updates if higher than previous best)
  if (session.userId) {
    const profile = await db.playerProfile.findUnique({ where: { userId: session.userId } });
    await submitLeaderboardEntry({
      experienceId: session.experienceId,
      userId: session.userId,
      displayName: profile?.displayName ?? 'Unknown',
      score: newHighest,
      sessionId,
    }).catch(() => {});
  }

  return {
    accepted: true,
    newHighest: isNewHigh,
    highestScore: newHighest,
  };
}

/**
 * End a competitive session.
 * Calculates minutes used, triggers revenue split, settles.
 */
export async function endCompetitiveSession(params: {
  sessionId: string;
  reason?: string;
}): Promise<{ 
  ended: boolean; 
  highestScore: number; 
  attempts: number;
  minutesUsed: number;
  revenueSplit?: any;
  error?: string;
}> {
  const { sessionId } = params;

  const session = await db.playSession.findUnique({ where: { id: sessionId } });
  if (!session) return { ended: false, highestScore: 0, attempts: 0, minutesUsed: 0, error: 'Session not found' };
  if (!session.competitiveMode) return { ended: false, highestScore: 0, attempts: 0, minutesUsed: 0, error: 'Not a competitive session' };
  if (session.status === 'ENDED') return { ended: false, highestScore: 0, attempts: 0, minutesUsed: 0, error: 'Session already ended' };

  // Calculate elapsed time
  const timerStartedAt = session.timerStartedAt ?? session.startedAt;
  const elapsedMs = Date.now() - timerStartedAt.getTime();
  const minutesUsed = Math.max(1, Math.ceil(elapsedMs / 60000));

  // End the kernel session (captures telemetry)
  await endSession(sessionId, 'completed').catch(() => {});

  // Update session record
  await db.playSession.update({
    where: { id: sessionId },
    data: {
      status: 'ENDED',
      endedAt: new Date(),
      timerElapsedMs: elapsedMs,
      score: session.highestScore,
    },
  });

  // Process revenue split if minutes were purchased
  let revenueSplit: any = undefined;
  if (session.minutePurchaseId && session.userId) {
    const exp = await db.experienceRecord.findUnique({ where: { id: session.experienceId } });
    const purchase = await db.minutePurchaseRecord.findUnique({ where: { id: session.minutePurchaseId } });

    if (exp && purchase) {
      const result = await consumeMinutes({
        purchaseId: session.minutePurchaseId,
        minutesUsed,
        experienceId: session.experienceId,
        experienceName: exp.title,
        creatorId: exp.creatorId,
        userId: session.userId,
      });
      revenueSplit = result.revenueSplit;
    }
  }

  return {
    ended: true,
    highestScore: session.highestScore,
    attempts: session.attempts,
    minutesUsed,
    revenueSplit,
  };
}

/**
 * Get competitive session status.
 */
export async function getCompetitiveSession(sessionId: string): Promise<any | null> {
  const session = await db.playSession.findUnique({ where: { id: sessionId } });
  if (!session || !session.competitiveMode) return null;

  const elapsedMs = session.status === 'ACTIVE' && session.timerStartedAt
    ? Date.now() - session.timerStartedAt.getTime()
    : session.timerElapsedMs;

  return {
    sessionId: session.id,
    experienceId: session.experienceId,
    userId: session.userId,
    status: session.status,
    competitiveMode: session.competitiveMode,
    timerStartedAt: session.timerStartedAt?.getTime(),
    timerElapsedMs: elapsedMs,
    elapsedMinutes: Math.floor(elapsedMs / 60000),
    attempts: session.attempts,
    highestScore: session.highestScore,
    minutePurchaseId: session.minutePurchaseId,
  };
}
