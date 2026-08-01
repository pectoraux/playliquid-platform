/**
 * World Engine — AI Experience Evolution Agent
 * ---------------------------------------------
 * The AI watches experience metrics and proposes improvements.
 *
 * It does NOT autonomously modify experiences. It:
 *   1. Analyzes aggregated metrics (drop-offs, engagement, economy)
 *   2. Uses the LLM to identify patterns and propose changes
 *   3. Generates a new bundle (fork) with the proposed changes
 *   4. Predicts improvement
 *   5. Returns a proposal for creator approval
 *
 * Uses z-ai-web-dev-sdk (server-side only).
 */

import ZAI from 'z-ai-web-dev-sdk';
import { db } from '@/lib/db';
import { getMetrics } from './metrics-service';
import { getRoyaltyGraph } from './economy-service';
import type { ExperienceBundle, EvolutionProposalData } from '@/kernel/types';

export async function analyzeAndPropose(experienceId: string): Promise<{ proposal: EvolutionProposalData | null; error?: string }> {
  // Fetch experience + metrics + bundle
  const exp = await db.experienceRecord.findUnique({
    where: { id: experienceId },
    include: { creator: true },
  });
  if (!exp) return { proposal: null, error: 'Experience not found' };

  const metrics = await getMetrics(experienceId);
  if (!metrics || metrics.totalSessions === 0) {
    return { proposal: null, error: 'No session data to analyze yet' };
  }

  const bundleRecord = exp.bundleHash
    ? await db.bundleRecord.findUnique({ where: { contentHash: exp.bundleHash } })
    : null;
  if (!bundleRecord) return { proposal: null, error: 'Bundle not found' };

  const bundle: ExperienceBundle = JSON.parse(bundleRecord.bundleJson);
  const genome = exp.genomeJson ? JSON.parse(exp.genomeJson) : null;
  const royaltyGraph = await getRoyaltyGraph(experienceId);

  // Prepare analysis context for the LLM
  const context = {
    experience: {
      id: exp.id,
      title: exp.title,
      description: exp.description,
      genome,
      bundle: {
        type: bundle.type,
        instances: bundle.instances.map((i) => ({ id: i.id, extensionId: i.extensionId, config: i.config })),
        wires: bundle.wires,
      },
    },
    metrics: {
      totalSessions: metrics.totalSessions,
      completionRate: Math.round(metrics.completionRate * 100) / 100,
      averageScore: Math.round(metrics.averageScore),
      averageDropOffMs: metrics.averageDropOffMs,
      averageDropOffSeconds: Math.round(metrics.averageDropOffMs / 1000),
      frustrationEvents: metrics.frustrationEvents,
      achievementEvents: metrics.achievementEvents,
      tokensEarned: metrics.tokensEarned,
      tokensSpent: metrics.tokensSpent,
      marketActions: metrics.marketActions,
    },
    royaltyGraph,
  };

  const systemPrompt = `You are the PlayLiquid AI Experience Evolution Agent. You analyze experience metrics and propose improvements to the experience graph.

You do NOT generate code. You analyze patterns and propose config changes to existing extensions in the graph.

Analyze the metrics and propose changes that would improve retention, engagement, or economy balance.

Respond with ONLY valid JSON (no markdown) in this exact shape:
{
  "analysis": {
    "patterns": ["pattern 1", "pattern 2"],
    "dropOffPoint": "description of where players quit, if applicable",
    "bottlenecks": ["bottleneck 1"],
    "strengths": ["strength 1"]
  },
  "proposedChanges": {
    "summary": "one-line summary of the proposed evolution",
    "changes": [
      {
        "instance": "farm",
        "config": { "intervalTicks": 3 },
        "reason": "speed up production to reduce early drop-off"
      }
    ]
  },
  "predictedLift": 0.15
}

Rules:
- predictedLift is a decimal (0.15 = +15% retention expected)
- Only propose changes to existing instances' configs (don't add/remove extensions)
- Be specific about which instance and which config key to change
- Base your analysis on the actual metrics provided`;

  const userPrompt = `Analyze this experience and propose an evolution:

${JSON.stringify(context, null, 2)}`;

  try {
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      thinking: { type: 'disabled' },
    });

    const raw = completion.choices[0]?.message?.content ?? '';
    let jsonStr = raw.trim();
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) jsonStr = fenceMatch[1].trim();

    const parsed = JSON.parse(jsonStr);

    // Build the new bundle with proposed config changes
    const newBundle: ExperienceBundle = {
      type: bundle.type,
      name: `${bundle.name ?? exp.title} v2`,
      instances: bundle.instances.map((inst) => {
        const change = parsed.proposedChanges?.changes?.find((c: any) => c.instance === inst.id);
        if (change?.config) {
          return {
            ...inst,
            config: { ...(inst.config ?? {}), ...change.config },
          };
        }
        return inst;
      }),
      wires: bundle.wires,
    };

    // Persist the proposal
    const record = await db.evolutionProposal.create({
      data: {
        experienceId,
        analysisJson: JSON.stringify(parsed.analysis),
        proposedChangesJson: JSON.stringify(parsed.proposedChanges),
        predictedLift: parsed.predictedLift ?? 0,
        newBundleJson: JSON.stringify(newBundle),
        status: 'PENDING',
      },
    });

    const proposal: EvolutionProposalData = {
      id: record.id,
      experienceId,
      analysis: parsed.analysis,
      proposedChanges: parsed.proposedChanges,
      predictedLift: parsed.predictedLift ?? 0,
      newBundle,
      status: 'PENDING',
      createdAt: record.createdAt.getTime(),
    };

    return { proposal };
  } catch (err) {
    // Fallback: rule-based proposal
    return { proposal: fallbackProposal(experienceId, exp.title, bundle, metrics), error: `AI fallback: ${(err as Error).message}` };
  }
}

/**
 * Rule-based fallback if the LLM fails.
 */
function fallbackProposal(experienceId: string, title: string, bundle: ExperienceBundle, metrics: any): EvolutionProposalData {
  const changes: any[] = [];
  const patterns: string[] = [];
  const bottlenecks: string[] = [];

  // Rule 1: low completion rate → speed up economy
  if (metrics.completionRate < 0.3) {
    const farm = bundle.instances.find((i) => i.extensionId === 'pl.farm');
    if (farm) {
      const currentInterval = (farm.config?.intervalTicks as number) ?? 5;
      changes.push({
        instance: farm.id,
        config: { intervalTicks: Math.max(1, currentInterval - 2) },
        reason: 'Speed up farm production to improve early engagement',
      });
    }
    patterns.push(`Low completion rate (${Math.round(metrics.completionRate * 100)}%)`);
    bottlenecks.push('Economy may be too slow for player retention');
  }

  // Rule 2: high frustration → reduce difficulty
  if (metrics.frustrationEvents > metrics.totalSessions * 0.3) {
    patterns.push(`High frustration rate (${metrics.frustrationEvents} events in ${metrics.totalSessions} sessions)`);
    bottlenecks.push('Players may be quitting early due to difficulty');
  }

  // Rule 3: low token activity → increase rewards
  if (metrics.tokensEarned < metrics.totalSessions * 3) {
    const competition = bundle.instances.find((i) => i.extensionId === 'pl.competition');
    if (competition) {
      changes.push({
        instance: competition.id,
        config: { scorePerTrade: 20 },
        reason: 'Increase score rewards to boost achievement signals',
      });
    }
  }

  if (changes.length === 0) {
    changes.push({
      instance: bundle.instances[0]?.id ?? 'farm',
      config: { intervalTicks: 3 },
      reason: 'Minor tuning to maintain engagement',
    });
  }

  const newBundle: ExperienceBundle = {
    type: bundle.type,
    name: `${bundle.name ?? title} v2`,
    instances: bundle.instances.map((inst) => {
      const change = changes.find((c) => c.instance === inst.id);
      if (change?.config) {
        return { ...inst, config: { ...(inst.config ?? {}), ...change.config } };
      }
      return inst;
    }),
    wires: bundle.wires,
  };

  const proposal: EvolutionProposalData = {
    id: `fallback_${Date.now()}`,
    experienceId,
    analysis: {
      patterns: patterns.length > 0 ? patterns : ['Metrics analyzed'],
      bottlenecks: bottlenecks.length > 0 ? bottlenecks : ['No critical bottlenecks detected'],
      strengths: ['Economy graph is functional'],
    },
    proposedChanges: {
      summary: 'Rule-based tuning proposal',
      changes,
    },
    predictedLift: 0.1,
    newBundle,
    status: 'PENDING',
    createdAt: Date.now(),
  };

  return proposal;
}

/**
 * Get pending proposals for an experience.
 */
export async function getProposals(experienceId: string): Promise<EvolutionProposalData[]> {
  const records = await db.evolutionProposal.findMany({
    where: { experienceId },
    orderBy: { createdAt: 'desc' },
  });
  return records.map((r) => ({
    id: r.id,
    experienceId: r.experienceId,
    analysis: JSON.parse(r.analysisJson),
    proposedChanges: JSON.parse(r.proposedChangesJson),
    predictedLift: r.predictedLift,
    newBundle: r.newBundleJson ? JSON.parse(r.newBundleJson) : undefined,
    status: r.status as EvolutionProposalData['status'],
    createdAt: r.createdAt.getTime(),
  }));
}

/**
 * Approve a proposal and publish the evolved fork.
 */
export async function approveProposal(proposalId: string): Promise<{ newExperienceId?: string; error?: string }> {
  const proposal = await db.evolutionProposal.findUnique({ where: { id: proposalId } });
  if (!proposal) return { error: 'Proposal not found' };
  if (proposal.status !== 'PENDING') return { error: 'Proposal already reviewed' };

  // Mark as approved
  await db.evolutionProposal.update({
    where: { id: proposalId },
    data: { status: 'APPROVED', reviewedAt: new Date() },
  });

  // Publish the new bundle as a fork
  if (!proposal.newBundleJson) return { error: 'No bundle in proposal' };

  const newBundle: ExperienceBundle = JSON.parse(proposal.newBundleJson);
  const original = await db.experienceRecord.findUnique({
    where: { id: proposal.experienceId },
    include: { creator: true },
  });
  if (!original) return { error: 'Original experience not found' };

  // Compile through the kernel
  const { compileBundle } = await import('@/kernel/compiler');
  const { resolveExtension } = await import('@/kernel/extensions');
  const graph = compileBundle(newBundle, resolveExtension);

  if (!graph.valid) {
    return { error: `Proposed bundle does not compile: ${graph.errors.map((e) => e.message).join(', ')}` };
  }

  // Compute genome
  const { telemetryService } = await import('@/lib/telemetry-store');
  const genome = telemetryService.computeGenome(`${original.title} v2`.toLowerCase().replace(/\s+/g, '-'), graph);
  await telemetryService.persistGenome(genome).catch(() => {});

  // Create the forked experience
  const slug = `${original.slug}-v2-${Date.now().toString(36).slice(-4)}`;
  const intent = JSON.parse(original.intentJson);

  const newExp = await db.experienceRecord.create({
    data: {
      slug,
      title: `${original.title} v2`,
      description: `Evolved version of ${original.title}. ${JSON.parse(proposal.proposedChangesJson).summary ?? ''}`,
      creatorId: original.creatorId,
      bundleHash: graph.contentHash,
      parentExperienceId: original.id,
      intentJson: JSON.stringify(intent),
      genomeJson: JSON.stringify(genome),
      status: 'PUBLISHED',
      publishedAt: new Date(),
    },
  });

  // Persist the bundle
  const { persistBundle } = await import('@/lib/session-registry');
  await persistBundle(newExp.id, newBundle, graph).catch(() => {});

  // Increment original's fork count
  await db.experienceRecord.update({
    where: { id: original.id },
    data: { forkCount: { increment: 1 } },
  }).catch(() => {});

  // Mark proposal as applied
  await db.evolutionProposal.update({
    where: { id: proposalId },
    data: { status: 'APPLIED' },
  });

  return { newExperienceId: newExp.id };
}

/**
 * Reject a proposal.
 */
export async function rejectProposal(proposalId: string): Promise<void> {
  await db.evolutionProposal.update({
    where: { id: proposalId },
    data: { status: 'REJECTED', reviewedAt: new Date() },
  });
}
