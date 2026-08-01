import { NextResponse } from 'next/server';
import { getAllCivilizations } from '@/lib/multiverse/multiverse-service';

export async function GET() {
  const civs = await getAllCivilizations();
  return NextResponse.json({ civilizations: civs });
}
