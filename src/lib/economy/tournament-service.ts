/**
 * ADR-010: Tournament Service
 * -----------------------------
 * Tournaments are separate from games.
 * Teams compete across multiple experiences over a duration.
 */

import { db } from '@/lib/db';

export async function createTournament(params: {
  name: string;
  description: string;
  organizerId: string;
  organizerName: string;
  startsAt: Date;
  endsAt: Date;
  entryFeeXof?: number;
  experiences: string[];
  teamDistributionPolicy?: string;
  maxTeams?: number;
  maxTeamSize?: number;
  admissionType?: string;
}): Promise<{ tournamentId: string }> {
  const tournament = await db.tournamentRecord.create({
    data: {
      name: params.name,
      description: params.description,
      organizerId: params.organizerId,
      organizerName: params.organizerName,
      startsAt: params.startsAt,
      endsAt: params.endsAt,
      entryFeeXof: params.entryFeeXof ?? 0,
      experiencesJson: JSON.stringify(params.experiences),
      teamDistributionPolicy: params.teamDistributionPolicy ?? 'equal',
      maxTeams: params.maxTeams,
      maxTeamSize: params.maxTeamSize ?? 5,
      admissionType: params.admissionType ?? 'open',
    },
  });
  return { tournamentId: tournament.id };
}

export async function createTeam(params: {
  tournamentId: string;
  name: string;
  captainId: string;
  captainName: string;
}): Promise<{ teamId: string }> {
  const team = await db.tournamentTeamRecord.create({
    data: {
      tournamentId: params.tournamentId,
      name: params.name,
      captainId: params.captainId,
      captainName: params.captainName,
      membersJson: JSON.stringify([{ userId: params.captainId, displayName: params.captainName }]),
    },
  });
  return { teamId: team.id };
}

export async function joinTeam(teamId: string, userId: string, displayName: string): Promise<void> {
  const team = await db.tournamentTeamRecord.findUnique({ where: { id: teamId } });
  if (!team) return;
  const members = JSON.parse(team.membersJson);
  if (!members.find((m: any) => m.userId === userId)) {
    members.push({ userId, displayName });
    await db.tournamentTeamRecord.update({
      where: { id: teamId },
      data: { membersJson: JSON.stringify(members) },
    });
  }
}

export async function getTournaments(status?: string): Promise<any[]> {
  const where: any = {};
  if (status) where.status = status;
  const tournaments = await db.tournamentRecord.findMany({
    where,
    orderBy: { startsAt: 'desc' },
    take: 20,
  });
  return tournaments.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    organizerName: t.organizerName,
    status: t.status,
    startsAt: t.startsAt.getTime(),
    endsAt: t.endsAt.getTime(),
    prizePoolXof: t.prizePoolXof,
    prizePoolLiquid: t.prizePoolXof / 1_000_000,
    entryFeeXof: t.entryFeeXof,
    experiences: JSON.parse(t.experiencesJson),
    teamDistributionPolicy: t.teamDistributionPolicy,
    maxTeams: t.maxTeams,
    maxTeamSize: t.maxTeamSize,
    admissionType: t.admissionType,
  }));
}

export async function getTournamentTeams(tournamentId: string): Promise<any[]> {
  const teams = await db.tournamentTeamRecord.findMany({
    where: { tournamentId },
    orderBy: { totalScore: 'desc' },
  });
  return teams.map((t) => ({
    id: t.id,
    name: t.name,
    captainName: t.captainName,
    members: JSON.parse(t.membersJson),
    totalScore: t.totalScore,
    rank: t.rank,
  }));
}
