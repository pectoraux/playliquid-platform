import { NextResponse } from 'next/server';
import { submitChallengeEntry } from '@/lib/social/social-service';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const result = await submitChallengeEntry(id, body.userId, body.score);
  return NextResponse.json(result);
}
