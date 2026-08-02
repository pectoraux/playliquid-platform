import { NextRequest, NextResponse } from 'next/server';
import { toggleLike, isLiked, getLikedExperiences } from '@/lib/social/engagement-service';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { experienceId, userId } = body;
  if (!experienceId) return NextResponse.json({ error: 'experienceId required' }, { status: 400 });
  const result = await toggleLike(experienceId, userId ?? 'demo-user');
  return NextResponse.json(result);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const experienceId = url.searchParams.get('experienceId');
  const userId = url.searchParams.get('userId') ?? 'demo-user';

  if (experienceId) {
    const liked = await isLiked(experienceId, userId);
    return NextResponse.json({ liked });
  }

  const likedExps = await getLikedExperiences(userId);
  return NextResponse.json({ experiences: likedExps });
}
