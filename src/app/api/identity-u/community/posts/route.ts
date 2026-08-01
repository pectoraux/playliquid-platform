import { NextRequest, NextResponse } from 'next/server';
import { createCommunityPost, upvotePost } from '@/lib/identity-universe/community-service';

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (body.action === 'upvote') {
    await upvotePost(body.postId);
    return NextResponse.json({ ok: true });
  }
  const result = await createCommunityPost(body);
  return NextResponse.json(result);
}
