import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RateLimit } from '../../common/http/rate-limit.decorator';
import { RateLimitGuard } from '../../common/http/rate-limit.guard';
import { AuthService } from '../application/auth.service';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
@UseGuards(RateLimitGuard)
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('login')
  @RateLimit({ limit: 5, ttlSeconds: 60 })
  @ApiOperation({ summary: 'Inicia sesión y entrega un JWT' })
  login(@Body() body: LoginDto): Promise<unknown> {
    return this.auth.login(body.email, body.password);
  }
}
