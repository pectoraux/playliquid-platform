import { NextResponse } from 'next/server';
import { getCreatorAssets } from '@/lib/asset-economy/asset-service';

export async function GET(_req: Request, { params }: { params: Promise<{ creatorId: string }> }) {
  const { creatorId } = await params;
  const result = await getCreatorAssets(creatorId);
  return NextResponse.json(result);
}
