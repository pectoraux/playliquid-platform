import { NextResponse } from 'next/server';
import { checkAndAwardAchievements } from '@/lib/identity/achievement-service';

export async function POST(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const awarded = await checkAndAwardAchievements(userId);
  return NextResponse.json({ awarded });
}
