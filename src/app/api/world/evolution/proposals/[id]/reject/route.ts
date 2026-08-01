import { NextResponse } from 'next/server';
import { rejectProposal } from '@/lib/world/evolution-agent';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await rejectProposal(id);
  return NextResponse.json({ ok: true });
}
