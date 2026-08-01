import { NextResponse } from 'next/server';
import { getPlayerWallet } from '@/lib/social/social-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId') ?? 'demo-user';
  const wallet = await getPlayerWallet(userId);
  return NextResponse.json({ wallet });
}
