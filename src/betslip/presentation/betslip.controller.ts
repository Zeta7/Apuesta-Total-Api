import { Body, Controller, Headers, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import type { AuthUser } from '../../auth/domain/auth-user';
import { CurrentUser } from '../../auth/presentation/current-user.decorator';
import { JwtAuthGuard } from '../../auth/presentation/jwt-auth.guard';
import { RateLimit } from '../../common/http/rate-limit.decorator';
import { RateLimitGuard } from '../../common/http/rate-limit.guard';
import { CalculateBetslipService } from '../application/calculate-betslip.service';
import { PlaceBetslipService } from '../application/place-betslip.service';
import { CalculateBetslipDto } from './dto/calculate-betslip.dto';

@ApiTags('betslip')
@Controller('betslip')
@UseGuards(RateLimitGuard)
export class BetslipController {
  constructor(
    private readonly calculateService: CalculateBetslipService,
    private readonly placeService: PlaceBetslipService,
  ) {}
  @Post('calculate')
  @RateLimit({ limit: 30, ttlSeconds: 60 })
  @ApiOperation({ summary: 'Calcula un cupón sin generar movimientos' })
  calculate(@Body() body: CalculateBetslipDto): Promise<unknown> {
    return this.calculateService.execute(body);
  }

  @Post('place')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Confirma una apuesta con débito atómico' })
  place(
    @CurrentUser() user: AuthUser,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: CalculateBetslipDto,
    @Req() request: FastifyRequest,
  ): Promise<unknown> {
    return this.placeService.execute(user.id, key, body, request.id);
  }
}
