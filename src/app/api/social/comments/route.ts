import { NextRequest, NextResponse } from 'next/server';
import { getComments, postComment } from '@/lib/social/social-v2';

// GET /api/social/comments?experienceId=X → { comments: Comment[] }
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const experienceId = url.searchParams.get('experienceId');
  const limitParam = url.searchParams.get('limit');
  const limit = limitParam ? Math.min(200, Math.max(1, Number(limitParam) || 50)) : 50;

  if (!experienceId) {
    return NextResponse.json(
      { error: 'experienceId is required' },
      { status: 400 }
    );
  }

  const comments = await getComments(experienceId, limit);
  return NextResponse.json({ comments });
}

// POST /api/social/comments { experienceId, body, userId?, displayName?, parentId? }
export async function POST(req: NextRequest) {
  const data = await req.json().catch(() => ({}));
  const experienceId: string | undefined = data.experienceId;
  const body: string | undefined = data.body;

  if (!experienceId) {
    return NextResponse.json(
      { error: 'experienceId is required' },
      { status: 400 }
    );
  }
  if (!body || typeof body !== 'string' || body.trim().length === 0) {
    return NextResponse.json(
      { error: 'body is required' },
      { status: 400 }
    );
  }

  const comment = await postComment({
    experienceId,
    body: body.trim(),
    userId: data.userId,
    displayName: data.displayName,
    parentId: data.parentId,
  });

  return NextResponse.json({ comment });
}
