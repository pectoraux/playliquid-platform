import { NextResponse } from 'next/server';
import { acceptChallenge } from '@/lib/social/social-service';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  await acceptChallenge(id, body.userId);
  return NextResponse.json({ ok: true });
}
