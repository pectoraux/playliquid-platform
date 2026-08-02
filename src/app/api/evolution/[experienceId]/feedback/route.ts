import { NextRequest, NextResponse } from 'next/server';
import { submitFeedback, getFeedbackSummary } from '@/lib/evolution/feedback-store';
import type { FeedbackType } from '@/lib/evolution/evolution-types';

const VALID_TYPES: FeedbackType[] = ['FUN', 'CONFUSING', 'TOO_HARD', 'BUG', 'SUGGESTION'];

export async function GET(_req: Request, { params }: { params: Promise<{ experienceId: string }> }) {
  const { experienceId } = await params;
  const summary = await getFeedbackSummary(experienceId);
  return NextResponse.json(summary);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ experienceId: string }> }) {
  const { experienceId } = await params;
  const body = await req.json().catch(() => ({}));
  const type = String(body.type ?? '').toUpperCase() as FeedbackType;
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: `Invalid type. Must be one of ${VALID_TYPES.join(', ')}` }, { status: 400 });
  }
  const record = await submitFeedback({
    experienceId,
    playerId: body.playerId,
    sessionId: body.sessionId,
    type,
    funScore: Number(body.funScore ?? 0),
    difficultyScore: Number(body.difficultyScore ?? 0),
    emotionScore: Number(body.emotionScore ?? 0),
    comment: body.comment,
  });
  return NextResponse.json({ ok: true, feedback: record });
}
