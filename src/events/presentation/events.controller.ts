import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RateLimit } from '../../common/http/rate-limit.decorator';
import { RateLimitGuard } from '../../common/http/rate-limit.guard';
import { EventsService } from '../application/events.service';
import { ListEventsQuery } from './dto/list-events.query';

@ApiTags('events')
@Controller('events')
@UseGuards(RateLimitGuard)
export class EventsController {
  constructor(private readonly events: EventsService) {}
  @Get()
  @RateLimit({ limit: 60, ttlSeconds: 60 })
  @ApiOperation({
    summary: 'Lista eventos por rango',
    description: 'Ejemplo rápido: `GET /events?from=2026-06-11T00:00:00Z&to=2026-06-18T23:59:59Z`',
  })
  list(@Query() query: ListEventsQuery): Promise<unknown> {
    return this.events.list(query);
  }
  @Get(':eventId')
  @RateLimit({ limit: 60, ttlSeconds: 60 })
  @ApiOperation({ summary: 'Detalle y mercados de un evento' })
  detail(@Param('eventId', ParseUUIDPipe) id: string): Promise<unknown> {
    return this.events.detail(id);
  }
}
