import { NextResponse } from 'next/server';
import { listExperiences } from '@/lib/studio-service';

export async function GET() {
  const experiences = await listExperiences();
  return NextResponse.json({ experiences });
}
