import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { compileBundle } from '@/kernel/compiler';
import { resolveExtension } from '@/kernel/extensions';
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

const bundleSchema = z.object({
  type: z.enum(['GAME', 'SPARK']),
  name: z.string().optional(),
  instances: z.array(instanceSchema),
  wires: z.array(wireSchema),
});

const compileSchema = z.object({
  bundle: bundleSchema,
});

/**
 * POST /api/kernel/compile
 * Validates a bundle and returns the compiled graph (or errors).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = compileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { valid: false, errors: [{ code: 'INVALID_INPUT', message: parsed.error.message }] },
      { status: 400 },
    );
  }

  const bundle = parsed.data.bundle as ExperienceBundle;
  const graph = compileBundle(bundle, resolveExtension);

  return NextResponse.json({
    valid: graph.valid,
    errors: graph.errors,
    executionOrder: graph.executionOrder,
    deterministic: graph.deterministic,
    declaredTokens: graph.declaredTokens,
    contentHash: graph.contentHash,
  });
}
