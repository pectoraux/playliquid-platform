/**
 * Phase 20.6 — Player Feedback Intelligence
 * -----------------------------------------
 * Structured player feedback collection + AI clustering.
 *
 * Players submit feedback with a type (FUN, CONFUSING, TOO_HARD, BUG,
 * SUGGESTION), three rating dimensions (funScore, difficultyScore,
 * emotionScore), and an optional comment.
 *
 * The AI clusters feedback into human-readable themes like:
 *   "Players love speed mechanics"
 *   "Players dislike unclear objectives"
 */

import ZAI from 'z-ai-web-dev-sdk';
import { db } from '@/lib/db';
import type { FeedbackCluster, FeedbackRecord, FeedbackType } from './evolution-types';

const MICRO = 1_000_000;

export async function submitFeedback(params: {
  experienceId: string;
  playerId?: string;
  sessionId?: string;
  type: FeedbackType;
  funScore: number;
  difficultyScore: number;
  emotionScore: number;
  comment?: string;
}): Promise<FeedbackRecord> {
  const row = await db.experienceFeedbackRecord.create({
    data: {
      experienceId: params.experienceId,
      playerId: params.playerId,
      sessionId: params.sessionId,
      type: params.type,
      funScore: clamp01to5(params.funScore),
      difficultyScore: clamp01to5(params.difficultyScore),
      emotionScore: clamp01to5(params.emotionScore),
      comment: params.comment,
    },
  });
  return rowToRecord(row);
}

export async function getFeedbackForExperience(experienceId: string, limit = 100): Promise<FeedbackRecord[]> {
  const rows = await db.experienceFeedbackRecord.findMany({
    where: { experienceId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return rows.map(rowToRecord);
}

export async function getFeedbackSummary(experienceId: string): Promise<{
  total: number;
  byType: Record<FeedbackType, number>;
  avgFun: number;
  avgDifficulty: number;
  avgEmotion: number;
  clusters: FeedbackCluster[];
}> {
  const rows = await getFeedbackForExperience(experienceId, 200);
  const byType: Record<FeedbackType, number> = {
    FUN: 0, CONFUSING: 0, TOO_HARD: 0, BUG: 0, SUGGESTION: 0,
  };
  let funSum = 0, diffSum = 0, emoSum = 0;
  for (const r of rows) {
    byType[r.type] = (byType[r.type] ?? 0) + 1;
    funSum += r.funScore;
    diffSum += r.difficultyScore;
    emoSum += r.emotionScore;
  }
  const total = rows.length;
  const clusters = await clusterFeedback(rows);
  return {
    total,
    byType,
    avgFun: total > 0 ? funSum / total : 0,
    avgDifficulty: total > 0 ? diffSum / total : 0,
    avgEmotion: total > 0 ? emoSum / total : 0,
    clusters,
  };
}

// ─── AI clustering ─────────────────────────────────────────────────────────

export async function clusterFeedback(rows: FeedbackRecord[]): Promise<FeedbackCluster[]> {
  if (rows.length === 0) return [];

  // Try LLM clustering
  try {
    const clusters = await llmCluster(rows);
    // Persist cluster labels back onto the rows (best-effort)
    for (const cluster of clusters) {
      for (const comment of cluster.exampleComments) {
        const match = rows.find((r) => r.comment === comment);
        if (match) {
          await db.experienceFeedbackRecord.updateMany({
            where: { id: match.id },
            data: { clusterLabel: cluster.label },
          }).catch(() => {});
        }
      }
    }
    return clusters;
  } catch {
    return ruleBasedClusters(rows);
  }
}

async function llmCluster(rows: FeedbackRecord[]): Promise<FeedbackCluster[]> {
  const zai = await ZAI.create();
  const input = rows.slice(0, 50).map((r, i) => ({
    id: i,
    type: r.type,
    fun: r.funScore,
    difficulty: r.difficultyScore,
    comment: r.comment ?? '',
  }));

  const completion = await zai.chat.completions.create({
    messages: [
      {
        role: 'assistant',
        content: `You are a player feedback analyst for PlayLiquid. Cluster the feedback into 2-5 human-readable themes.
Each cluster must have: label (short, e.g. "Players love speed mechanics"), sentiment (positive|negative|mixed), exampleComments (up to 3 actual comment strings from the input), and the ids of the feedback items that belong to it.

Respond with ONLY valid JSON (no markdown) in this shape:
{ "clusters": [ { "label": "...", "sentiment": "positive", "ids": [0,1], "exampleComments": ["..."] } ] }`,
      },
      { role: 'user', content: JSON.stringify(input, null, 2) },
    ],
    thinking: { type: 'disabled' },
  });

  const raw = completion.choices[0]?.message?.content ?? '';
  let jsonStr = raw.trim();
  const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) jsonStr = fence[1].trim();
  const parsed = JSON.parse(jsonStr);

  const clusters: FeedbackCluster[] = [];
  for (const c of parsed.clusters ?? []) {
    const ids: number[] = Array.isArray(c.ids) ? c.ids : [];
    const members = ids.map((id) => rows[id]).filter(Boolean);
    if (members.length === 0) continue;
    const types: Record<FeedbackType, number> = { FUN: 0, CONFUSING: 0, TOO_HARD: 0, BUG: 0, SUGGESTION: 0 };
    let funSum = 0, diffSum = 0;
    for (const m of members) {
      types[m.type] = (types[m.type] ?? 0) + 1;
      funSum += m.funScore;
      diffSum += m.difficultyScore;
    }
    clusters.push({
      label: String(c.label ?? 'Unlabeled cluster'),
      sentiment: (c.sentiment === 'positive' || c.sentiment === 'negative' || c.sentiment === 'mixed') ? c.sentiment : 'mixed',
      count: members.length,
      avgFun: members.length > 0 ? funSum / members.length : 0,
      avgDifficulty: members.length > 0 ? diffSum / members.length : 0,
      exampleComments: Array.isArray(c.exampleComments) ? c.exampleComments.slice(0, 3) : [],
      types,
    });
  }
  return clusters;
}

function ruleBasedClusters(rows: FeedbackRecord[]): FeedbackCluster[] {
  const groups = new Map<FeedbackType, FeedbackRecord[]>();
  for (const r of rows) {
    if (!groups.has(r.type)) groups.set(r.type, []);
    groups.get(r.type)!.push(r);
  }
  const labelMap: Record<FeedbackType, string> = {
    FUN: 'Players are enjoying the core loop',
    CONFUSING: 'Players find parts of the experience confusing',
    TOO_HARD: 'Players feel the difficulty is too high',
    BUG: 'Players report bugs',
    SUGGESTION: 'Players have feature suggestions',
  };
  const sentimentMap: Record<FeedbackType, FeedbackCluster['sentiment']> = {
    FUN: 'positive',
    CONFUSING: 'negative',
    TOO_HARD: 'negative',
    BUG: 'negative',
    SUGGESTION: 'mixed',
  };
  const clusters: FeedbackCluster[] = [];
  for (const [type, members] of groups) {
    const types: Record<FeedbackType, number> = { FUN: 0, CONFUSING: 0, TOO_HARD: 0, BUG: 0, SUGGESTION: 0 };
    let funSum = 0, diffSum = 0;
    const comments: string[] = [];
    for (const m of members) {
      types[m.type] = (types[m.type] ?? 0) + 1;
      funSum += m.funScore;
      diffSum += m.difficultyScore;
      if (m.comment && comments.length < 3) comments.push(m.comment);
    }
    clusters.push({
      label: labelMap[type],
      sentiment: sentimentMap[type],
      count: members.length,
      avgFun: members.length > 0 ? funSum / members.length : 0,
      avgDifficulty: members.length > 0 ? diffSum / members.length : 0,
      exampleComments: comments,
      types,
    });
  }
  return clusters.sort((a, b) => b.count - a.count);
}

// ─── helpers ───────────────────────────────────────────────────────────────

function clamp01to5(n: number): number {
  const v = Number(n);
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(5, v));
}

function rowToRecord(row: any): FeedbackRecord {
  return {
    id: row.id,
    experienceId: row.experienceId,
    playerId: row.playerId ?? undefined,
    sessionId: row.sessionId ?? undefined,
    type: row.type as FeedbackType,
    funScore: row.funScore,
    difficultyScore: row.difficultyScore,
    emotionScore: row.emotionScore,
    comment: row.comment ?? undefined,
    clusterLabel: row.clusterLabel ?? undefined,
    createdAt: row.createdAt instanceof Date ? row.createdAt.getTime() : new Date(row.createdAt).getTime(),
  };
}

// Re-exported for tests / dev seed convenience
export { MICRO };
