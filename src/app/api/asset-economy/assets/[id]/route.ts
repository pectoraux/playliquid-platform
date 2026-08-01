import { NextResponse } from 'next/server';
import { getAsset } from '@/lib/asset-economy/asset-service';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const asset = await getAsset(id);
  if (!asset) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ asset });
}
