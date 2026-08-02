/**
 * Phase 21.2 — Experience Discovery Graph
 * ---------------------------------------
 * Collaborative filtering: "Players who played experience A also played B."
 *
 * Computed from session co-occurrence (same userId played both experiences).
 * This is the collaborative signal that complements the content-based
 * genome similarity in discovery-service.ts.
 *
 * Also surfaces shared extensions/mechanics between related experiences.
 */

import { db } from '@/lib/db';
import type { CoPlayEdge, DiscoveryGraph } from './intelligence-types';

/**
 * Recompute the co-play graph for an experience (or all experiences).
 * Walks play sessions, finds users who played multiple experiences, and
 * builds edges between every pair of experiences a user played.
 */
export async function recomputeDiscoveryGraph(experienceId?: string): Promise<{ edgesBuilt: number }> {
  // Gather all sessions, grouped by user
  const sessions = await db.playSession.findMany({
    where: { userId: { not: null } },
    select: { userId: true, experienceId: true },
  });

  const userExperiences = new Map<string, Set<string>>();
  for (const s of sessions) {
    if (!s.userId) continue;
    if (!userExperiences.has(s.userId)) userExperiences.set(s.userId, new Set());
    userExperiences.get(s.userId)!.add(s.experienceId);
  }

  // Build co-occurrence counts: edgeKey "A|B" (A < B lexicographically) → count
  const edgeCounts = new Map<string, number>();
  for (const exps of userExperiences.values()) {
    const arr = Array.from(exps);
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const [a, b] = [arr[i], arr[j]].sort();
        const key = `${a}|${b}`;
        edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1);
      }
    }
  }

  // Filter to edges involving the requested experience (if specified)
  let edgesBuilt = 0;
  const extensionCache = new Map<string, string[]>();

  const getExtensions = async (expId: string): Promise<string[]> => {
    if (extensionCache.has(expId)) return extensionCache.get(expId)!;
    const exp = await db.experienceRecord.findUnique({
      where: { id: expId },
      select: { bundleHash: true },
    });
    let exts: string[] = [];
    if (exp?.bundleHash) {
      const bundle = await db.bundleRecord.findUnique({ where: { contentHash: exp.bundleHash } });
      if (bundle) {
        const parsed = JSON.parse(bundle.bundleJson);
        exts = Array.from(new Set(parsed.instances.map((i: any) => i.extensionId)));
      }
    }
    extensionCache.set(expId, exts);
    return exts;
  };

  for (const [key, sharedPlayers] of edgeCounts.entries()) {
    const [expA, expB] = key.split('|');
    if (experienceId && expA !== experienceId && expB !== experienceId) continue;

    const [extsA, extsB] = await Promise.all([getExtensions(expA), getExtensions(expB)]);
    const sharedExtensions = extsA.filter((e) => extsB.includes(e));
    const sharedMechanics = deriveMechanics(sharedExtensions);

    // co-play score: Jaccard-like normalized similarity
    const totalA = await db.playSession.count({ where: { experienceId: expA } });
    const totalB = await db.playSession.count({ where: { experienceId: expB } });
    const denominator = totalA + totalB - sharedPlayers;
    const coPlayScore = denominator > 0 ? sharedPlayers / denominator : 0;

    await db.coPlayEdgeRecord.upsert({
      where: { experienceA_experienceB: { experienceA: expA, experienceB: expB } },
      create: {
        experienceA: expA,
        experienceB: expB,
        sharedPlayers,
        coPlayScore: Math.round(coPlayScore * 1000) / 1000,
        sharedExtensionsJson: JSON.stringify(sharedExtensions),
        sharedMechanicsJson: JSON.stringify(sharedMechanics),
        computedAt: new Date(),
      },
      update: {
        sharedPlayers,
        coPlayScore: Math.round(coPlayScore * 1000) / 1000,
        sharedExtensionsJson: JSON.stringify(sharedExtensions),
        sharedMechanicsJson: JSON.stringify(sharedMechanics),
        computedAt: new Date(),
      },
    });
    edgesBuilt++;
  }

  return { edgesBuilt };
}

/**
 * Get the discovery graph for an experience — its related experiences
 * sorted by co-play score.
 */
export async function getDiscoveryGraph(experienceId: string, limit = 10): Promise<DiscoveryGraph> {
  // Edges where this experience is either A or B
  const [asA, asB] = await Promise.all([
    db.coPlayEdgeRecord.findMany({
      where: { experienceA: experienceId },
      orderBy: { coPlayScore: 'desc' },
      take: limit,
    }),
    db.coPlayEdgeRecord.findMany({
      where: { experienceB: experienceId },
      orderBy: { coPlayScore: 'desc' },
      take: limit,
    }),
  ]);

  const totalPlayers = await db.playSession.count({ where: { experienceId } });

  // Normalize: always present the "other" experience as experienceB
  const rawEdges = [
    ...asA.map((e) => ({ row: e, other: e.experienceB })),
    ...asB.map((e) => ({ row: e, other: e.experienceA })),
  ];

  // Dedupe by the other experience, keeping the highest score
  const bestByOther = new Map<string, { row: any; other: string }>();
  for (const entry of rawEdges) {
    const existing = bestByOther.get(entry.other);
    if (!existing || entry.row.coPlayScore > existing.row.coPlayScore) {
      bestByOther.set(entry.other, entry);
    }
  }

  // Fetch names for the related experiences
  const otherIds = Array.from(bestByOther.keys());
  const otherExps = await db.experienceRecord.findMany({
    where: { id: { in: otherIds } },
    select: { id: true, title: true },
  });
  const nameMap = new Map(otherExps.map((e) => [e.id, e.title]));

  const edges: CoPlayEdge[] = Array.from(bestByOther.values())
    .map(({ row, other }) => ({
      experienceA: experienceId,
      experienceB: other,
      experienceBName: nameMap.get(other) ?? other,
      sharedPlayers: row.sharedPlayers,
      coPlayScore: row.coPlayScore,
      sharedExtensions: JSON.parse(row.sharedExtensionsJson),
      sharedMechanics: JSON.parse(row.sharedMechanicsJson),
    }))
    .sort((a, b) => b.coPlayScore - a.coPlayScore)
    .slice(0, limit);

  return {
    experienceId,
    edges,
    totalPlayers,
    relatedCount: edges.length,
  };
}

/**
 * Get the global discovery graph summary — top co-play pairs across the
 * network, useful for surfacing "experiences frequently played together."
 */
export async function getGlobalDiscoveryGraph(limit = 15): Promise<CoPlayEdge[]> {
  const rows = await db.coPlayEdgeRecord.findMany({
    orderBy: { sharedPlayers: 'desc' },
    take: limit,
  });
  const expIds = new Set<string>();
  for (const r of rows) { expIds.add(r.experienceA); expIds.add(r.experienceB); }
  const exps = await db.experienceRecord.findMany({
    where: { id: { in: Array.from(expIds) } },
    select: { id: true, title: true },
  });
  const nameMap = new Map(exps.map((e) => [e.id, e.title]));

  return rows.map((r) => ({
    experienceA: r.experienceA,
    experienceB: r.experienceB,
    experienceBName: nameMap.get(r.experienceB) ?? r.experienceB,
    sharedPlayers: r.sharedPlayers,
    coPlayScore: r.coPlayScore,
    sharedExtensions: JSON.parse(r.sharedExtensionsJson),
    sharedMechanics: JSON.parse(r.sharedMechanicsJson),
  }));
}

function deriveMechanics(extensions: string[]): string[] {
  const mechanicMap: Record<string, string> = {
    'pl.physics': 'physics',
    'pl.movement': 'movement',
    'pl.score': 'scoring',
    'pl.coin-collector': 'collection',
    'pl.farm': 'economy',
    'pl.cooking': 'crafting',
    'pl.weather': 'environment',
    'pl.marketplace': 'trade',
    'pl.competition': 'competition',
  };
  return Array.from(new Set(extensions.map((e) => mechanicMap[e]).filter(Boolean)));
}
