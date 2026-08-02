/**
 * Phase 22 — Generation Orchestrator
 * ----------------------------------
 * Ties together the full AI Game Design Compiler flow:
 *
 *   description → designGame → validateCompatibility → compilePrompt → generate
 *
 * The orchestrator persists a GameCreationSession so the flow can be
 * resumed at any step. The final "generate" step uses the existing
 * createEngineExperience() to publish the game.
 */

import { db } from '@/lib/db';
import { designGame, refineSpec } from './game-designer-agent';
import { validateCompatibility, suggestFixes } from './compatibility-validator';
import { compilePrompt } from './prompt-compiler';
import { createEngineExperience } from '@/lib/runtime/runtime-service';
import type { GameFormat, GameSpecification } from './game-spec-schema';

export interface DesignResult {
  sessionId: string;
  spec: GameSpecification;
}

export interface CompileResult {
  sessionId: string;
  spec: GameSpecification;
  compatibility: ReturnType<typeof validateCompatibility>;
  compiledPrompt: string;
}

export interface GenerateResult {
  sessionId: string;
  experienceId: string;
  spec: GameSpecification;
}

/**
 * Step 1: Create a session + design the game from a description.
 */
export async function startDesignSession(
  description: string,
  formatHint?: GameFormat,
): Promise<DesignResult> {
  const session = await db.gameCreationSession.create({
    data: {
      rawDescription: description,
      format: formatHint ?? 'game',
      status: 'designing',
    },
  });

  const { spec, error } = await designGame(description, formatHint);

  await db.gameCreationSession.update({
    where: { id: session.id },
    data: {
      generatedSpecJson: JSON.stringify(spec),
      format: spec.format,
      status: 'ready',
    },
  });

  return { sessionId: session.id, spec };
}

/**
 * Step 1b: Refine an existing spec with user feedback.
 */
export async function refineDesignSession(
  sessionId: string,
  feedback: string,
): Promise<{ spec: GameSpecification; error?: string }> {
  const session = await db.gameCreationSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error('Session not found');

  const currentSpec: GameSpecification = JSON.parse(session.generatedSpecJson);
  const { spec, error } = await refineSpec(currentSpec, feedback);

  await db.gameCreationSession.update({
    where: { id: sessionId },
    data: { generatedSpecJson: JSON.stringify(spec) },
  });

  return { spec, error };
}

/**
 * Step 2: Validate compatibility + compile the generation prompt.
 */
export async function compileDesignSession(sessionId: string): Promise<CompileResult> {
  const session = await db.gameCreationSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error('Session not found');

  const spec: GameSpecification = JSON.parse(session.generatedSpecJson);
  const compatibility = validateCompatibility(spec);
  const compiledPrompt = compilePrompt(spec, compatibility);

  await db.gameCreationSession.update({
    where: { id: sessionId },
    data: {
      compatibilityJson: JSON.stringify(compatibility),
      compiledPrompt,
      status: 'ready',
    },
  });

  return { sessionId, spec, compatibility, compiledPrompt };
}

/**
 * Step 3: Generate the experience (publish via the engine template).
 */
export async function generateExperience(sessionId: string): Promise<GenerateResult> {
  const session = await db.gameCreationSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error('Session not found');

  const spec: GameSpecification = JSON.parse(session.generatedSpecJson);

  await db.gameCreationSession.update({
    where: { id: sessionId },
    data: { status: 'generating' },
  });

  // Use the existing engine experience creator (picks the right engine template)
  const { experienceId } = await createEngineExperience({
    title: spec.title,
    description: spec.description,
    engineGameId: spec.engineTemplateId ?? (spec.format === 'spark' ? 'catch-stars' : 'neon-runner'),
    format: spec.format === 'spark' ? 'spark' : 'game',
    tags: [spec.genre, ...spec.extensions.slice(0, 3)],
    competitiveEligible: spec.competitiveEligible,
  });

  await db.gameCreationSession.update({
    where: { id: sessionId },
    data: {
      status: 'completed',
      resultExperienceId: experienceId,
    },
  });

  return { sessionId, experienceId, spec };
}

/**
 * Get a session's current state.
 */
export async function getDesignSession(sessionId: string): Promise<{
  spec: GameSpecification;
  compatibility: ReturnType<typeof validateCompatibility> | null;
  compiledPrompt: string | null;
  status: string;
  experienceId: string | null;
} | null> {
  const session = await db.gameCreationSession.findUnique({ where: { id: sessionId } });
  if (!session) return null;

  return {
    spec: JSON.parse(session.generatedSpecJson),
    compatibility: session.compatibilityJson && session.compatibilityJson !== '{}'
      ? JSON.parse(session.compatibilityJson)
      : null,
    compiledPrompt: session.compiledPrompt,
    status: session.status,
    experienceId: session.resultExperienceId,
  };
}
