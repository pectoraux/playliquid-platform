import { NextRequest, NextResponse } from 'next/server';
import { setInsightStatus } from '@/lib/intelligence/autonomous-agents-service';

// POST /api/intelligence/agents/insight/[id]
//   { status: "SEEN" | "ACTED" | "DISMISSED" }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const status = body.status as 'NEW' | 'SEEN' | 'ACTED' | 'DISMISSED';
  if (!['NEW', 'SEEN', 'ACTED', 'DISMISSED'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }
  await setInsightStatus(id, status);
  return NextResponse.json({ ok: true });
}
