import { NextResponse } from 'next/server';
import { recomputeAllCreatorIntelligence } from '@/lib/intelligence/creator-intelligence-service';

export async function POST(_req: Request) {
  const result = await recomputeAllCreatorIntelligence();
  return NextResponse.json(result);
}
