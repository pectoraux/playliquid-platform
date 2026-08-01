import { NextResponse } from 'next/server';
import { getWorldPassport } from '@/lib/identity/inventory-service';

export async function GET(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const passport = await getWorldPassport(userId);
  return NextResponse.json({ passport });
}
