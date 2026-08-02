/**
 * Phase 22 — Game Specification Schema
 * ------------------------------------
 * The structured output of the AI Game Architect.
 * This is the "compiled design" that sits between the user's imagination
 * and the actual game generation.
 *
 * Flow: User description → GameSpecification → LLM-ready prompt → game
 */

export type GameFormat = 'spark' | 'game';
export type GameOrientation = 'portrait' | 'landscape';
export type GameRuntime = 'native' | 'html5';

export interface GameSpecification {
  // ── Identity ──
  title: string;
  description: string;
  format: GameFormat;
  genre: string;           // "action platformer", "endless runner", "tower defense"
  coreFantasy: string;     // "Player becomes a ninja defending a futuristic city"

  // ── Player actions ──
  playerActions: string[];  // ["run", "jump", "attack", "dodge"]

  // ── Game loop ──
  gameLoop: string;         // "Fight enemies → collect energy → upgrade → defeat boss"
  sessionLength: string;    // "5-10 minutes" or "30-60 seconds"

  // ── Technical ──
  orientation: GameOrientation;
  controls: string[];       // ["keyboard", "controller", "touch"]
  camera: string;           // "side scrolling", "top-down", "first-person"
  difficulty: string;       // "progressive", "fixed", "adaptive"

  // ── Required extensions ──
  extensions: string[];     // ["physics", "combat", "score", "health"]

  // ── Telemetry events ──
  telemetry: string[];      // ["kills", "damage_taken", "level_completed"]

  // ── Best-fit PlayLiquid engine template ──
  engineTemplateId?: string;  // "neon-runner", "sky-defender", "coin-rush", "catch-stars", etc.
  engineTemplateReason?: string;

  // ── Competitive ──
  competitiveEligible: boolean;

  // ── AI reasoning (for transparency) ──
  reasoning: string;
}

export interface CompatibilityCheck {
  runtime: GameRuntime;
  container: string;        // "16:9 Landscape" or "9:16 Portrait"
  input: string[];          // ["keyboard", "controller"]
  telemetry: boolean;
  extensions: string[];     // validated extension list
  evolutionReady: boolean;
  missing: string[];        // what's not yet supported
  warnings: string[];
  passed: boolean;
}

export const DEFAULT_SPEC: GameSpecification = {
  title: '',
  description: '',
  format: 'game',
  genre: '',
  coreFantasy: '',
  playerActions: [],
  gameLoop: '',
  sessionLength: '',
  orientation: 'landscape',
  controls: ['keyboard'],
  camera: 'side scrolling',
  difficulty: 'progressive',
  extensions: ['physics', 'score'],
  telemetry: ['score', 'game_over'],
  engineTemplateId: undefined,
  competitiveEligible: false,
  reasoning: '',
};

// ─── Available PlayLiquid capabilities (for validation) ────────────────────

export const PLAYLIQUID_CAPABILITIES = {
  runtimes: ['native', 'html5'],
  orientations: ['portrait', 'landscape'],
  inputs: ['keyboard', 'controller', 'touch'],
  extensions: [
    'physics', 'movement', 'score', 'coin-collector',
    'farm', 'cooking', 'weather', 'marketplace', 'competition',
    'combat', 'enemy-ai', 'health', 'progression', 'inventory',
  ],
  telemetryEvents: [
    'game_start', 'game_over', 'score_updated', 'level_completed',
    'player_action', 'enemy_destroyed', 'coin_collected', 'damage_taken',
  ],
  sparkConstraints: {
    maxDuration: 90,
    orientation: 'portrait',
    input: 'touch',
    maxMechanics: 2,
  },
  gameConstraints: {
    orientation: 'landscape',
    input: ['keyboard', 'controller'],
  },
};

/**
 * Map user-level extension names to PlayLiquid engine template ids.
 * The AI architect uses this to pick the closest existing game engine.
 */
export const EXTENSION_TO_TEMPLATE: Record<string, string[]> = {
  'physics': ['neon-runner', 'coin-rush'],
  'combat': ['sky-defender'],
  'enemy-ai': ['sky-defender'],
  'score': ['neon-runner', 'sky-defender', 'coin-rush', 'catch-stars'],
  'health': ['sky-defender'],
  'progression': ['neon-runner'],
  'collection': ['coin-rush', 'catch-stars'],
  'reflex': ['reaction-challenge'],
  'virtual-pet': ['tap-pet'],
};
