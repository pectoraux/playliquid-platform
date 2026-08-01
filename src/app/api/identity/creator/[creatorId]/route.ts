import { NextResponse } from 'next/server';
import { getCreatorIdentity } from '@/lib/identity/inventory-service';

export async function GET(_req: Request, { params }: { params: Promise<{ creatorId: string }> }) {
  const { creatorId } = await params;
  const identity = await getCreatorIdentity(creatorId);
  if (!identity) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ identity });
}
