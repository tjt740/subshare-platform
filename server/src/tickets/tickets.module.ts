import {
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import {
  Order,
  Subscription,
  Ticket,
  TicketMessage,
  TICKET_CATEGORIES,
} from '../entities';
import { CurrentUser, JwtAuthGuard, JwtUser } from '../auth/auth.common';

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket) private readonly tickets: Repository<Ticket>,
    @InjectRepository(TicketMessage)
    private readonly messages: Repository<TicketMessage>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(Subscription)
    private readonly subs: Repository<Subscription>,
  ) {}

  async create(
    userId: number,
    subject: string,
    content: string,
    orderId?: number,
    category = 'general',
    subscriptionId?: number,
  ) {
    if (orderId) {
      const order = await this.orders.findOneBy({ id: orderId, userId });
      if (!order) throw new NotFoundException('关联订单不存在');
    }
    if (subscriptionId) {
      const sub = await this.subs.findOneBy({ id: subscriptionId, userId });
      if (!sub) throw new NotFoundException('关联订阅不存在');
    }
    const ticket = await this.tickets.save(
      this.tickets.create({
        userId,
        subject,
        orderId: orderId ?? null,
        subscriptionId: subscriptionId ?? null,
        category: (TICKET_CATEGORIES as readonly string[]).includes(category)
          ? category
          : 'general',
      }),
    );
    await this.messages.save(
      this.messages.create({ ticketId: ticket.id, senderRole: 'user', content }),
    );
    return ticket;
  }

  listMine(userId: number) {
    return this.tickets.find({ where: { userId }, order: { updatedAt: 'DESC' } });
  }

  async getMine(userId: number, id: number) {
    const ticket = await this.tickets.findOneBy({ id, userId });
    if (!ticket) throw new NotFoundException('工单不存在');
    const messages = await this.messages.find({
      where: { ticketId: id },
      order: { id: 'ASC' },
    });
    let orderNo: string | null = null;
    if (ticket.orderId) {
      orderNo = (await this.orders.findOneBy({ id: ticket.orderId }))?.orderNo ?? null;
    }
    return { ...ticket, orderNo, messages };
  }

  async reply(userId: number, id: number, content: string) {
    const ticket = await this.tickets.findOneBy({ id, userId });
    if (!ticket) throw new NotFoundException('工单不存在');
    await this.messages.save(
      this.messages.create({ ticketId: id, senderRole: 'user', content }),
    );
    ticket.status = 'open'; // 用户追问 -> 回到待处理
    await this.tickets.save(ticket);
    return this.getMine(userId, id);
  }

  async close(userId: number, id: number) {
    const ticket = await this.tickets.findOneBy({ id, userId });
    if (!ticket) throw new NotFoundException('工单不存在');
    ticket.status = 'closed';
    await this.tickets.save(ticket);
    return ticket;
  }
}

class CreateTicketDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  subject: string;
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  content: string;
  @IsOptional()
  @IsInt()
  orderId?: number;
  @IsOptional()
  @IsInt()
  subscriptionId?: number;
  @IsOptional()
  @IsString()
  category?: string;
}

class MessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string;
}

@Controller()
@UseGuards(JwtAuthGuard)
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Post('tickets')
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateTicketDto) {
    return this.tickets.create(
      user.sub,
      dto.subject,
      dto.content,
      dto.orderId,
      dto.category,
      dto.subscriptionId,
    );
  }

  @Get('me/tickets')
  mine(@CurrentUser() user: JwtUser) {
    return this.tickets.listMine(user.sub);
  }

  @Get('tickets/:id')
  get(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
    return this.tickets.getMine(user.sub, id);
  }

  @Post('tickets/:id/messages')
  reply(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MessageDto,
  ) {
    return this.tickets.reply(user.sub, id, dto.content);
  }

  @Post('tickets/:id/close')
  close(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
    return this.tickets.close(user.sub, id);
  }
}

@Module({
  imports: [
    TypeOrmModule.forFeature([Ticket, TicketMessage, Order, Subscription]),
  ],
  providers: [TicketsService],
  controllers: [TicketsController],
  exports: [TicketsService],
})
export class TicketsModule {}
