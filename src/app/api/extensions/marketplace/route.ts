import { NextResponse } from 'next/server';
import { getExtensions } from '@/lib/extensions/extension-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const category = url.searchParams.get('category') ?? undefined;
  const sort = (url.searchParams.get('sort') ?? 'trending') as any;
  const extensions = await getExtensions({ category, sort });
  return NextResponse.json({ extensions });
}
