/**
 * Phase 22 — AI Game Designer Agent
 * ---------------------------------
 * Takes a natural-language description and produces a structured
 * GameSpecification. This is the "architect" that sits between the
 * user's imagination and the generation model.
 *
 * The agent:
 *   1. Understands the game idea
 *   2. Decides mechanics, genre, core fantasy
 *   3. Picks required extensions
 *   4. Maps to the best PlayLiquid engine template
 *   5. Returns a complete GameSpecification
 *
 * Uses z-ai-web-dev-sdk (server-side only).
 */

import ZAI from 'z-ai-web-dev-sdk';
import { GAMES } from '@/engine/games';
import { SPARKS } from '@/engine/sparks';
import { EXTENSION_TO_TEMPLATE, type GameFormat, type GameSpecification } from './game-spec-schema';

const SYSTEM_PROMPT = `You are the PlayLiquid AI Game Architect. You convert a user's game idea into a structured Game Specification.

Your job is NOT to generate code. You ANALYZE the idea and produce a design document that a separate generator can use.

Available PlayLiquid engine templates (pick the closest match):
${JSON.stringify(
  [...Object.values(GAMES).map((g) => ({ id: g.id, name: g.name, tags: g.tags, format: g.format })),
   ...Object.values(SPARKS).map((s) => ({ id: s.id, name: s.name, tags: s.tags, format: s.format }))],
  null, 2
)}

Rules:
1. Choose format: "spark" for quick mobile experiences (30-90s, touch, portrait), "game" for longer desktop experiences (5-10min, keyboard, landscape)
2. Pick the closest engineTemplateId from the available templates above
3. List the required extensions (physics, combat, score, etc.)
4. Define the core fantasy and game loop
5. List telemetry events that should be tracked
6. Set competitiveEligible = true if the game has a scoring/competitive element
7. Be specific and actionable — this spec will be compiled into a generation prompt

Respond with ONLY valid JSON (no markdown) in this exact shape:
{
  "title": "A creative, marketable title",
  "description": "1-2 sentence elevator pitch",
  "format": "spark" | "game",
  "genre": "e.g. action platformer, endless runner, tower defense",
  "coreFantasy": "What does the player become? What's the fantasy?",
  "playerActions": ["run", "jump", "attack"],
  "gameLoop": "Fight enemies → collect energy → upgrade → defeat boss",
  "sessionLength": "5-10 minutes" or "30-60 seconds",
  "orientation": "portrait" | "landscape",
  "controls": ["keyboard", "touch"],
  "camera": "side scrolling" | "top-down" | "first-person",
  "difficulty": "progressive" | "fixed" | "adaptive",
  "extensions": ["physics", "combat", "score"],
  "telemetry": ["kills", "damage_taken", "level_completed", "score"],
  "engineTemplateId": "neon-runner" | "sky-defender" | "coin-rush" | "catch-stars" | "reaction-challenge" | "tap-pet",
  "engineTemplateReason": "why this template is the best fit",
  "competitiveEligible": true | false,
  "reasoning": "2-3 sentences explaining your design decisions"
}`;

export async function designGame(
  description: string,
  formatHint?: GameFormat,
): Promise<{ spec: GameSpecification; error?: string }> {
  // Try LLM first
  try {
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: SYSTEM_PROMPT },
        { role: 'user', content: `Game idea: "${description}"${formatHint ? `\n\nFormat preference: ${formatHint}` : ''}\n\nDesign this game:` },
      ],
      thinking: { type: 'disabled' },
    });

    const raw = completion.choices[0]?.message?.content ?? '';
    let jsonStr = raw.trim();
    const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) jsonStr = fence[1].trim();

    const parsed = JSON.parse(jsonStr);
    const spec = normalizeSpec(parsed, description, formatHint);
    return { spec };
  } catch (err) {
    // Fallback: rule-based design
    return { spec: fallbackDesign(description, formatHint), error: `AI fallback: ${(err as Error).message}` };
  }
}

function normalizeSpec(parsed: any, description: string, formatHint?: GameFormat): GameSpecification {
  const format: GameFormat = formatHint ?? (parsed.format === 'spark' ? 'spark' : 'game');
  return {
    title: String(parsed.title ?? 'Untitled Experience'),
    description: String(parsed.description ?? description),
    format,
    genre: String(parsed.genre ?? 'game'),
    coreFantasy: String(parsed.coreFantasy ?? parsed.description ?? ''),
    playerActions: Array.isArray(parsed.playerActions) ? parsed.playerActions : [],
    gameLoop: String(parsed.gameLoop ?? ''),
    sessionLength: String(parsed.sessionLength ?? (format === 'spark' ? '30-60 seconds' : '5-10 minutes')),
    orientation: (parsed.orientation === 'portrait' ? 'portrait' : 'landscape') as GameSpecification['orientation'],
    controls: Array.isArray(parsed.controls) ? parsed.controls : (format === 'spark' ? ['touch'] : ['keyboard']),
    camera: String(parsed.camera ?? (format === 'spark' ? 'fixed' : 'side scrolling')),
    difficulty: String(parsed.difficulty ?? 'progressive'),
    extensions: Array.isArray(parsed.extensions) ? parsed.extensions : ['physics', 'score'],
    telemetry: Array.isArray(parsed.telemetry) ? parsed.telemetry : ['score', 'game_over'],
    engineTemplateId: String(parsed.engineTemplateId ?? pickTemplate(parsed.extensions, format)),
    engineTemplateReason: String(parsed.engineTemplateReason ?? ''),
    competitiveEligible: Boolean(parsed.competitiveEligible ?? false),
    reasoning: String(parsed.reasoning ?? ''),
  };
}

function pickTemplate(extensions: string[], format: GameFormat): string {
  if (format === 'spark') {
    if (extensions.includes('reflex')) return 'reaction-challenge';
    if (extensions.includes('virtual-pet')) return 'tap-pet';
    return 'catch-stars';
  }
  if (extensions.includes('combat') || extensions.includes('enemy-ai')) return 'sky-defender';
  if (extensions.includes('collection')) return 'coin-rush';
  return 'neon-runner';
}

function fallbackDesign(description: string, formatHint?: GameFormat): GameSpecification {
  const desc = description.toLowerCase();
  let format: GameFormat = formatHint ?? 'game';
  let template = 'neon-runner';
  let genre = 'action';
  let actions = ['run', 'jump'];
  let extensions = ['physics', 'score'];
  let telemetry = ['score', 'game_over'];

  if (desc.includes('shoot') || desc.includes('defend') || desc.includes('fight') || desc.includes('combat') || desc.includes('attack')) {
    template = 'sky-defender';
    genre = 'tower defense / shooter';
    actions = ['aim', 'shoot', 'defend'];
    extensions = ['physics', 'combat', 'enemy-ai', 'score', 'health'];
    telemetry = ['kills', 'damage_taken', 'wave_completed', 'score'];
  } else if (desc.includes('collect') || desc.includes('coin') || desc.includes('grab')) {
    template = 'coin-rush';
    genre = 'collector / arcade';
    actions = ['move', 'collect'];
    extensions = ['physics', 'score', 'collection'];
    telemetry = ['coins_collected', 'score', 'time_bonus'];
  } else if (desc.includes('race') || desc.includes('run') || desc.includes('speed')) {
    template = 'neon-runner';
    genre = 'endless runner';
    actions = ['run', 'jump', 'dodge'];
    extensions = ['physics', 'movement', 'score', 'progression'];
    telemetry = ['distance', 'obstacles_avoided', 'coins_collected', 'score'];
  } else if (desc.includes('pet') || desc.includes('care') || desc.includes('raise')) {
    format = 'spark';
    template = 'tap-pet';
    genre = 'virtual pet';
    actions = ['feed', 'play', 'pet'];
    extensions = ['score'];
    telemetry = ['happiness', 'hunger', 'score'];
  } else if (desc.includes('react') || desc.includes('quick') || desc.includes('fast tap')) {
    format = 'spark';
    template = 'reaction-challenge';
    genre = 'reflex / reaction';
    actions = ['tap'];
    extensions = ['score'];
    telemetry = ['reaction_time', 'streak', 'score'];
  } else if (desc.includes('catch') || desc.includes('fall')) {
    format = 'spark';
    template = 'catch-stars';
    genre = 'catcher / arcade';
    actions = ['move', 'catch'];
    extensions = ['physics', 'score'];
    telemetry = ['items_caught', 'items_missed', 'score'];
  }

  const title = generateTitle(description, template);
  const isSpark = format === 'spark';

  return {
    title,
    description: description.slice(0, 120),
    format,
    genre,
    coreFantasy: `Player ${actions[0]}s to ${desc.includes('defend') ? 'protect their city' : 'achieve the highest score'}`,
    playerActions: actions,
    gameLoop: `${actions[0].charAt(0).toUpperCase() + actions[0].slice(1)} → score → ${template === 'sky-defender' ? 'survive waves' : 'beat high score'}`,
    sessionLength: isSpark ? '30-60 seconds' : '5-10 minutes',
    orientation: isSpark ? 'portrait' : 'landscape',
    controls: isSpark ? ['touch'] : ['keyboard', 'controller'],
    camera: isSpark ? 'fixed' : 'side scrolling',
    difficulty: 'progressive',
    extensions,
    telemetry,
    engineTemplateId: template,
    engineTemplateReason: `Closest match based on keywords in the description (${template})`,
    competitiveEligible: true,
    reasoning: `Rule-based design: matched "${description.slice(0, 50)}" to the ${template} template based on keywords. Format: ${format}.`,
  };
}

function generateTitle(description: string, template: string): string {
  const templates: Record<string, string[]> = {
    'neon-runner': ['Neon Dash', 'Cyber Sprint', 'Velocity Rush', 'Photon Runner'],
    'sky-defender': ['Sky Guardian', 'Aerial Defender', 'Star Shield', 'Void Protector'],
    'coin-rush': ['Coin Frenzy', 'Gold Rush', 'Treasure Dash', 'Mint Collector'],
    'catch-stars': ['Star Catcher', 'Cosmic Catch', 'Stellar Rain', 'Shower of Stars'],
    'reaction-challenge': ['Quick Tap', 'Reflex Test', 'Instant Reaction', 'Speed Tap'],
    'tap-pet': ['Pocket Pet', 'Tiny Companion', 'Lil Buddy', 'Mini Critter'],
  };
  const options = templates[template] ?? ['Custom Experience'];
  // Pick based on description hash for determinism
  let hash = 0;
  for (let i = 0; i < description.length; i++) hash = (hash * 31 + description.charCodeAt(i)) | 0;
  return options[Math.abs(hash) % options.length];
}

/**
 * Refine a spec based on user feedback (real-time collaboration).
 * e.g. "make it harder" → increase difficulty, "add multiplayer" → add social extension
 */
export async function refineSpec(
  currentSpec: GameSpecification,
  feedback: string,
): Promise<{ spec: GameSpecification; error?: string }> {
  const fb = feedback.toLowerCase();
  const spec = { ...currentSpec };

  if (fb.includes('hard') || fb.includes('difficult')) {
    spec.difficulty = 'adaptive';
  }
  if (fb.includes('easy')) {
    spec.difficulty = 'fixed';
  }
  if (fb.includes('multiplayer') || fb.includes('social')) {
    spec.extensions = [...new Set([...spec.extensions, 'competition'])];
  }
  if (fb.includes('combat') || fb.includes('fight') || fb.includes('enemy')) {
    spec.extensions = [...new Set([...spec.extensions, 'combat', 'enemy-ai'])];
    spec.engineTemplateId = 'sky-defender';
  }
  if (fb.includes('spark') || fb.includes('short') || fb.includes('mobile')) {
    spec.format = 'spark';
    spec.orientation = 'portrait';
    spec.controls = ['touch'];
    spec.sessionLength = '30-60 seconds';
  }
  if (fb.includes('game') || fb.includes('long') || fb.includes('desktop')) {
    spec.format = 'game';
    spec.orientation = 'landscape';
    spec.controls = ['keyboard', 'controller'];
    spec.sessionLength = '5-10 minutes';
  }

  spec.reasoning = `Refined based on feedback: "${feedback}". Updated ${fb.includes('hard') ? 'difficulty' : fb.includes('spark') ? 'format to spark' : 'extensions'}.`;
  return { spec };
}
