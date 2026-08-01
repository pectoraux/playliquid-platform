import { NextRequest, NextResponse } from 'next/server';
import { installAsset } from '@/lib/asset-economy/asset-service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const result = await installAsset({ assetId: id, ...body });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 422 });
  return NextResponse.json({ ok: true });
}
