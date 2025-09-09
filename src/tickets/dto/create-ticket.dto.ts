import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';
import { TicketType } from '../../../db/models/Ticket';
import { VALIDATION_MESSAGES } from '../../common/constants';

export class CreateTicketDto {
  @ApiProperty({
    description: 'The type of ticket to create',
    enum: TicketType,
    example: TicketType.managementReport,
  })
  @IsNotEmpty({ message: VALIDATION_MESSAGES.TICKET_TYPE_REQUIRED })
  @IsEnum(TicketType, { message: VALIDATION_MESSAGES.TICKET_TYPE_INVALID })
  type!: TicketType;

  @ApiProperty({
    description: 'The ID of the company for which to create the ticket',
    example: 1,
    minimum: 1,
  })
  @IsNotEmpty({ message: VALIDATION_MESSAGES.COMPANY_ID_REQUIRED })
  @IsNumber({}, { message: VALIDATION_MESSAGES.COMPANY_ID_POSITIVE })
  @IsPositive({ message: VALIDATION_MESSAGES.COMPANY_ID_POSITIVE })
  @Type(() => Number)
  companyId!: number;
}
