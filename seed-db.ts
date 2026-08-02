/**
 * Standalone seed script — runs directly against the database.
 * Usage: bun run seed-db.ts
 *
 * Creates: creators, published experiences (with bundles), native Neon Runner,
 * HTML5 Orb Collector, and intelligence records.
 */

import { db } from './src/lib/db';
import { compileBundle } from './src/kernel/compiler';
import { resolveExtension } from './src/kernel/extensions';
import { telemetryService } from './src/lib/telemetry-store';
import { persistBundle } from './src/lib/session-registry';
import { ensurePlayerProfile } from './src/lib/world/player-service';
import { recordActivity } from './src/lib/universe/social-service';
import { quickPlay } from './src/lib/universe/play-service';
import { ensureDemoCreator } from './src/lib/studio-service';
import { updateContainmentConfig } from './src/lib/economy/containment-service';
import { importHtml5Game, seedNativeNeonRunner, seedOrbCollectorHtml5 } from './src/lib/runtime/runtime-service';
import type { ExperienceBundle, ExperienceIntent } from './src/kernel/types';

const CREATOR_NAMES = ['Alex Rivers', 'Maya Chen', 'Diego Torres', 'Priya Patel', 'Kenji Sato'];
const SPARK_TITLES = [
  'Neon Runner', 'Coin Quest', 'Farm Kingdom', 'Zombie Defense', 'Sky Towers',
  'Pixel Puzzle', 'Battle Arena', 'Dragon Lair', 'Ocean Explorer', 'Star Miner',
  'Cooking Master', 'Drift Racing', 'Tower Siege', 'Crystal Caves', 'Weather Wars',
  'Merchant Empire', 'Dungeon Crawler', 'Fishing Frenzy', 'Code Breaker', 'Garden Grow',
];

async function main() {
  console.log('🌱 Seeding PlayLiquid database...');

  // 1. Create demo creator
  await ensureDemoCreator();
  console.log('  ✓ Demo creator');

  // 2. Create 5 creators
  const creators: Array<{ id: string; handle: string; displayName: string }> = [];
  for (const name of CREATOR_NAMES) {
    const handle = name.toLowerCase().replace(/\s+/g, '-');
    let creator = await db.creatorRecord.findUnique({ where: { handle } });
    if (!creator) {
      creator = await db.creatorRecord.create({
        data: { handle, displayName: name, bio: `Creator of amazing experiences on PlayLiquid.` },
      });
    }
    creators.push(creator);
  }
  console.log(`  ✓ ${creators.length} creators`);

  // 3. Publish experiences (reuse Farm Kingdom bundle)
  const { FARM_KINGDOM_BUNDLE, FARM_KINGDOM_INTENT, FARM_KINGDOM_DESCRIPTION } = await import('./src/components/studio/farm-kingdom-demo');
  const sparks: Array<{ id: string; title: string }> = [];
  for (let i = 0; i < SPARK_TITLES.length; i++) {
    const title = SPARK_TITLES[i];
    const creator = creators[i % creators.length];
    const existing = await db.experienceRecord.findFirst({ where: { title } });
    if (existing) { sparks.push(existing); continue; }

    const bundle: ExperienceBundle = JSON.parse(JSON.stringify(FARM_KINGDOM_BUNDLE));
    bundle.name = title;
    for (const inst of bundle.instances) {
      inst.config = {
        ...(inst.config ?? {}),
        ...(inst.extensionId === 'pl.farm' ? { intervalTicks: 2 + (i % 5) } : {}),
        ...(inst.extensionId === 'pl.cooking' ? { cornNeeded: 1 + (i % 4) } : {}),
        ...(inst.extensionId === 'pl.marketplace' ? { exchangeRate: 0.5 + (i % 3) * 0.5 } : {}),
        ...(inst.extensionId === 'pl.competition' ? { entryFee: i % 3, scorePerTrade: 5 + (i % 5) * 5 } : {}),
      };
    }
    const intent: ExperienceIntent = { ...FARM_KINGDOM_INTENT, kind: i % 5 === 0 ? 'SPARK' : 'GAME', emotions: FARM_KINGDOM_INTENT.emotions.slice(0, 1 + (i % 3)) };
    const graph = compileBundle(bundle, resolveExtension);
    if (!graph.valid) continue;
    const genome = telemetryService.computeGenome(title.toLowerCase().replace(/\s+/g, '-'), graph);
    await telemetryService.persistGenome(genome).catch(() => {});
    await persistBundle(title.toLowerCase().replace(/\s+/g, '-'), bundle, graph).catch(() => {});
    const exp = await db.experienceRecord.create({
      data: {
        slug: `${title.toLowerCase().replace(/\s+/g, '-')}-${Date.now().toString(36).slice(-4)}`,
        title, description: `An amazing ${intent.kind.toLowerCase()} experience by ${creator.displayName}.`,
        creatorId: creator.id, bundleHash: graph.contentHash,
        intentJson: JSON.stringify(intent), genomeJson: JSON.stringify(genome),
        status: 'PUBLISHED', publishedAt: new Date(Date.now() - i * 3600000),
      },
    });
    sparks.push(exp);
    await updateContainmentConfig(exp.id, { runtimeType: 'native', aspectRatio: '16:9', orientation: 'landscape' }).catch(() => {});
  }
  console.log(`  ✓ ${sparks.length} experiences`);

  // 4. Create players + run sessions (smaller batch for speed)
  const playerIds: string[] = [];
  for (let i = 0; i < 20; i++) {
    const userId = `universe_player_${i}`;
    await ensurePlayerProfile(userId, `Player${i}`);
    playerIds.push(userId);
  }
  let sessions = 0;
  for (const userId of playerIds) {
    const spark = sparks[Math.floor(Math.random() * sparks.length)];
    const result = await quickPlay({ experienceId: spark.id, userId, ticks: 10 + Math.floor(Math.random() * 10) }).catch(() => null);
    if (result?.result) sessions++;
  }
  console.log(`  ✓ ${playerIds.length} players, ${sessions} sessions`);

  // 5. Seed native Neon Runner
  const native = await seedNativeNeonRunner();
  console.log(`  ✓ Native Neon Runner (${native.created ? 'created' : 'exists'}): ${native.experienceId}`);

  // 6. Seed HTML5 Orb Collector
  const html5 = await seedOrbCollectorHtml5();
  console.log(`  ✓ HTML5 Orb Collector (${html5.created ? 'created' : 'exists'}): ${html5.experienceId}`);

  // 7. Seed intelligence (genomes + co-play + creator scores + patterns)
  const { computeExperienceIntelligence } = await import('./src/lib/intelligence/genome-service');
  const { recomputeDiscoveryGraph } = await import('./src/lib/intelligence/discovery-graph-service');
  const { recomputeAllCreatorIntelligence } = await import('./src/lib/intelligence/creator-intelligence-service');
  const { recomputeCompositionPatterns } = await import('./src/lib/intelligence/extension-genome-service');

  let genomes = 0;
  for (const spark of sparks) {
    const g = await computeExperienceIntelligence(spark.id).catch(() => null);
    if (g) genomes++;
  }
  const graph = await recomputeDiscoveryGraph();
  const creators2 = await recomputeAllCreatorIntelligence();
  const patterns = await recomputeCompositionPatterns();
  console.log(`  ✓ Intelligence: ${genomes} genomes, ${graph.edgesBuilt} co-play edges, ${creators2.computed} creators scored, ${patterns.patterns} patterns`);

  console.log('\n✅ Seed complete!');
  console.log(`   Experiences: ${sparks.length + 2} (including Neon Runner native + Orb Collector HTML5)`);
  console.log(`   Database: ${process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] ?? 'unknown'}`);
}

main().then(() => process.exit(0)).catch(e => { console.error('SEED ERROR:', e); process.exit(1); });
