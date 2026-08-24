import { Prisma, PrismaClient } from '@prisma/client';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { externalDatasetSchema, type ExternalDataset } from './external-data.schema';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();
const marketOrder: Record<string, number> = { ML0: 1, OU200: 2, QA158: 3, ML235: 4 };

type TeamMetadata = Record<string, { countryCode?: string; fifaCode?: string; shortName?: string }>;
type GroupFixture = { eventGroups: Record<string, string> };

function json(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value == null
    ? Prisma.JsonNull
    : (JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue);
}

async function loadJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(resolve(path), 'utf8')) as T;
}

async function loadDataset(): Promise<ExternalDataset> {
  const raw = await loadJson<unknown>('data/world-cup-events.json');
  return externalDatasetSchema.parse(raw);
}

async function seedReferenceData(): Promise<void> {
  const phases = [
    ['GROUP_STAGE', 'Fase de grupos', 1],
    ['ROUND_OF_32', '16vos', 2],
    ['ROUND_OF_16', '8vos', 3],
    ['QUARTER_FINAL', '4tos', 4],
    ['SEMI_FINAL', 'Semifinal', 5],
    ['THIRD_PLACE', 'Tercer puesto', 6],
    ['FINAL', 'Final', 7],
  ] as const;
  for (const [code, name, order] of phases) {
    await prisma.phase.upsert({
      where: { code },
      create: { code, name, order },
      update: { name, order },
    });
  }
  const groups = ['UNASSIGNED', ...'ABCDEFGHIJKL'.split('').map((letter) => `GROUP_${letter}`)];
  for (const [index, code] of groups.entries()) {
    const name = code === 'UNASSIGNED' ? 'Sin asignar' : `Grupo ${code.slice(-1)}`;
    await prisma.tournamentGroup.upsert({
      where: { code },
      create: { code, name, order: index },
      update: { name, order: index },
    });
  }
}

async function seedEvents(dataset: ExternalDataset): Promise<void> {
  const teamMetadata = await loadJson<TeamMetadata>('data/team-metadata.json');
  const groupFixture = await loadJson<GroupFixture>('data/world-cup-groups.json');
  const phase = await prisma.phase.findUniqueOrThrow({ where: { code: 'GROUP_STAGE' } });
  const unassigned = await prisma.tournamentGroup.findUniqueOrThrow({
    where: { code: 'UNASSIGNED' },
  });
  for (const source of dataset.Events) {
    const competition = await prisma.competition.upsert({
      where: { externalId: source.LeagueId },
      create: { externalId: source.LeagueId, name: source.LeagueName },
      update: { name: source.LeagueName },
    });
    const teams = new Map<string, string>();
    for (const participant of source.Participants) {
      const metadata = teamMetadata[participant.Name] ?? {};
      const team = await prisma.team.upsert({
        where: { externalId: participant._id },
        create: {
          externalId: participant._id,
          name: participant.Name,
          shortName: metadata.shortName ?? null,
          countryCode: metadata.countryCode ?? null,
          fifaCode: metadata.fifaCode ?? null,
          sourceCountry: participant.Country ?? null,
          sourceMetadata: json(participant),
        },
        update: {
          name: participant.Name,
          shortName: metadata.shortName ?? null,
          countryCode: metadata.countryCode ?? null,
          fifaCode: metadata.fifaCode ?? null,
          sourceCountry: participant.Country ?? null,
          sourceMetadata: json(participant),
        },
      });
      teams.set(participant.VenueRole, team.id);
    }
    const groupCode = groupFixture.eventGroups[source.EventName];
    const group = groupCode
      ? await prisma.tournamentGroup.findUniqueOrThrow({ where: { code: groupCode } })
      : unassigned;
    const startDate = new Date(source.StartEventDate);
    const estimatedEndDate = new Date(
      startDate.getTime() +
        Number(process.env.DEFAULT_FOOTBALL_EVENT_DURATION_MINUTES ?? 120) * 60_000,
    );
    const event = await prisma.event.upsert({
      where: { externalId: source._id },
      create: {
        externalId: source._id,
        name: source.EventName,
        startDate,
        estimatedEndDate,
        durationSource: 'ESTIMATED',
        externalLeagueId: source.LeagueId,
        externalStatus: source.Status == null ? null : String(source.Status),
        status: source.IsSuspended ? 'SUSPENDED' : source.IsLive ? 'LIVE' : 'SCHEDULED',
        isLive: source.IsLive,
        isSuspended: source.IsSuspended,
        earlyPayoutEnabled: source.IsEarlyPayout,
        statisticsEnabled: source.Settings?.HasStatistics === true,
        betBuilderEnabled: source.Settings?.IsBetBuilderEnabled === true,
        groupSource: groupCode ? 'VERIFIED_FIXTURE' : 'DATASET_FALLBACK',
        sourceMetadata: json({
          Metadata: source.Metadata,
          Score: source.Score,
          LiveGameState: source.LiveGameState,
        }),
        competitionId: competition.id,
        phaseId: phase.id,
        groupId: group.id,
        homeTeamId: teams.get('Home') ?? null,
        awayTeamId: teams.get('Away') ?? null,
      },
      update: {
        name: source.EventName,
        startDate,
        estimatedEndDate,
        externalStatus: source.Status == null ? null : String(source.Status),
        status: source.IsSuspended ? 'SUSPENDED' : source.IsLive ? 'LIVE' : 'SCHEDULED',
        isLive: source.IsLive,
        isSuspended: source.IsSuspended,
        earlyPayoutEnabled: source.IsEarlyPayout,
        statisticsEnabled: source.Settings?.HasStatistics === true,
        betBuilderEnabled: source.Settings?.IsBetBuilderEnabled === true,
        groupSource: groupCode ? 'VERIFIED_FIXTURE' : 'DATASET_FALLBACK',
        sourceMetadata: json({
          Metadata: source.Metadata,
          Score: source.Score,
          LiveGameState: source.LiveGameState,
        }),
        competitionId: competition.id,
        phaseId: phase.id,
        groupId: group.id,
        homeTeamId: teams.get('Home') ?? null,
        awayTeamId: teams.get('Away') ?? null,
      },
    });
    for (const [fallbackIndex, sourceMarket] of source.Markets.entries()) {
      const displayOrder = marketOrder[sourceMarket.MarketType._id] ?? 100 + fallbackIndex;
      const marketType = await prisma.marketType.upsert({
        where: { externalId: sourceMarket.MarketType._id },
        create: {
          externalId: sourceMarket.MarketType._id,
          name: sourceMarket.MarketType.Name,
          displayOrder,
          metadata: json(sourceMarket.MarketType),
        },
        update: {
          name: sourceMarket.MarketType.Name,
          displayOrder,
          metadata: json(sourceMarket.MarketType),
        },
      });
      const market = await prisma.market.upsert({
        where: { externalId: sourceMarket._id },
        create: {
          externalId: sourceMarket._id,
          name: sourceMarket.Name,
          isSuspended: sourceMarket.IsSuspended,
          isLive: sourceMarket.IsLive,
          sourceMetadata: json(sourceMarket),
          eventId: event.id,
          marketTypeId: marketType.id,
        },
        update: {
          name: sourceMarket.Name,
          isSuspended: sourceMarket.IsSuspended,
          isLive: sourceMarket.IsLive,
          sourceMetadata: json(sourceMarket),
          eventId: event.id,
          marketTypeId: marketType.id,
        },
      });
      for (const sourceSelection of sourceMarket.Selections) {
        await prisma.selection.upsert({
          where: { externalId: sourceSelection._id },
          create: {
            externalId: sourceSelection._id,
            name: sourceSelection.Name,
            decimalOdds: new Prisma.Decimal(sourceSelection.DisplayOdds.Decimal),
            isDisabled: sourceSelection.IsDisabled,
            status: sourceSelection.Status == null ? null : String(sourceSelection.Status),
            outcomeType:
              sourceSelection.OutcomeType == null ? null : String(sourceSelection.OutcomeType),
            points:
              sourceSelection.Points == null ? null : new Prisma.Decimal(sourceSelection.Points),
            sourceMetadata: json(sourceSelection),
            marketId: market.id,
          },
          update: {
            name: sourceSelection.Name,
            decimalOdds: new Prisma.Decimal(sourceSelection.DisplayOdds.Decimal),
            isDisabled: sourceSelection.IsDisabled,
            status: sourceSelection.Status == null ? null : String(sourceSelection.Status),
            outcomeType:
              sourceSelection.OutcomeType == null ? null : String(sourceSelection.OutcomeType),
            points:
              sourceSelection.Points == null ? null : new Prisma.Decimal(sourceSelection.Points),
            sourceMetadata: json(sourceSelection),
            marketId: market.id,
          },
        });
      }
    }
  }
}

async function main(): Promise<void> {
  const dataset = await loadDataset();
  await seedReferenceData();
  await seedEvents(dataset);
  const user = await prisma.user.upsert({
    where: { email: 'demo@apuestatotal.test' },
    create: { email: 'demo@apuestatotal.test', passwordHash: await argon2.hash('Demo12345!') },
    update: {},
  });
  await prisma.balance.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      amount: new Prisma.Decimal('200.00'),
      bonus: new Prisma.Decimal('0.00'),
      currency: 'PEN',
    },
    update: {},
  });
  console.info(`Seed completed: ${dataset.Events.length} events`);
}

void main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
