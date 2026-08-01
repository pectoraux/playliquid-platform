import { NextResponse } from 'next/server';
import { seedMarketplace } from '@/lib/creator-intel/evolution-service';

export async function POST() {
  await seedMarketplace();
  return NextResponse.json({ ok: true });
}
