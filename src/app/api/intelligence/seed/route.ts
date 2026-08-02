import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { computeExperienceIntelligence } from '@/lib/intelligence/genome-service';
import { recomputeDiscoveryGraph } from '@/lib/intelligence/discovery-graph-service';
import { recomputeAllCreatorIntelligence } from '@/lib/intelligence/creator-intelligence-service';
import { recomputeCompositionPatterns } from '@/lib/intelligence/extension-genome-service';

/**
 * POST /api/intelligence/seed
 * Bootstraps the entire intelligence layer in one call:
 *   1. Compute Experience Genome for all published experiences
 *   2. Recompute the co-play discovery graph
 *   3. Recompute creator intelligence scores
 *   4. Mine extension composition patterns
 *
 * Idempotent — safe to call repeatedly.
 */
export async function POST() {
  const experiences = await db.experienceRecord.findMany({
    where: { status: 'PUBLISHED' },
    select: { id: true },
  });

  let genomesComputed = 0;
  for (const exp of experiences) {
    const g = await computeExperienceIntelligence(exp.id);
    if (g) genomesComputed++;
  }

  const graphResult = await recomputeDiscoveryGraph();
  const creatorResult = await recomputeAllCreatorIntelligence();
  const patternResult = await recomputeCompositionPatterns();

  return NextResponse.json({
    ok: true,
    genomesComputed,
    coPlayEdges: graphResult.edgesBuilt,
    creatorsScored: creatorResult.computed,
    compositionPatterns: patternResult.patterns,
  });
}
