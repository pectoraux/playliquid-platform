import { NextRequest, NextResponse } from 'next/server';
import { createExperiment, getExperiments } from '@/lib/creator-os/creator-studio-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const creatorId = url.searchParams.get('creatorId') ?? 'creator_demo';
  const experiments = await getExperiments(creatorId);
  return NextResponse.json({ experiments });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const result = await createExperiment(body);
  return NextResponse.json(result);
}
