import { NextResponse } from 'next/server';
import { proposeFork } from '@/lib/evolution/sandbox-service';

// POST /api/evolution/[experienceId]/fork
// AI generates a "new version" fork proposal (Phase 20.5).
export async function POST(_req: Request, { params }: { params: Promise<{ experienceId: string }> }) {
  const { experienceId } = await params;
  const result = await proposeFork(experienceId);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 422 });
  return NextResponse.json(result);
}
