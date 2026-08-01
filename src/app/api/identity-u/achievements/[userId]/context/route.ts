import { NextResponse } from 'next/server';
import { getAchievementContext } from '@/lib/identity-universe/community-service';

export async function GET(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const context = await getAchievementContext(userId);
  return NextResponse.json({ achievements: context });
}
