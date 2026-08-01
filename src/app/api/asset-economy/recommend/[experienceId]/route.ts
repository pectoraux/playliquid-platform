import { NextResponse } from 'next/server';
import { getAIAssetRecommendations } from '@/lib/asset-economy/asset-service';

export async function GET(_req: Request, { params }: { params: Promise<{ experienceId: string }> }) {
  const { experienceId } = await params;
  const recommendations = await getAIAssetRecommendations(experienceId);
  return NextResponse.json({ recommendations });
}
