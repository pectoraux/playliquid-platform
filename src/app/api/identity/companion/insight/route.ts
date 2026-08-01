import { NextResponse } from 'next/server';
import { getCompanionInsight } from '@/lib/identity/companion-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId') ?? 'demo-user';
  const result = await getCompanionInsight(userId);
  return NextResponse.json(result);
}
