/**
 * Phase 17 — Extension Publishing + Marketplace + Installation + Analytics
 * -----------------------------------------------------------------------
 * ADR-001: Extensions are the fundamental primitive.
 *
 * This service makes ExtensionRecord the canonical entity for:
 *   - Publishing (create, version, validate)
 *   - Marketplace (discover, trending, used together)
 *   - Installation (track which experiences use which extensions)
 *   - Analytics (creator dashboard for extension performance)
 *   - Reputation (multi-dimensional scoring)
 */

import { db } from '@/lib/db';
import { listExtensions } from '@/kernel/extensions';

// ─── Publishing ────────────────────────────────────────────────────────────

/**
 * Seed canonical ExtensionRecords from the kernel registry.
 * This syncs the hardcoded kernel extensions into the database as
 * first-class platform entities.
 */
export async function seedExtensionRecords(): Promise<number> {
  const kernelExtensions = listExtensions();
  let count = 0;

  for (const { manifest } of kernelExtensions) {
    const existing = await db.extensionRecord.findUnique({ where: { id: manifest.id } });
    if (existing) {
      // Update with new fields
      await db.extensionRecord.update({
        where: { id: manifest.id },
        data: {
          creatorId: 'platform',
          creatorName: 'PlayLiquid',
          author: manifest.author,
          icon: manifest.icon ?? '📦',
          tagsJson: JSON.stringify(manifest.tags ?? []),
          status: 'PUBLISHED',
        },
      });
      continue;
    }

    await db.extensionRecord.create({
      data: {
        id: manifest.id,
        slug: manifest.slug,
        name: manifest.name,
        description: manifest.description,
        creatorId: 'platform',
        creatorName: 'PlayLiquid',
        author: manifest.author,
        category: manifest.category,
        kind: manifest.kind,
        trustLevel: manifest.trustLevel,
        determinism: manifest.determinismMode,
        manifestJson: JSON.stringify(manifest),
        icon: manifest.icon ?? '📦',
        tagsJson: JSON.stringify(manifest.tags ?? []),
        status: 'PUBLISHED',
        qualityScore: 70 + Math.floor(Math.random() * 25),
        performanceScore: 70 + Math.floor(Math.random() * 25),
        innovationScore: 50 + Math.floor(Math.random() * 40),
        adoptionScore: Math.floor(Math.random() * 30) + 10,
        installCount: Math.floor(Math.random() * 100) + 10,
        rating: 4 + Math.random(),
        ratingCount: Math.floor(Math.random() * 50) + 5,
      },
    });
    count++;
  }

  return count;
}

/**
 * Publish a new extension (future: creator-uploaded extensions).
 */
export async function publishExtension(params: {
  id: string;
  slug: string;
  name: string;
  description: string;
  creatorId: string;
  creatorName: string;
  category: string;
  kind: string;
  manifestJson: string;
  icon?: string;
  tags?: string[];
  priceXof?: number;
  royaltyBps?: number;
}): Promise<{ extensionId: string; error?: string }> {
  const existing = await db.extensionRecord.findUnique({ where: { id: params.id } });
  if (existing) return { extensionId: '', error: 'Extension ID already exists' };

  const ext = await db.extensionRecord.create({
    data: {
      id: params.id,
      slug: params.slug,
      name: params.name,
      description: params.description,
      creatorId: params.creatorId,
      creatorName: params.creatorName,
      author: params.creatorName,
      category: params.category,
      kind: params.kind,
      trustLevel: 'native',
      determinism: 'deterministic',
      manifestJson: params.manifestJson,
      icon: params.icon ?? '📦',
      tagsJson: JSON.stringify(params.tags ?? []),
      priceXof: params.priceXof ?? 0,
      royaltyBps: params.royaltyBps ?? 0,
      status: 'PUBLISHED',
    },
  });

  return { extensionId: ext.id };
}

// ─── Marketplace ───────────────────────────────────────────────────────────

export async function getExtensionFeed(): Promise<{
  trending: any[];
  newest: any[];
  topRated: any[];
  mostInstalled: any[];
}> {
  const [trending, newest, topRated, mostInstalled] = await Promise.all([
    db.extensionRecord.findMany({ where: { status: 'PUBLISHED' }, orderBy: { adoptionScore: 'desc' }, take: 6 }),
    db.extensionRecord.findMany({ where: { status: 'PUBLISHED' }, orderBy: { createdAt: 'desc' }, take: 6 }),
    db.extensionRecord.findMany({ where: { status: 'PUBLISHED' }, orderBy: { rating: 'desc' }, take: 6 }),
    db.extensionRecord.findMany({ where: { status: 'PUBLISHED' }, orderBy: { installCount: 'desc' }, take: 6 }),
  ]);

  return {
    trending: trending.map(toDTO),
    newest: newest.map(toDTO),
    topRated: topRated.map(toDTO),
    mostInstalled: mostInstalled.map(toDTO),
  };
}

export async function getExtensions(params?: {
  category?: string;
  sort?: 'trending' | 'newest' | 'rated' | 'installed';
  limit?: number;
}): Promise<any[]> {
  const where: any = { status: 'PUBLISHED' };
  if (params?.category) where.category = params.category;

  let orderBy: any = { installCount: 'desc' };
  if (params?.sort === 'newest') orderBy = { createdAt: 'desc' };
  else if (params?.sort === 'rated') orderBy = { rating: 'desc' };
  else if (params?.sort === 'installed') orderBy = { installCount: 'desc' };
  else if (params?.sort === 'trending') orderBy = { adoptionScore: 'desc' };

  const extensions = await db.extensionRecord.findMany({
    where,
    orderBy,
    take: params?.limit ?? 20,
  });

  return extensions.map(toDTO);
}

export async function getExtension(id: string): Promise<any | null> {
  const ext = await db.extensionRecord.findUnique({ where: { id } });
  if (!ext) return null;

  const dto = toDTO(ext);

  // Get experiences using this extension
  const installations = await db.extensionInstallationRecord.findMany({
    where: { extensionId: id },
    take: 10,
  });
  dto.usedBy = installations.map((i) => ({
    experienceId: i.experienceId,
    experienceName: i.experienceName,
    installedAt: i.installedAt.getTime(),
  }));

  return dto;
}

// ─── Installation ──────────────────────────────────────────────────────────

/**
 * Record that an experience uses an extension.
 * Called when a bundle is published or an extension is installed.
 */
export async function recordInstallation(params: {
  extensionId: string;
  experienceId: string;
  experienceName: string;
  installedBy: string;
}): Promise<void> {
  await db.extensionInstallationRecord.upsert({
    where: {
      extensionId_experienceId: {
        extensionId: params.extensionId,
        experienceId: params.experienceId,
      },
    },
    create: {
      extensionId: params.extensionId,
      experienceId: params.experienceId,
      experienceName: params.experienceName,
      installedBy: params.installedBy,
    },
    update: {},
  });

  // Increment install count
  await db.extensionRecord.update({
    where: { id: params.extensionId },
    data: {
      installCount: { increment: 1 },
      adoptionScore: { increment: 1 },
    },
  });
}

/**
 * Get all extensions used by an experience (the extension graph).
 */
export async function getExperienceExtensions(experienceId: string): Promise<any[]> {
  const installations = await db.extensionInstallationRecord.findMany({
    where: { experienceId },
    include: { extension: true },
  });

  return installations.map((i) => ({
    extensionId: i.extensionId,
    name: i.extension.name,
    description: i.extension.description,
    icon: i.extension.icon,
    category: i.extension.category,
    version: i.installedVersion,
    creatorName: i.extension.creatorName,
    rating: i.extension.rating,
    installCount: i.extension.installCount,
    royaltyBps: i.extension.royaltyBps,
  }));
}

/**
 * Get "used together" recommendations.
 * If you install extension X, what else do games using X typically use?
 */
export async function getUsedTogether(extensionId: string, limit = 5): Promise<any[]> {
  // Find all experiences that use this extension
  const installations = await db.extensionInstallationRecord.findMany({
    where: { extensionId },
    select: { experienceId: true },
  });

  if (installations.length === 0) return [];

  const experienceIds = installations.map((i) => i.experienceId);

  // Find other extensions installed in those experiences
  const otherInstallations = await db.extensionInstallationRecord.findMany({
    where: {
      experienceId: { in: experienceIds },
      extensionId: { not: extensionId },
    },
    include: { extension: true },
  });

  // Count by extension
  const counts: Record<string, { count: number; extension: any }> = {};
  for (const inst of otherInstallations) {
    if (!counts[inst.extensionId]) {
      counts[inst.extensionId] = { count: 0, extension: inst.extension };
    }
    counts[inst.extensionId].count++;
  }

  // Sort by count and return top N
  return Object.entries(counts)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, limit)
    .map(([id, { count, extension }]) => ({
      extensionId: id,
      name: extension.name,
      icon: extension.icon,
      category: extension.category,
      coOccurrence: count,
      coOccurrencePercent: Math.round((count / installations.length) * 100),
    }));
}

// ─── Analytics ─────────────────────────────────────────────────────────────

export async function getExtensionAnalytics(creatorId: string): Promise<{
  totalExtensions: number;
  totalInstalls: number;
  totalRevenueXof: number;
  totalRoyaltyXof: number;
  topExtensions: any[];
}> {
  const extensions = await db.extensionRecord.findMany({
    where: { creatorId },
    orderBy: { totalRevenueXof: 'desc' },
  });

  const totalInstalls = extensions.reduce((s, e) => s + e.installCount, 0);
  const totalRevenueXof = extensions.reduce((s, e) => s + e.totalRevenueXof, 0);

  // Calculate royalty earned (sum of royalty distributions)
  const royaltyRecords = await db.extensionRoyaltyDistributionRecord.findMany({
    where: { extensionCreatorId: creatorId },
  });
  const totalRoyaltyXof = royaltyRecords.reduce((s, r) => s + r.extensionRoyaltyXof, 0);

  return {
    totalExtensions: extensions.length,
    totalInstalls,
    totalRevenueXof,
    totalRoyaltyXof,
    topExtensions: extensions.slice(0, 10).map((e) => ({
      id: e.id,
      name: e.name,
      icon: e.icon,
      category: e.category,
      installCount: e.installCount,
      rating: e.rating,
      totalRevenueXof: e.totalRevenueXof,
      royaltyBps: e.royaltyBps,
    })),
  };
}

// ─── Reputation ────────────────────────────────────────────────────────────

export async function updateExtensionReputation(extensionId: string): Promise<void> {
  const ext = await db.extensionRecord.findUnique({ where: { id: extensionId } });
  if (!ext) return;

  // Adoption score based on install count
  const adoptionScore = Math.min(100, ext.installCount * 2);

  // Quality from rating
  const qualityScore = Math.min(100, Math.round(ext.rating * 20));

  await db.extensionRecord.update({
    where: { id: extensionId },
    data: { adoptionScore, qualityScore },
  });
}

// ─── Helper ────────────────────────────────────────────────────────────────

function toDTO(e: any): any {
  return {
    id: e.id,
    slug: e.slug,
    name: e.name,
    description: e.description,
    creatorId: e.creatorId,
    creatorName: e.creatorName,
    category: e.category,
    kind: e.kind,
    trustLevel: e.trustLevel,
    version: e.version,
    icon: e.icon,
    tags: JSON.parse(e.tagsJson),
    priceXof: e.priceXof,
    royaltyBps: e.royaltyBps,
    qualityScore: e.qualityScore,
    performanceScore: e.performanceScore,
    innovationScore: e.innovationScore,
    fairnessScore: e.fairnessScore,
    adoptionScore: e.adoptionScore,
    installCount: e.installCount,
    forkCount: e.forkCount,
    rating: e.rating,
    ratingCount: e.ratingCount,
    totalRevenueXof: e.totalRevenueXof,
    status: e.status,
    createdAt: e.createdAt.getTime(),
  };
}
