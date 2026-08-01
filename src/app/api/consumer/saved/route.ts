import { NextResponse } from 'next/server';
import { getSavedSparks } from '@/lib/consumer/discover-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId') ?? 'demo-user';
  const saved = await getSavedSparks(userId);
  return NextResponse.json({ saved });
}
