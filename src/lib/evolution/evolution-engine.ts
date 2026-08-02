/**
 * Phase 20.1 — Evolution Intelligence Engine
 * ------------------------------------------
 * Upgrades the existing AI Evolution Agent from "metrics → suggestions" to:
 *
 *   Metrics → diagnosis → hypothesis → experiment → evolution
 *
 * Inputs:  ExperienceMetrics, ReplayEvents, PlayerFeedback,
 *          ExtensionGraph, EconomyData, LeaderboardData
 *
 * Output:  EvolutionProposalV2 (problem, evidence, affectedExtensions,
 *          graphChanges, expectedImpact, confidenceScore, newBundle)
 *
 * The engine NEVER edits production. It produces a proposal + a graph
 * mutation (before/after bundle) that the creator must approve.
 *
 * Uses z-ai-web-dev-sdk (server-side only). Falls back to a rule-based
 * diagnosis if the LLM is unavailable.
 */

import ZAI from 'z-ai-web-dev-sdk';
import { db } from '@/lib/db';
import { getMetrics } from '@/lib/world/metrics-service';
import { getRoyaltyGraph } from '@/lib/world/economy-service';
import { getLeaderboard } from '@/lib/competition/leaderboard-service';
import { getFeedbackForExperience } from './feedback-store';
import { applyChanges } from './mutation-service';
import { createMutation } from './mutation-store';
import type {
  EvolutionInputs,
  EvolutionProposalV2,
  GraphChangeSpec,
  MutationType,
} from './evolution-types';
import type { ExperienceBundle } from '@/kernel/types';

// ─── Gather inputs ─────────────────────────────────────────────────────────

export async function gatherInputs(experienceId: string): Promise<EvolutionInputs | null> {
  const exp = await db.experienceRecord.findUnique({
    where: { id: experienceId },
    include: { creator: true },
  });
  if (!exp) return null;

  const bundleRecord = exp.bundleHash
    ? await db.bundleRecord.findUnique({ where: { contentHash: exp.bundleHash } })
    : null;
  if (!bundleRecord) return null;
  const bundle: ExperienceBundle = JSON.parse(bundleRecord.bundleJson);

  const metrics = await getMetrics(experienceId);
  const m = metrics ?? {
    totalSessions: 0, completionRate: 0, averageScore: 0, averageDropOffMs: 0,
    frustrationEvents: 0, achievementEvents: 0, tokensEarned: 0, tokensSpent: 0,
    marketActions: 0, socialMoments: 0,
  };

  // Replay events: pull recent session telemetry summaries
  const recentSessions = await db.playSession.findMany({
    where: { experienceId },
    include: { telemetry: true },
    orderBy: { startedAt: 'desc' },
    take: 30,
  });
  const replayEvents = recentSessions
    .filter((s) => s.telemetry)
    .map((s) => ({
      kind: s.telemetry!.completion ? 'completed' : 'dropped',
      tick: s.tickCount,
      summary: `${s.telemetry!.completion ? 'Completed' : 'Dropped'} at tick ${s.tickCount} (score ${s.score})`,
    }));

  // Player feedback
  const feedbackRows = await getFeedbackForExperience(experienceId, 50);
  const feedback = feedbackRows.map((f) => ({
    type: f.type,
    funScore: f.funScore,
    difficultyScore: f.difficultyScore,
    comment: f.comment,
  }));

  // Economy data
  const royaltyGraph = await getRoyaltyGraph(experienceId);
  const leaderboardEntries = await db.leaderboardEntryRecord.count({ where: { experienceId } });
  const competitiveSessions = await db.playSession.count({ where: { experienceId, competitiveMode: true } });
  const revenueRecords = await db.creatorRevenueRecord.findMany({
    where: { experienceId },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  const creatorShareLiquid = revenueRecords.reduce((s, r) => s + r.amountXof, 0) / 1_000_000;

  // Prize pool (micro-XOF → Liquid)
  let prizePoolMicro = 0;
  try {
    const pool = await db.ledgerAccount.findFirst({ where: { id: `PRIZE_POOL:${experienceId}` } });
    prizePoolMicro = pool?.balanceMicro ?? 0;
  } catch { /* ledger account may not exist yet */ }
  const prizePoolLiquid = prizePoolMicro / 1_000_000;

  // Leaderboard top entries
  const leaderboard = (await getLeaderboard(experienceId, 'all-time', 5)).map((e, i) => ({
    rank: i + 1,
    displayName: e.displayName,
    score: e.score,
  }));

  return {
    experienceId,
    experienceName: exp.title,
    bundle,
    metrics: {
      totalSessions: m.totalSessions,
      completionRate: m.completionRate,
      averageScore: m.averageScore,
      averageDropOffMs: m.averageDropOffMs,
      frustrationEvents: m.frustrationEvents,
      achievementEvents: m.achievementEvents,
      tokensEarned: m.tokensEarned,
      tokensSpent: m.tokensSpent,
      marketActions: m.marketActions,
      socialMoments: m.socialMoments,
    },
    replayEvents,
    feedback,
    economy: {
      creatorShareLiquid,
      prizePoolLiquid,
      leaderboardEntries,
      competitiveSessions,
    },
    leaderboard,
    // royaltyGraph kept for context, included implicitly in the prompt below
    // (we serialize it via JSON.stringify below)
    // Note: we attach it as an extra field via spread to avoid bloating the type.
    ...(royaltyGraph ? { royaltyGraph } : {}),
  } as EvolutionInputs;
}

// ─── LLM diagnosis ─────────────────────────────────────────────────────────

interface LLMProposal {
  problem: string;
  evidence: string;
  affectedExtensions: string[];
  graphChanges: GraphChangeSpec[];
  expectedImpact: string;
  confidenceScore: number;
  analysis: {
    patterns: string[];
    dropOffPoint?: string;
    bottlenecks: string[];
    strengths: string[];
    diagnosis: string;
    hypothesis: string;
  };
  predictedLift: number;
}

const SYSTEM_PROMPT = `You are the PlayLiquid Experience Evolution Engine. You turn telemetry into a structured evolution proposal.

Your job:
1. DIAGNOSE the biggest problem (low completion, frustration, drop-off, weak economy, confusing feedback).
2. Form a HYPOTHESIS about the root cause.
3. Propose GRAPH CHANGES that the creator can approve. You may:
   - UPDATE_CONFIG (change an existing instance's config keys)
   - ADD_EXTENSION (add a new instance of an existing extension)
   - REMOVE_EXTENSION (remove an instance)
   - REWIRE_CONNECTION (add/remove a wire)
   - CHANGE_ECONOMY (broadcast an economy config patch)
4. Predict the IMPACT and your CONFIDENCE (0.0-1.0).

Rules:
- You NEVER edit production directly. You only propose graph changes.
- Be specific: name the instance id and the config key.
- Base evidence on the actual metrics. Quote numbers.
- One proposal per call. Pick the highest-impact problem.
- No new currencies. No reward minting. Liquid is purchased only.
- Extensions are the primitive. Changes are graph mutations.

Respond with ONLY valid JSON (no markdown fences) in this exact shape:
{
  "problem": "78% of players quit after the weather event.",
  "evidence": "Players who encounter the storm mechanic have 45% lower completion (n=...).",
  "affectedExtensions": ["pl.weather"],
  "graphChanges": [
    { "mutationType": "UPDATE_CONFIG", "instance": "weather", "config": { "stormChance": 0.14 }, "reason": "Reduce storm frequency by 30% to improve early retention." }
  ],
  "expectedImpact": "+12% completion",
  "confidenceScore": 0.72,
  "analysis": {
    "patterns": ["..."],
    "dropOffPoint": "...",
    "bottlenecks": ["..."],
    "strengths": ["..."],
    "diagnosis": "...",
    "hypothesis": "..."
  },
  "predictedLift": 0.12
}`;

export async function runEvolutionEngine(experienceId: string): Promise<{
  proposal: EvolutionProposalV2 | null;
  error?: string;
}> {
  const inputs = await gatherInputs(experienceId);
  if (!inputs) return { proposal: null, error: 'Experience or bundle not found' };
  if (inputs.metrics.totalSessions === 0 && inputs.feedback.length === 0) {
    return { proposal: null, error: 'No telemetry or feedback yet — run a simulation or collect player feedback first.' };
  }

  let llm: LLMProposal | null = null;
  try {
    llm = await callLLM(inputs);
  } catch (err) {
    llm = null;
  }

  const proposal = llm ?? fallbackDiagnosis(inputs);

  // Materialize the new bundle by applying the proposed graph changes.
  const applied = applyChanges(inputs.bundle, proposal.graphChanges);
  let newBundle: ExperienceBundle | undefined;
  if (applied.ok && applied.bundle) {
    newBundle = { ...applied.bundle, name: `${inputs.bundle.name ?? inputs.experienceName} evolution` };
  }

  // Pick the dominant mutation type for the mutation record.
  const mutationType: MutationType = proposal.graphChanges[0]?.mutationType ?? 'UPDATE_CONFIG';

  // Persist the proposal (status DISCOVERED → PROPOSED once we have a bundle)
  const status = newBundle ? 'PROPOSED' : 'DISCOVERED';
  const row = await db.evolutionProposal.create({
    data: {
      experienceId,
      analysisJson: JSON.stringify(proposal.analysis),
      proposedChangesJson: JSON.stringify({ summary: proposal.expectedImpact, changes: proposal.graphChanges }),
      predictedLift: proposal.predictedLift,
      newBundleJson: newBundle ? JSON.stringify(newBundle) : null,
      problem: proposal.problem,
      evidence: proposal.evidence,
      affectedExtensionsJson: JSON.stringify(proposal.affectedExtensions),
      graphChangesJson: JSON.stringify(proposal.graphChanges),
      expectedImpact: proposal.expectedImpact,
      confidenceScore: proposal.confidenceScore,
      status,
    },
  });

  // Persist the mutation record (before/after graph snapshot)
  let mutationId: string | undefined;
  if (newBundle) {
    const mutation = await createMutation({
      experienceId,
      proposalId: row.id,
      mutationType,
      beforeGraph: inputs.bundle,
      afterGraph: newBundle,
    });
    mutationId = mutation.id;
    await db.evolutionProposal.update({ where: { id: row.id }, data: { mutationId } });
  }

  return {
    proposal: {
      id: row.id,
      experienceId,
      experienceName: inputs.experienceName,
      problem: proposal.problem,
      evidence: proposal.evidence,
      affectedExtensions: proposal.affectedExtensions,
      graphChanges: proposal.graphChanges,
      expectedImpact: proposal.expectedImpact,
      confidenceScore: proposal.confidenceScore,
      newBundle,
      analysis: proposal.analysis,
      predictedLift: proposal.predictedLift,
      status: status as EvolutionProposalV2['status'],
      mutationId,
      createdAt: row.createdAt.getTime(),
    },
  };
}

async function callLLM(inputs: EvolutionInputs): Promise<LLMProposal> {
  const zai = await ZAI.create();
  const userPrompt = `Analyze this experience and propose ONE evolution:

Experience: ${inputs.experienceName} (${inputs.experienceId})

Bundle graph:
${JSON.stringify({
  instances: inputs.bundle.instances.map((i) => ({ id: i.id, extensionId: i.extensionId, config: i.config })),
  wires: inputs.bundle.wires,
}, null, 2)}

Metrics:
- totalSessions: ${inputs.metrics.totalSessions}
- completionRate: ${Math.round(inputs.metrics.completionRate * 100)}%
- averageScore: ${Math.round(inputs.metrics.averageScore)}
- averageDropOffMs: ${inputs.metrics.averageDropOffMs} (${Math.round(inputs.metrics.averageDropOffMs / 1000)}s)
- frustrationEvents: ${inputs.metrics.frustrationEvents}
- achievementEvents: ${inputs.metrics.achievementEvents}
- tokensEarned: ${inputs.metrics.tokensEarned}
- tokensSpent: ${inputs.metrics.tokensSpent}
- marketActions: ${inputs.metrics.marketActions}
- socialMoments: ${inputs.metrics.socialMoments}

Recent replay events (${inputs.replayEvents.length}):
${JSON.stringify(inputs.replayEvents.slice(0, 15), null, 2)}

Player feedback (${inputs.feedback.length}):
${JSON.stringify(inputs.feedback.slice(0, 20), null, 2)}

Economy:
- creatorShareLiquid: ${inputs.economy.creatorShareLiquid}
- prizePoolLiquid: ${inputs.economy.prizePoolLiquid}
- leaderboardEntries: ${inputs.economy.leaderboardEntries}
- competitiveSessions: ${inputs.economy.competitiveSessions}

Leaderboard top:
${JSON.stringify(inputs.leaderboard, null, 2)}`;

  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'assistant', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    thinking: { type: 'disabled' },
  });

  const raw = completion.choices[0]?.message?.content ?? '';
  let jsonStr = raw.trim();
  const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) jsonStr = fence[1].trim();

  const parsed = JSON.parse(jsonStr);

  // Validate + normalize
  return {
    problem: String(parsed.problem ?? 'Undiagnosed problem'),
    evidence: String(parsed.evidence ?? ''),
    affectedExtensions: Array.isArray(parsed.affectedExtensions) ? parsed.affectedExtensions : [],
    graphChanges: Array.isArray(parsed.graphChanges) ? parsed.graphChanges : [],
    expectedImpact: String(parsed.expectedImpact ?? ''),
    confidenceScore: clamp(Number(parsed.confidenceScore ?? 0.5), 0, 1),
    analysis: {
      patterns: Array.isArray(parsed.analysis?.patterns) ? parsed.analysis.patterns : [],
      dropOffPoint: parsed.analysis?.dropOffPoint,
      bottlenecks: Array.isArray(parsed.analysis?.bottlenecks) ? parsed.analysis.bottlenecks : [],
      strengths: Array.isArray(parsed.analysis?.strengths) ? parsed.analysis.strengths : [],
      diagnosis: String(parsed.analysis?.diagnosis ?? ''),
      hypothesis: String(parsed.analysis?.hypothesis ?? ''),
    },
    predictedLift: clamp(Number(parsed.predictedLift ?? 0), 0, 1),
  };
}

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

// ─── Rule-based fallback ───────────────────────────────────────────────────
// Used when the LLM is unavailable. Produces a conservative, evidence-based
// diagnosis from the raw metrics.

function fallbackDiagnosis(inputs: EvolutionInputs): LLMProposal {
  const m = inputs.metrics;
  const patterns: string[] = [];
  const bottlenecks: string[] = [];
  const changes: GraphChangeSpec[] = [];
  let problem = 'Engagement could be improved';
  let evidence = `${m.totalSessions} sessions analyzed`;
  let expectedImpact = '+5-10% retention';
  let hypothesis = 'Tuning key config values will improve engagement.';

  // Rule 1: low completion → speed up the dominant economy extension
  if (m.completionRate < 0.4 && m.totalSessions >= 3) {
    patterns.push(`Low completion rate (${Math.round(m.completionRate * 100)}%)`);
    const farm = inputs.bundle.instances.find((i) => i.extensionId === 'pl.farm');
    if (farm) {
      const cur = Number((farm.config as any)?.intervalTicks ?? 5);
      changes.push({
        mutationType: 'UPDATE_CONFIG',
        instance: farm.id,
        config: { intervalTicks: Math.max(1, cur - 2) },
        reason: `Speed up farm production (intervalTicks ${cur} → ${Math.max(1, cur - 2)}) to reduce early drop-off.`,
      });
      problem = `Only ${Math.round(m.completionRate * 100)}% of players complete the experience`;
      evidence = `${m.totalSessions} sessions, ${Math.round(m.averageDropOffMs / 1000)}s average drop-off, ${m.frustrationEvents} frustration events.`;
      expectedImpact = '+12% completion';
      hypothesis = 'The economy is too slow in the opening, causing players to leave before the rewarding loop.';
      bottlenecks.push('Early-game pacing too slow');
    }
  }

  // Rule 2: high frustration → reduce weather difficulty
  if (m.frustrationEvents > m.totalSessions * 0.3) {
    patterns.push(`High frustration rate (${m.frustrationEvents}/${m.totalSessions} sessions)`);
    const weather = inputs.bundle.instances.find((i) => i.extensionId === 'pl.weather');
    if (weather) {
      const cur = Number((weather.config as any)?.stormChance ?? 0.2);
      const next = Math.round(Math.max(0.05, cur * 0.7) * 100) / 100;
      changes.push({
        mutationType: 'UPDATE_CONFIG',
        instance: weather.id,
        config: { stormChance: next },
        reason: `Reduce storm frequency (stormChance ${cur} → ${next}) — players hit by storms drop more often.`,
      });
      if (!problem.startsWith('Only')) {
        problem = `${Math.round((m.frustrationEvents / Math.max(1, m.totalSessions)) * 100)}% of sessions show frustration signals`;
        evidence = `${m.frustrationEvents} frustration events across ${m.totalSessions} sessions.`;
        expectedImpact = '+10% retention';
      }
      bottlenecks.push('Weather difficulty spikes');
    }
  }

  // Rule 3: weak token economy → boost rewards
  if (m.tokensEarned < m.totalSessions * 3 && m.totalSessions > 0) {
    patterns.push(`Low token activity (${m.tokensEarned} earned across ${m.totalSessions} sessions)`);
    const competition = inputs.bundle.instances.find((i) => i.extensionId === 'pl.competition');
    if (competition) {
      changes.push({
        mutationType: 'UPDATE_CONFIG',
        instance: competition.id,
        config: { scorePerTrade: 20 },
        reason: 'Increase score rewards to strengthen achievement signals.',
      });
      bottlenecks.push('Weak reward feedback loop');
      if (changes.length === 1) {
        problem = 'Token economy is too conservative';
        evidence = `${m.tokensEarned} tokens earned across ${m.totalSessions} sessions (avg ${(m.tokensEarned / Math.max(1, m.totalSessions)).toFixed(1)}/session).`;
        expectedImpact = '+8% engagement';
      }
    }
  }

  // Rule 4: feedback-driven
  const tooHard = inputs.feedback.filter((f) => f.type === 'TOO_HARD').length;
  const confusing = inputs.feedback.filter((f) => f.type === 'CONFUSING').length;
  if (tooHard > inputs.feedback.length * 0.4 && inputs.feedback.length >= 3) {
    patterns.push(`${tooHard}/${inputs.feedback.length} players report the experience is too hard`);
    const physics = inputs.bundle.instances.find((i) => i.extensionId === 'pl.physics');
    if (physics) {
      changes.push({
        mutationType: 'UPDATE_CONFIG',
        instance: physics.id,
        config: { gravity: 0.5 },
        reason: 'Soften physics to address "too hard" feedback.',
      });
      problem = 'Players report the experience is too hard';
      evidence = `${tooHard} of ${inputs.feedback.length} feedback entries flagged difficulty.`;
      expectedImpact = '+15% completion';
      hypothesis = 'Reducing difficulty will retain players who currently drop early.';
    }
  }
  if (confusing > inputs.feedback.length * 0.3 && inputs.feedback.length >= 3) {
    patterns.push(`${confusing}/${inputs.feedback.length} players find the experience confusing`);
  }

  // Rule 5: if nothing triggered, propose a small tuning
  if (changes.length === 0) {
    const target = inputs.bundle.instances[0];
    if (target) {
      changes.push({
        mutationType: 'UPDATE_CONFIG',
        instance: target.id,
        config: { intervalTicks: 3 },
        reason: 'Minor tuning to maintain engagement (no critical issues detected).',
      });
    }
    patterns.push('No critical bottlenecks detected');
    bottlenecks.push('None significant');
    problem = 'Healthy experience — minor tuning opportunity';
    evidence = `${m.totalSessions} sessions, ${Math.round(m.completionRate * 100)}% completion, ${m.frustrationEvents} frustration events.`;
    expectedImpact = '+3-5% retention';
    hypothesis = 'A small tuning pass can still surface incremental gains.';
  }

  const strengths: string[] = [];
  if (m.completionRate >= 0.6) strengths.push(`Strong completion rate (${Math.round(m.completionRate * 100)}%)`);
  if (m.achievementEvents > m.totalSessions) strengths.push('Healthy achievement density');
  if (inputs.economy.competitiveSessions > 0) strengths.push(`${inputs.economy.competitiveSessions} competitive sessions`);

  return {
    problem,
    evidence,
    affectedExtensions: Array.from(new Set(changes.map((c) => {
      const inst = inputs.bundle.instances.find((i) => i.id === c.instance);
      return inst?.extensionId ?? c.extensionId ?? 'unknown';
    }).filter(Boolean))),
    graphChanges: changes,
    expectedImpact,
    confidenceScore: 0.55,
    analysis: {
      patterns,
      bottlenecks,
      strengths: strengths.length > 0 ? strengths : ['Graph compiles and runs'],
      diagnosis: problem,
      hypothesis,
    },
    predictedLift: 0.08,
  };
}

// ─── List / approve / reject (proposal lifecycle) ──────────────────────────

export async function getProposalsV2(experienceId: string, limit = 20): Promise<EvolutionProposalV2[]> {
  const rows = await db.evolutionProposal.findMany({
    where: { experienceId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  const exp = await db.experienceRecord.findUnique({ where: { id: experienceId } });
  return rows.map((r) => ({
    id: r.id,
    experienceId: r.experienceId,
    experienceName: exp?.title ?? experienceId,
    problem: r.problem ?? '',
    evidence: r.evidence ?? '',
    affectedExtensions: r.affectedExtensionsJson ? JSON.parse(r.affectedExtensionsJson) : [],
    graphChanges: r.graphChangesJson ? JSON.parse(r.graphChangesJson) : [],
    expectedImpact: r.expectedImpact ?? '',
    confidenceScore: r.confidenceScore,
    newBundle: r.newBundleJson ? JSON.parse(r.newBundleJson) : undefined,
    analysis: r.analysisJson ? JSON.parse(r.analysisJson) : { patterns: [], bottlenecks: [], strengths: [], diagnosis: '', hypothesis: '' },
    predictedLift: r.predictedLift,
    status: r.status as EvolutionProposalV2['status'],
    mutationId: r.mutationId ?? undefined,
    createdAt: r.createdAt.getTime(),
    reviewedAt: r.reviewedAt?.getTime(),
  }));
}

export async function getProposalV2(proposalId: string): Promise<EvolutionProposalV2 | null> {
  const r = await db.evolutionProposal.findUnique({ where: { id: proposalId } });
  if (!r) return null;
  const exp = await db.experienceRecord.findUnique({ where: { id: r.experienceId } });
  return {
    id: r.id,
    experienceId: r.experienceId,
    experienceName: exp?.title ?? r.experienceId,
    problem: r.problem ?? '',
    evidence: r.evidence ?? '',
    affectedExtensions: r.affectedExtensionsJson ? JSON.parse(r.affectedExtensionsJson) : [],
    graphChanges: r.graphChangesJson ? JSON.parse(r.graphChangesJson) : [],
    expectedImpact: r.expectedImpact ?? '',
    confidenceScore: r.confidenceScore,
    newBundle: r.newBundleJson ? JSON.parse(r.newBundleJson) : undefined,
    analysis: r.analysisJson ? JSON.parse(r.analysisJson) : { patterns: [], bottlenecks: [], strengths: [], diagnosis: '', hypothesis: '' },
    predictedLift: r.predictedLift,
    status: r.status as EvolutionProposalV2['status'],
    mutationId: r.mutationId ?? undefined,
    createdAt: r.createdAt.getTime(),
    reviewedAt: r.reviewedAt?.getTime(),
  };
}
