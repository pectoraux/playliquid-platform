import { NextResponse } from 'next/server';
import { getRoyaltyGraph } from '@/lib/world/economy-service';

export async function GET(_req: Request, { params }: { params: Promise<{ experienceId: string }> }) {
  const { experienceId } = await params;
  const shares = await getRoyaltyGraph(experienceId);
  return NextResponse.json({ shares });
}
