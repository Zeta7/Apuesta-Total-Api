import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsIn, IsString, IsUUID, Matches } from 'class-validator';

export class CalculateBetslipDto {
  @ApiProperty({ enum: ['SINGLE', 'COMBO'] }) @IsIn(['SINGLE', 'COMBO']) type!: 'SINGLE' | 'COMBO';
  @ApiProperty({ example: '10.00' }) @IsString() @Matches(/^\d+(\.\d{1,2})?$/) stake!: string;
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  selectionIds!: string[];
}
