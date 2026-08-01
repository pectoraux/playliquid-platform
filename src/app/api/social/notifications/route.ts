import { NextResponse } from 'next/server';
import { getNotifications, getUnreadCount, markAllRead } from '@/lib/social/social-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId') ?? 'demo-user';
  const [notifications, unreadCount] = await Promise.all([
    getNotifications(userId),
    getUnreadCount(userId),
  ]);
  return NextResponse.json({ notifications, unreadCount });
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId') ?? 'demo-user';
  await markAllRead(userId);
  return NextResponse.json({ ok: true });
}
