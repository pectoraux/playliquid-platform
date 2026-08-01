import { NextRequest, NextResponse } from 'next/server';
import { computeReputation, submitRating } from '@/lib/universe/rating-service';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ experienceId: string }> }) {
  const { experienceId } = await params;
  const reputation = await computeReputation(experienceId);
  return NextResponse.json({ reputation });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ experienceId: string }> }) {
  const { experienceId } = await params;
  const body = await req.json();
  await submitRating({
    experienceId,
    userId: body.userId ?? 'demo-user',
    overallScore: body.score ?? 50,
    reviewText: body.reviewText,
  });
  return NextResponse.json({ ok: true });
}
