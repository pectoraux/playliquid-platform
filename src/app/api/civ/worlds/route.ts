import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createWorld, listWorlds } from '@/lib/civ/world-service';

const createSchema = z.object({
  experienceId: z.string(),
  name: z.string(),
  description: z.string(),
  creatorId: z.string().default('creator_demo'),
});

export async function GET() {
  const worlds = await listWorlds();
  return NextResponse.json({ worlds });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  const world = await createWorld(parsed.data);
  return NextResponse.json({ world });
}
