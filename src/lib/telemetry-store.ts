/**
 * Prisma-backed Telemetry Repository + Service factory
 * -----------------------------------------------------
 */

import { db } from '@/lib/db';
import type { ExperienceEvent, ExperienceGenome } from '@/kernel/types';
import type { TelemetryRepo } from '@/kernel/telemetry';
import { TelemetryService } from '@/kernel/telemetry';

export const prismaTelemetryRepo: TelemetryRepo = {
  async recordEvent(evt) {
    const row = await db.experienceEventRecord.create({
      data: {
        experienceId: evt.experienceId,
        sessionId: evt.sessionId,
        bundleHash: evt.bundleHash,
        tickCount: evt.tickCount,
        sessionDurationMs: evt.sessionDurationMs,
        actions: evt.actions,
        completion: evt.completion,
        score: evt.score,
        tokensEmittedJson: JSON.stringify(evt.tokensEmitted),
        tokensConsumedJson: JSON.stringify(evt.tokensConsumed),
        extensionsJson: JSON.stringify(evt.extensions),
      },
    });
    return toEvent(row);
  },

  async listEvents(limit = 100) {
    const rows = await db.experienceEventRecord.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map(toEvent);
  },

  async recordGenome(genome) {
    await db.experienceGenomeRecord.upsert({
      where: { bundleHash: genome.bundleHash ?? '' },
      create: {
        experienceId: genome.experienceId,
        bundleHash: genome.bundleHash ?? '',
        extensionsJson: JSON.stringify(genome.extensions),
        categoriesJson: JSON.stringify(genome.categories),
        mechanicsJson: JSON.stringify(genome.mechanics),
        compositionDepth: genome.compositionDepth,
        hasEconomy: genome.hasEconomy,
        hasAI: genome.hasAI,
        tokenCount: genome.tokenCount,
      },
      update: {},
    });
  },

  async listGenomes(limit = 100) {
    const rows = await db.experienceGenomeRecord.findMany({
      orderBy: { computedAt: 'desc' },
      take: limit,
    });
    return rows.map((r) => ({
      experienceId: r.experienceId,
      bundleHash: r.bundleHash || undefined,
      extensions: JSON.parse(r.extensionsJson),
      categories: JSON.parse(r.categoriesJson),
      mechanics: JSON.parse(r.mechanicsJson),
      compositionDepth: r.compositionDepth,
      hasEconomy: r.hasEconomy,
      hasAI: r.hasAI,
      tokenCount: r.tokenCount,
      computedAt: r.computedAt.getTime(),
    }));
  },
};

function toEvent(row: {
  id: string;
  experienceId: string;
  sessionId: string;
  bundleHash: string | null;
  tickCount: number;
  sessionDurationMs: number;
  actions: number;
  completion: boolean;
  score: number | null;
  tokensEmittedJson: string;
  tokensConsumedJson: string;
  extensionsJson: string;
  createdAt: Date;
}): ExperienceEvent {
  return {
    id: row.id,
    experienceId: row.experienceId,
    sessionId: row.sessionId,
    bundleHash: row.bundleHash ?? undefined,
    tickCount: row.tickCount,
    sessionDurationMs: row.sessionDurationMs,
    actions: row.actions,
    completion: row.completion,
    score: row.score ?? undefined,
    tokensEmitted: JSON.parse(row.tokensEmittedJson),
    tokensConsumed: JSON.parse(row.tokensConsumedJson),
    extensions: JSON.parse(row.extensionsJson),
    createdAt: row.createdAt.getTime(),
  };
}

export const telemetryService = new TelemetryService(prismaTelemetryRepo);
