/**
 * Minimal seed — creates essential records fast for deployment.
 * Usage: DATABASE_URL=... bun run seed-min.ts
 */
import { db } from './src/lib/db';
import { compileBundle } from './src/kernel/compiler';
import { resolveExtension } from './src/kernel/extensions';
import { telemetryService } from './src/lib/telemetry-store';
import { persistBundle } from './src/lib/session-registry';
import { ensureDemoCreator } from './src/lib/studio-service';
import { updateContainmentConfig } from './src/lib/economy/containment-service';
import { seedNativeNeonRunner, seedOrbCollectorHtml5 } from './src/lib/runtime/runtime-service';
import type { ExperienceBundle, ExperienceIntent } from './src/kernel/types';

const CREATOR_NAMES = ['Alex Rivers', 'Maya Chen', 'Diego Torres', 'Priya Patel', 'Kenji Sato'];
const TITLES = [
  'Neon Runner', 'Coin Quest', 'Farm Kingdom', 'Zombie Defense', 'Sky Towers',
  'Pixel Puzzle', 'Battle Arena', 'Dragon Lair', 'Ocean Explorer', 'Star Miner',
];

async function main() {
  console.log('🌱 Minimal seed...');
  await ensureDemoCreator();
  const creators = [];
  for (const name of CREATOR_NAMES) {
    const handle = name.toLowerCase().replace(/\s+/g, '-');
    let c = await db.creatorRecord.findUnique({ where: { handle } });
    if (!c) c = await db.creatorRecord.create({ data: { handle, displayName: name, bio: 'PlayLiquid creator.' } });
    creators.push(c);
  }
  console.log(`  ✓ ${creators.length} creators`);

  const { FARM_KINGDOM_BUNDLE, FARM_KINGDOM_INTENT } = await import('./src/components/studio/farm-kingdom-demo');
  let expCount = 0;
  for (let i = 0; i < TITLES.length; i++) {
    const title = TITLES[i];
    const existing = await db.experienceRecord.findFirst({ where: { title } });
    if (existing) { expCount++; continue; }
    const bundle: ExperienceBundle = JSON.parse(JSON.stringify(FARM_KINGDOM_BUNDLE));
    bundle.name = title;
    const intent: ExperienceIntent = { ...FARM_KINGDOM_INTENT, kind: i % 5 === 0 ? 'SPARK' : 'GAME' };
    const graph = compileBundle(bundle, resolveExtension);
    if (!graph.valid) continue;
    const genome = telemetryService.computeGenome(title.toLowerCase().replace(/\s+/g, '-'), graph);
    await persistBundle(title.toLowerCase().replace(/\s+/g, '-'), bundle, graph).catch(() => {});
    const exp = await db.experienceRecord.create({
      data: {
        slug: `${title.toLowerCase().replace(/\s+/g, '-')}-${Date.now().toString(36).slice(-4)}`,
        title, description: `A PlayLiquid experience by ${creators[i % creators.length].displayName}.`,
        creatorId: creators[i % creators.length].id, bundleHash: graph.contentHash,
        intentJson: JSON.stringify(intent), genomeJson: JSON.stringify(genome),
        status: 'PUBLISHED', publishedAt: new Date(Date.now() - i * 3600000),
      },
    });
    await updateContainmentConfig(exp.id, { runtimeType: 'native', aspectRatio: '16:9', orientation: 'landscape' }).catch(() => {});
    expCount++;
  }
  console.log(`  ✓ ${expCount} experiences`);

  const native = await seedNativeNeonRunner();
  console.log(`  ✓ Native Neon Runner: ${native.experienceId.slice(-8)}`);
  const html5 = await seedOrbCollectorHtml5();
  console.log(`  ✓ HTML5 Orb Collector: ${html5.experienceId.slice(-8)}`);

  console.log('\n✅ Minimal seed complete!');
}
main().then(() => process.exit(0)).catch(e => { console.error('ERROR:', e.message); process.exit(1); });
