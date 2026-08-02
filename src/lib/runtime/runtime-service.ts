/**
 * Phase 20.5 — Runtime Service
 * ----------------------------
 * Bridges the ExperienceRecord + ContainmentConfig to the actual runtime
 * (native kernel vs imported HTML5). Provides:
 *   - getExperienceBundle(experienceId) → bundle + containment config
 *   - importHtml5Game(params) → creates experience + containment + imported record
 *   - seedNativeGame() → creates the canonical "Neon Runner" native experience
 */

import { db } from '@/lib/db';
import { compileBundle } from '@/kernel/compiler';
import { resolveExtension } from '@/kernel/extensions';
import { telemetryService } from '@/lib/telemetry-store';
import { persistBundle } from '@/lib/session-registry';
import { ensureDemoCreator } from '@/lib/studio-service';
import { getContainmentConfig, updateContainmentConfig } from '@/lib/economy/containment-service';
import type { ExperienceBundle } from '@/kernel/types';

const MICRO = 1_000_000;

export interface ExperienceRuntime {
  experienceId: string;
  title: string;
  description: string;
  creatorId: string;
  runtimeType: 'native' | 'html5' | 'external';
  bundle: ExperienceBundle | null;
  containment: {
    aspectRatio: string | null;
    orientation: string;
    html5BundleUrl: string | null;
    externalUrl: string | null;
  };
}

/**
 * Get the full runtime info for an experience (bundle + containment).
 */
export async function getExperienceRuntime(experienceId: string): Promise<ExperienceRuntime | null> {
  const exp = await db.experienceRecord.findUnique({
    where: { id: experienceId },
    include: { creator: true },
  });
  if (!exp) return null;

  const config = await getContainmentConfig(experienceId);

  let bundle: ExperienceBundle | null = null;
  if (exp.bundleHash) {
    const bundleRecord = await db.bundleRecord.findUnique({ where: { contentHash: exp.bundleHash } });
    if (bundleRecord) {
      bundle = JSON.parse(bundleRecord.bundleJson);
    }
  }

  return {
    experienceId: exp.id,
    title: exp.title,
    description: exp.description,
    creatorId: exp.creatorId,
    runtimeType: config.runtimeType as 'native' | 'html5' | 'external',
    bundle,
    containment: {
      aspectRatio: config.aspectRatio,
      orientation: config.orientation,
      html5BundleUrl: config.html5BundleUrl,
      externalUrl: config.externalUrl,
    },
  };
}

/**
 * Import an HTML5 game as a PlayLiquid experience.
 * Creates:
 *   - ImportedGameBundleRecord (the bundle metadata)
 *   - ExperienceRecord (the experience)
 *   - GameContainmentConfigRecord (runtimeType=html5)
 */
export async function importHtml5Game(params: {
  name: string;
  description?: string;
  gameUrl: string;        // e.g. /imported-games/orb-collector/
  manifest: {
    name: string;
    version?: string;
    runtime: { type: string; entry: string };
    viewport?: { aspectRatio?: string; orientation?: string };
    permissions?: string[];
  };
  uploadedBy?: string;
}): Promise<{ experienceId: string; importedId: string }> {
  const creator = await ensureDemoCreator();
  const uploadedBy = params.uploadedBy ?? creator.id;
  const aspectRatio = params.manifest.viewport?.aspectRatio ?? '16:9';
  const orientation = params.manifest.viewport?.orientation ?? 'landscape';

  // Create the experience (no bundle for HTML5 — the runtime is the iframe)
  const slug = `${params.name.toLowerCase().replace(/\s+/g, '-')}-html5-${Date.now().toString(36).slice(-4)}`;
  const exp = await db.experienceRecord.create({
    data: {
      slug,
      title: params.name,
      description: params.description ?? `Imported HTML5 game: ${params.name}`,
      creatorId: creator.id,
      intentJson: JSON.stringify({ kind: 'GAME', emotions: ['excitement'], goals: ['collect'], audience: 'general', description: params.description ?? '' }),
      status: 'PUBLISHED',
      publishedAt: new Date(),
      format: 'GAME',
    },
  });

  // Create containment config with runtimeType=html5
  await updateContainmentConfig(exp.id, {
    runtimeType: 'html5',
    aspectRatio,
    orientation,
    html5BundleUrl: params.gameUrl,
  });

  // Create the imported game bundle record
  const imported = await db.importedGameBundleRecord.create({
    data: {
      experienceId: exp.id,
      filename: `${params.name.toLowerCase().replace(/\s+/g, '-')}.zip`,
      storageUrl: params.gameUrl,
      manifestJson: JSON.stringify(params.manifest),
      runtimeType: 'html5',
      uploadedBy,
      status: 'PUBLISHED',
    },
  });

  return { experienceId: exp.id, importedId: imported.id };
}

/**
 * Seed the canonical native "Neon Runner" experience.
 * Uses Physics + Movement + Score + CoinCollector + Competition extensions.
 */
export async function seedNativeNeonRunner(): Promise<{ experienceId: string; created: boolean }> {
  const creator = await ensureDemoCreator();

  // Check if already exists
  const existing = await db.experienceRecord.findFirst({
    where: { title: 'Neon Runner (Native)', creatorId: creator.id },
  });
  if (existing) {
    // Ensure containment config is native
    await updateContainmentConfig(existing.id, { runtimeType: 'native', aspectRatio: '16:9', orientation: 'landscape' });
    return { experienceId: existing.id, created: false };
  }

  const bundle: ExperienceBundle = {
    type: 'GAME',
    name: 'Neon Runner (Native)',
    instances: [
      { id: 'physics', extensionId: 'pl.physics', config: { speed: 6 } },
      { id: 'movement', extensionId: 'pl.movement' },
      { id: 'score', extensionId: 'pl.score', config: { pointsPerUnit: 5 } },
      { id: 'coins', extensionId: 'pl.coin-collector', config: { coinCount: 12, collectRadius: 7 } },
      { id: 'competition', extensionId: 'pl.competition', config: { entryFee: 0, scorePerTrade: 10 } },
    ],
    wires: [
      { from: { instance: 'physics', channel: 'position' }, to: { instance: 'movement', channel: 'position' } },
      { from: { instance: 'physics', channel: 'position' }, to: { instance: 'coins', channel: 'position' } },
      { from: { instance: 'movement', channel: 'movementEvent' }, to: { instance: 'score', channel: 'movementEvent' } },
      // Competition tracks trade events (optional input); it sits idle until
      // marketplace trades flow. For Neon Runner it provides the competitive
      // eligibility without requiring a marketplace wire.
    ],
  };

  const graph = compileBundle(bundle, resolveExtension);
  if (!graph.valid) {
    throw new Error(`Neon Runner bundle does not compile: ${graph.errors.map((e) => e.message).join(', ')}`);
  }

  const genome = telemetryService.computeGenome('neon-runner-native', graph);
  await telemetryService.persistGenome(genome).catch(() => {});
  await persistBundle('neon-runner-native', bundle, graph).catch(() => {});

  const exp = await db.experienceRecord.create({
    data: {
      slug: `neon-runner-native-${Date.now().toString(36).slice(-4)}`,
      title: 'Neon Runner (Native)',
      description: 'The canonical native PlayLiquid game. Physics + Movement + Score + Coin Collector + Competition. Play with WASD/Arrows.',
      creatorId: creator.id,
      bundleHash: graph.contentHash,
      intentJson: JSON.stringify({ kind: 'GAME', emotions: ['excitement', 'mastery'], goals: ['collect coins', 'beat high score'], audience: 'general', description: 'Native runtime validation experience' }),
      genomeJson: JSON.stringify(genome),
      status: 'PUBLISHED',
      publishedAt: new Date(),
      format: 'GAME',
      competitiveEligible: true,
    },
  });

  // Native containment config
  await updateContainmentConfig(exp.id, { runtimeType: 'native', aspectRatio: '16:9', orientation: 'landscape' });

  return { experienceId: exp.id, created: true };
}

/**
 * Seed the Orb Collector HTML5 experience (imported).
 */
export async function seedOrbCollectorHtml5(): Promise<{ experienceId: string; created: boolean }> {
  const creator = await ensureDemoCreator();

  const existing = await db.experienceRecord.findFirst({
    where: { title: 'Orb Collector (HTML5)', creatorId: creator.id },
  });
  if (existing) {
    return { experienceId: existing.id, created: false };
  }

  const result = await importHtml5Game({
    name: 'Orb Collector (HTML5)',
    description: 'An imported HTML5 game running inside the PlayLiquid ContainmentFrame. Pure Canvas API + JavaScript. Validates the input/telemetry bridges.',
    gameUrl: '/imported-games/orb-collector/',
    manifest: {
      name: 'Orb Collector',
      version: '1.0.0',
      runtime: { type: 'html5', entry: 'index.html' },
      viewport: { aspectRatio: '16:9', orientation: 'landscape' },
      permissions: ['input', 'telemetry'],
    },
    uploadedBy: creator.id,
  });

  return { experienceId: result.experienceId, created: true };
}

/**
 * List imported HTML5 games.
 */
export async function listImportedGames(): Promise<Array<{
  experienceId: string;
  experienceName: string;
  storageUrl: string;
  status: string;
  createdAt: number;
}>> {
  const rows = await db.importedGameBundleRecord.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  return rows.map((r) => ({
    experienceId: r.experienceId,
    experienceName: JSON.parse(r.manifestJson).name ?? r.filename,
    storageUrl: r.storageUrl,
    status: r.status,
    createdAt: r.createdAt.getTime(),
  }));
}
