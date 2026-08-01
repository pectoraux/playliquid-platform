import { NextRequest, NextResponse } from 'next/server';
import { formRelation } from '@/lib/multiverse/multiverse-service';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const result = await formRelation(body);
  return NextResponse.json(result);
}
