import { NextRequest, NextResponse } from 'next/server';
import { recordInstallation } from '@/lib/extensions/extension-service';

export async function POST(req: NextRequest) {
  const body = await req.json();
  await recordInstallation(body);
  return NextResponse.json({ ok: true });
}
