import { NextResponse } from 'next/server';
import { getCompanionMessages } from '@/lib/identity/companion-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId') ?? 'demo-user';
  const messages = await getCompanionMessages(userId);
  return NextResponse.json({ messages });
}
