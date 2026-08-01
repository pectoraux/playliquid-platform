import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sendAction } from '@/lib/session-registry';

const actionSchema = z.object({
  instanceId: z.string(),
  action: z.string(),
  payload: z.unknown().optional(),
});

/**
 * POST /api/kernel/sessions/:id/action
 * Apply a user action (e.g. move-up) to a specific extension instance.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const snapshot = sendAction(id, parsed.data.instanceId, parsed.data.action, parsed.data.payload);
  if (!snapshot) {
    return NextResponse.json({ error: 'session not found' }, { status: 404 });
  }
  return NextResponse.json({ snapshot });
}
