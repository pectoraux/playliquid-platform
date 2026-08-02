/**
 * Phase 18 — Consumer Alignment Service
 * --------------------------------------
 * YouTube-style home with Sparks feed, Experiences, Live, Highlights.
 * Replay graph with timeline events.
 * Spark presentation config.
 */

import { db } from '@/lib/db';
import { getExperienceExtensions } from '@/lib/extensions/extension-service';

// ─── YouTube Home ──────────────────────────────────────────────────────────

export interface YouTubeHome {
  sparks: any[];
  experiences: any[];
  live: any[];
  highlights: any[];
}

export async function getYouTubeHome(userId: string): Promise<YouTubeHome> {
  const [sparks, experiences, live, highlights] = await Promise.all([
    getSparks(6),
    getExperiencesForHome(8),
    getLiveStreams(5),
    getHighlightsForHome(6),
  ]);

  return { sparks, experiences, live, highlights };
}

export async function getSparks(limit: number): Promise<any[]> {
  // Experiences with format='spark' (or fallback to any if none tagged yet)
  let sparks = await db.experienceRecord.findMany({
    where: { status: 'PUBLISHED', format: 'spark' },
    orderBy: { playCount: 'desc' },
    take: limit,
    include: { creator: true },
  });

  // Fallback: if no sparks tagged, use regular experiences as sparks
  if (sparks.length === 0) {
    sparks = await db.experienceRecord.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { playCount: 'desc' },
      take: limit,
      include: { creator: true },
    });
  }

  return Promise.all(sparks.map(async (exp) => {
    const extensions = await getExperienceExtensions(exp.id).catch(() => []);
    return {
      experienceId: exp.id,
      title: exp.title,
      creatorName: exp.creator?.displayName ?? 'Unknown',
      creatorId: exp.creatorId,
      playCount: exp.playCount,
      format: exp.format,
      extensions: extensions.slice(0, 3).map((e: any) => ({ icon: e.icon, name: e.name })),
    };
  }));
}

async function getExperiencesForHome(limit: number): Promise<any[]> {
  const exps = await db.experienceRecord.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { playCount: 'desc' },
    take: limit,
    include: { creator: true },
  });

  return Promise.all(exps.map(async (exp) => {
    const extensions = await getExperienceExtensions(exp.id).catch(() => []);
    return {
      experienceId: exp.id,
      title: exp.title,
      description: exp.description.slice(0, 100),
      creatorName: exp.creator?.displayName ?? 'Unknown',
      creatorId: exp.creatorId,
      playCount: exp.playCount,
      forkCount: exp.forkCount,
      likeCount: exp.likeCount,
      format: exp.format,
      competitiveEligible: exp.competitiveEligible,
      extensions: extensions.slice(0, 5).map((e: any) => ({ icon: e.icon, name: e.name, category: e.category })),
    };
  }));
}

export async function getLiveStreams(limit: number): Promise<any[]> {
  const streams = await db.liveStreamRecord.findMany({
    where: { status: 'LIVE' },
    orderBy: { viewerCount: 'desc' },
    take: limit,
  });
  return streams.map((s) => ({
    id: s.id,
    experienceId: s.experienceId,
    experienceName: s.experienceName,
    playerName: s.playerName,
    viewerCount: s.viewerCount,
    startedAt: s.startedAt.getTime(),
  }));
}

export async function getHighlightsForHome(limit: number): Promise<any[]> {
  const highlights = await db.highlightRecord.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return highlights.map((h) => ({
    id: h.id,
    experienceId: h.experienceId,
    experienceName: h.experienceName,
    userId: h.userId,
    displayName: h.displayName,
    triggerType: h.triggerType,
    title: h.title,
    description: h.description,
    scoreAtHighlight: h.scoreAtHighlight,
    viewCount: h.viewCount,
    createdAt: h.createdAt.getTime(),
  }));
}

// ─── Experience Graph Transparency ─────────────────────────────────────────

export async function getExperienceGraph(experienceId: string): Promise<any[]> {
  return getExperienceExtensions(experienceId);
}

// ─── Replay Events ─────────────────────────────────────────────────────────

export async function getReplayEvents(replayId: string): Promise<any[]> {
  const events = await db.replayEventRecord.findMany({
    where: { replayId },
    orderBy: { timestamp: 'asc' },
  });
  return events.map((e) => ({
    id: e.id,
    timestamp: e.timestamp,
    eventType: e.eventType,
    extensionId: e.extensionId,
    description: e.description,
    scoreAtEvent: e.scoreAtEvent,
    metadata: JSON.parse(e.metadataJson),
  }));
}

export async function addReplayEvent(params: {
  replayId: string;
  timestamp: number;
  eventType: string;
  extensionId?: string;
  description: string;
  scoreAtEvent?: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await db.replayEventRecord.create({
    data: {
      replayId: params.replayId,
      timestamp: params.timestamp,
      eventType: params.eventType,
      extensionId: params.extensionId,
      description: params.description,
      scoreAtEvent: params.scoreAtEvent,
      metadataJson: JSON.stringify(params.metadata ?? {}),
    },
  });
}

// ─── Spark Presentation ────────────────────────────────────────────────────

export async function getSparkConfig(experienceId: string): Promise<any | null> {
  const config = await db.sparkPresentationConfigRecord.findUnique({
    where: { experienceId },
  });
  if (!config) return null;
  return {
    orientation: config.orientation,
    maxDurationSeconds: config.maxDurationSeconds,
    autoplay: config.autoplay,
    previewAsset: config.previewAsset,
    interactionMode: config.interactionMode,
  };
}

// ─── Live Stream ───────────────────────────────────────────────────────────

export async function goLive(params: {
  sessionId: string;
  experienceId: string;
  experienceName: string;
  playerId: string;
  playerName: string;
}): Promise<{ streamId: string }> {
  // End existing streams
  await db.liveStreamRecord.updateMany({
    where: { playerId: params.playerId, status: 'LIVE' },
    data: { status: 'ENDED', endedAt: new Date() },
  });

  const stream = await db.liveStreamRecord.create({
    data: {
      sessionId: params.sessionId,
      experienceId: params.experienceId,
      experienceName: params.experienceName,
      playerId: params.playerId,
      playerName: params.playerName,
      viewerCount: Math.floor(Math.random() * 50) + 1,
    },
  });
  return { streamId: stream.id };
}
