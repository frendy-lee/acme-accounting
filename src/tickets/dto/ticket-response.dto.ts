import { ApiProperty } from '@nestjs/swagger';
import {
  TicketType,
  TicketStatus,
  TicketCategory,
} from '../../../db/models/Ticket';

export class TicketResponseDto {
  @ApiProperty()
  id!: number;

  @ApiProperty({ enum: TicketType })
  type!: TicketType;

  @ApiProperty()
  companyId!: number;

  @ApiProperty()
  assigneeId!: number;

  @ApiProperty({ enum: TicketStatus })
  status!: TicketStatus;

  @ApiProperty({ enum: TicketCategory })
  category!: TicketCategory;
}
