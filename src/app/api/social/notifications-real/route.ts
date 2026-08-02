import { NextRequest, NextResponse } from 'next/server';
import { getNotifications, markNotificationsRead, getUnreadCount } from '@/lib/social/engagement-service';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId') ?? 'demo-user';
  const action = url.searchParams.get('action');

  if (action === 'unread') {
    const count = await getUnreadCount(userId);
    return NextResponse.json({ unread: count });
  }

  const notifications = await getNotifications(userId);
  return NextResponse.json({ notifications });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const userId = body.userId ?? 'demo-user';
  await markNotificationsRead(userId);
  return NextResponse.json({ ok: true });
}
