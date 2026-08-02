/**
 * Phase 21 — Network & Marketplace Intelligence
 * ---------------------------------------------
 * Type definitions for the intelligence layer that coordinates
 * experiences, creators, extensions, and players across the network.
 *
 *   21.1  Experience Genome (enriched)
 *   21.2  Experience Discovery Graph (co-play collaborative filtering)
 *   21.3  Creator Intelligence Score (6 dimensions)
 *   21.4  Extension Ecosystem Intelligence (composition patterns)
 *   21.5  Autonomous Creator Agents (proactive insights)
 *
 * No new currencies, no new reward systems, no new social primitives.
 * This layer reads existing telemetry + economy + feedback data and
 * surfaces intelligence.
 */

// ─── 21.1: Enriched Experience Genome ──────────────────────────────────────

export interface ExperienceIntelligence {
  experienceId: string;
  experienceName: string;
  mechanics: string[];          // extension ids
  compositionDepth: number;
  hasEconomy: boolean;
  hasCompetition: boolean;
  hasAI: boolean;
  emotionalProfile: {
    mastery: number;            // 0-1
    excitement: number;
    creativity: number;
    relaxation: number;
    competition: number;
  };
  dominantEmotion: string | null;
  economyProfile: {
    entryPriceXof: number;
    monetization: string;       // free | competitive | tournament
    retention: number;          // completion rate
    tokenVelocity: number;      // tokens earned per session
  };
  audienceProfile: {
    avgSkill: number;           // 0-100
    socialBehavior: string;     // solo | social | competitive
    segment: string;            // casual | regular | hardcore | creator
    size: number;               // total players
  };
  noveltyScore: number;         // 0-100
  qualityScore: number;         // 0-100
  maturityScore: number;        // 0-100
  computedAt: number;
}

// ─── 21.2: Discovery Graph (co-play edges) ─────────────────────────────────

export interface CoPlayEdge {
  experienceA: string;
  experienceB: string;
  experienceBName: string;
  sharedPlayers: number;
  coPlayScore: number;          // 0-1
  sharedExtensions: string[];
  sharedMechanics: string[];
}

export interface DiscoveryGraph {
  experienceId: string;
  edges: CoPlayEdge[];
  totalPlayers: number;
  relatedCount: number;
}

// ─── 21.3: Creator Intelligence Score ──────────────────────────────────────

export type CreatorTier = 'emerging' | 'growing' | 'established' | 'leading';

export interface CreatorIntelligence {
  creatorId: string;
  creatorName: string;
  retentionQuality: number;       // 0-100
  evolutionVelocity: number;      // 0-100
  extensionAdoption: number;      // 0-100
  fairness: number;               // 0-100
  communityHealth: number;        // 0-100
  economicSustainability: number; // 0-100
  overallIntelligence: number;    // 0-100
  tier: CreatorTier;
  signals: string[];
  computedAt: number;
}

// ─── 21.4: Extension Composition Patterns ──────────────────────────────────

export interface CompositionPattern {
  patternSignature: string;
  extensions: string[];
  extensionNames: string[];
  occurrenceCount: number;
  avgCompletion: number;       // 0-1
  avgRetention: number;        // 0-1
  avgReputation: number;       // 0-100
  context: string;             // any | competitive | economy | social
  recommendation: string | null;
}

// ─── 21.5: Autonomous Creator Agents ───────────────────────────────────────

export type AgentType = 'design' | 'economy' | 'growth' | 'community';

export interface AgentInsight {
  id: string;
  creatorId: string;
  experienceId?: string;
  experienceName?: string;
  agentType: AgentType;
  insightType: 'observation' | 'suggestion' | 'alert' | 'opportunity' | 'prediction';
  title: string;
  body: string;
  actionSuggestion?: string;
  expectedImpact?: string;
  confidence: number;        // 0-1
  severity: 'info' | 'suggestion' | 'warning' | 'critical';
  status: 'NEW' | 'SEEN' | 'ACTED' | 'DISMISSED';
  surfacedAt: number;
}

export const AGENT_META: Record<AgentType, { name: string; icon: string; role: string }> = {
  design: { name: 'Design Agent', icon: '🎨', role: 'Player experience & retention' },
  economy: { name: 'Economy Agent', icon: '💰', role: 'Pricing & competitive economy' },
  growth: { name: 'Growth Agent', icon: '📈', role: 'Discovery & audience conversion' },
  community: { name: 'Community Agent', icon: '👥', role: 'Player sentiment & engagement' },
};
