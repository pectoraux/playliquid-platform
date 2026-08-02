/**
 * Phase 20 — Experience Evolution Operating System
 * -----------------------------------------------
 * Type definitions for the evolution loop:
 *   Players → Telemetry → AI Analysis → Hypothesis → Experiment
 *          → Graph Variant → Player Testing → Winner Selection → Evolution
 *
 * The AI NEVER modifies production experiences directly. It produces
 * EvolutionProposals which are turned into graph Mutations that must be
 * creator-approved before touching production.
 */

import type { ExperienceBundle } from '@/kernel/types';

// ─── Proposal lifecycle (ADR-aligned, no autonomous edits) ─────────────────

export type ProposalStatus =
  | 'DISCOVERED'     // AI surfaced a problem from telemetry
  | 'PROPOSED'       // AI formed a hypothesis + change
  | 'CREATOR_REVIEW' // creator is looking at it
  | 'EXPERIMENTING'  // sandbox A/B run in progress
  | 'APPROVED'       // creator approved; mutation will be/has been applied
  | 'REJECTED'       // creator rejected
  | 'ROLLED_BACK'    // was applied then reverted
  // legacy statuses (kept for backward-compat with v0.1 evolution agent)
  | 'PENDING'
  | 'APPLIED';

export type MutationType =
  | 'ADD_EXTENSION'
  | 'REMOVE_EXTENSION'
  | 'UPDATE_CONFIG'
  | 'REWIRE_CONNECTION'
  | 'CHANGE_ECONOMY';

export type MutationStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'APPLIED'
  | 'REJECTED'
  | 'ROLLED_BACK';

export type FeedbackType =
  | 'FUN'
  | 'CONFUSING'
  | 'TOO_HARD'
  | 'BUG'
  | 'SUGGESTION';

export type EvolutionRunStatus = 'RUNNING' | 'COMPLETED' | 'FAILED';

// ─── EvolutionProposal (rich, Phase 20 shape) ──────────────────────────────

export interface GraphChangeSpec {
  mutationType: MutationType;
  /** instance id (or extensionId for ADD_EXTENSION) */
  instance?: string;
  extensionId?: string;
  /** config patch for UPDATE_CONFIG, economy change for CHANGE_ECONOMY */
  config?: Record<string, unknown>;
  /** wire change for REWIRE_CONNECTION */
  wire?: {
    from?: { instance: string; channel: string };
    to?: { instance: string; channel: string };
    remove?: boolean;
  };
  reason: string;
}

export interface EvolutionProposalV2 {
  id: string;
  experienceId: string;
  experienceName: string;
  // ── structured diagnosis ──
  problem: string;
  evidence: string;
  affectedExtensions: string[];
  graphChanges: GraphChangeSpec[];
  expectedImpact: string;
  confidenceScore: number; // 0.0 - 1.0
  // ── the resulting bundle (after applying the changes) ──
  newBundle?: ExperienceBundle;
  // ── AI reasoning (kept for transparency) ──
  analysis: {
    patterns: string[];
    dropOffPoint?: string;
    bottlenecks: string[];
    strengths: string[];
    diagnosis: string;
    hypothesis: string;
  };
  predictedLift: number;
  status: ProposalStatus;
  mutationId?: string;
  createdAt: number;
  reviewedAt?: number;
}

// ─── EvolutionEngine inputs ────────────────────────────────────────────────

export interface EvolutionInputs {
  experienceId: string;
  experienceName: string;
  bundle: ExperienceBundle;
  metrics: {
    totalSessions: number;
    completionRate: number;
    averageScore: number;
    averageDropOffMs: number;
    frustrationEvents: number;
    achievementEvents: number;
    tokensEarned: number;
    tokensSpent: number;
    marketActions: number;
    socialMoments: number;
  };
  replayEvents: Array<{
    kind: string;
    tick: number;
    summary?: string;
  }>;
  feedback: Array<{
    type: FeedbackType;
    funScore: number;
    difficultyScore: number;
    comment?: string;
  }>;
  economy: {
    creatorShareLiquid: number;
    prizePoolLiquid: number;
    leaderboardEntries: number;
    competitiveSessions: number;
  };
  leaderboard: Array<{
    rank: number;
    displayName: string;
    score: number;
  }>;
}

// ─── Mutation record (graph-level, never touches prod directly) ────────────

export interface MutationRecord {
  id: string;
  experienceId: string;
  proposalId?: string;
  mutationType: MutationType;
  beforeGraph: ExperienceBundle;
  afterGraph: ExperienceBundle;
  creatorApproved: boolean;
  status: MutationStatus;
  appliedExperienceId?: string;
  createdAt: number;
  appliedAt?: number;
}

// ─── Evolution Sandbox run (A/B) ───────────────────────────────────────────

export interface EvolutionRunRecordData {
  id: string;
  experienceId: string;
  mutationId?: string;
  simulationId?: string;
  variantA: string;
  variantB: string;
  winner: 'A' | 'B' | 'TIE' | null;
  metrics: {
    A: Record<string, number>;
    B: Record<string, number>;
    delta: Record<string, number>;
  };
  status: EvolutionRunStatus;
  createdAt: number;
  completedAt?: number;
}

// ─── Evolution Timeline ────────────────────────────────────────────────────

export interface EvolutionTimelineEntry {
  version: string;       // "v1.0", "v1.1", ...
  versionNumber: number;
  changeSummary: string;
  changeType: 'CREATED' | 'EVOLUTION' | 'EXPERIMENT_WIN' | 'MANUAL_FORK' | 'ROLLBACK';
  impact?: string;       // "+14% retention"
  mutationId?: string;
  proposalId?: string;
  bundleHash?: string;
  createdBy: string;
  createdAt: number;
}

// ─── Player Feedback ───────────────────────────────────────────────────────

export interface FeedbackRecord {
  id: string;
  experienceId: string;
  playerId?: string;
  sessionId?: string;
  type: FeedbackType;
  funScore: number;
  difficultyScore: number;
  emotionScore: number;
  comment?: string;
  clusterLabel?: string;
  createdAt: number;
}

export interface FeedbackCluster {
  label: string;          // "Players love speed mechanics"
  sentiment: 'positive' | 'negative' | 'mixed';
  count: number;
  avgFun: number;
  avgDifficulty: number;
  exampleComments: string[];
  types: Record<FeedbackType, number>;
}
