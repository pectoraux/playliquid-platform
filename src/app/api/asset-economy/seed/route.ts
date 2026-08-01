import { NextResponse } from 'next/server';
import { seedAssets } from '@/lib/asset-economy/asset-service';

export async function POST() {
  await seedAssets();
  return NextResponse.json({ ok: true });
}
