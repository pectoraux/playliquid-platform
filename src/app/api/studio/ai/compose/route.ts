import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { composeExperience } from '@/lib/ai-composer';
import type { ExperienceIntent } from '@/kernel/types';

const composeSchema = z.object({
  description: z.string(),
  intent: z.object({
    kind: z.enum(['GAME', 'SPARK', 'SIMULATION', 'CHALLENGE', 'LEARNING']),
    emotions: z.array(z.enum(['competition', 'discovery', 'creativity', 'mastery', 'relaxation', 'social', 'strategy'])),
    goals: z.array(z.string()),
    audience: z.string(),
    description: z.string(),
  }),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = composeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const result = await composeExperience(parsed.data.description, parsed.data.intent as ExperienceIntent);
  return NextResponse.json(result);
}
