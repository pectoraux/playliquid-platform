import { NextRequest, NextResponse } from 'next/server';
import { saveSpark, unsaveSpark } from '@/lib/consumer/discover-service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ experienceId: string }> }) {
  const { experienceId } = await params;
  const body = await req.json().catch(() => ({}));
  const userId = body.userId ?? 'demo-user';
  await saveSpark(userId, experienceId);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ experienceId: string }> }) {
  const { experienceId } = await params;
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId') ?? 'demo-user';
  await unsaveSpark(userId, experienceId);
  return NextResponse.json({ ok: true });
}
