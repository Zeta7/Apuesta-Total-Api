import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EventStatus, Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { DomainError } from '../../common/domain/domain.error';
import { CacheService } from '../../common/infrastructure/cache/cache.service';
import { PrismaService } from '../../common/infrastructure/prisma/prisma.service';
import type { ListEventsQuery } from '../presentation/dto/list-events.query';

const eventInclude = {
  competition: true,
  phase: true,
  group: true,
  homeTeam: true,
  awayTeam: true,
  _count: { select: { markets: true } },
} satisfies Prisma.EventInclude;

@Injectable()
export class EventsService {
  private readonly ttl: number;
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    config: ConfigService,
  ) {
    this.ttl = config.get<number>('EVENTS_CACHE_TTL', 60);
  }

  async list(query: ListEventsQuery): Promise<unknown> {
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    if (from && to && from > to)
      throw new DomainError('INVALID_DATE_RANGE', 'El rango de fechas no es válido');
    if (query.timezone) {
      try {
        new Intl.DateTimeFormat('en', { timeZone: query.timezone });
      } catch {
        throw new DomainError('INVALID_TIMEZONE', 'La zona horaria no es válida');
      }
    }
    const cacheKey = `events:list:${createHash('sha256').update(JSON.stringify(query)).digest('hex')}`;
    const cached = await this.cache.get<unknown>(cacheKey);
    if (cached) return cached;
    const where: Prisma.EventWhereInput = {
      ...(from || to
        ? { startDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}),
      ...(query.phase ? { phase: { code: query.phase } } : {}),
      ...(query.group ? { group: { code: query.group } } : {}),
      ...(query.status ? { status: query.status as EventStatus } : {}),
    };
    const [events, total] = await this.prisma.$transaction([
      this.prisma.event.findMany({
        where,
        include: eventInclude,
        orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.event.count({ where }),
    ]);
    const result = {
      data: events.map((event) => this.mapEvent(event)),
      meta: { page: query.page, limit: query.limit, total },
    };
    await this.cache.set(cacheKey, result, this.ttl);
    return result;
  }

  async detail(id: string): Promise<unknown> {
    const cacheKey = `events:detail:${id}`;
    const cached = await this.cache.get<unknown>(cacheKey);
    if (cached) return cached;
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        ...eventInclude,
        markets: {
          include: { marketType: true, selections: { orderBy: { id: 'asc' } } },
          orderBy: [{ marketType: { displayOrder: 'asc' } }, { id: 'asc' }],
        },
      },
    });
    if (!event) throw new DomainError('EVENT_NOT_FOUND', 'Evento no encontrado', 404);
    const result = {
      ...this.mapEvent(event),
      markets: event.markets.map((market) => ({
        id: market.id,
        externalId: market.externalId,
        name: market.name,
        marketType: {
          id: market.marketType.id,
          externalId: market.marketType.externalId,
          name: market.marketType.name,
          displayOrder: market.marketType.displayOrder,
        },
        isSuspended: market.isSuspended,
        selections: market.selections.map((selection) => ({
          id: selection.id,
          externalId: selection.externalId,
          name: selection.name,
          odds: selection.decimalOdds.toFixed(2),
          isAvailable: this.selectionAvailable(event, market, selection),
        })),
      })),
    };
    await this.cache.set(cacheKey, result, this.ttl);
    return result;
  }

  private selectionAvailable(
    event: { startDate: Date; isSuspended: boolean },
    market: { isSuspended: boolean },
    selection: { isDisabled: boolean; status: string | null; decimalOdds: Prisma.Decimal },
  ): boolean {
    return (
      !event.isSuspended &&
      !market.isSuspended &&
      !selection.isDisabled &&
      selection.status === '0' &&
      selection.decimalOdds.gt(1) &&
      event.startDate > new Date()
    );
  }

  private mapEvent(
    event: Prisma.EventGetPayload<{ include: typeof eventInclude }>,
  ): Record<string, unknown> {
    const marketCount = event._count.markets;
    return {
      id: event.id,
      externalId: event.externalId,
      name: event.name,
      startDate: event.startDate.toISOString(),
      endDate: event.endDate?.toISOString() ?? null,
      estimatedEndDate: event.estimatedEndDate?.toISOString() ?? null,
      durationSource: event.durationSource,
      status: event.status,
      isLive: event.isLive,
      isSuspended: event.isSuspended,
      competition: { id: event.competition.id, name: event.competition.name },
      phase: { code: event.phase.code, name: event.phase.name },
      group: event.group
        ? { code: event.group.code, name: event.group.name, source: event.groupSource }
        : null,
      homeTeam: event.homeTeam && {
        id: event.homeTeam.id,
        name: event.homeTeam.name,
        shortName: event.homeTeam.shortName,
        countryCode: event.homeTeam.countryCode,
        flagUrl: event.homeTeam.flagUrl,
      },
      awayTeam: event.awayTeam && {
        id: event.awayTeam.id,
        name: event.awayTeam.name,
        shortName: event.awayTeam.shortName,
        countryCode: event.awayTeam.countryCode,
        flagUrl: event.awayTeam.flagUrl,
      },
      homePlaceholder: event.homePlaceholder,
      awayPlaceholder: event.awayPlaceholder,
      features: {
        statistics: event.statisticsEnabled,
        earlyPayout: event.earlyPayoutEnabled,
        betBuilder: event.betBuilderEnabled,
        superOdds: event.superOddsEnabled,
      },
      hasMarkets: marketCount > 0,
      marketCount,
      isBettable:
        !event.isSuspended &&
        event.status === 'SCHEDULED' &&
        event.startDate > new Date() &&
        marketCount > 0,
    };
  }
}
