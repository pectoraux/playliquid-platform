/**
 * AI Composer Types
 * -----------------
 * Shared types for the AI Experience Composer.
 * Pure types — no SDK dependency. Safe for client-side import.
 */

export interface AISuggestion {
  reasoning: string;
  instances: Array<{
    extensionId: string;
    instanceId: string;
    role: string;
    config?: Record<string, unknown>;
    why: string;
  }>;
  wires: Array<{
    from: { instance: string; channel: string };
    to: { instance: string; channel: string };
    why: string;
  }>;
  tokenFlow: string;
  expectedEmotions: string[];
}
