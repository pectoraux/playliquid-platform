import { NextResponse } from 'next/server';
import { getInventory } from '@/lib/identity/inventory-service';

export async function GET(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const inventory = await getInventory(userId);
  return NextResponse.json({ inventory });
}
