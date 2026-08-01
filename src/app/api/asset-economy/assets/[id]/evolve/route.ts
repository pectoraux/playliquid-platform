import { NextRequest, NextResponse } from 'next/server';
import { evolveAsset } from '@/lib/asset-economy/asset-service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const result = await evolveAsset({ assetId: id, ...body });
  return NextResponse.json(result);
}
