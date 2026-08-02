import { NextRequest, NextResponse } from 'next/server';
import {
  followCreator,
  unfollowCreator,
  isFollowing,
  getFollowerCount,
} from '@/lib/social/social-service';

// GET /api/social/follow?creatorId=X&viewerId=Y → { following, followers }
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const creatorId = url.searchParams.get('creatorId');
  const viewerId = url.searchParams.get('viewerId') ?? 'demo-user';

  if (!creatorId) {
    return NextResponse.json(
      { error: 'creatorId is required' },
      { status: 400 }
    );
  }

  const [following, followers] = await Promise.all([
    isFollowing(viewerId, creatorId),
    getFollowerCount(creatorId),
  ]);

  return NextResponse.json({ following, followers });
}

// POST /api/social/follow { creatorId, action, viewerId? }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const creatorId: string | undefined = body.creatorId;
  const action: string | undefined = body.action;
  const viewerId: string = body.viewerId ?? 'demo-user';

  if (!creatorId) {
    return NextResponse.json(
      { error: 'creatorId is required' },
      { status: 400 }
    );
  }

  if (action === 'follow') {
    const { following } = await followCreator(viewerId, creatorId);
    const followers = await getFollowerCount(creatorId);
    return NextResponse.json({ following, followers });
  }

  if (action === 'unfollow') {
    const { following } = await unfollowCreator(viewerId, creatorId);
    const followers = await getFollowerCount(creatorId);
    return NextResponse.json({ following, followers });
  }

  return NextResponse.json(
    { error: 'action must be "follow" or "unfollow"' },
    { status: 400 }
  );
}
