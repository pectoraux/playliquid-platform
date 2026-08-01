import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { spawnCitizens } from '@/lib/civ/world-service';

const schema = z.object({
  count: z.number().int().min(1).max(500),
  roleDistribution: z.record(z.string(), z.number()).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  const result = await spawnCitizens({ worldId: id, count: parsed.data.count, roleDistribution: parsed.data.roleDistribution as any });
  return NextResponse.json(result);
}
