import { NextResponse } from 'next/server';
import { dismissInsight } from '@/lib/creator-intel/ai-team-service';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await dismissInsight(id);
  return NextResponse.json({ ok: true });
}
