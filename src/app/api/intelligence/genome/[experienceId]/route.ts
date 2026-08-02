import { NextResponse } from 'next/server';
import { computeExperienceIntelligence, getExperienceIntelligence } from '@/lib/intelligence/genome-service';

export async function POST(_req: Request, { params }: { params: Promise<{ experienceId: string }> }) {
  const { experienceId } = await params;
  const result = await computeExperienceIntelligence(experienceId);
  if (!result) return NextResponse.json({ error: 'Experience not found' }, { status: 404 });
  return NextResponse.json({ genome: result });
}

export async function GET(_req: Request, { params }: { params: Promise<{ experienceId: string }> }) {
  const { experienceId } = await params;
  const result = await getExperienceIntelligence(experienceId);
  if (!result) return NextResponse.json({ error: 'Experience not found' }, { status: 404 });
  return NextResponse.json({ genome: result });
}
