import { NextResponse } from 'next/server';
import { getCollectionItems } from '@/lib/social/social-service';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const items = await getCollectionItems(id);
  return NextResponse.json({ items });
}
