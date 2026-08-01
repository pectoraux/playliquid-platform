import { NextRequest, NextResponse } from 'next/server';
import { executeWorldTrade } from '@/lib/multiverse/multiverse-service';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const result = await executeWorldTrade(body);
  return NextResponse.json(result);
}
