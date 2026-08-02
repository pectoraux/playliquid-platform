import { NextRequest, NextResponse } from 'next/server';
import { applyApprovedMutation } from '@/lib/evolution/sandbox-service';

// POST /api/evolution/mutations/[id]/apply
//   { mode: "replace" | "publish-new" | "discard" }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const mode = body.mode === 'publish-new' ? 'publish-new' : body.mode === 'discard' ? 'discard' : 'replace';

  const result = await applyApprovedMutation({ mutationId: id, mode });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 422 });
  return NextResponse.json({ ok: true, ...result });
}
