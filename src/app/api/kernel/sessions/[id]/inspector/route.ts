import { NextResponse } from 'next/server';
import { snapshot } from '@/lib/session-registry';

/**
 * GET /api/kernel/sessions/:id/inspector
 * Returns the current inspector snapshot (live runtime state).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const snap = snapshot(id);
  if (!snap) {
    return NextResponse.json({ error: 'session not found' }, { status: 404 });
  }
  return NextResponse.json({ snapshot: snap });
}
