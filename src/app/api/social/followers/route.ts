import { NextRequest, NextResponse } from 'next/server';
import { getFollowerCount } from '@/lib/social/social-v2';

// GET /api/social/followers?creatorId=X → { followers: number }
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const creatorId = url.searchParams.get('creatorId');

  if (!creatorId) {
    return NextResponse.json(
      { error: 'creatorId is required' },
      { status: 400 }
    );
  }

  const followers = await getFollowerCount(creatorId);
  return NextResponse.json({ followers });
}
