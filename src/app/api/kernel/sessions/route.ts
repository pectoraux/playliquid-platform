import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { startSession } from '@/lib/session-registry';
import type { ExperienceBundle } from '@/kernel/types';

const wireSchema = z.object({
  from: z.object({ instance: z.string(), channel: z.string() }),
  to: z.object({ instance: z.string(), channel: z.string() }),
});

const instanceSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  config: z.record(z.string(), z.unknown()).optional(),
  role: z.enum(['core', 'mechanic', 'economy', 'social', 'ai-advisory', 'render']).optional(),
});

const startSchema = z.object({
  experienceId: z.string(),
  bundle: z.object({
    type: z.enum(['GAME', 'SPARK']),
    name: z.string().optional(),
    instances: z.array(instanceSchema),
    wires: z.array(wireSchema),
  }),
  mode: z.enum(['PREVIEW', 'EARN']).optional(),
  userId: z.string().optional(),
});

/**
 * POST /api/kernel/sessions
 * Compiles the bundle and starts a runtime session.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = startSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { valid: false, errors: [{ code: 'INVALID_INPUT', message: parsed.error.message }] },
      { status: 400 },
    );
  }

  const result = await startSession({
    experienceId: parsed.data.experienceId,
    bundle: parsed.data.bundle as ExperienceBundle,
    mode: parsed.data.mode,
    userId: parsed.data.userId,
  });

  if (!result.valid) {
    return NextResponse.json({ valid: false, errors: result.errors.map((m) => ({ code: 'COMPILE', message: m })) }, { status: 422 });
  }

  return NextResponse.json({ valid: true, sessionId: result.sessionId });
}
