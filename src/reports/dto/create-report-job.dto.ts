import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { REPORT_TYPES, VALIDATION_MESSAGES } from '../../common/constants';

export type ReportType = 'accounts' | 'yearly' | 'fs' | 'all';

export class CreateReportJobDto {
  @ApiProperty({
    description: 'The type of report to generate',
    enum: [
      REPORT_TYPES.ACCOUNTS,
      REPORT_TYPES.YEARLY,
      REPORT_TYPES.FS,
      REPORT_TYPES.ALL,
    ],
    example: REPORT_TYPES.ALL,
    required: false,
    default: REPORT_TYPES.ALL,
  })
  @IsOptional()
  @IsEnum(Object.values(REPORT_TYPES), {
    message: VALIDATION_MESSAGES.REPORT_TYPE_INVALID,
  })
  type?: ReportType;
}
