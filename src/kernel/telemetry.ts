/**
 * Telemetry + Genome
 * -------------------
 * Every session emits an ExperienceEvent capturing play telemetry. The genome
 * is derived from the bundle (extensions, categories, composition depth) and
 * becomes the substrate for the future AI Evolution Engine.
 *
 * In v0.1 we collect data and compute genomes. We do NOT yet run evolution.
 */

import type {
  CompiledGraph,
  ExperienceEvent,
  ExperienceGenome,
  ExtensionCategory,
  RuntimeEvent,
} from './types';

export interface TelemetryRepo {
  recordEvent(evt: Omit<ExperienceEvent, 'id' | 'createdAt'>): Promise<ExperienceEvent>;
  listEvents(limit?: number): Promise<ExperienceEvent[]>;
  recordGenome(genome: ExperienceGenome): Promise<void>;
  listGenomes(limit?: number): Promise<ExperienceGenome[]>;
}

export class TelemetryService {
  constructor(private repo: TelemetryRepo) {}

  /**
   * Summarize a runtime session into an ExperienceEvent.
   */
  async recordSession(params: {
    experienceId: string;
    sessionId: string;
    bundleHash?: string;
    tickCount: number;
    sessionDurationMs: number;
    actionCount: number;
    completion: boolean;
    score?: number;
    tokenEmits: RuntimeEvent[];
    tokenConsumes: RuntimeEvent[];
    extensions: string[];
  }): Promise<ExperienceEvent> {
    const tokensEmitted: Record<string, number> = {};
    for (const e of params.tokenEmits) {
      if (e.kind === 'token-emit') {
        tokensEmitted[e.symbol] = (tokensEmitted[e.symbol] ?? 0) + e.amount;
      }
    }
    const tokensConsumed: Record<string, number> = {};
    for (const e of params.tokenConsumes) {
      if (e.kind === 'token-consume') {
        tokensConsumed[e.symbol] = (tokensConsumed[e.symbol] ?? 0) + e.amount;
      }
    }
    return this.repo.recordEvent({
      experienceId: params.experienceId,
      sessionId: params.sessionId,
      bundleHash: params.bundleHash,
      tickCount: params.tickCount,
      sessionDurationMs: params.sessionDurationMs,
      actions: params.actionCount,
      completion: params.completion,
      score: params.score,
      tokensEmitted,
      tokensConsumed,
      extensions: params.extensions,
    });
  }

  /**
   * Compute the genome of a compiled graph.
   */
  computeGenome(experienceId: string, graph: CompiledGraph): ExperienceGenome {
    const categories: Record<ExtensionCategory, number> = {
      MECHANIC: 0,
      ECONOMY: 0,
      AI: 0,
      SOCIAL: 0,
      RENDER: 0,
      PHYSICS: 0,
    };

    const extensions: string[] = [];
    const mechanics: string[] = [];

    for (const { manifest } of Object.values(graph.instances)) {
      extensions.push(manifest.id);
      categories[manifest.category] += 1;
      if (manifest.category === 'MECHANIC' || manifest.category === 'PHYSICS') {
        mechanics.push(manifest.slug);
      }
    }

    // Composition depth = longest path in the dependency graph
    const depth = computeDepth(graph);

    const hasEconomy = categories.ECONOMY > 0;
    const hasAI = categories.AI > 0;
    const tokenCount = graph.declaredTokens.length;

    // ── Genome v2 scores ─────────────────────────────────────────────
    const instanceCount = Object.keys(graph.instances).length;
    const wireCount = Object.values(graph.inputSources)
      .reduce((sum, sources) => sum + Object.values(sources).reduce((s, w) => s + w.length, 0), 0);

    // Complexity: depth + instance count + wire density
    const complexityScore = Math.min(100, Math.round(
      depth * 12 + instanceCount * 8 + wireCount * 5
    ));

    // Novelty: how many distinct categories + unique token combinations
    const distinctCats = Object.values(categories).filter((c) => c > 0).length;
    const noveltyScore = Math.min(100, Math.round(
      distinctCats * 15 + tokenCount * 10 + (hasAI ? 15 : 0)
    ));

    // Economy: token count + economy extension density + liquid backing
    const economyExtensions = categories.ECONOMY;
    const backedTokens = graph.declaredTokens.filter((t) => t.liquidBackingMicro).length;
    const economyScore = Math.min(100, Math.round(
      economyExtensions * 20 + tokenCount * 10 + backedTokens * 15
    ));

    // Social: social extensions + competition presence
    const socialScore = Math.min(100, Math.round(
      categories.SOCIAL * 30 + (extensions.some((e) => e.includes('competition')) ? 25 : 0)
    ));

    // Emotion: derived from intent — we don't have intent here, so use category signals
    const emotionSignals = (categories.MECHANIC > 0 ? 1 : 0) + (categories.ECONOMY > 0 ? 1 : 0) +
      (categories.SOCIAL > 0 ? 1 : 0) + (categories.AI > 0 ? 1 : 0) + (categories.RENDER > 0 ? 1 : 0);
    const emotionScore = Math.min(100, emotionSignals * 20);

    // Retention prediction: heuristic — economy + social + moderate complexity
    const retentionPrediction = Math.min(100, Math.round(
      economyScore * 0.3 + socialScore * 0.25 + (complexityScore < 80 ? 20 : 10) + (hasAI ? 10 : 0) + 15
    ));

    // DNA arrays (ordered fingerprints)
    const extensionDNA = Object.values(graph.instances)
      .map(({ manifest }) => manifest.slug)
      .sort();
    const tokenDNA = graph.declaredTokens.map((t) => t.symbol).sort();
    const interactionDNA = Object.entries(graph.inputSources)
      .flatMap(([target, sources]) =>
        Object.entries(sources).flatMap(([channel, wires]) =>
          wires.map((w) => `${w.from.instance}.${w.from.channel}->${target}.${channel}`)
        )
      )
      .sort();

    const genome: ExperienceGenome = {
      experienceId,
      bundleHash: graph.contentHash,
      extensions,
      categories,
      mechanics,
      compositionDepth: depth,
      hasEconomy,
      hasAI,
      tokenCount,
      computedAt: Date.now(),
      complexityScore,
      noveltyScore,
      economyScore,
      socialScore,
      emotionScore,
      retentionPrediction,
      extensionDNA,
      tokenDNA,
      interactionDNA,
    };

    return genome;
  }

  async persistGenome(genome: ExperienceGenome): Promise<void> {
    await this.repo.recordGenome(genome);
  }

  async listEvents(limit?: number): Promise<ExperienceEvent[]> {
    return this.repo.listEvents(limit);
  }

  async listGenomes(limit?: number): Promise<ExperienceGenome[]> {
    return this.repo.listGenomes(limit);
  }
}

function computeDepth(graph: CompiledGraph): number {
  // Longest path in DAG (number of nodes in the longest chain)
  const memo: Record<string, number> = {};
  const deps: Record<string, string[]> = {};

  for (const id of Object.keys(graph.instances)) deps[id] = [];
  for (const [targetId, sources] of Object.entries(graph.inputSources)) {
    for (const wires of Object.values(sources)) {
      for (const w of wires) {
        if (!deps[targetId].includes(w.from.instance)) {
          deps[targetId].push(w.from.instance);
        }
      }
    }
  }

  function depthOf(id: string): number {
    if (memo[id]) return memo[id];
    if (deps[id].length === 0) return (memo[id] = 1);
    let max = 0;
    for (const d of deps[id]) max = Math.max(max, depthOf(d));
    return (memo[id] = max + 1);
  }

  let max = 0;
  for (const id of Object.keys(graph.instances)) max = Math.max(max, depthOf(id));
  return max;
}
