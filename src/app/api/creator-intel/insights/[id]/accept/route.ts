import { NextResponse } from 'next/server';
import { acceptInsight } from '@/lib/creator-intel/ai-team-service';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await acceptInsight(id);
  return NextResponse.json({ ok: true });
}
