import { NextResponse } from 'next/server';
import { getSparks } from '@/lib/consumer-v2/consumer-service';

export async function GET() {
  const sparks = await getSparks(10);
  return NextResponse.json({ sparks });
}
