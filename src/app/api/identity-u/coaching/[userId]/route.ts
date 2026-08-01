import { NextResponse } from 'next/server';
import { getCoachingInsights } from '@/lib/identity-universe/community-service';

export async function GET(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const insights = await getCoachingInsights(userId);
  return NextResponse.json({ insights });
}
