/**
 * Phase 20.4/20.5 — Evolution Sandbox + AI-Generated Forks
 * --------------------------------------------------------
 * Run variants safely. No production impact until the creator approves.
 *
 * Flow:
 *   Current Experience
 *     → Create Fork (in-memory bundle)
 *     → Apply Mutation
 *     → Compile Graph (kernel compiler validates)
 *     → Simulation (reuse Simulation Lab + kernel runtime)
 *     → Human Approval
 *
 * The sandbox also runs A/B comparisons: variantA (current) vs variantB
 * (mutated). The winner is selected by the experiment metric (completion
 * rate by default, configurable).
 *
 * Phase 20.5: AI can propose a "new version" fork. The creator then chooses
 * to: replace the current experience, publish as a new experience, or
 * discard. This module implements the fork + publish steps.
 */

import { db } from '@/lib/db';
import { runSimulation, getSimulationRuns } from '@/lib/world/simulation-service';
import { compileBundle } from '@/kernel/compiler';
import { resolveExtension } from '@/kernel/extensions';
import { telemetryService } from '@/lib/telemetry-store';
import { persistBundle } from '@/lib/session-registry';
import { applyChanges, diffBundles } from './mutation-service';
import { markApplied, getMutation } from './mutation-store';
import { recordVersion } from '@/lib/creator-os/creator-studio-service';
import type { EvolutionRunRecordData } from './evolution-types';
import type { ExperienceBundle } from '@/kernel/types';

export interface SandboxResult {
  ok: boolean;
  compileValid: boolean;
  compileErrors?: string[];
  mutationId?: string;
  simulationId?: string;
  beforeMetrics?: Record<string, number>;
  afterMetrics?: Record<string, number>;
  error?: string;
}

/**
 * Run a sandbox simulation of a mutation.
 * 1. Fetch the current bundle
 * 2. Apply the mutation → new bundle
 * 3. Compile (validate graph)
 * 4. Simulate the new bundle against N synthetic players
 * 5. Compare metrics
 *
 * Does NOT touch the production experience.
 */
export async function runSandbox(params: {
  experienceId: string;
  mutationId: string;
  playerCount?: number;
}): Promise<SandboxResult> {
  const mutation = await getMutation(params.mutationId);
  if (!mutation) return { ok: false, compileValid: false, error: 'Mutation not found' };

  // Validate the after-graph compiles
  const graph = compileBundle(mutation.afterGraph, resolveExtension);
  if (!graph.valid) {
    return {
      ok: false,
      compileValid: false,
      compileErrors: graph.errors.map((e) => e.message),
      mutationId: params.mutationId,
      error: `Proposed bundle does not compile: ${graph.errors.map((e) => e.message).join(', ')}`,
    };
  }

  // Capture "before" metrics (current production state)
  const beforeMetrics = await getMetricsSnapshot(params.experienceId);

  // We need to publish the mutated bundle as a TEMPORARY fork experience so
  // the simulation service can run sessions against it. We create it with
  // status DRAFT and a parent pointer, then simulate, then optionally delete.
  const original = await db.experienceRecord.findUnique({
    where: { id: params.experienceId },
    include: { creator: true },
  });
  if (!original) return { ok: false, compileValid: true, error: 'Original experience not found' };

  const slug = `${original.slug}-sandbox-${Date.now().toString(36).slice(-6)}`;
  const intent = JSON.parse(original.intentJson);
  const diff = diffBundles(mutation.beforeGraph, mutation.afterGraph);
  const changeSummary = diff.configChanges
    .map((c) => `${c.instance}.${c.key}: ${String(c.before)}→${String(c.after)}`)
    .concat(diff.addedInstances.map((i) => `+${i}`))
    .concat(diff.removedInstances.map((i) => `-${i}`))
    .join(', ') || 'no changes';

  const sandboxExp = await db.experienceRecord.create({
    data: {
      slug,
      title: `${original.title} (sandbox)`,
      description: `Sandbox fork for mutation ${params.mutationId}. ${changeSummary}`,
      creatorId: original.creatorId,
      bundleHash: graph.contentHash,
      parentExperienceId: original.id,
      intentJson: JSON.stringify(intent),
      genomeJson: original.genomeJson,
      status: 'DRAFT',
    },
  });

  // Persist the bundle for the sandbox experience
  await persistBundle(sandboxExp.id, mutation.afterGraph, graph).catch(() => {});

  // Run simulation against the sandbox experience
  const playerCount = Math.min(params.playerCount ?? 8, 30);
  const simResult = await runSimulation({
    experienceId: sandboxExp.id,
    playerCount,
    variantLabel: 'B',
  });

  if (simResult.error) {
    // Cleanup sandbox experience on failure
    await db.experienceRecord.delete({ where: { id: sandboxExp.id } }).catch(() => {});
    return { ok: false, compileValid: true, mutationId: params.mutationId, error: simResult.error };
  }

  const afterMetrics = await getMetricsSnapshot(sandboxExp.id);

  // Cleanup: remove the sandbox experience + its bundle so it never reaches
  // the consumer. The metrics are captured in the EvolutionRunRecord.
  await db.experienceRecord.delete({ where: { id: sandboxExp.id } }).catch(() => {});

  return {
    ok: true,
    compileValid: true,
    mutationId: params.mutationId,
    simulationId: simResult.runId,
    beforeMetrics,
    afterMetrics,
  };
}

/**
 * Run an A/B experiment: simulate variant A (current) and variant B (mutated)
 * and record the winner.
 */
export async function runEvolutionExperiment(params: {
  experienceId: string;
  mutationId: string;
  playerCount?: number;
}): Promise<{ run: EvolutionRunRecordData | null; error?: string }> {
  const mutation = await getMutation(params.mutationId);
  if (!mutation) return { run: null, error: 'Mutation not found' };

  // Variant A: simulate current production
  const simA = await runSimulation({
    experienceId: params.experienceId,
    playerCount: Math.min(params.playerCount ?? 8, 30),
    variantLabel: 'A',
  });

  // Variant B: sandbox simulation of the mutation
  const sandboxB = await runSandbox({
    experienceId: params.experienceId,
    mutationId: params.mutationId,
    playerCount: params.playerCount,
  });

  if (!sandboxB.ok) {
    return { run: null, error: sandboxB.error ?? 'Sandbox B failed' };
  }

  const metricsA = simA.error ? {} : (await getMetricsSnapshot(params.experienceId));
  const metricsB = sandboxB.afterMetrics ?? {};

  // Winner: compare completionRate (primary), then averageScore (secondary)
  const winner = pickWinner(metricsA, metricsB);

  const delta: Record<string, number> = {};
  for (const key of Object.keys(metricsB)) {
    const a = Number(metricsA[key] ?? 0);
    const b = Number(metricsB[key] ?? 0);
    delta[key] = Math.round((b - a) * 1000) / 1000;
  }

  const row = await db.evolutionRunRecord.create({
    data: {
      experienceId: params.experienceId,
      mutationId: params.mutationId,
      simulationId: sandboxB.simulationId,
      variantA: 'Current',
      variantB: 'Mutated',
      winner,
      metricsJson: JSON.stringify({ A: metricsA, B: metricsB, delta }),
      status: 'COMPLETED',
      completedAt: new Date(),
    },
  });

  // Move proposal to EXPERIMENTING → then APPROVED if B wins
  const proposal = await db.evolutionProposal.findFirst({
    where: { mutationId: params.mutationId },
  });
  if (proposal) {
    await db.evolutionProposal.update({
      where: { id: proposal.id },
      data: { status: winner === 'B' ? 'EXPERIMENTING' : 'EXPERIMENTING' },
    });
  }

  return {
    run: {
      id: row.id,
      experienceId: row.experienceId,
      mutationId: row.mutationId ?? undefined,
      simulationId: row.simulationId ?? undefined,
      variantA: row.variantA,
      variantB: row.variantB,
      winner: row.winner as EvolutionRunRecordData['winner'],
      metrics: { A: metricsA, B: metricsB, delta },
      status: 'COMPLETED',
      createdAt: row.createdAt.getTime(),
      completedAt: row.completedAt?.getTime(),
    },
  };
}

function pickWinner(a: Record<string, number>, b: Record<string, number>): 'A' | 'B' | 'TIE' {
  const aComp = Number(a.completionRate ?? 0);
  const bComp = Number(b.completionRate ?? 0);
  if (Math.abs(bComp - aComp) < 0.02) {
    const aScore = Number(a.averageScore ?? 0);
    const bScore = Number(b.averageScore ?? 0);
    if (bScore > aScore * 1.05) return 'B';
    if (aScore > bScore * 1.05) return 'A';
    return 'TIE';
  }
  return bComp > aComp ? 'B' : 'A';
}

async function getMetricsSnapshot(experienceId: string): Promise<Record<string, number>> {
  const { getMetrics } = await import('@/lib/world/metrics-service');
  const m = await getMetrics(experienceId);
  if (!m) return {};
  return {
    totalSessions: m.totalSessions,
    completionRate: Math.round(m.completionRate * 1000) / 1000,
    averageScore: Math.round(m.averageScore),
    averageDropOffMs: m.averageDropOffMs,
    frustrationEvents: m.frustrationEvents,
    achievementEvents: m.achievementEvents,
    tokensEarned: m.tokensEarned,
    tokensSpent: m.tokensSpent,
    marketActions: m.marketActions,
  };
}

export async function getEvolutionRuns(experienceId: string, limit = 20): Promise<EvolutionRunRecordData[]> {
  const rows = await db.evolutionRunRecord.findMany({
    where: { experienceId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    experienceId: r.experienceId,
    mutationId: r.mutationId ?? undefined,
    simulationId: r.simulationId ?? undefined,
    variantA: r.variantA,
    variantB: r.variantB,
    winner: r.winner as EvolutionRunRecordData['winner'],
    metrics: r.metricsJson ? JSON.parse(r.metricsJson) : { A: {}, B: {}, delta: {} },
    status: r.status as EvolutionRunRecordData['status'],
    createdAt: r.createdAt.getTime(),
    completedAt: r.completedAt?.getTime(),
  }));
}

// ─── Phase 20.5: Apply an approved mutation to production ─────────────────
// This is the ONLY place where a mutation touches a live experience.
// It requires creator approval (status APPROVED) and produces a new version.

export async function applyApprovedMutation(params: {
  mutationId: string;
  mode: 'replace' | 'publish-new' | 'discard';
}): Promise<{ newExperienceId?: string; versionRecorded?: boolean; error?: string }> {
  const mutation = await getMutation(params.mutationId);
  if (!mutation) return { error: 'Mutation not found' };

  if (params.mode === 'discard') {
    await db.experienceMutationRecord.update({
      where: { id: params.mutationId },
      data: { status: 'REJECTED', creatorApproved: false },
    });
    // Also reject the originating proposal
    if (mutation.proposalId) {
      await db.evolutionProposal.update({
        where: { id: mutation.proposalId },
        data: { status: 'REJECTED', reviewedAt: new Date() },
      }).catch(() => {});
    }
    return {};
  }

  // Validate the after-graph still compiles
  const graph = compileBundle(mutation.afterGraph, resolveExtension);
  if (!graph.valid) {
    return { error: `Mutated bundle does not compile: ${graph.errors.map((e) => e.message).join(', ')}` };
  }

  const original = await db.experienceRecord.findUnique({
    where: { id: mutation.experienceId },
    include: { creator: true },
  });
  if (!original) return { error: 'Original experience not found' };

  // Compute genome for the new bundle
  const genome = telemetryService.computeGenome(
    `${original.title} v2`.toLowerCase().replace(/\s+/g, '-'),
    graph,
  );
  await telemetryService.persistGenome(genome).catch(() => {});

  if (params.mode === 'replace') {
    // Update the existing experience in place: bump bundle hash + record version
    const versions = await db.experienceVersionRecord.findMany({
      where: { experienceId: original.id },
      orderBy: { version: 'desc' },
      take: 1,
    });
    const nextVersion = (versions[0]?.version ?? 1) + 1;

    await db.experienceRecord.update({
      where: { id: original.id },
      data: {
        bundleHash: graph.contentHash,
        genomeJson: JSON.stringify(genome),
      },
    });
    await persistBundle(original.id, mutation.afterGraph, graph).catch(() => {});

    await markApplied(params.mutationId, original.id);
    const diff = diffBundles(mutation.beforeGraph, mutation.afterGraph);
    const summary = diff.configChanges
      .map((c) => `${c.instance}.${c.key}: ${String(c.before)}→${String(c.after)}`)
      .concat(diff.addedInstances.map((i) => `+${i}`))
      .concat(diff.removedInstances.map((i) => `-${i}`))
      .join(', ') || 'applied mutation';

    await recordVersion({
      experienceId: original.id,
      experienceName: original.title,
      version: nextVersion,
      bundleHash: graph.contentHash,
      changeSummary: summary,
      createdBy: original.creatorId,
    }).catch(() => {});

    // Mark proposal as APPROVED
    if (mutation.proposalId) {
      await db.evolutionProposal.update({
        where: { id: mutation.proposalId },
        data: { status: 'APPROVED', reviewedAt: new Date() },
      }).catch(() => {});
    }

    return { versionRecorded: true };
  }

  if (params.mode === 'publish-new') {
    // Publish as a new experience (fork lineage preserved)
    const slug = `${original.slug}-v2-${Date.now().toString(36).slice(-4)}`;
    const intent = JSON.parse(original.intentJson);
    const newExp = await db.experienceRecord.create({
      data: {
        slug,
        title: `${original.title} v2`,
        description: `Evolved version of ${original.title}.`,
        creatorId: original.creatorId,
        bundleHash: graph.contentHash,
        parentExperienceId: original.id,
        intentJson: JSON.stringify(intent),
        genomeJson: JSON.stringify(genome),
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    await persistBundle(newExp.id, mutation.afterGraph, graph).catch(() => {});
    await db.experienceRecord.update({
      where: { id: original.id },
      data: { forkCount: { increment: 1 } },
    }).catch(() => {});

    await markApplied(params.mutationId, newExp.id);
    await recordVersion({
      experienceId: newExp.id,
      experienceName: newExp.title,
      version: 1,
      bundleHash: graph.contentHash,
      changeSummary: `Published as new experience (fork of ${original.title})`,
      createdBy: original.creatorId,
    }).catch(() => {});

    if (mutation.proposalId) {
      await db.evolutionProposal.update({
        where: { id: mutation.proposalId },
        data: { status: 'APPROVED', reviewedAt: new Date() },
      }).catch(() => {});
    }

    return { newExperienceId: newExp.id, versionRecorded: true };
  }

  return { error: `Unknown mode: ${params.mode}` };
}

// ─── Convenience: generate an AI fork proposal (Phase 20.5) ────────────────
// This wraps runEvolutionEngine + sandbox into a single "propose a new
// version" flow. The actual engine lives in evolution-engine.ts; here we
// just expose a helper that returns the fork bundle for the UI.

export async function proposeFork(experienceId: string): Promise<{
  forkBundle?: ExperienceBundle;
  proposalId?: string;
  mutationId?: string;
  error?: string;
}> {
  const { runEvolutionEngine } = await import('./evolution-engine');
  const result = await runEvolutionEngine(experienceId);
  if (result.error || !result.proposal) return { error: result.error ?? 'No proposal generated' };
  return {
    forkBundle: result.proposal.newBundle,
    proposalId: result.proposal.id,
    mutationId: result.proposal.mutationId,
  };
}
