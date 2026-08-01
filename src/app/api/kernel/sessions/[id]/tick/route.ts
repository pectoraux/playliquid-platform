import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { tick } from '@/lib/session-registry';

const tickSchema = z.object({
  ticks: z.number().int().min(1).max(100).default(1),
});

/**
 * POST /api/kernel/sessions/:id/tick
 * Advance the session by N ticks. Returns the inspector snapshot.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = tickSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const snapshot = tick(id, parsed.data.ticks);
  if (!snapshot) {
    return NextResponse.json({ error: 'session not found' }, { status: 404 });
  }
  return NextResponse.json({ snapshot });
}
