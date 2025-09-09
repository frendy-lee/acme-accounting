import { ApiProperty } from '@nestjs/swagger';

export class JobStatusResponseDto {
  @ApiProperty()
  jobId!: string;

  @ApiProperty()
  type!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  timestamps!: {
    created: string;
    started?: string;
    completed?: string;
  };

  @ApiProperty({ required: false })
  processingTime?: string;

  @ApiProperty()
  message!: string;

  @ApiProperty({ required: false })
  resultUrl?: string;

  @ApiProperty({ required: false, type: [String] })
  resultPaths?: string[];

  @ApiProperty({ required: false })
  error?: string;
}

export class CreateReportJobResponseDto {
  @ApiProperty()
  jobId!: string;

  @ApiProperty()
  type!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  message!: string;

  @ApiProperty()
  responseTime!: string;

  @ApiProperty()
  statusUrl!: string;

  @ApiProperty()
  resultUrl!: string;
}
