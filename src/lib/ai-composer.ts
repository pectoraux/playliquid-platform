/**
 * AI Experience Composer
 * ----------------------
 * The first AI feature of PlayLiquid. Takes a natural-language description
 * + the creator's intent, and suggests an extension graph (which extensions
 * to include and how to wire them).
 *
 * Uses the z-ai-web-dev-sdk LLM to generate a structured graph suggestion
 * based on the available extension catalog.
 *
 * The AI does NOT generate code. It generates a graph composition.
 *
 * IMPORTANT: This module imports z-ai-web-dev-sdk and MUST only be called
 * from server-side code (API routes). Client code should import types from
 * './ai-composer-types' and the pure converter from './suggestion-utils'.
 */

import ZAI from 'z-ai-web-dev-sdk';
import { listExtensions } from '@/kernel/extensions';
import type { ExperienceIntent } from '@/kernel/types';
import type { AISuggestion } from './ai-composer-types';

export type { AISuggestion } from './ai-composer-types';

export async function composeExperience(
  description: string,
  intent: ExperienceIntent,
): Promise<{ suggestion: AISuggestion; error?: string }> {
  // Build the extension catalog for the prompt
  const catalog = listExtensions().map(({ manifest }) => ({
    id: manifest.id,
    name: manifest.name,
    category: manifest.category,
    description: manifest.description,
    icon: manifest.icon,
    inputs: manifest.inputs.map((i) => ({ name: i.name, type: JSON.stringify(i.type), required: i.required, cardinality: i.cardinality })),
    outputs: manifest.outputs.map((o) => ({ name: o.name, type: JSON.stringify(o.type) })),
    tokens: manifest.tokenDefinitions?.map((t) => t.symbol) ?? [],
    consumesTokens: manifest.consumesTokens ?? [],
    tags: manifest.tags ?? [],
  }));

  const systemPrompt = `You are the PlayLiquid AI Experience Composer. You help creators design interactive experiences by composing extensions into a typed graph.

You do NOT generate code. You generate a GRAPH COMPOSITION: which extensions to include, how to wire their channels, and what the token flow looks like.

Available extensions (JSON):
${JSON.stringify(catalog, null, 2)}

Rules:
1. Every required input (required: true) MUST have a wire feeding it from a matching output channel.
2. Channel types must be compatible (records are structural — extra fields are OK).
3. The graph must be acyclic (no circular dependencies).
4. Token flows should make sense: an extension that consumesToken X should be downstream of one that emits X.
5. Choose extensions that match the creator's intent and description.
6. Keep the graph simple — 3 to 6 extensions is ideal.

Respond with ONLY valid JSON in this exact shape (no markdown, no explanation outside JSON):
{
  "reasoning": "why you chose these extensions",
  "instances": [
    { "extensionId": "pl.farm", "instanceId": "farm", "role": "economy", "config": {}, "why": "produces CORN" }
  ],
  "wires": [
    { "from": { "instance": "farm", "channel": "farmTick" }, "to": { "instance": "cooking", "channel": "farmTick" }, "why": "cooking reacts to farm output" }
  ],
  "tokenFlow": "CORN → MEAL → GOLD → leaderboard",
  "expectedEmotions": ["mastery", "strategy"]
}`;

  const userPrompt = `Creator description: "${description}"

Intent:
- Type: ${intent.kind}
- Emotions: ${intent.emotions.join(', ')}
- Goals: ${intent.goals.join(', ')}
- Audience: ${intent.audience}

Suggest an extension graph for this experience. Remember: ONLY valid JSON, no markdown.`;

  try {
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      thinking: { type: 'disabled' },
    });

    const raw = completion.choices[0]?.message?.content ?? '';

    // Extract JSON from the response (handle markdown code fences)
    let jsonStr = raw.trim();
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      jsonStr = fenceMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr) as AISuggestion;

    // Validate: all extensionIds exist
    const validIds = new Set(catalog.map((c) => c.id));
    parsed.instances = parsed.instances.filter((i) => validIds.has(i.extensionId));

    // Validate: all wires reference declared instances and channels
    const instanceMap = new Map(parsed.instances.map((i) => [i.instanceId, i.extensionId]));
    const extMap = new Map(listExtensions().map(({ manifest }) => [manifest.id, manifest]));
    parsed.wires = parsed.wires.filter((w) => {
      const fromExt = instanceMap.get(w.from.instance);
      const toExt = instanceMap.get(w.to.instance);
      if (!fromExt || !toExt) return false;
      const fromManifest = extMap.get(fromExt);
      const toManifest = extMap.get(toExt);
      if (!fromManifest?.outputs.some((o) => o.name === w.from.channel)) return false;
      if (!toManifest?.inputs.some((i) => i.name === w.to.channel)) return false;
      return true;
    });

    return { suggestion: parsed };
  } catch (err) {
    return {
      suggestion: fallbackSuggestion(description, intent),
      error: `AI composer fallback: ${(err as Error).message}`,
    };
  }
}

/**
 * Fallback: if the AI fails, produce a sensible graph from keyword matching.
 */
function fallbackSuggestion(description: string, intent: ExperienceIntent): AISuggestion {
  const lower = description.toLowerCase();
  const instances: AISuggestion['instances'] = [];
  const wires: AISuggestion['wires'] = [];

  // Always include physics + movement + score for game-like experiences
  if (intent.kind === 'GAME' || intent.kind === 'CHALLENGE' || lower.includes('move') || lower.includes('race') || lower.includes('runner')) {
    instances.push(
      { extensionId: 'pl.physics', instanceId: 'physics', role: 'core', why: 'player movement' },
      { extensionId: 'pl.movement', instanceId: 'movement', role: 'mechanic', why: 'detect movement' },
      { extensionId: 'pl.score', instanceId: 'score', role: 'mechanic', why: 'track score' },
    );
    wires.push(
      { from: { instance: 'physics', channel: 'position' }, to: { instance: 'movement', channel: 'position' }, why: 'feed position to movement' },
      { from: { instance: 'movement', channel: 'movementEvent' }, to: { instance: 'score', channel: 'movementEvent' }, why: 'score from movement' },
    );
  }

  // Economy keywords
  if (lower.includes('farm') || lower.includes('cook') || lower.includes('trade') || lower.includes('economy') || intent.emotions.includes('strategy')) {
    if (!instances.find((i) => i.instanceId === 'farm')) {
      instances.push({ extensionId: 'pl.farm', instanceId: 'farm', role: 'economy', why: 'produce resources' });
    }
    if (lower.includes('cook') || lower.includes('meal') || lower.includes('recipe')) {
      instances.push({ extensionId: 'pl.cooking', instanceId: 'cooking', role: 'economy', why: 'convert produce to meals' });
    }
    if (lower.includes('market') || lower.includes('trade') || lower.includes('sell')) {
      instances.push({ extensionId: 'pl.marketplace', instanceId: 'marketplace', role: 'economy', why: 'trade meals for gold' });
    }
    if (lower.includes('compete') || lower.includes('leaderboard') || lower.includes('competition') || intent.emotions.includes('competition')) {
      instances.push({ extensionId: 'pl.competition', instanceId: 'competition', role: 'social', why: 'competitive scoring' });
    }
  }

  // Weather
  if (lower.includes('weather') || lower.includes('rain') || lower.includes('storm') || lower.includes('climate')) {
    instances.push({ extensionId: 'pl.weather', instanceId: 'weather', role: 'render', why: 'dynamic weather' });
  }

  // Coin collector
  if (lower.includes('coin') || lower.includes('collect') || lower.includes('treasure')) {
    instances.push({ extensionId: 'pl.coin-collector', instanceId: 'coins', role: 'economy', why: 'collectible coins' });
    if (instances.find((i) => i.instanceId === 'physics')) {
      wires.push({ from: { instance: 'physics', channel: 'position' }, to: { instance: 'coins', channel: 'position' }, why: 'detect coin collection' });
    }
  }

  // Ensure at least something
  if (instances.length === 0) {
    instances.push(
      { extensionId: 'pl.farm', instanceId: 'farm', role: 'economy', why: 'default: farming' },
      { extensionId: 'pl.cooking', instanceId: 'cooking', role: 'economy', why: 'default: cooking' },
    );
  }

  return {
    reasoning: 'Fallback graph based on keyword matching from the description and intent.',
    instances,
    wires,
    tokenFlow: instances.map((i) => i.extensionId).join(' → '),
    expectedEmotions: intent.emotions,
  };
}
