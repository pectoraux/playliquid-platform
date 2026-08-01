import { NextResponse } from 'next/server';
import { getMarketplaceItems, getMarketplaceSummary } from '@/lib/creator-intel/evolution-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const type = url.searchParams.get('type') ?? undefined;
  const summary = url.searchParams.get('summary') === 'true';
  if (summary) {
    const s = await getMarketplaceSummary();
    return NextResponse.json({ summary: s });
  }
  const items = await getMarketplaceItems(type);
  return NextResponse.json({ items });
}
