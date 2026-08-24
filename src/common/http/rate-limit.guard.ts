import { CanActivate, ExecutionContext, Injectable, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { CacheService } from '../infrastructure/cache/cache.service';
import { RATE_LIMIT_KEY, type RateLimitOptions } from './rate-limit.decorator';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly cache: CacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.get<RateLimitOptions>(RATE_LIMIT_KEY, context.getHandler());
    if (!options) return true;
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const identity = request.ip || 'unknown';
    const key = `rate:${request.routeOptions.url}:${identity}`;
    const count = await this.cache.increment(key, options.ttlSeconds);
    if (count !== null && count > options.limit)
      throw new HttpException({ code: 'RATE_LIMIT_EXCEEDED', message: 'Rate limit exceeded' }, 429);
    return true;
  }
}
