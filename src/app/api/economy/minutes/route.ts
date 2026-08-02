import { NextRequest, NextResponse } from 'next/server';
import { purchaseMinutes, getActiveMinutes, getMinutePurchases } from '@/lib/economy/minutes-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId') ?? 'demo-user';
  const experienceId = url.searchParams.get('experienceId');
  if (experienceId) {
    const active = await getActiveMinutes(userId, experienceId);
    return NextResponse.json({ active });
  }
  const purchases = await getMinutePurchases(userId);
  return NextResponse.json({ purchases });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const result = await purchaseMinutes({
    userId: body.userId ?? 'demo-user',
    experienceId: body.experienceId,
    minutes: body.minutes,
  });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 422 });
  return NextResponse.json(result);
}
