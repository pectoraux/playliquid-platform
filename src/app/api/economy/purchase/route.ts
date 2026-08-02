import { NextRequest, NextResponse } from 'next/server';
import { purchaseLiquid } from '@/lib/economy/liquid-wallet-service';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const result = await purchaseLiquid({
    userId: body.userId ?? 'demo-user',
    amountXof: body.amountXof,
    paymentProvider: body.paymentProvider,
    paymentRef: body.paymentRef,
  });
  return NextResponse.json(result);
}
