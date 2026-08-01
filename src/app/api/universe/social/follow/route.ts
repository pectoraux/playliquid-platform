import { NextRequest, NextResponse } from 'next/server';
import { followUser, unfollowUser } from '@/lib/universe/social-service';

export async function POST(req: NextRequest) {
  const body = await req.json();
  await followUser(body.followerId ?? 'demo-user', body.targetUserId);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const url = new URL(req.url);
  const followerId = url.searchParams.get('followerId') ?? 'demo-user';
  const targetUserId = url.searchParams.get('targetUserId')!;
  await unfollowUser(followerId, targetUserId);
  return NextResponse.json({ ok: true });
}
