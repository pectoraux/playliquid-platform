/**
 * Phase 19 — Creator Operating System Service
 * -------------------------------------------
 * Transforms creators from "people who publish games" into
 * "operators of interactive businesses."
 */

import ZAI from 'z-ai-web-dev-sdk';
import { db } from '@/lib/db';
import { getExtensionAnalytics } from '@/lib/extensions/extension-service';

const MICRO = 1_000_000;

// ─── Overview ──────────────────────────────────────────────────────────────

export async function getCreatorOverview(creatorId: string): Promise<{
  channel: any;
  revenue: any;
  content: any[];
  insights: any[];
}> {
  const creator = await db.creatorRecord.findUnique({
    where: { id: creatorId },
    include: { experiences: true },
  });
  if (!creator) return { channel: null, revenue: null, content: [], insights: [] };

  const publishedExps = creator.experiences.filter((e) => e.status === 'PUBLISHED');
  let totalPlayers = 0;
  let totalPlayTimeMs = 0;

  for (const exp of publishedExps) {
    const metrics = await db.experienceMetrics.findUnique({ where: { experienceId: exp.id } });
    totalPlayers += metrics?.totalSessions ?? exp.playCount;
    totalPlayTimeMs += metrics?.totalPlayTimeMs ?? 0;
  }

  // Revenue from competitive sessions
  const revenueRecords = await db.creatorRevenueRecord.findMany({
    where: { creatorId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  const totalRevenueXof = revenueRecords.reduce((s, r) => s + r.amountXof, 0);

  // Extension royalties received
  const royaltyRecords = await db.extensionRoyaltyDistributionRecord.findMany({
    where: { extensionCreatorId: creatorId },
  });
  const totalRoyaltyXof = royaltyRecords.reduce((s, r) => s + r.extensionRoyaltyXof, 0);

  // Channel health
  const channel = {
    displayName: creator.displayName,
    handle: creator.handle,
    level: creator.creatorLevel,
    xp: creator.creatorXP,
    followers: creator.followers,
    totalPlayers,
    totalPlayTimeMs,
    totalLiquid: creator.totalLiquid,
    totalExperiences: publishedExps.length,
    totalRevenueXof,
    totalRevenueLiquid: totalRevenueXof / MICRO,
    totalRoyaltyXof,
    totalRoyaltyLiquid: totalRoyaltyXof / MICRO,
  };

  // Revenue breakdown by source
  const revenueBySource: Record<string, number> = {};
  for (const r of revenueRecords) {
    revenueBySource[r.source] = (revenueBySource[r.source] ?? 0) + r.amountXof;
  }
  const revenue = {
    totalXof: totalRevenueXof,
    totalLiquid: totalRevenueXof / MICRO,
    bySource: Object.entries(revenueBySource).map(([source, amount]) => ({
      source,
      amountLiquid: amount / MICRO,
      percent: totalRevenueXof > 0 ? Math.round((amount / totalRevenueXof) * 100) : 0,
    })),
    royaltyEarnedLiquid: totalRoyaltyXof / MICRO,
    recentRecords: revenueRecords.slice(0, 10).map((r) => ({
      source: r.source,
      amountLiquid: r.amountXof / MICRO,
      experienceName: r.experienceName,
      description: r.description,
      createdAt: r.createdAt.getTime(),
    })),
  };

  // Content
  const content = await Promise.all(publishedExps.map(async (exp) => {
    const metrics = await db.experienceMetrics.findUnique({ where: { experienceId: exp.id } });
    const extensions = await db.extensionInstallationRecord.findMany({
      where: { experienceId: exp.id },
      include: { extension: true },
    });
    return {
      experienceId: exp.id,
      title: exp.title,
      format: exp.format,
      type: exp.intentJson ? JSON.parse(exp.intentJson).kind : 'GAME',
      playCount: metrics?.totalSessions ?? exp.playCount,
      completionRate: metrics ? Math.round(metrics.completionRate * 100) : 0,
      reputationScore: 0, // would compute from rating
      revenueXof: 0, // would aggregate
      competitiveEligible: exp.competitiveEligible,
      pricePerMinuteXof: exp.pricePerMinuteXof,
      extensions: extensions.map((i) => ({
        icon: i.extension.icon,
        name: i.extension.name,
        category: i.extension.category,
        royaltyBps: i.extension.royaltyBps,
      })),
      publishedAt: exp.publishedAt?.getTime() ?? exp.createdAt.getTime(),
    };
  }));

  // AI insights
  const insights = await generateCreatorInsights(creatorId, channel, content);

  return { channel, revenue, content, insights };
}

// ─── AI Insights ───────────────────────────────────────────────────────────

async function generateCreatorInsights(creatorId: string, channel: any, content: any[]): Promise<any[]> {
  const insights: any[] = [];

  // Rule-based insights
  for (const exp of content) {
    if (exp.completionRate < 30 && exp.playCount > 5) {
      insights.push({
        category: 'retention',
        problem: `Low completion rate on "${exp.title}"`,
        evidence: `Only ${exp.completionRate}% of players complete the experience.`,
        recommendation: 'Use the AI Evolution Agent to analyze and improve early-game pacing.',
        expectedImpact: '+15-25% completion',
        severity: 'warning',
        reportType: 'daily',
      });
    }

    if (exp.playCount > 20 && exp.completionRate > 70) {
      insights.push({
        category: 'opportunity',
        problem: `"${exp.title}" has excellent retention`,
        evidence: `${exp.completionRate}% completion with ${exp.playCount} plays.`,
        recommendation: 'Enable competitive mode to monetize through purchased minutes.',
        expectedImpact: 'New revenue stream',
        severity: 'info',
        reportType: 'weekly',
      });
    }

    if (exp.competitiveEligible && exp.pricePerMinuteXof === 0) {
      insights.push({
        category: 'economy',
        problem: `"${exp.title}" is competitive but free`,
        evidence: 'Competitive eligible with 0 XOF per minute.',
        recommendation: 'Set a price per minute to generate revenue from competitive play.',
        expectedImpact: 'Direct revenue from competitive sessions',
        severity: 'suggestion',
        reportType: 'weekly',
      });
    }
  }

  if (channel.totalPlayers > 100 && channel.followers < 10) {
    insights.push({
      category: 'social',
      problem: 'Low follower conversion',
      evidence: `${channel.totalPlayers} players but only ${channel.followers} followers.`,
      recommendation: 'Post creator updates and engage with your community.',
      expectedImpact: '+20% follower conversion',
      severity: 'suggestion',
      reportType: 'weekly',
    });
  }

  if (insights.length === 0) {
    insights.push({
      category: 'opportunity',
      problem: 'Your channel is growing',
      evidence: `${channel.totalExperiences} experiences with ${channel.totalPlayers} total players.`,
      recommendation: 'Keep creating! Consider experimenting with different formats.',
      expectedImpact: 'Audience growth',
      severity: 'info',
      reportType: 'daily',
    });
  }

  // Try LLM enhancement for the top insight
  if (insights.length > 0) {
    try {
      const zai = await ZAI.create();
      const completion = await zai.chat.completions.create({
        messages: [
          { role: 'assistant', content: `You are a Creator Copilot for PlayLiquid. Analyze the creator's data and write ONE strategic insight (2 sentences). Be specific and actionable. No markdown.` },
          { role: 'user', content: `Creator: ${channel.displayName}, Experiences: ${channel.totalExperiences}, Players: ${channel.totalPlayers}, Revenue: ${channel.totalRevenueLiquid}L, Followers: ${channel.followers}. Top content: ${JSON.stringify(content.slice(0, 3).map(c => ({ title: c.title, plays: c.playCount, completion: c.completionRate })))}` },
        ],
        thinking: { type: 'disabled' },
      });
      const enhanced = completion.choices[0]?.message?.content?.trim();
      if (enhanced) {
        insights.unshift({
          category: 'evolution',
          problem: 'AI Copilot Strategic Assessment',
          evidence: enhanced,
          recommendation: 'Follow the copilot\'s strategic direction',
          expectedImpact: 'Channel growth',
          severity: 'info',
          reportType: 'monthly',
        });
      }
    } catch {
      // Keep rule-based
    }
  }

  // Persist insights
  for (const insight of insights) {
    await db.creatorInsightRecord.create({
      data: {
        creatorId,
        category: insight.category,
        problem: insight.problem,
        evidence: insight.evidence,
        recommendation: insight.recommendation,
        expectedImpact: insight.expectedImpact,
        severity: insight.severity,
        reportType: insight.reportType,
      },
    }).catch(() => {});
  }

  return insights;
}

// ─── Experiments ───────────────────────────────────────────────────────────

export async function createExperiment(params: {
  creatorId: string;
  experienceId: string;
  experienceName: string;
  name: string;
  hypothesis: string;
  type: string;
  variantA: Record<string, unknown>;
  variantB: Record<string, unknown>;
}): Promise<{ experimentId: string }> {
  const exp = await db.creatorExperimentRecord.create({
    data: {
      creatorId: params.creatorId,
      experienceId: params.experienceId,
      experienceName: params.experienceName,
      name: params.name,
      hypothesis: params.hypothesis,
      type: params.type,
      variantAJson: JSON.stringify(params.variantA),
      variantBJson: JSON.stringify(params.variantB),
      status: 'RUNNING',
    },
  });
  return { experimentId: exp.id };
}

export async function getExperiments(creatorId: string): Promise<any[]> {
  const experiments = await db.creatorExperimentRecord.findMany({
    where: { creatorId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  return experiments.map((e) => ({
    id: e.id,
    experienceName: e.experienceName,
    name: e.name,
    hypothesis: e.hypothesis,
    type: e.type,
    status: e.status,
    winner: e.winner,
    metrics: JSON.parse(e.metricsJson),
    createdAt: e.createdAt.getTime(),
  }));
}

export async function completeExperiment(experimentId: string, winner: string, metrics: Record<string, unknown>): Promise<void> {
  await db.creatorExperimentRecord.update({
    where: { id: experimentId },
    data: {
      status: 'COMPLETED',
      winner,
      metricsJson: JSON.stringify(metrics),
      completedAt: new Date(),
    },
  });
}

// ─── Version History ───────────────────────────────────────────────────────

export async function recordVersion(params: {
  experienceId: string;
  experienceName: string;
  version: number;
  bundleHash?: string;
  changeSummary: string;
  createdBy: string;
}): Promise<void> {
  await db.experienceVersionRecord.create({
    data: {
      experienceId: params.experienceId,
      experienceName: params.experienceName,
      version: params.version,
      bundleHash: params.bundleHash,
      changeSummary: params.changeSummary,
      createdBy: params.createdBy,
    },
  });
}

export async function getVersions(experienceId: string): Promise<any[]> {
  const versions = await db.experienceVersionRecord.findMany({
    where: { experienceId },
    orderBy: { version: 'desc' },
    take: 20,
  });
  return versions.map((v) => ({
    id: v.id,
    version: v.version,
    changeSummary: v.changeSummary,
    metricsBefore: JSON.parse(v.metricsBeforeJson),
    metricsAfter: JSON.parse(v.metricsAfterJson),
    createdBy: v.createdBy,
    createdAt: v.createdAt.getTime(),
  }));
}

// ─── Extension Economy Dashboard ───────────────────────────────────────────

export async function getExtensionEconomy(creatorId: string): Promise<{
  extensions: any[];
  totalRoyaltyPaidXof: number;
  totalRoyaltyReceivedXof: number;
  revenueImpact: any;
}> {
  // Extensions this creator uses (from their experiences)
  const experiences = await db.experienceRecord.findMany({
    where: { creatorId, status: 'PUBLISHED' },
  });

  const extensionMap = new Map<string, any>();
  for (const exp of experiences) {
    const installations = await db.extensionInstallationRecord.findMany({
      where: { experienceId: exp.id },
      include: { extension: true },
    });
    for (const inst of installations) {
      const ext = inst.extension;
      if (!extensionMap.has(ext.id)) {
        extensionMap.set(ext.id, {
          extensionId: ext.id,
          name: ext.name,
          icon: ext.icon,
          category: ext.category,
          creatorName: ext.creatorName,
          royaltyBps: ext.royaltyBps,
          installCount: ext.installCount,
          rating: ext.rating,
          usedInExperiences: [],
        });
      }
      extensionMap.get(ext.id)!.usedInExperiences.push(exp.title);
    }
  }

  // Royalties paid (from creator's share to extension creators)
  const royaltiesPaid = await db.extensionRoyaltyDistributionRecord.findMany({
    where: { gameCreatorId: creatorId },
  });
  const totalRoyaltyPaidXof = royaltiesPaid.reduce((s, r) => s + r.extensionRoyaltyXof, 0);

  // Royalties received (if creator also makes extensions)
  const royaltiesReceived = await db.extensionRoyaltyDistributionRecord.findMany({
    where: { extensionCreatorId: creatorId },
  });
  const totalRoyaltyReceivedXof = royaltiesReceived.reduce((s, r) => s + r.extensionRoyaltyXof, 0);

  return {
    extensions: Array.from(extensionMap.values()),
    totalRoyaltyPaidXof,
    totalRoyaltyReceivedXof,
    revenueImpact: {
      totalRoyaltyPaidLiquid: totalRoyaltyPaidXof / MICRO,
      totalRoyaltyReceivedLiquid: totalRoyaltyReceivedXof / MICRO,
      netRoyaltyLiquid: (totalRoyaltyReceivedXof - totalRoyaltyPaidXof) / MICRO,
    },
  };
}

// ─── Get Insights ──────────────────────────────────────────────────────────

export async function getInsights(creatorId: string, limit = 20): Promise<any[]> {
  const insights = await db.creatorInsightRecord.findMany({
    where: { creatorId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return insights.map((i) => ({
    id: i.id,
    category: i.category,
    problem: i.problem,
    evidence: i.evidence,
    recommendation: i.recommendation,
    expectedImpact: i.expectedImpact,
    severity: i.severity,
    status: i.status,
    reportType: i.reportType,
    experienceName: i.experienceName,
    createdAt: i.createdAt.getTime(),
  }));
}
