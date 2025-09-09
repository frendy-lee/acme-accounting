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

    let category: TicketCategory;
    if (type === TicketType.managementReport) {
      category = TicketCategory.accounting;
    } else if (type === TicketType.registrationAddressChange) {
      category = TicketCategory.corporate;
    } else if (type === TicketType.strikeOff) {
      category = TicketCategory.management;
    } else {
      throw new ConflictException(`Unsupported ticket type: ${String(type)}`);
    }

    let assignee: User | undefined;

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
    } else if (type === TicketType.strikeOff) {
      const directors = await User.findAll({
        where: { companyId, role: UserRole.director },
        order: [['createdAt', 'DESC']],
      });

      if (directors.length > 1) {
        throw new ConflictException(
          `Multiple users with role director. Cannot create a ticket`,
        );
      }

      if (directors.length === 0) {
        throw new ConflictException(
          `Cannot find user with role director to create a ticket`,
        );
      }

      assignee = directors[0];
    }

    if (!assignee) {
      throw new ConflictException(
        `Unable to determine assignee for ticket type: ${String(type)}`,
      );
    }

    if (type === TicketType.strikeOff) {
      const transaction = await Ticket.sequelize!.transaction();

      try {
        await Ticket.update(
          { status: TicketStatus.resolved },
          {
            where: {
              companyId,
              status: TicketStatus.open,
            },
            transaction,
          },
        );

        const ticket = await Ticket.create(
          {
            companyId,
            assigneeId: assignee.id,
            category,
            type,
            status: TicketStatus.open,
          },
          { transaction },
        );

        await transaction.commit();

        const ticketDto: TicketDto = {
          id: ticket.id,
          type: ticket.type,
          assigneeId: ticket.assigneeId,
          status: ticket.status,
          category: ticket.category,
          companyId: ticket.companyId,
        };

        return ticketDto;
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    } else {
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
}
