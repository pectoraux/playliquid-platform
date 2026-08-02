import { NextResponse } from 'next/server';
import { getExtensionAnalytics } from '@/lib/extensions/extension-service';

export async function GET(_req: Request, { params }: { params: Promise<{ creatorId: string }> }) {
  const { creatorId } = await params;
  const analytics = await getExtensionAnalytics(creatorId);
  return NextResponse.json({ analytics });
}
