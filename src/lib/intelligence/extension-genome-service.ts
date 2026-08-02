/**
 * Phase 21.4 — Extension Ecosystem Intelligence
 * --------------------------------------------
 * Mines successful extension composition patterns across the network.
 *
 * "Experiences with {Physics, Score, Competition} have 72% avg completion
 *  in competitive contexts."
 *
 * Generates pattern signatures from each published experience's extension
 * set, then aggregates completion/retention/reputation per pattern.
 */

import ZAI from 'z-ai-web-dev-sdk';
import { db } from '@/lib/db';
import { computeReputation } from '@/lib/universe/rating-service';
import type { CompositionPattern } from './intelligence-types';

/**
 * Recompute all composition patterns by scanning published experiences.
 * Builds all subset-pairs of extensions used together.
 */
export async function recomputeCompositionPatterns(): Promise<{ patterns: number }> {
  const experiences = await db.experienceRecord.findMany({
    where: { status: 'PUBLISHED' },
    select: { id: true, bundleHash: true, competitiveEligible: true },
  });

  // For each experience, gather its extension set + metrics + reputation
  type ExpData = {
    experienceId: string;
    extensions: string[];
    completion: number;
    retention: number;
    reputation: number;
    context: string;
  };
  const expData: ExpData[] = [];

  for (const exp of experiences) {
    if (!exp.bundleHash) continue;
    const bundle = await db.bundleRecord.findUnique({ where: { contentHash: exp.bundleHash } });
    if (!bundle) continue;
    const parsed = JSON.parse(bundle.bundleJson);
    const extensions = Array.from(new Set(parsed.instances.map((i: any) => i.extensionId)));
    if (extensions.length === 0) continue;

    const metrics = await db.experienceMetrics.findUnique({ where: { experienceId: exp.id } });
    const reputation = await computeReputation(exp.id);
    const genome = await db.experienceGenomeRecord.findFirst({ where: { experienceId: exp.id } });

    expData.push({
      experienceId: exp.id,
      extensions,
      completion: metrics?.completionRate ?? 0,
      retention: genome?.retentionPrediction ?? (metrics?.completionRate ?? 0) * 100,
      reputation: reputation.overallScore,
      context: exp.competitiveEligible ? 'competitive' : 'any',
    });
  }

  // Build pattern → list of experiences (exact-set match for depth-2 and depth-3 pairs/triples)
  // We mine pairs and triples (most useful for recommendations).
  const patternExperiences = new Map<string, ExpData[]>();

  for (const data of expData) {
    const exts = data.extensions;
    // Pairs
    for (let i = 0; i < exts.length; i++) {
      for (let j = i + 1; j < exts.length; j++) {
        const sig = [exts[i], exts[j]].sort().join(',');
        if (!patternExperiences.has(sig)) patternExperiences.set(sig, []);
        patternExperiences.get(sig)!.push(data);
      }
    }
    // Triples
    for (let i = 0; i < exts.length; i++) {
      for (let j = i + 1; j < exts.length; j++) {
        for (let k = j + 1; k < exts.length; k++) {
          const sig = [exts[i], exts[j], exts[k]].sort().join(',');
          if (!patternExperiences.has(sig)) patternExperiences.set(sig, []);
          patternExperiences.get(sig)!.push(data);
        }
      }
    }
  }

  // Fetch extension names
  const allExtIds = new Set<string>();
  for (const exts of patternExperiences.keys()) {
    for (const e of exts.split(',')) allExtIds.add(e);
  }
  const extRecords = await db.extensionRecord.findMany({
    where: { id: { in: Array.from(allExtIds) } },
    select: { id: true, name: true, icon: true },
  });
  const nameMap = new Map(extRecords.map((e) => [e.id, e.name]));

  // Persist patterns (only those with >= 1 occurrence)
  let count = 0;
  for (const [sig, exps] of patternExperiences.entries()) {
    if (exps.length === 0) continue;
    const extensions = sig.split(',');
    const avgCompletion = exps.reduce((s, e) => s + e.completion, 0) / exps.length;
    const avgRetention = exps.reduce((s, e) => s + e.retention, 0) / exps.length;
    const avgReputation = exps.reduce((s, e) => s + e.reputation, 0) / exps.length;
    const competitiveCount = exps.filter((e) => e.context === 'competitive').length;
    const context = competitiveCount > exps.length / 2 ? 'competitive' : 'any';

    const recommendation = generateRecommendation(extensions, nameMap, avgCompletion, avgReputation, context);

    await db.extensionCompositionPatternRecord.upsert({
      where: { patternSignature: sig },
      create: {
        patternSignature: sig,
        extensionsJson: JSON.stringify(extensions),
        occurrenceCount: exps.length,
        avgCompletion: Math.round(avgCompletion * 1000) / 1000,
        avgRetention: Math.round(avgRetention * 100) / 100,
        avgReputation: Math.round(avgReputation),
        context,
        recommendation,
      },
      update: {
        extensionsJson: JSON.stringify(extensions),
        occurrenceCount: exps.length,
        avgCompletion: Math.round(avgCompletion * 1000) / 1000,
        avgRetention: Math.round(avgRetention * 100) / 100,
        avgReputation: Math.round(avgReputation),
        context,
        recommendation,
        computedAt: new Date(),
      },
    });
    count++;
  }

  return { patterns: count };
}

function generateRecommendation(
  extensions: string[],
  nameMap: Map<string, string>,
  avgCompletion: number,
  avgReputation: number,
  context: string,
): string | null {
  const names = extensions.map((e) => nameMap.get(e) ?? e).join(' + ');
  const completionPct = Math.round(avgCompletion * 100);
  if (context === 'competitive' && avgCompletion > 0.5) {
    return `Strong competitive foundation: ${names} (${completionPct}% avg completion)`;
  }
  if (avgReputation >= 70) {
    return `High-quality composition: ${names} (${Math.round(avgReputation)}/100 reputation)`;
  }
  if (avgCompletion > 0.6) {
    return `Reliable engagement pattern: ${names} (${completionPct}% completion)`;
  }
  if (avgCompletion < 0.3) {
    return `Underperforming composition: ${names} (${completionPct}% completion — consider rebalancing)`;
  }
  return `Common pattern: ${names}`;
}

export async function getTopCompositionPatterns(limit = 15, context?: string): Promise<CompositionPattern[]> {
  const where: any = {};
  if (context) where.context = context;
  const rows = await db.extensionCompositionPatternRecord.findMany({
    where,
    orderBy: { occurrenceCount: 'desc' },
    take: limit,
  });

  const allExtIds = new Set<string>();
  for (const r of rows) {
    for (const e of JSON.parse(r.extensionsJson)) allExtIds.add(e);
  }
  const extRecords = await db.extensionRecord.findMany({
    where: { id: { in: Array.from(allExtIds) } },
    select: { id: true, name: true },
  });
  const nameMap = new Map(extRecords.map((e) => [e.id, e.name]));

  return rows.map((r) => ({
    patternSignature: r.patternSignature,
    extensions: JSON.parse(r.extensionsJson),
    extensionNames: JSON.parse(r.extensionsJson).map((id: string) => nameMap.get(id) ?? id),
    occurrenceCount: r.occurrenceCount,
    avgCompletion: r.avgCompletion,
    avgRetention: r.avgRetention,
    avgReputation: r.avgReputation,
    context: r.context,
    recommendation: r.recommendation,
  }));
}

/**
 * AI-generated composition recommendation: given a partial set of extensions,
 * suggest what to add based on successful patterns.
 */
export async function recommendComposition(currentExtensions: string[]): Promise<{
  suggestion?: string;
  recommendedAdditions: Array<{ extensionId: string; extensionName: string; reason: string }>;
}> {
  if (currentExtensions.length === 0) {
    return { recommendedAdditions: [] };
  }

  // Find patterns that contain the current extensions as a subset
  const allPatterns = await db.extensionCompositionPatternRecord.findMany({
    where: { occurrenceCount: { gte: 1 } },
    orderBy: { avgCompletion: 'desc' },
    take: 50,
  });

  const candidates = new Map<string, { count: number; completionSum: number; pattern: any }>();
  for (const p of allPatterns) {
    const exts: string[] = JSON.parse(p.extensionsJson);
    // Does this pattern's set contain all current extensions?
    if (currentExtensions.every((e) => exts.includes(e))) {
      const additions = exts.filter((e) => !currentExtensions.includes(e));
      for (const add of additions) {
        if (!candidates.has(add)) {
          candidates.set(add, { count: 0, completionSum: 0, pattern: p });
        }
        const c = candidates.get(add)!;
        c.count += p.occurrenceCount;
        c.completionSum += p.avgCompletion;
      }
    }
  }

  if (candidates.size === 0) {
    return { recommendedAdditions: [] };
  }

  // Rank additions by total occurrence count * avg completion
  const ranked = Array.from(candidates.entries())
    .map(([extId, c]) => ({
      extensionId: extId,
      extensionName: extId,
      count: c.count,
      avgCompletion: c.completionSum / c.count,
    }))
    .sort((a, b) => (b.count * b.avgCompletion) - (a.count * a.avgCompletion))
    .slice(0, 3);

  const extRecords = await db.extensionRecord.findMany({
    where: { id: { in: ranked.map((r) => r.extensionId) } },
    select: { id: true, name: true },
  });
  const nameMap = new Map(extRecords.map((e) => [e.id, e.name]));

  const recommendedAdditions = ranked.map((r) => ({
    extensionId: r.extensionId,
    extensionName: nameMap.get(r.extensionId) ?? r.extensionId,
    reason: `Appears in ${r.count} successful pattern(s) with ${Math.round(r.avgCompletion * 100)}% avg completion`,
  }));

  let suggestion: string | undefined;
  if (recommendedAdditions.length > 0) {
    try {
      const zai = await ZAI.create();
      const completion = await zai.chat.completions.create({
        messages: [
          {
            role: 'assistant',
            content: `You are the PlayLiquid Extension Genome analyst. Given a creator's current extensions and the most common successful additions, write ONE sentence recommending what to add next and why. No markdown.`,
          },
          {
            role: 'user',
            content: `Current: ${currentExtensions.join(', ')}\nTop additions: ${JSON.stringify(recommendedAdditions)}`,
          },
        ],
        thinking: { type: 'disabled' },
      });
      suggestion = completion.choices[0]?.message?.content?.trim();
    } catch {
      suggestion = `Consider adding ${recommendedAdditions[0].extensionName}: ${recommendedAdditions[0].reason}.`;
    }
  }

  return { suggestion, recommendedAdditions };
}
