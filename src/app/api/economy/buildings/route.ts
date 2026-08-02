import { NextResponse } from 'next/server';
import { getBuildings, getAvailableBuildings, buildBuilding } from '@/lib/living/economy-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const worldId = url.searchParams.get('worldId');
  if (worldId) {
    const buildings = await getBuildings(worldId);
    return NextResponse.json({ buildings });
  }
  const available = getAvailableBuildings();
  return NextResponse.json({ available });
}
