import { NextRequest, NextResponse } from 'next/server';
import { likeComment } from '@/lib/social/social-service';

// POST /api/social/comments/[id]/like → { likes: number }
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { error: 'comment id is required' },
      { status: 400 }
    );
  }

  try {
    const result = await likeComment(id);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to like comment';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
