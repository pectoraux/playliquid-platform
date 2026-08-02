import { NextResponse } from 'next/server';
import { getWallet } from '@/lib/economy/liquid-wallet-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId') ?? 'demo-user';
  const wallet = await getWallet(userId);
  return NextResponse.json({ wallet });
}
