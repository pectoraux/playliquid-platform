import { NextResponse } from 'next/server';
import { approveProposal } from '@/lib/world/evolution-agent';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await approveProposal(id);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }
  return NextResponse.json({ newExperienceId: result.newExperienceId });
}
