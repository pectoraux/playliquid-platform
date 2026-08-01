import { NextResponse } from 'next/server';
import { createWorld, spawnCitizens } from '@/lib/civ/world-service';
import { runWorldTicks } from '@/lib/civ/scheduler';
import { db } from '@/lib/db';
import { FARM_KINGDOM_BUNDLE, FARM_KINGDOM_INTENT, FARM_KINGDOM_DESCRIPTION } from '@/components/studio/farm-kingdom-demo';
import { compileBundle } from '@/kernel/compiler';
import { resolveExtension } from '@/kernel/extensions';
import { telemetryService } from '@/lib/telemetry-store';
import { persistBundle } from '@/lib/session-registry';

/**
 * POST /api/civ/demo
 * Creates the Farm Kingdom Civilization demo:
 *   1. Publishes Farm Kingdom experience (if not exists)
 *   2. Creates a world from it
 *   3. Spawns 100 AI citizens
 *   4. Runs 200 ticks (scaled down from 1000 for demo speed)
 *   5. Returns the world ID for inspection
 */
export async function POST() {
  try {
    // 1. Find or create Farm Kingdom experience
    let exp = await db.experienceRecord.findFirst({
      where: { title: 'Farm Kingdom', status: 'PUBLISHED' },
    });

    if (!exp) {
      // Compile + publish
      const graph = compileBundle(FARM_KINGDOM_BUNDLE, resolveExtension);
      if (!graph.valid) {
        return NextResponse.json({ error: 'Farm Kingdom bundle invalid' }, { status: 500 });
      }

      const genome = telemetryService.computeGenome('farm-kingdom', graph);
      await telemetryService.persistGenome(genome).catch(() => {});
      await persistBundle('farm-kingdom', FARM_KINGDOM_BUNDLE, graph).catch(() => {});

      exp = await db.experienceRecord.create({
        data: {
          slug: `farm-kingdom-${Date.now().toString(36).slice(-4)}`,
          title: 'Farm Kingdom',
          description: FARM_KINGDOM_DESCRIPTION,
          creatorId: 'creator_demo',
          bundleHash: graph.contentHash,
          intentJson: JSON.stringify(FARM_KINGDOM_INTENT),
          genomeJson: JSON.stringify(genome),
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
      });
    }

    // 2. Create world
    const world = await createWorld({
      experienceId: exp.id,
      name: 'Farm Kingdom Civilization',
      description: 'A living world of 100 AI citizens with farmers, merchants, builders, explorers, and competitors.',
      creatorId: 'creator_demo',
    });

    // 3. Spawn 20 citizens with role distribution (scaled for demo speed)
    await spawnCitizens({
      worldId: world.id,
      count: 20,
      roleDistribution: {
        CITIZEN: 8,
        MERCHANT: 4,
        BUILDER: 2,
        EXPLORER: 3,
        COMPETITOR: 3,
      },
    });

    // 4. Run 50 ticks (LLM disabled for speed; can be enabled for richer stories)
    const result = await runWorldTicks({
      worldId: world.id,
      ticks: 50,
      useLLM: false,
    });

    // 5. Get final stats
    const { getWorldStats } = await import('@/lib/civ/scheduler');
    const stats = await getWorldStats(world.id);

    return NextResponse.json({
      worldId: world.id,
      worldName: world.name,
      experienceId: exp.id,
      citizens: 100,
      ticksRun: result.ticksRun,
      eventsGenerated: result.eventsGenerated,
      decisions: result.decisions,
      stats,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
