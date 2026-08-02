import { NextResponse } from 'next/server';
import { getExtensionFeed, seedExtensionRecords } from '@/lib/extensions/extension-service';

export async function GET() {
  await seedExtensionRecords().catch(() => {});
  const feed = await getExtensionFeed();
  return NextResponse.json({ feed });
}
