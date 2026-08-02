/**
 * Phase 22 — Prompt Compiler
 * --------------------------
 * Converts a validated GameSpecification into an LLM-ready generation prompt.
 *
 * This is the "compilation" step: the structured spec becomes a detailed
 * prompt that can be used either:
 *   - Internally by PlayLiquid's AI (to pick + configure an engine template)
 *   - Externally by a creator (copied to an external LLM to generate HTML5 code)
 *
 * The compiled prompt is NOT the user's original description. It is a
 * structured, platform-aware generation directive.
 */

import type { CompatibilityCheck, GameSpecification } from './game-spec-schema';
import { GAMES } from '@/engine/games';
import { SPARKS } from '@/engine/sparks';

export function compilePrompt(spec: GameSpecification, check: CompatibilityCheck): string {
  const template = spec.engineTemplateId
    ? (GAMES[spec.engineTemplateId] ?? SPARKS[spec.engineTemplateId])
    : null;

  const isSpark = spec.format === 'spark';

  return `You are an expert PlayLiquid Experience Engineer.

Create a production-ready interactive experience for the PlayLiquid platform.

PROJECT: ${spec.title}
CATEGORY: ${isSpark ? 'Mobile Spark' : 'Desktop Game'}
FORMAT: ${spec.orientation === 'portrait' ? 'Portrait 9:16' : 'Landscape 16:9'}
RUNTIME: ${check.runtime === 'html5' ? 'HTML5 Canvas' : 'Native PlayLiquid Runtime (PlayEngine)'}

REQUIREMENTS:
The experience MUST:
- Run inside the PlayLiquid ContainmentFrame
- Support ${spec.controls.join(' + ')} input
- Emit PlayLiquid telemetry events via postMessage bridges
- Expose gameplay state for the Evolution Engine
- Support replay recording
- Be deterministic (seeded RNG for reproducible sessions)

GAME DESIGN:
Fantasy: ${spec.coreFantasy}
Genre: ${spec.genre}
Core loop: ${spec.gameLoop}
Session length: ${spec.sessionLength}
Difficulty: ${spec.difficulty}
Camera: ${spec.camera}

Player actions:
${spec.playerActions.map((a) => `- ${a}`).join('\n')}

Required systems:
${spec.extensions.map((e) => `- ${e}`).join('\n')}

Telemetry events to emit:
${spec.telemetry.map((t) => `- ${t}`).join('\n')}

ENGINE TEMPLATE: ${template?.name ?? 'custom'}
${template ? `The experience should use the "${template.id}" engine template as its foundation. This template provides: ${template.tags.join(', ')}.` : 'No template match — generate from scratch.'}

${isSpark ? `
SPARK CONSTRAINTS:
- Vertical 9:16 orientation
- Touch-only input
- 30-90 second sessions
- One core mechanic
- Instant loading (no splash screens)
- Viral sharing hook
` : `
GAME CONSTRAINTS:
- Landscape 16:9 orientation
- Keyboard + controller input
- Progressive difficulty
- Score + leaderboard integration
- Competitive-eligible: ${spec.competitiveEligible ? 'yes' : 'no'}
`}

INPUT BRIDGE (pl:input):
Receive messages from the PlayLiquid ContainmentFrame:
\`\`\`javascript
window.addEventListener('message', (event) => {
  if (event.data.type === 'pl:input') {
    // Handle: move-left, move-right, move-up, move-down, action, start
  }
});
\`\`\`

TELEMETRY BRIDGE (pl:telemetry):
Send game events to the PlayLiquid ContainmentFrame:
\`\`\`javascript
window.parent.postMessage({
  type: 'pl:telemetry',
  event: { name: 'score_updated', value: 100, ts: Date.now() }
}, '*');
\`\`\`

REQUIRED EVENTS:
- game_start (on session begin)
- score_updated (on score change)
- ${spec.telemetry.filter((t) => !['score', 'game_over'].includes(t)).map((t) => t).join('\n- ')}
- game_over (on session end, with final score)

OUTPUT:
${check.runtime === 'html5' ? `Generate a complete HTML5 game package:
- /index.html
- /game.js (pure Canvas API, no frameworks)
- /style.css
- /manifest.json

The output must be ZIP-ready and run standalone in an iframe.` : `The experience will use the PlayLiquid PlayEngine. Configure the engine with the appropriate game definition.`}

COMPATIBILITY CHECK:
- Runtime: ${check.runtime} ✅
- Container: ${check.container} ✅
- Input: ${check.input.join(', ')} ✅
- Telemetry: ${check.telemetry ? 'enabled' : 'disabled'} ${check.telemetry ? '✅' : '❌'}
- Extensions: ${check.extensions.join(', ')} ${check.extensions.length > 0 ? '✅' : '❌'}
- Evolution ready: ${check.evolutionReady ? 'yes' : 'no'} ${check.evolutionReady ? '✅' : '❌'}
${check.warnings.length > 0 ? `\nWARNINGS:\n${check.warnings.map((w) => `- ${w}`).join('\n')}` : ''}

Generate the experience now.`;
}
