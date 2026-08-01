import { NextResponse } from 'next/server';
import { endLive } from '@/lib/social/social-service';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await endLive(id);
  return NextResponse.json({ ok: true });
}
