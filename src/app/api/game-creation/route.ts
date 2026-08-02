import { NextRequest, NextResponse } from 'next/server';
import { startDesignSession, refineDesignSession, compileDesignSession, generateExperience } from '@/lib/game-creation/generation-orchestrator';
import type { GameFormat } from '@/lib/game-creation/game-spec-schema';

/**
 * POST /api/game-creation
 *   { action: "design" | "refine" | "compile" | "generate", description?, sessionId?, feedback?, formatHint? }
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const action = body.action ?? 'design';

  try {
    if (action === 'design') {
      if (!body.description) {
        return NextResponse.json({ error: 'description is required for design action' }, { status: 400 });
      }
      const formatHint = body.formatHint as GameFormat | undefined;
      const result = await startDesignSession(body.description, formatHint);
      return NextResponse.json(result);
    }

    if (action === 'refine') {
      if (!body.sessionId || !body.feedback) {
        return NextResponse.json({ error: 'sessionId and feedback are required for refine action' }, { status: 400 });
      }
      const result = await refineDesignSession(body.sessionId, body.feedback);
      return NextResponse.json(result);
    }

    if (action === 'compile') {
      if (!body.sessionId) {
        return NextResponse.json({ error: 'sessionId is required for compile action' }, { status: 400 });
      }
      const result = await compileDesignSession(body.sessionId);
      return NextResponse.json(result);
    }

    if (action === 'generate') {
      if (!body.sessionId) {
        return NextResponse.json({ error: 'sessionId is required for generate action' }, { status: 400 });
      }
      const result = await generateExperience(body.sessionId);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
