import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createDraft, listDrafts } from '@/lib/studio-service';

const intentSchema = z.object({
  kind: z.enum(['GAME', 'SPARK', 'SIMULATION', 'CHALLENGE', 'LEARNING']),
  emotions: z.array(z.enum(['competition', 'discovery', 'creativity', 'mastery', 'relaxation', 'social', 'strategy'])),
  goals: z.array(z.string()),
  audience: z.string(),
  description: z.string(),
});

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

const createDraftSchema = z.object({
  title: z.string(),
  description: z.string(),
  bundle: bundleSchema,
  intent: intentSchema,
  parentExperienceId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = createDraftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const draft = createDraft(parsed.data);
  return NextResponse.json({ draft });
}

export async function GET() {
  return NextResponse.json({ drafts: listDrafts() });
}
