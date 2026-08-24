import { Module } from '@nestjs/common';
import { RateLimitGuard } from '../common/http/rate-limit.guard';
import { EventsService } from './application/events.service';
import { EventsController } from './presentation/events.controller';

@Module({ controllers: [EventsController], providers: [EventsService, RateLimitGuard] })
export class EventsModule {}
