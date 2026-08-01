import { NextRequest, NextResponse } from 'next/server';
import { rateAsset } from '@/lib/asset-economy/asset-service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  await rateAsset(id, body.userId ?? 'demo-user', body.rating);
  return NextResponse.json({ ok: true });
}
