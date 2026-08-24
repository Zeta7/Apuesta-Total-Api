import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'demo@apuestatotal.test' }) @IsEmail() email!: string;
  @ApiProperty({ example: 'Demo12345!' }) @IsString() @MinLength(8) password!: string;
}
