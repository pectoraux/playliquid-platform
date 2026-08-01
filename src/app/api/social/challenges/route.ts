import { NextResponse } from 'next/server';
import { createChallenge, getChallenges } from '@/lib/social/social-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId') ?? undefined;
  const challenges = await getChallenges(userId);
  return NextResponse.json({ challenges });
}

export async function POST(req: Request) {
  const body = await req.json();
  const result = await createChallenge(body);
  return NextResponse.json(result);
}
