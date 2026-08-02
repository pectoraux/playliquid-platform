import { NextResponse } from 'next/server';
import { getAllExperienceIntelligence } from '@/lib/intelligence/genome-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get('limit') ?? 30);
  const genomes = await getAllExperienceIntelligence(limit);
  return NextResponse.json({ genomes });
}
