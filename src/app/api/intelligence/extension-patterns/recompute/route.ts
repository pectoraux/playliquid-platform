import { NextResponse } from 'next/server';
import { recomputeCompositionPatterns } from '@/lib/intelligence/extension-genome-service';

export async function POST(_req: Request) {
  const result = await recomputeCompositionPatterns();
  return NextResponse.json(result);
}
