/**
 * Studio Experience Service
 * --------------------------
 * Handles draft persistence, publish (compile + genome + persist), and fork.
 * This is the bridge between the Studio UI and the kernel.
 */

import { db } from '@/lib/db';
import { compileBundle } from '@/kernel/compiler';
import { resolveExtension, listExtensions } from '@/kernel/extensions';
import { telemetryService } from '@/lib/telemetry-store';
import type {
  ExperienceBundle,
  ExperienceIntent,
  ExperienceGenome,
  PublishedExperience,
} from '@/kernel/types';

// ─── Demo Creator ──────────────────────────────────────────────────────────

const DEMO_CREATOR_ID = 'creator_demo';
const DEMO_CREATOR_HANDLE = 'playliquid-studio';

export async function ensureDemoCreator() {
  const existing = await db.creatorRecord.findUnique({ where: { handle: DEMO_CREATOR_HANDLE } });
  if (existing) return existing;
  return db.creatorRecord.create({
    data: {
      id: DEMO_CREATOR_ID,
      handle: DEMO_CREATOR_HANDLE,
      displayName: 'Studio Demo Creator',
      bio: 'Creating experiences with PlayLiquid Studio v0.1',
      totalLiquid: 0,
      playerHours: 0,
    },
  });
}

// ─── Draft Management ──────────────────────────────────────────────────────

export interface DraftExperience {
  id: string;
  title: string;
  description: string;
  bundle: ExperienceBundle;
  intent: ExperienceIntent;
  parentExperienceId?: string;
  createdAt: number;
  updatedAt: number;
}

// Drafts are stored in-memory (global to survive hot-reload)
const globalForDrafts = globalThis as unknown as { __playliquidDrafts?: Map<string, DraftExperience> };
const drafts: Map<string, DraftExperience> = globalForDrafts.__playliquidDrafts ?? new Map();
globalForDrafts.__playliquidDrafts = drafts;

export function createDraft(params: {
  title: string;
  description: string;
  bundle: ExperienceBundle;
  intent: ExperienceIntent;
  parentExperienceId?: string;
}): DraftExperience {
  const id = `draft_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  const draft: DraftExperience = {
    id,
    title: params.title,
    description: params.description,
    bundle: params.bundle,
    intent: params.intent,
    parentExperienceId: params.parentExperienceId,
    createdAt: now,
    updatedAt: now,
  };
  drafts.set(id, draft);
  return draft;
}

export function getDraft(id: string): DraftExperience | undefined {
  return drafts.get(id);
}

export function updateDraft(id: string, updates: Partial<Pick<DraftExperience, 'title' | 'description' | 'bundle' | 'intent'>>): DraftExperience | undefined {
  const draft = drafts.get(id);
  if (!draft) return undefined;
  Object.assign(draft, updates, { updatedAt: Date.now() });
  return draft;
}

export function listDrafts(): DraftExperience[] {
  return Array.from(drafts.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function deleteDraft(id: string): boolean {
  return drafts.delete(id);
}

// ─── Publish ───────────────────────────────────────────────────────────────

export async function publishDraft(draftId: string): Promise<{ experience: PublishedExperience; errors: string[] }> {
  const draft = drafts.get(draftId);
  if (!draft) {
    return { experience: null as any, errors: ['Draft not found'] };
  }

  // Compile the bundle through the kernel
  const graph = compileBundle(draft.bundle, resolveExtension);
  if (!graph.valid) {
    return { experience: null as any, errors: graph.errors.map((e) => `[${e.code}] ${e.message}`) };
  }

  // Compute genome
  await ensureDemoCreator();
  const genome = telemetryService.computeGenome(draft.title.toLowerCase().replace(/\s+/g, '-'), graph);
  await telemetryService.persistGenome(genome).catch(() => {});

  // Persist bundle (reuse kernel's persistBundle logic via session-registry)
  // We store the bundle hash on the experience
  const slug = draft.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'experience';

  // Create the published experience record
  const record = await db.experienceRecord.create({
    data: {
      slug: `${slug}-${Date.now().toString(36).slice(-4)}`,
      title: draft.title,
      description: draft.description,
      creatorId: DEMO_CREATOR_ID,
      bundleHash: graph.contentHash,
      parentExperienceId: draft.parentExperienceId,
      intentJson: JSON.stringify(draft.intent),
      genomeJson: JSON.stringify(genome),
      status: 'PUBLISHED',
      publishedAt: new Date(),
    },
  });

  // If this is a fork, increment the parent's forkCount
  if (draft.parentExperienceId) {
    await db.experienceRecord.update({
      where: { id: draft.parentExperienceId },
      data: { forkCount: { increment: 1 } },
    }).catch(() => {});
  }

  const experience: PublishedExperience = {
    id: record.id,
    slug: record.slug,
    title: record.title,
    description: record.description,
    creatorId: record.creatorId,
    creatorName: 'Studio Demo Creator',
    bundleHash: record.bundleHash ?? '',
    parentExperienceId: record.parentExperienceId ?? undefined,
    intent: draft.intent,
    genome,
    status: 'PUBLISHED',
    playCount: 0,
    forkCount: 0,
    likeCount: 0,
    createdAt: record.createdAt.getTime(),
    publishedAt: record.publishedAt?.getTime(),
  };

  // Remove the draft
  drafts.delete(draftId);

  return { experience, errors: [] };
}

// ─── Fork ──────────────────────────────────────────────────────────────────

export async function forkExperience(experienceId: string): Promise<{ draft: DraftExperience | null; error?: string }> {
  const original = await db.experienceRecord.findUnique({
    where: { id: experienceId },
    include: { creator: true },
  });
  if (!original) {
    return { draft: null, error: 'Experience not found' };
  }

  // Fetch the original bundle from the bundle record
  const bundleRecord = original.bundleHash
    ? await db.bundleRecord.findUnique({ where: { contentHash: original.bundleHash } })
    : null;
  const bundle: ExperienceBundle | null = bundleRecord
    ? JSON.parse(bundleRecord.bundleJson)
    : null;

  if (!bundle) {
    return { draft: null, error: 'Original bundle not found' };
  }

  const originalIntent: ExperienceIntent = JSON.parse(original.intentJson);

  const draft = createDraft({
    title: `${original.title} (Fork)`,
    description: original.description,
    bundle,
    intent: originalIntent,
    parentExperienceId: original.id,
  });

  return { draft };
}

// ─── List / Get Published Experiences ──────────────────────────────────────

export async function listExperiences(limit = 50): Promise<PublishedExperience[]> {
  await ensureDemoCreator();
  const records = await db.experienceRecord.findMany({
    where: { status: 'PUBLISHED' },
    include: { creator: true },
    orderBy: { publishedAt: 'desc' },
    take: limit,
  });
  return records.map(toPublished);
}

export async function getExperience(id: string): Promise<PublishedExperience | null> {
  const record = await db.experienceRecord.findUnique({
    where: { id },
    include: { creator: true, forks: true },
  });
  if (!record) return null;
  return toPublished(record);
}

export async function getExperienceBundle(experienceId: string): Promise<ExperienceBundle | null> {
  const exp = await db.experienceRecord.findUnique({ where: { id: experienceId } });
  if (!exp?.bundleHash) return null;
  const bundleRecord = await db.bundleRecord.findUnique({ where: { contentHash: exp.bundleHash } });
  if (!bundleRecord) return null;
  return JSON.parse(bundleRecord.bundleJson);
}

// ─── Creator Profile ───────────────────────────────────────────────────────

export interface CreatorProfile {
  id: string;
  handle: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  followers: number;
  totalLiquid: number;
  playerHours: number;
  experienceCount: number;
  extensionCount: number;
  forkCount: number;
  createdAt: number;
}

export async function getCreatorProfile(creatorId: string): Promise<CreatorProfile | null> {
  const creator = await db.creatorRecord.findUnique({
    where: { id: creatorId },
    include: { experiences: true },
  });
  if (!creator) return null;

  const publishedExps = creator.experiences.filter((e) => e.status === 'PUBLISHED');
  const forkCount = creator.experiences.filter((e) => e.parentExperienceId).length;

  return {
    id: creator.id,
    handle: creator.handle,
    displayName: creator.displayName,
    bio: creator.bio ?? '',
    avatarUrl: creator.avatarUrl ?? '',
    followers: creator.followers,
    totalLiquid: creator.totalLiquid,
    playerHours: creator.playerHours,
    experienceCount: publishedExps.length,
    extensionCount: listExtensions().filter((e) => e.manifest.author === creator.handle).length,
    forkCount,
    createdAt: creator.createdAt.getTime(),
  };
}

export async function getCreatorByHandle(handle: string): Promise<CreatorProfile | null> {
  const creator = await db.creatorRecord.findUnique({
    where: { handle },
    include: { experiences: true },
  });
  if (!creator) return null;
  return getCreatorProfile(creator.id);
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function toPublished(record: any): PublishedExperience {
  return {
    id: record.id,
    slug: record.slug,
    title: record.title,
    description: record.description,
    creatorId: record.creatorId,
    creatorName: record.creator?.displayName ?? 'Unknown',
    bundleHash: record.bundleHash ?? '',
    parentExperienceId: record.parentExperienceId ?? undefined,
    intent: JSON.parse(record.intentJson),
    genome: record.genomeJson ? JSON.parse(record.genomeJson) : null,
    status: record.status,
    playCount: record.playCount,
    forkCount: record.forkCount,
    likeCount: record.likeCount,
    createdAt: record.createdAt.getTime(),
    publishedAt: record.publishedAt?.getTime(),
  };
}
