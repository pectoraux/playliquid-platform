import { NextRequest, NextResponse } from 'next/server';
import { createTournament, getTournaments, createTeam, joinTeam, getTournamentTeams } from '@/lib/economy/tournament-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get('status') ?? undefined;
  const tournaments = await getTournaments(status);
  return NextResponse.json({ tournaments });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (body.action === 'createTeam') {
    const result = await createTeam(body);
    return NextResponse.json(result);
  }
  if (body.action === 'joinTeam') {
    await joinTeam(body.teamId, body.userId, body.displayName);
    return NextResponse.json({ ok: true });
  }
  if (body.action === 'getTeams') {
    const teams = await getTournamentTeams(body.tournamentId);
    return NextResponse.json({ teams });
  }
  const result = await createTournament(body);
  return NextResponse.json(result);
}
