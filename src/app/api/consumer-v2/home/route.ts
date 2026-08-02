import { NextResponse } from 'next/server';
import { getYouTubeHome } from '@/lib/consumer-v2/consumer-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId') ?? 'demo-user';
  const home = await getYouTubeHome(userId);
  return NextResponse.json({ home });
}
