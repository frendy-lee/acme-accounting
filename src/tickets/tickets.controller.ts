import {
  Body,
  ConflictException,
  Controller,
  Get,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { Company } from '../../db/models/Company';
import {
  Ticket,
  TicketCategory,
  TicketStatus,
  TicketType,
} from '../../db/models/Ticket';
import { User, UserRole } from '../../db/models/User';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { TicketResponseDto } from './dto/ticket-response.dto';
import { API_ROUTES, ERROR_MESSAGES } from '../common/constants';

@ApiTags('Tickets')
@Controller(API_ROUTES.TICKETS)
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
export class TicketsController {
  @Get()
  @ApiOperation({
    summary: 'Get all tickets',
    description: 'Retrieve all tickets with company and user information',
  })
  @ApiResponse({
    status: 200,
    description: 'List of all tickets',
    type: [TicketResponseDto],
  })
  async findAll(): Promise<Ticket[]> {
    return await Ticket.findAll({ include: [Company, User] });
  }

  @Post()
  @ApiOperation({
    summary: 'Create a new ticket',
    description:
      'Create a new ticket with automatic assignee assignment based on business rules',
  })
  @ApiBody({ type: CreateTicketDto })
  @ApiResponse({
    status: 201,
    description: 'Ticket created successfully',
    type: TicketResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({
    status: 409,
    description:
      'Business rule conflict (duplicate ticket, no suitable assignee, etc.)',
  })
  async create(
    @Body() createTicketDto: CreateTicketDto,
  ): Promise<TicketResponseDto> {
    const { type, companyId } = createTicketDto;

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
          ERROR_MESSAGES.DUPLICATE_REGISTRATION_ADDRESS_CHANGE,
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
      throw new ConflictException(
        `${ERROR_MESSAGES.UNSUPPORTED_TICKET_TYPE}: ${String(type)}`,
      );
    }

    let assignee: User | undefined;

    if (type === TicketType.managementReport) {
      const assignees = await User.findAll({
        where: { companyId, role: UserRole.accountant },
        order: [['createdAt', 'DESC']],
      });

      if (!assignees.length) {
        throw new ConflictException(ERROR_MESSAGES.NO_ACCOUNTANT);
      }

      assignee = assignees[0];
    } else if (type === TicketType.registrationAddressChange) {
      const corporateSecretaries = await User.findAll({
        where: { companyId, role: UserRole.corporateSecretary },
        order: [['createdAt', 'DESC']],
      });

      if (corporateSecretaries.length > 1) {
        throw new ConflictException(
          ERROR_MESSAGES.MULTIPLE_CORPORATE_SECRETARY,
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
          throw new ConflictException(ERROR_MESSAGES.MULTIPLE_DIRECTORS);
        }

        if (directors.length === 1) {
          assignee = directors[0];
        } else {
          throw new ConflictException(
            ERROR_MESSAGES.NO_CORPORATE_SECRETARY_OR_DIRECTOR,
          );
        }
      }
    } else if (type === TicketType.strikeOff) {
      const directors = await User.findAll({
        where: { companyId, role: UserRole.director },
        order: [['createdAt', 'DESC']],
      });

      if (directors.length > 1) {
        throw new ConflictException(ERROR_MESSAGES.MULTIPLE_DIRECTORS);
      }

      if (directors.length === 0) {
        throw new ConflictException(ERROR_MESSAGES.NO_DIRECTOR);
      }

      assignee = directors[0];
    }

    if (!assignee) {
      throw new ConflictException(
        `${ERROR_MESSAGES.UNABLE_TO_DETERMINE_ASSIGNEE}: ${String(type)}`,
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

        const ticketDto: TicketResponseDto = {
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

      const ticketDto: TicketResponseDto = {
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
