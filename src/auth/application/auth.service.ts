import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { DomainError } from '../../common/domain/domain.error';
import { PrismaService } from '../../common/infrastructure/prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}
  async login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; tokenType: 'Bearer'; expiresIn: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user?.isActive || !(await argon2.verify(user.passwordHash, password)))
      throw new DomainError('INVALID_CREDENTIALS', 'Credenciales inválidas', 401);
    return {
      accessToken: await this.jwt.signAsync({ sub: user.id, email: user.email }),
      tokenType: 'Bearer',
      expiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
    };
  }
}
