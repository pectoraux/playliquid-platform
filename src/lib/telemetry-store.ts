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
        compositionDepth: genome.compositionDepth,
        hasEconomy: genome.hasEconomy,
        hasAI: genome.hasAI,
        tokenCount: genome.tokenCount,
        mechanicsJson: JSON.stringify({
          mechanics: genome.mechanics,
          complexityScore: genome.complexityScore,
          noveltyScore: genome.noveltyScore,
          economyScore: genome.economyScore,
          socialScore: genome.socialScore,
          emotionScore: genome.emotionScore,
          retentionPrediction: genome.retentionPrediction,
          extensionDNA: genome.extensionDNA,
          tokenDNA: genome.tokenDNA,
          interactionDNA: genome.interactionDNA,
        }),
      },
      update: {},
    });
  },

  async listGenomes(limit = 100) {
    const rows = await db.experienceGenomeRecord.findMany({
      orderBy: { computedAt: 'desc' },
      take: limit,
    });
    return rows.map((r) => {
      const v2 = r.mechanicsJson ? JSON.parse(r.mechanicsJson) : {};
      return {
        experienceId: r.experienceId,
        bundleHash: r.bundleHash || undefined,
        extensions: JSON.parse(r.extensionsJson),
        categories: JSON.parse(r.categoriesJson),
        mechanics: v2.mechanics ?? JSON.parse(r.mechanicsJson),
        compositionDepth: r.compositionDepth,
        hasEconomy: r.hasEconomy,
        hasAI: r.hasAI,
        tokenCount: r.tokenCount,
        computedAt: r.computedAt.getTime(),
        complexityScore: v2.complexityScore ?? 0,
        noveltyScore: v2.noveltyScore ?? 0,
        economyScore: v2.economyScore ?? 0,
        socialScore: v2.socialScore ?? 0,
        emotionScore: v2.emotionScore ?? 0,
        retentionPrediction: v2.retentionPrediction ?? 0,
        extensionDNA: v2.extensionDNA ?? [],
        tokenDNA: v2.tokenDNA ?? [],
        interactionDNA: v2.interactionDNA ?? [],
      };
    });
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
