import { NextResponse } from 'next/server';
import { listAssets, getAssetMarketSummary } from '@/lib/civ/asset-service';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const summary = url.searchParams.get('summary') === 'true';
  if (summary) {
    const s = await getAssetMarketSummary(id);
    return NextResponse.json({ summary: s });
  }
  const assets = await listAssets(id);
  return NextResponse.json({ assets });
}
