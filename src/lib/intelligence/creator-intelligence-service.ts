/**
 * Phase 21.3 — Creator Intelligence Score
 * ---------------------------------------
 * Unifies scattered creator signals into one score with 6 dimensions:
 *   - retentionQuality      (avg completion across published experiences)
 *   - evolutionVelocity     (mutations/month — how fast they iterate)
 *   - extensionAdoption     (diversity of extensions used)
 *   - fairness              (economy fairness + competitive balance)
 *   - communityHealth       (followers, feedback sentiment, engagement)
 *   - economicSustainability (revenue stability + prize pool health)
 *
 * Tier: emerging → growing → established → leading
 */

import { db } from '@/lib/db';
import { computeReputation } from '@/lib/universe/rating-service';
import type { CreatorIntelligence, CreatorTier } from './intelligence-types';

const MICRO = 1_000_000;
const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export async function computeCreatorIntelligence(creatorId: string): Promise<CreatorIntelligence | null> {
  const creator = await db.creatorRecord.findUnique({
    where: { id: creatorId },
    include: { experiences: true },
  });
  if (!creator) return null;

  const publishedExps = creator.experiences.filter((e) => e.status === 'PUBLISHED');
  if (publishedExps.length === 0) {
    return emptyIntelligence(creatorId, creator.displayName);
  }

  // Gather per-experience data
  let totalCompletion = 0;
  let totalReputation = 0;
  let totalFrustration = 0;
  let totalSessions = 0;
  let totalTokensEarned = 0;
  let totalTokensSpent = 0;
  const allExtensions = new Set<string>();
  let competitiveExps = 0;

  for (const exp of publishedExps) {
    const metrics = await db.experienceMetrics.findUnique({ where: { experienceId: exp.id } });
    const reputation = await computeReputation(exp.id);
    totalCompletion += metrics?.completionRate ?? 0;
    totalReputation += reputation.overallScore;
    totalFrustration += metrics?.frustrationEvents ?? 0;
    totalSessions += metrics?.totalSessions ?? exp.playCount;
    totalTokensEarned += metrics?.tokensEarned ?? 0;
    totalTokensSpent += metrics?.tokensSpent ?? 0;
    if (exp.competitiveEligible) competitiveExps++;

    const installations = await db.extensionInstallationRecord.findMany({
      where: { experienceId: exp.id },
      select: { extensionId: true },
    });
    for (const inst of installations) allExtensions.add(inst.extensionId);
  }

  const expCount = publishedExps.length;
  const avgCompletion = totalCompletion / expCount;
  const avgReputation = totalReputation / expCount;

  // ── Dimension 1: retentionQuality ──
  const retentionQuality = Math.round(Math.min(100, avgCompletion * 100));

  // ── Dimension 2: evolutionVelocity ──
  const oneMonthAgo = new Date(Date.now() - ONE_MONTH_MS);
  const recentMutations = await db.experienceMutationRecord.count({
    where: {
      experienceId: { in: publishedExps.map((e) => e.id) },
      createdAt: { gte: oneMonthAgo },
    },
  });
  const evolutionVelocity = Math.min(100, Math.round(recentMutations * 15 + expCount * 5));

  // ── Dimension 3: extensionAdoption ──
  const extensionAdoption = Math.min(100, Math.round(allExtensions.size * 12));

  // ── Dimension 4: fairness ──
  // Fair = low frustration relative to sessions + competitive balance
  const frustrationRate = totalSessions > 0 ? totalFrustration / totalSessions : 0;
  const fairnessBase = Math.max(0, 100 - frustrationRate * 100);
  const competitiveBalance = competitiveExps > 0 ? Math.min(20, competitiveExps * 5) : 10;
  const fairness = Math.round(Math.min(100, fairnessBase * 0.8 + competitiveBalance));

  // ── Dimension 5: communityHealth ──
  const feedbackCount = await db.experienceFeedbackRecord.count({
    where: { experienceId: { in: publishedExps.map((e) => e.id) } },
  });
  const positiveFeedback = await db.experienceFeedbackRecord.count({
    where: {
      experienceId: { in: publishedExps.map((e) => e.id) },
      type: 'FUN',
    },
  });
  const feedbackSentiment = feedbackCount > 0 ? positiveFeedback / feedbackCount : 0.5;
  const communityHealth = Math.min(100, Math.round(
    creator.followers * 2 + feedbackCount * 4 + feedbackSentiment * 30,
  ));

  // ── Dimension 6: economicSustainability ──
  const revenueRecords = await db.creatorRevenueRecord.findMany({ where: { creatorId } });
  const totalRevenueXof = revenueRecords.reduce((s, r) => s + r.amountXof, 0);
  const revenueLiquid = totalRevenueXof / MICRO;
  const revenueStability = Math.min(60, Math.round(revenueLiquid * 10));
  const prizePoolScore = Math.min(40, Math.round(competitiveExps * 8));
  const economicSustainability = revenueStability + prizePoolScore;

  // ── Overall (weighted) ──
  const overallIntelligence = Math.round(
    retentionQuality * 0.20 +
    evolutionVelocity * 0.15 +
    extensionAdoption * 0.15 +
    fairness * 0.15 +
    communityHealth * 0.15 +
    economicSustainability * 0.20,
  );

  const tier = deriveTier(overallIntelligence, expCount);

  const signals: string[] = [];
  if (retentionQuality >= 70) signals.push(`Strong retention (${retentionQuality}/100 avg completion)`);
  if (evolutionVelocity >= 50) signals.push(`Fast iterator (${recentMutations} mutations in 30d)`);
  if (extensionAdoption >= 50) signals.push(`Diverse toolkit (${allExtensions.size} extensions)`);
  if (fairness >= 70) signals.push(`Fair economy (low frustration)`);
  if (communityHealth >= 50) signals.push(`Engaged community (${creator.followers} followers, ${feedbackCount} feedback)`);
  if (economicSustainability >= 50) signals.push(`Sustainable revenue (${revenueLiquid.toFixed(1)}L earned)`);
  if (signals.length === 0) signals.push('Emerging creator — collecting first signals');

  const record = await db.creatorIntelligenceRecord.upsert({
    where: { creatorId },
    create: {
      creatorId,
      creatorName: creator.displayName,
      retentionQuality,
      evolutionVelocity,
      extensionAdoption,
      fairness,
      communityHealth,
      economicSustainability,
      overallIntelligence,
      tier,
      signalsJson: JSON.stringify(signals),
    },
    update: {
      creatorName: creator.displayName,
      retentionQuality,
      evolutionVelocity,
      extensionAdoption,
      fairness,
      communityHealth,
      economicSustainability,
      overallIntelligence,
      tier,
      signalsJson: JSON.stringify(signals),
      computedAt: new Date(),
    },
  });

  return rowToIntelligence(record);
}

export async function getCreatorIntelligence(creatorId: string): Promise<CreatorIntelligence | null> {
  const row = await db.creatorIntelligenceRecord.findUnique({ where: { creatorId } });
  if (!row) return computeCreatorIntelligence(creatorId);
  return rowToIntelligence(row);
}

export async function getCreatorIntelligenceLeaderboard(limit = 20): Promise<CreatorIntelligence[]> {
  const rows = await db.creatorIntelligenceRecord.findMany({
    orderBy: { overallIntelligence: 'desc' },
    take: limit,
  });
  return rows.map(rowToIntelligence);
}

/**
 * Recompute intelligence for all creators with published experiences.
 */
export async function recomputeAllCreatorIntelligence(): Promise<{ computed: number }> {
  const creators = await db.creatorRecord.findMany({
    where: { experiences: { some: { status: 'PUBLISHED' } } },
    select: { id: true },
  });
  let computed = 0;
  for (const c of creators) {
    await computeCreatorIntelligence(c.id);
    computed++;
  }
  return { computed };
}

// ─── helpers ───────────────────────────────────────────────────────────────

function deriveTier(overall: number, expCount: number): CreatorTier {
  if (overall >= 75 && expCount >= 3) return 'leading';
  if (overall >= 55 && expCount >= 2) return 'established';
  if (overall >= 30 || expCount >= 1) return 'growing';
  return 'emerging';
}

function emptyIntelligence(creatorId: string, name: string): CreatorIntelligence {
  return {
    creatorId,
    creatorName: name,
    retentionQuality: 0,
    evolutionVelocity: 0,
    extensionAdoption: 0,
    fairness: 50,
    communityHealth: 0,
    economicSustainability: 0,
    overallIntelligence: 0,
    tier: 'emerging',
    signals: ['No published experiences yet'],
    computedAt: Date.now(),
  };
}

function rowToIntelligence(row: any): CreatorIntelligence {
  return {
    creatorId: row.creatorId,
    creatorName: row.creatorName,
    retentionQuality: row.retentionQuality,
    evolutionVelocity: row.evolutionVelocity,
    extensionAdoption: row.extensionAdoption,
    fairness: row.fairness,
    communityHealth: row.communityHealth,
    economicSustainability: row.economicSustainability,
    overallIntelligence: row.overallIntelligence,
    tier: row.tier as CreatorTier,
    signals: JSON.parse(row.signalsJson),
    computedAt: row.computedAt instanceof Date ? row.computedAt.getTime() : new Date(row.computedAt).getTime(),
  };
}
