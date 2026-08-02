/**
 * Phase 21 — Runtime Service
 * ---------------------------
 * Bridges ExperienceRecord + ContainmentConfig to the actual runtime.
 * Now supports three runtime modes:
 *   - native (engine): PlayEngine-based games (real game engine)
 *   - spark: PlayEngine-based vertical touch mini-games
 *   - html5: Imported HTML5 games (iframe + postMessage)
 *
 * Also handles AI-generated game creation (prompt → game config → experience).
 */

import { db } from '@/lib/db';
import { compileBundle } from '@/kernel/compiler';
import { resolveExtension } from '@/kernel/extensions';
import { telemetryService } from '@/lib/telemetry-store';
import { persistBundle } from '@/lib/session-registry';
import { ensureDemoCreator } from '@/lib/studio-service';
import { getContainmentConfig, updateContainmentConfig } from '@/lib/economy/containment-service';
import type { ExperienceBundle } from '@/kernel/types';
import { GAMES } from '@/engine/games';
import { SPARKS } from '@/engine/sparks';

export interface ExperienceRuntime {
  experienceId: string;
  title: string;
  description: string;
  creatorId: string;
  runtimeType: 'native' | 'html5' | 'external' | 'spark';
  engineGameId?: string;     // for native engine games + sparks
  bundle: ExperienceBundle | null;
  containment: {
    aspectRatio: string | null;
    orientation: string;
    html5BundleUrl: string | null;
    externalUrl: string | null;
  };
}

/**
 * Get the full runtime info for an experience.
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

  // Determine runtime type: spark format → spark runtime
  let runtimeType = config.runtimeType as 'native' | 'html5' | 'external' | 'spark';
  if (exp.format === 'spark') {
    runtimeType = 'spark';
  }

  // Extract engine game id from the experience metadata
  // (stored in intentJson as engineGameId)
  let engineGameId: string | undefined;
  try {
    const intent = JSON.parse(exp.intentJson);
    engineGameId = intent.engineGameId;
  } catch { /* ignore */ }

  return {
    experienceId: exp.id,
    title: exp.title,
    description: exp.description,
    creatorId: exp.creatorId,
    runtimeType,
    engineGameId,
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
 * Create an engine-based experience (native game or spark).
 * Used by the AI Creation Studio and the game seeder.
 */
export async function createEngineExperience(params: {
  title: string;
  description: string;
  engineGameId: string;
  format: 'game' | 'spark';
  tags?: string[];
  competitiveEligible?: boolean;
}): Promise<{ experienceId: string }> {
  const creator = await ensureDemoCreator();
  const game = params.format === 'spark' ? SPARKS[params.engineGameId] : GAMES[params.engineGameId];
  if (!game) throw new Error(`Unknown engine game: ${params.engineGameId}`);

  const slug = `${params.title.toLowerCase().replace(/\s+/g, '-')}-${Date.now().toString(36).slice(-4)}`;
  const aspectRatio = params.format === 'spark' ? '9:16' : '16:9';
  const orientation = params.format === 'spark' ? 'portrait' : 'landscape';

  // Create a minimal bundle (the engine handles the game logic; the bundle
  // records which extensions the game conceptually uses for the graph view)
  const bundle: ExperienceBundle = {
    type: params.format === 'spark' ? 'SPARK' : 'GAME',
    name: params.title,
    instances: [{ id: 'engine', extensionId: 'pl.physics', config: { engineGameId: params.engineGameId } }],
    wires: [],
  };

  const graph = compileBundle(bundle, resolveExtension);
  const genome = telemetryService.computeGenome(slug, graph);
  await telemetryService.persistGenome(genome).catch(() => {});
  if (graph.contentHash) {
    await persistBundle(slug, bundle, graph).catch(() => {});
  }

  const exp = await db.experienceRecord.create({
    data: {
      slug,
      title: params.title,
      description: params.description,
      creatorId: creator.id,
      bundleHash: graph.contentHash,
      intentJson: JSON.stringify({
        kind: params.format === 'spark' ? 'SPARK' : 'GAME',
        emotions: ['excitement'],
        goals: ['score'],
        audience: 'general',
        description: params.description,
        engineGameId: params.engineGameId,
        tags: params.tags ?? game.tags,
      }),
      genomeJson: JSON.stringify(genome),
      status: 'PUBLISHED',
      publishedAt: new Date(),
      format: params.format,
      competitiveEligible: params.competitiveEligible ?? false,
    },
  });

  await updateContainmentConfig(exp.id, {
    runtimeType: params.format === 'spark' ? 'spark' : 'native',
    aspectRatio,
    orientation,
  });

  return { experienceId: exp.id };
}

/**
 * Import an HTML5 game as a PlayLiquid experience.
 */
export async function importHtml5Game(params: {
  name: string;
  description?: string;
  gameUrl: string;
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
  const aspectRatio = params.manifest.viewport?.aspectRatio ?? '16:9';
  const orientation = params.manifest.viewport?.orientation ?? 'landscape';

  const slug = `${params.name.toLowerCase().replace(/\s+/g, '-')}-html5-${Date.now().toString(36).slice(-4)}`;
  const exp = await db.experienceRecord.create({
    data: {
      slug,
      title: params.name,
      description: params.description ?? `Imported HTML5 game: ${params.name}`,
      creatorId: creator.id,
      intentJson: JSON.stringify({ kind: 'GAME', emotions: ['excitement'], goals: ['play'], audience: 'general', description: params.description ?? '' }),
      status: 'PUBLISHED',
      publishedAt: new Date(),
      format: 'game',
    },
  });

  await updateContainmentConfig(exp.id, {
    runtimeType: 'html5',
    aspectRatio,
    orientation,
    html5BundleUrl: params.gameUrl,
  });

  const imported = await db.importedGameBundleRecord.create({
    data: {
      experienceId: exp.id,
      filename: `${params.name.toLowerCase().replace(/\s+/g, '-')}.zip`,
      storageUrl: params.gameUrl,
      manifestJson: JSON.stringify(params.manifest),
      runtimeType: 'html5',
      uploadedBy: params.uploadedBy ?? creator.id,
      status: 'PUBLISHED',
    },
  });

  return { experienceId: exp.id, importedId: imported.id };
}

/**
 * Seed the canonical engine games + sparks.
 */
export async function seedEngineGames(): Promise<{ created: string[] }> {
  const created: string[] = [];

  // Seed native games
  for (const game of Object.values(GAMES)) {
    const existing = await db.experienceRecord.findFirst({
      where: { title: game.name, format: 'game' },
    });
    if (existing) {
      created.push(`${game.name} (exists)`);
      continue;
    }
    const result = await createEngineExperience({
      title: game.name,
      description: game.description,
      engineGameId: game.id,
      format: 'game',
      tags: game.tags,
      competitiveEligible: game.tags.includes('competitive'),
    });
    created.push(`${game.name} → ${result.experienceId.slice(-8)}`);
  }

  // Seed sparks
  for (const spark of Object.values(SPARKS)) {
    const existing = await db.experienceRecord.findFirst({
      where: { title: spark.name, format: 'spark' },
    });
    if (existing) {
      created.push(`${spark.name} (exists)`);
      continue;
    }
    const result = await createEngineExperience({
      title: spark.name,
      description: spark.description,
      engineGameId: spark.id,
      format: 'spark',
      tags: spark.tags,
    });
    created.push(`${spark.name} → ${result.experienceId.slice(-8)}`);
  }

  return { created };
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
