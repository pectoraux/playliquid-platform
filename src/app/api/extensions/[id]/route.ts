import { NextResponse } from 'next/server';
import { getExtension, getUsedTogether } from '@/lib/extensions/extension-service';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const extension = await getExtension(id);
  if (!extension) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const usedTogether = await getUsedTogether(id, 5);
  return NextResponse.json({ extension, usedTogether });
}
