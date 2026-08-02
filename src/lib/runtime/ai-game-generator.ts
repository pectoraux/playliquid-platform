/**
 * AI Game Generator (Phase 21.3)
 * ------------------------------
 * Takes a natural-language prompt and produces an `AIGameProposal` — a
 * structured description of which existing engine game/spark template best
 * matches the creator's intent, plus a generated title, description, tags,
 * competitive-eligibility flag, and balance-parameter overrides.
 *
 * The LLM never generates code. It picks from the existing catalog of
 * engine games (`src/engine/games.ts`) and sparks (`src/engine/sparks.ts`)
 * and produces creative-metadata overlays on top of the chosen template.
 *
 * IMPORTANT: imports `z-ai-web-dev-sdk`. MUST only be called server-side.
 */

import ZAI from 'z-ai-web-dev-sdk';
import { GAMES } from '@/engine/games';
import { SPARKS } from '@/engine/sparks';

// ─── Types ─────────────────────────────────────────────────────────────────

export type AIGameFormat = 'game' | 'spark';

export interface AIGameBalanceParams {
  /** Optional overrides applied on top of the template's GameConfig. */
  [key: string]: number | string | boolean;
}

export interface AIGameProposal {
  /** Generated creative title. */
  title: string;
  /** Generated marketing description (1-2 sentences). */
  description: string;
  /** "game" (landscape 16:9) or "spark" (vertical 9:16 mini-game). */
  format: AIGameFormat;
  /** Id of the chosen engine template (e.g. "neon-runner"). */
  engineGameId: string;
  /** Display name of the chosen template (e.g. "Neon Runner"). */
  gameName: string;
  /** Generated content tags (audience, mood, platform). */
  tags: string[];
  /** Whether this experience can be used for competitive play. */
  competitiveEligible: boolean;
  /** Optional balance overrides (speed, gravity, spawnInterval, etc.). */
  balanceParams: AIGameBalanceParams;
  /** LLM explanation of why it chose this template. */
  reasoning: string;
  /** Source: "ai" (LLM) or "rule" (keyword fallback). */
  source: 'ai' | 'rule';
}

interface CatalogEntry {
  id: string;
  name: string;
  description: string;
  format: AIGameFormat;
  tags: string[];
  configKeys: string[];
}

// ─── Catalog ───────────────────────────────────────────────────────────────

function buildCatalog(): CatalogEntry[] {
  const games: CatalogEntry[] = Object.values(GAMES).map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    format: 'game',
    tags: g.tags,
    configKeys: Object.keys(g.config),
  }));
  const sparks: CatalogEntry[] = Object.values(SPARKS).map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    format: 'spark',
    tags: s.tags,
    configKeys: Object.keys(s.config),
  }));
  return [...games, ...sparks];
}

const CATALOG = buildCatalog();

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Generate an `AIGameProposal` from a natural-language prompt.
 *
 * The LLM is given the full catalog of engine games + sparks and asked to:
 *   1. Pick the best-matching template
 *   2. Generate a creative title + description tailored to the prompt
 *   3. Decide whether it is competitive-eligible
 *   4. Suggest 3-6 tags
 *   5. Suggest optional balance-parameter overrides
 *
 * Falls back to a rule-based keyword matcher if the LLM fails or returns
 * invalid JSON.
 */
export async function generateGameProposal(prompt: string): Promise<AIGameProposal> {
  const trimmed = (prompt ?? '').trim();
  if (!trimmed) {
    return ruleBasedProposal('A fun arcade experience for everyone.');
  }

  try {
    const proposal = await llmProposal(trimmed);
    return proposal;
  } catch (err) {
    const fallback = ruleBasedProposal(trimmed);
    fallback.reasoning = `LLM unavailable (${(err as Error).message}); used keyword fallback. ${fallback.reasoning}`;
    return fallback;
  }
}

// ─── LLM Proposal ──────────────────────────────────────────────────────────

async function llmProposal(prompt: string): Promise<AIGameProposal> {
  const catalogForPrompt = CATALOG.map((c) => ({
    id: c.id,
    name: c.name,
    format: c.format,
    description: c.description,
    tags: c.tags,
    configurable: c.configKeys,
  }));

  const systemPrompt = `You are the PlayLiquid AI Game Generator. Creators describe a game they want in natural language, and you map their description onto the best available engine template, then generate a polished creative overlay.

You do NOT generate code. You return a JSON object that selects one of the available templates and customizes its identity (title, description, tags) and balance (config overrides).

Available templates (JSON):
${JSON.stringify(catalogForPrompt, null, 2)}

Decision rules:
1. Choose the SINGLE template whose mechanics best fit the prompt.
   - "neon-runner" → endless runner, side-scroller, jumping, dodging, speed, cyberpunk
   - "sky-defender" → tower defense, shooting, waves, drones, aim, defend, base
   - "coin-rush" → collecting, timed, coins, treasure, fast arcade
   - "catch-stars" → falling objects, basket, catch, casual mobile, one-thumb
   - "reaction-challenge" → reflexes, tap the moment, quick reaction, instant
   - "tap-pet" → virtual pet, wholesome, feed, play, care, idle
2. Pick "spark" format (9:16 vertical mini-game) for casual/quick/mobile-first prompts.
   Pick "game" format (16:9 landscape) for action/skill/competitive prompts.
3. Generate a NEW creative title (do not just echo the template name). Make it evocative and on-theme.
4. Write a 1-2 sentence marketing description tailored to the prompt.
5. Suggest 3-6 lowercase tags describing audience, mood, and platform.
6. Set competitiveEligible=true ONLY if the template is skill-based and fair for leaderboards (true for neon-runner, sky-defender, coin-rush, reaction-challenge; false for tap-pet, catch-stars unless prompt explicitly asks for competition).
7. balanceParams: optional config overrides that adjust difficulty/pacing to match the prompt's tone (e.g. {"speed": 380, "spawnInterval": 1.2}). Only include keys that exist in the template's "configurable" list. Empty object {} is fine.

Respond with ONLY valid JSON in this exact shape (no markdown, no prose outside JSON):
{
  "engineGameId": "neon-runner",
  "title": "Neon Drift: Neo-Tokyo Sprint",
  "description": "Outrun the corporate enforcers through a rain-soaked Neo-Tokyo skyline. Jump rooftops, snag data-coins, survive the night.",
  "format": "game",
  "tags": ["cyberpunk", "endless-runner", "competitive", "mobile"],
  "competitiveEligible": true,
  "balanceParams": { "speed": 380, "spawnInterval": 1.2 },
  "reasoning": "The prompt asks for a fast cyberpunk runner — neon-runner is the closest mechanical match; speed was nudged up for the 'fast-paced' tone."
}`;

  const userPrompt = `Creator prompt: "${prompt}"

Pick the best template and produce the JSON proposal. ONLY valid JSON, no markdown.`;

  const zai = await ZAI.create();
  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'assistant', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    thinking: { type: 'disabled' },
  });

  const raw = completion.choices[0]?.message?.content ?? '';
  let jsonStr = raw.trim();
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  }

  const parsed = JSON.parse(jsonStr) as Partial<AIGameProposal> & {
    engineGameId?: string;
    title?: string;
    description?: string;
    format?: AIGameFormat;
    tags?: string[];
    competitiveEligible?: boolean;
    balanceParams?: AIGameBalanceParams;
    reasoning?: string;
  };

  return sanitizeProposal(parsed, prompt, 'ai');
}

// ─── Sanitization ──────────────────────────────────────────────────────────

function sanitizeProposal(
  parsed: Partial<AIGameProposal> & { engineGameId?: string },
  prompt: string,
  source: 'ai' | 'rule',
): AIGameProposal {
  // Resolve template
  const requestedId = parsed.engineGameId;
  const template =
    (requestedId && CATALOG.find((c) => c.id === requestedId)) ||
    CATALOG.find((c) => prompt.toLowerCase().includes(c.id)) ||
    CATALOG.find((c) => c.tags.some((t) => prompt.toLowerCase().includes(t))) ||
    CATALOG[0];

  if (!template) {
    // Should never happen, but be defensive
    return ruleBasedProposal(prompt);
  }

  // Title — fall back to template name if LLM gave empty/garbage
  const rawTitle = (parsed.title ?? '').toString().trim();
  const title = rawTitle || template.name;

  // Description
  const rawDesc = (parsed.description ?? '').toString().trim();
  const description = rawDesc || template.description;

  // Format — must match the template's actual format
  const format = template.format;

  // Tags — ensure array of strings, merge with template tags
  const rawTags = Array.isArray(parsed.tags) ? parsed.tags : [];
  const tags = Array.from(
    new Set(
      [...rawTags, ...template.tags]
        .filter((t): t is string => typeof t === 'string' && t.length > 0)
        .map((t) => t.toLowerCase().replace(/\s+/g, '-'))
        .slice(0, 8),
    ),
  );

  // Competitive eligibility
  const competitiveEligible =
    typeof parsed.competitiveEligible === 'boolean'
      ? parsed.competitiveEligible
      : template.tags.includes('competitive');

  // Balance params — only keys that exist on the template config
  const allowedKeys = new Set(template.configKeys);
  const rawBalance = parsed.balanceParams ?? {};
  const balanceParams: AIGameBalanceParams = {};
  for (const [k, v] of Object.entries(rawBalance)) {
    if (allowedKeys.has(k) && (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean')) {
      balanceParams[k] = v;
    }
  }

  // Reasoning
  const reasoning =
    (typeof parsed.reasoning === 'string' && parsed.reasoning.trim()) ||
    `Matched "${template.name}" template based on the creator's prompt.`;

  return {
    title,
    description,
    format,
    engineGameId: template.id,
    gameName: template.name,
    tags,
    competitiveEligible,
    balanceParams,
    reasoning,
    source,
  };
}

// ─── Rule-Based Fallback ───────────────────────────────────────────────────

/**
 * Keyword-based fallback proposal. Used when the LLM fails or returns
 * invalid output. Mirrors the prompt → template mapping documented in
 * the system prompt.
 */
function ruleBasedProposal(prompt: string): AIGameProposal {
  const p = prompt.toLowerCase();

  // Score each template by keyword overlap
  const scores = CATALOG.map((c) => {
    let score = 0;
    // Direct id mention
    if (p.includes(c.id)) score += 10;
    // Tag overlap
    for (const tag of c.tags) {
      if (p.includes(tag)) score += 3;
      if (p.includes(tag.replace('-', ' '))) score += 3;
    }
    // Keyword heuristics
    const keywords = KEYWORDS[c.id] ?? [];
    for (const kw of keywords) {
      if (p.includes(kw)) score += 2;
    }
    // Description word overlap
    for (const word of c.description.toLowerCase().split(/\W+/)) {
      if (word.length > 4 && p.includes(word)) score += 1;
    }
    return { c, score };
  }).sort((a, b) => b.score - a.score);

  const template = scores[0]?.c ?? CATALOG[0];

  // Generate a simple title by combining prompt noun + template flavor
  const titleBase = prompt.split(/\s+/).slice(0, 4).join(' ').trim();
  const title = titleBase
    ? `${capitalize(titleBase)}`
    : template.name;

  // Competitive eligibility from template tags
  const competitiveEligible = template.tags.includes('competitive');

  // Balance params: simple tone-based adjustments
  const balanceParams: AIGameBalanceParams = {};
  if (template.configKeys.includes('speed')) {
    if (p.includes('fast') || p.includes('hardcore') || p.includes('intense')) {
      balanceParams.speed = 420;
    } else if (p.includes('chill') || p.includes('relax') || p.includes('slow')) {
      balanceParams.speed = 240;
    }
  }
  if (template.configKeys.includes('spawnInterval')) {
    if (p.includes('dense') || p.includes('hard') || p.includes('fast')) {
      balanceParams.spawnInterval = 0.9;
    } else if (p.includes('chill') || p.includes('easy')) {
      balanceParams.spawnInterval = 2.0;
    }
  }

  const reasoning = `Rule-based fallback: matched "${template.name}" (${template.format}) using keyword analysis of the prompt.`;

  return {
    title,
    description: template.description,
    format: template.format,
    engineGameId: template.id,
    gameName: template.name,
    tags: [...template.tags, ...extractTags(p)].slice(0, 6),
    competitiveEligible,
    balanceParams,
    reasoning,
    source: 'rule',
  };
}

const KEYWORDS: Record<string, string[]> = {
  'neon-runner': ['runner', 'endless', 'jump', 'dodge', 'cyberpunk', 'race', 'side-scroller', 'scrolling'],
  'sky-defender': ['shoot', 'shooter', 'defend', 'defense', 'tower', 'wave', 'drone', 'aim', 'base', 'invader'],
  'coin-rush': ['collect', 'collector', 'coin', 'treasure', 'timed', 'arcade'],
  'catch-stars': ['catch', 'falling', 'basket', 'star', 'casual', 'one-thumb'],
  'reaction-challenge': ['reaction', 'reflex', 'tap', 'quick', 'instant', 'speed-test'],
  'tap-pet': ['pet', 'virtual-pet', 'care', 'feed', 'wholesome', 'idle', 'tamagotchi'],
};

function extractTags(p: string): string[] {
  const tags: string[] = [];
  if (p.includes('mobile')) tags.push('mobile');
  if (p.includes('desktop')) tags.push('desktop');
  if (p.includes('multiplayer') || p.includes('competitive')) tags.push('competitive');
  if (p.includes('casual')) tags.push('casual');
  if (p.includes('arcade')) tags.push('arcade');
  if (p.includes('cyberpunk') || p.includes('neon')) tags.push('cyberpunk');
  if (p.includes('chill') || p.includes('relax')) tags.push('relaxing');
  if (p.includes('fast') || p.includes('intense')) tags.push('fast-paced');
  return tags;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Example Prompts (used by the UI) ─────────────────────────────────────

export interface ExamplePrompt {
  label: string;
  prompt: string;
}

export const EXAMPLE_PROMPTS: ExamplePrompt[] = [
  {
    label: 'Endless runner',
    prompt: 'Create a fast-paced cyberpunk endless runner for mobile and desktop. Players jump over obstacles and collect coins while the speed ramps up.',
  },
  {
    label: 'Tower defense',
    prompt: 'Build a tower defense game where players defend their city from waves of invading drones. Aim and shoot to survive escalating waves.',
  },
  {
    label: 'Reaction game',
    prompt: 'Design a quick reaction spark where players tap the instant the screen turns green. Track streaks and best reaction time.',
  },
  {
    label: 'Virtual pet',
    prompt: 'Make a wholesome virtual pet spark. Players feed, play with, and care for a cute bouncing pet to keep its happiness up.',
  },
  {
    label: 'Coin collector',
    prompt: 'Create a 30-second timed arcade game where players collect as many coins as possible while avoiding bombs.',
  },
  {
    label: 'Catch falling stars',
    prompt: 'Design a casual one-thumb mobile spark where players move a basket to catch falling stars. Miss 3 and the game is over.',
  },
];
