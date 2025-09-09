import { Body, ConflictException, Controller, Get, Post } from '@nestjs/common';
import { Company } from '../../db/models/Company';
import {
  Ticket,
  TicketCategory,
  TicketStatus,
  TicketType,
} from '../../db/models/Ticket';
import { User, UserRole } from '../../db/models/User';

interface newTicketDto {
  type: TicketType;
  companyId: number;
}

interface TicketDto {
  id: number;
  type: TicketType;
  companyId: number;
  assigneeId: number;
  status: TicketStatus;
  category: TicketCategory;
}

@Controller('api/v1/tickets')
export class TicketsController {
  @Get()
  async findAll() {
    return await Ticket.findAll({ include: [Company, User] });
  }

  @Post()
  async create(@Body() newTicketDto: newTicketDto) {
    const { type, companyId } = newTicketDto;

    if (type === TicketType.registrationAddressChange) {
      const existingTicket = await Ticket.findOne({
        where: {
          companyId,
          type: TicketType.registrationAddressChange,
          status: TicketStatus.open,
        },
      });

      if (existingTicket) {
        throw new ConflictException(
          `Company already has an active registrationAddressChange ticket`,
        );
      }
    }

    const category =
      type === TicketType.managementReport
        ? TicketCategory.accounting
        : TicketCategory.corporate;

    let assignee: User;

    if (type === TicketType.managementReport) {
      const assignees = await User.findAll({
        where: { companyId, role: UserRole.accountant },
        order: [['createdAt', 'DESC']],
      });

      if (!assignees.length) {
        throw new ConflictException(
          `Cannot find user with role accountant to create a ticket`,
        );
      }

      assignee = assignees[0];
    } else if (type === TicketType.registrationAddressChange) {
      const corporateSecretaries = await User.findAll({
        where: { companyId, role: UserRole.corporateSecretary },
        order: [['createdAt', 'DESC']],
      });

      if (corporateSecretaries.length > 1) {
        throw new ConflictException(
          `Multiple users with role corporateSecretary. Cannot create a ticket`,
        );
      }

      if (corporateSecretaries.length === 1) {
        assignee = corporateSecretaries[0];
      } else {
        const directors = await User.findAll({
          where: { companyId, role: UserRole.director },
          order: [['createdAt', 'DESC']],
        });

        if (directors.length > 1) {
          throw new ConflictException(
            `Multiple users with role director. Cannot create a ticket`,
          );
        }

        if (directors.length === 1) {
          assignee = directors[0];
        } else {
          throw new ConflictException(
            `Cannot find user with role corporateSecretary or director to create a ticket`,
          );
        }
      }
    } else {
      throw new ConflictException(`Unsupported ticket type: ${String(type)}`);
    }

    const ticket = await Ticket.create({
      companyId,
      assigneeId: assignee.id,
      category,
      type,
      status: TicketStatus.open,
    });

    const ticketDto: TicketDto = {
      id: ticket.id,
      type: ticket.type,
      assigneeId: ticket.assigneeId,
      status: ticket.status,
      category: ticket.category,
      companyId: ticket.companyId,
    };

    return ticketDto;
  }
}
