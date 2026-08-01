import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { compileBundle } from '@/kernel/compiler';
import { resolveExtension, listExtensions } from '@/kernel/extensions';
import { telemetryService } from '@/lib/telemetry-store';
import { persistBundle } from '@/lib/session-registry';
import { ensurePlayerProfile } from '@/lib/world/player-service';
import { recordActivity } from '@/lib/universe/social-service';
import { quickPlay } from '@/lib/universe/play-service';
import { FARM_KINGDOM_BUNDLE, FARM_KINGDOM_INTENT, FARM_KINGDOM_DESCRIPTION } from '@/components/studio/farm-kingdom-demo';
import type { ExperienceBundle, ExperienceIntent } from '@/kernel/types';

const CREATOR_NAMES = ['Alex Rivers', 'Maya Chen', 'Diego Torres', 'Priya Patel', 'Kenji Sato'];
const SPARK_TITLES = [
  'Neon Runner', 'Coin Quest', 'Farm Kingdom', 'Zombie Defense', 'Sky Towers',
  'Pixel Puzzle', 'Battle Arena', 'Dragon Lair', 'Ocean Explorer', 'Star Miner',
  'Cooking Master', 'Drift Racing', 'Tower Siege', 'Crystal Caves', 'Weather Wars',
  'Merchant Empire', 'Dungeon Crawler', 'Fishing Frenzy', 'Code Breaker', 'Garden Grow',
];

// Variation configs for different sparks
const CONFIG_VARIATIONS: Record<string, Record<string, unknown>> = {
  'Farm Kingdom': {},
};

/**
 * POST /api/universe/demo
 * Seeds the PlayLiquid Launch Universe:
 *   1. Creates 5 creators
 *   2. Publishes 20 sparks
 *   3. Creates 100 simulated players
 *   4. Runs play sessions for each player
 *   5. Generates activity feed, ratings, social connections
 */
export async function POST() {
  try {
    // 1. Create creators (if not exist)
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

    // 2. Publish sparks (reuse Farm Kingdom bundle with variations)
    const sparks: Array<{ id: string; title: string; creatorId: string }> = [];
    for (let i = 0; i < SPARK_TITLES.length; i++) {
      const title = SPARK_TITLES[i];
      const creator = creators[i % creators.length];

      // Check if already exists
      const existing = await db.experienceRecord.findFirst({ where: { title } });
      if (existing) {
        sparks.push(existing);
        continue;
      }

      // Create a varied bundle based on Farm Kingdom
      const bundle: ExperienceBundle = JSON.parse(JSON.stringify(FARM_KINGDOM_BUNDLE));
      bundle.name = title;

      // Vary configs slightly for diversity
      for (const inst of bundle.instances) {
        inst.config = {
          ...(inst.config ?? {}),
          // Randomize some configs
          ...(inst.extensionId === 'pl.farm' ? { intervalTicks: 2 + (i % 5) } : {}),
          ...(inst.extensionId === 'pl.cooking' ? { cornNeeded: 1 + (i % 4) } : {}),
          ...(inst.extensionId === 'pl.marketplace' ? { exchangeRate: 0.5 + (i % 3) * 0.5 } : {}),
          ...(inst.extensionId === 'pl.competition' ? { entryFee: i % 3, scorePerTrade: 5 + (i % 5) * 5 } : {}),
        };
      }

      const intent: ExperienceIntent = {
        ...FARM_KINGDOM_INTENT,
        kind: i % 5 === 0 ? 'SPARK' : 'GAME',
        emotions: FARM_KINGDOM_INTENT.emotions.slice(0, 1 + (i % 3)),
      };

      // Compile
      const graph = compileBundle(bundle, resolveExtension);
      if (!graph.valid) continue;

      const genome = telemetryService.computeGenome(title.toLowerCase().replace(/\s+/g, '-'), graph);
      await telemetryService.persistGenome(genome).catch(() => {});
      await persistBundle(title.toLowerCase().replace(/\s+/g, '-'), bundle, graph).catch(() => {});

      const exp = await db.experienceRecord.create({
        data: {
          slug: `${title.toLowerCase().replace(/\s+/g, '-')}-${Date.now().toString(36).slice(-4)}`,
          title,
          description: `An amazing ${intent.kind.toLowerCase()} experience by ${creator.displayName}. ${FARM_KINGDOM_DESCRIPTION.slice(0, 100)}`,
          creatorId: creator.id,
          bundleHash: graph.contentHash,
          intentJson: JSON.stringify(intent),
          genomeJson: JSON.stringify(genome),
          status: 'PUBLISHED',
          publishedAt: new Date(Date.now() - i * 3600000), // stagger publish times
        },
      });

      sparks.push(exp);

      // Record publish activity
      await recordActivity({
        userId: `creator_${creator.id}`,
        type: 'published',
        targetType: 'experience',
        targetId: exp.id,
        targetName: title,
      }).catch(() => {});
    }

    // 3. Create 100 simulated players
    const playerNames = ['Player', 'Gamer', 'Explorer', 'Creator', 'Builder', 'Trader', 'Hunter', 'Mage', 'Knight', 'Sage'];
    const playerIds: string[] = [];
    for (let i = 0; i < 100; i++) {
      const userId = `universe_player_${i}`;
      const displayName = `${playerNames[i % playerNames.length]}${i}`;
      await ensurePlayerProfile(userId, displayName);
      playerIds.push(userId);
    }

    // 4. Run play sessions (each player plays 1-3 random sparks)
    let totalSessions = 0;
    for (const userId of playerIds) {
      const sessionsToPlay = 1 + Math.floor(Math.random() * 3);
      for (let s = 0; s < sessionsToPlay; s++) {
        const spark = sparks[Math.floor(Math.random() * sparks.length)];
        const result = await quickPlay({
          experienceId: spark.id,
          userId,
          ticks: 15 + Math.floor(Math.random() * 20),
        }).catch(() => null);
        if (result?.result) totalSessions++;
      }
    }

    // 5. Generate some social connections (follow creators)
    for (let i = 0; i < 30; i++) {
      const player = playerIds[Math.floor(Math.random() * playerIds.length)];
      const creator = creators[Math.floor(Math.random() * creators.length)];
      const { followUser } = await import('@/lib/universe/social-service');
      await followUser(player, `creator_${creator.id}`).catch(() => {});
    }

    return NextResponse.json({
      creators: creators.length,
      sparks: sparks.length,
      players: playerIds.length,
      sessionsRun: totalSessions,
      message: 'PlayLiquid Launch Universe seeded successfully',
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
