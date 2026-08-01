/**
 * World Engine — Experience Lab
 * ------------------------------
 * Runs simulated players against an experience to generate real telemetry.
 *
 * Each simulated player:
 *   1. Gets a synthetic profile (varied preferences)
 *   2. Starts a real session through the kernel API
 *   3. Sends actions (simulated play)
 *   4. Ticks the runtime
 *   5. Ends the session (capturing telemetry)
 *
 * This is NOT a mock. It runs actual sessions through the real runtime,
 * generating real token events, scores, and telemetry that feed back into
 * the metrics engine and evolution agent.
 */

import { db } from '@/lib/db';
import { startSession, tick, sendAction, endSession } from '@/lib/session-registry';
import { ensurePlayerProfile } from './player-service';
import { recomputeMetrics } from './metrics-service';
import { rewardEngagement } from './economy-service';
import type { SimulatedPlayer, ExperienceBundle } from '@/kernel/types';

const FIRST_NAMES = ['Alex', 'Sam', 'Jordan', 'Casey', 'Riley', 'Morgan', 'Avery', 'Quinn', 'Blake', 'Skyler', 'Drew', 'Reese', 'Sage', 'River', 'Phoenix', 'Wren'];
const ACTIONS = ['move-up', 'move-down', 'move-left', 'move-right'];

/**
 * Generate N simulated players with varied profiles.
 */
export function generateSimulatedPlayers(count: number): SimulatedPlayer[] {
  const players: SimulatedPlayer[] = [];
  for (let i = 0; i < count; i++) {
    const name = `${FIRST_NAMES[i % FIRST_NAMES.length]}_${i.toString(36)}`;
    const userId = `sim_${Date.now().toString(36)}_${i}`;
    players.push({
      userId,
      displayName: name,
      profile: {
        favoriteGenres: ['GAME'],
        emotionPreferences: (['mastery', 'strategy', 'competition'] as const).slice(0, 1 + (i % 3)),
        playedExtensions: [],
        completionRate: 0.3 + Math.random() * 0.5,
        averageSessionLength: 20000 + Math.random() * 60000,
        skillLevel: 20 + Math.random() * 60,
        socialBehavior: i % 3 === 0 ? 'competitive' : i % 3 === 1 ? 'social' : 'solo',
        creatorAffinity: [],
      },
      actionsPerSession: 5 + Math.floor(Math.random() * 15),
      preferredTickRate: 1 + Math.floor(Math.random() * 3),
    });
  }
  return players;
}

/**
 * Run a simulation: N players play an experience.
 * Each player runs a real session through the kernel.
 */
export async function runSimulation(params: {
  experienceId: string;
  playerCount: number;
  variantLabel?: string;
  variantConfig?: Record<string, unknown>;
}): Promise<{ runId: string; sessionsRun: number; error?: string }> {
  const { experienceId, playerCount } = params;

  // Fetch the experience bundle
  const exp = await db.experienceRecord.findUnique({ where: { id: experienceId } });
  if (!exp) return { runId: '', sessionsRun: 0, error: 'Experience not found' };

  const bundleRecord = exp.bundleHash
    ? await db.bundleRecord.findUnique({ where: { contentHash: exp.bundleHash } })
    : null;
  if (!bundleRecord) return { runId: '', sessionsRun: 0, error: 'Bundle not found' };

  let bundle: ExperienceBundle = JSON.parse(bundleRecord.bundleJson);

  // Apply variant config if provided
  if (params.variantConfig) {
    const vc = params.variantConfig;
    bundle = {
      ...bundle,
      instances: bundle.instances.map((inst) => ({
        ...inst,
        config: { ...(inst.config ?? {}), ...(vc[inst.id] ?? {}) },
      })),
    };
  }

  // Create simulation run record
  const run = await db.simulationRun.create({
    data: {
      experienceId,
      playerCount,
      variantLabel: params.variantLabel,
      variantConfigJson: JSON.stringify(params.variantConfig ?? {}),
      status: 'RUNNING',
    },
  });

  // Generate simulated players
  const players = generateSimulatedPlayers(playerCount);

  // Ensure player profiles exist
  for (const p of players) {
    await ensurePlayerProfile(p.userId, p.displayName);
  }

  // Ensure reward pool is seeded
  const { ledger } = await import('@/lib/token-store');
  const { ACCOUNTS } = await import('@/kernel/ledger');
  const rewardBalance = await ledger.getBalance(ACCOUNTS.REWARD_POOL);
  if (rewardBalance < 100_000_000) { // less than 100 Liquid
    await ledger.post([
      { account: ACCOUNTS.PLATFORM_CLEARING, debit: 0, credit: 1_000_000_000 },
      { account: ACCOUNTS.REWARD_POOL, debit: 1_000_000_000, credit: 0 },
    ], 'simulation seed funding');
  }

  // Run sessions (sequentially to avoid memory pressure)
  let sessionsRun = 0;
  for (const player of players) {
    try {
      // Start session — use the real experienceId so metrics are attributed correctly
      const startResult = await startSession({
        experienceId,
        bundle,
        mode: 'PREVIEW',
        userId: player.userId,
      });

      if (!startResult.valid || !startResult.sessionId) {
        continue;
      }

      const sessionId = startResult.sessionId;

      // Simulate play: send actions + tick
      const physicsInstance = bundle.instances.find((i) =>
        i.extensionId === 'pl.physics' || i.extensionId === 'pl.coin-collector',
      );
      const targetInstance = physicsInstance?.id ?? bundle.instances[0]?.id;

      if (targetInstance) {
        for (let a = 0; a < player.actionsPerSession; a++) {
          const action = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
          sendAction(sessionId, targetInstance, action);
          tick(sessionId, player.preferredTickRate);
        }
      }

      // Tick more to let economy flow
      tick(sessionId, 20);

      // End session — this captures telemetry + settles tokens
      await endSession(sessionId, 'completed');

      // Reward engagement (creator economy)
      const session = await db.playSession.findUnique({ where: { id: sessionId } });
      if (session) {
        try {
          await rewardEngagement({
            experienceId,
            userId: player.userId,
            sessionDurationMs: Date.now() - session.startedAt.getTime(),
            score: session.score,
          });
        } catch (err) {
          console.error(`Reward engagement failed for ${player.userId}:`, (err as Error).message);
        }
      }

      sessionsRun++;
    } catch (err) {
      // Continue even if one session fails
      console.error(`Simulation player ${player.userId} failed:`, (err as Error).message);
    }
  }

  // Recompute metrics for the experience
  await recomputeMetrics(experienceId);

  // Complete the simulation run
  const metrics = await recomputeMetrics(experienceId);
  await db.simulationRun.update({
    where: { id: run.id },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      metricsJson: JSON.stringify(metrics),
    },
  });

  return { runId: run.id, sessionsRun };
}

/**
 * Get simulation runs for an experience.
 */
export async function getSimulationRuns(experienceId: string): Promise<any[]> {
  const runs = await db.simulationRun.findMany({
    where: { experienceId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  return runs.map((r) => ({
    id: r.id,
    experienceId: r.experienceId,
    playerCount: r.playerCount,
    variantLabel: r.variantLabel,
    status: r.status,
    metrics: r.metricsJson ? JSON.parse(r.metricsJson) : {},
    createdAt: r.createdAt.getTime(),
    completedAt: r.completedAt?.getTime(),
  }));
}
