import { NextResponse } from 'next/server';
import { getLiveStreams, goLive } from '@/lib/consumer-v2/consumer-service';

export async function GET() {
  const live = await getLiveStreams(10);
  return NextResponse.json({ live });
}

export async function POST(req: Request) {
  const body = await req.json();
  const result = await goLive(body);
  return NextResponse.json(result);
}
