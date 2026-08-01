import { NextRequest, NextResponse } from 'next/server';
import { chatWithCompanion } from '@/lib/identity/companion-service';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const userId = body.userId ?? 'demo-user';
  const message = body.message ?? '';
  const result = await chatWithCompanion(userId, message);
  return NextResponse.json(result);
}
