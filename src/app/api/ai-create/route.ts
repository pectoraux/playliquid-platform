import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  generateGameProposal,
  type AIGameProposal,
  type AIGameFormat,
} from '@/lib/runtime/ai-game-generator';
import { createEngineExperience } from '@/lib/runtime/runtime-service';

// ─── POST /api/ai-create ───────────────────────────────────────────────────
//
// Two modes:
//
//   1. Generate mode (default):
//      Body: { prompt: string }
//      Returns: { proposal: AIGameProposal }
//
//   2. Publish mode (when ?mode=publish):
//      Body: { proposal: AIGameProposal }
//      Returns: { experienceId: string, published: true }
//
// The LLM is invoked server-side only (z-ai-web-dev-sdk is not bundled
// into the client).

const generateSchema = z.object({
  prompt: z.string().min(1),
});

const proposalSchema = z.object({
  proposal: z.object({
    title: z.string(),
    description: z.string(),
    format: z.enum(['game', 'spark']) as z.ZodType<AIGameFormat>,
    engineGameId: z.string(),
    gameName: z.string(),
    tags: z.array(z.string()),
    competitiveEligible: z.boolean(),
    balanceParams: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])),
    reasoning: z.string(),
    source: z.enum(['ai', 'rule']),
  }),
});

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('mode');

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // ── Publish mode ────────────────────────────────────────────────────────
  if (mode === 'publish') {
    const parsed = proposalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const proposal = parsed.data.proposal as AIGameProposal;

    try {
      const result = await createEngineExperience({
        title: proposal.title,
        description: proposal.description,
        engineGameId: proposal.engineGameId,
        format: proposal.format,
        tags: proposal.tags,
        competitiveEligible: proposal.competitiveEligible,
      });
      return NextResponse.json({
        experienceId: result.experienceId,
        published: true,
        proposal,
      });
    } catch (err) {
      return NextResponse.json(
        { error: `Failed to publish experience: ${(err as Error).message}` },
        { status: 500 },
      );
    }
  }

  // ── Generate mode (default) ────────────────────────────────────────────
  const parsed = generateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  try {
    const proposal = await generateGameProposal(parsed.data.prompt);
    return NextResponse.json({ proposal });
  } catch (err) {
    return NextResponse.json(
      { error: `AI generation failed: ${(err as Error).message}` },
      { status: 500 },
    );
  }
}

// ─── GET /api/ai-create ────────────────────────────────────────────────────
//
// Returns the list of available engine templates + example prompts.
// Used by the AI Creation Studio to render the catalog picker UI.

export async function GET() {
  const { GAMES } = await import('@/engine/games');
  const { SPARKS } = await import('@/engine/sparks');
  const { EXAMPLE_PROMPTS } = await import('@/lib/runtime/ai-game-generator');

  const games = Object.values(GAMES).map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    format: g.format,
    tags: g.tags,
    configKeys: Object.keys(g.config),
  }));
  const sparks = Object.values(SPARKS).map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    format: s.format,
    tags: s.tags,
    configKeys: Object.keys(s.config),
  }));

  return NextResponse.json({
    templates: { games, sparks },
    examples: EXAMPLE_PROMPTS,
  });
}
