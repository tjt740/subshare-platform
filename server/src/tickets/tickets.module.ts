import {
  BadRequestException,
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
import { In, Repository } from 'typeorm';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  Order,
  Subscription,
  Ticket,
  TicketMessage,
  TicketTransfer,
  TICKET_CATEGORIES,
  User,
} from '../entities';
import { CurrentUser, JwtAuthGuard, JwtUser } from '../auth/auth.common';

const displayName = (user?: User | null) =>
  user?.nickname?.trim() || user?.email?.split('@')[0] || '客服';

const hasTicketPermission = (user: User) => {
  if (user.role === 'super') return true;
  if (user.role !== 'admin') return false;
  try {
    return (JSON.parse(user.permissions || '[]') as string[]).includes('tickets');
  } catch {
    return false;
  }
};

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket) private readonly tickets: Repository<Ticket>,
    @InjectRepository(TicketMessage)
    private readonly messages: Repository<TicketMessage>,
    @InjectRepository(TicketTransfer)
    private readonly transfers: Repository<TicketTransfer>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(Subscription)
    private readonly subs: Repository<Subscription>,
  ) {}

  private async supportAgent(agentId: number) {
    const agent = await this.users.findOneBy({ id: agentId, status: 'active' });
    if (!agent || !hasTicketPermission(agent)) {
      throw new BadRequestException('所选客服不可用，请重新选择');
    }
    return agent;
  }

  async listAgents() {
    const all = await this.users.find({ where: { status: 'active' } });
    const agents = all.filter(hasTicketPermission);
    const tickets = agents.length
      ? await this.tickets.findBy({ assignedAgentId: In(agents.map((a) => a.id)) })
      : [];
    return agents.map((agent) => {
      const assigned = tickets.filter((t) => t.assignedAgentId === agent.id);
      const ratings = assigned
        .filter((t) => t.ratedAgentId === agent.id && t.rating)
        .map((t) => Number(t.rating));
      return {
        id: agent.id,
        name: displayName(agent),
        avatar: agent.avatar || 'sv:spark',
        title: agent.role === 'super' ? '客服主管' : '官方客服',
        activeTickets: assigned.filter((t) => !['resolved', 'closed'].includes(t.status))
          .length,
        ratingCount: ratings.length,
        avgRating: ratings.length
          ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
          : null,
      };
    });
  }

  async create(
    userId: number,
    subject: string,
    content: string,
    orderId?: number,
    category = 'general',
    subscriptionId?: number,
    preferredAgentId?: number,
  ) {
    if (orderId) {
      const order = await this.orders.findOneBy({ id: orderId, userId });
      if (!order) throw new NotFoundException('关联订单不存在');
    }
    if (subscriptionId) {
      const sub = await this.subs.findOneBy({ id: subscriptionId, userId });
      if (!sub) throw new NotFoundException('关联订阅不存在');
    }
    const customer = await this.users.findOneBy({ id: userId });
    const agent = preferredAgentId
      ? await this.supportAgent(preferredAgentId)
      : null;
    return this.tickets.manager.transaction(async (manager) => {
      const ticketRepo = manager.getRepository(Ticket);
      const messageRepo = manager.getRepository(TicketMessage);
      const now = new Date();
      const ticket = await ticketRepo.save(
        ticketRepo.create({
          userId,
          subject,
          orderId: orderId ?? null,
          subscriptionId: subscriptionId ?? null,
          category: (TICKET_CATEGORIES as readonly string[]).includes(category)
            ? category
            : 'general',
          assignedAgentId: agent?.id ?? null,
          assignedAt: agent ? now : null,
          lastMessageAt: now,
        }),
      );
      if (agent) {
        await messageRepo.save(
          messageRepo.create({
            ticketId: ticket.id,
            senderRole: 'system',
            senderId: null,
            senderName: '系统',
            messageType: 'transfer',
            metadata: JSON.stringify({ toAgentId: agent.id }),
            content: `已为您接入客服 ${displayName(agent)}，后续更换客服不会影响完整对话记录。`,
          }),
        );
      }
      await messageRepo.save(
        messageRepo.create({
          ticketId: ticket.id,
          senderRole: 'user',
          senderId: userId,
          senderName: displayName(customer),
          messageType: 'text',
          metadata: '{}',
          content,
        }),
      );
      return ticket;
    });
  }

  async listMine(userId: number) {
    const tickets = await this.tickets.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
    if (!tickets.length) return [];
    const agentIds = [
      ...new Set(tickets.map((t) => t.assignedAgentId).filter(Boolean)),
    ] as number[];
    const agents = agentIds.length
      ? await this.users.findBy({ id: In(agentIds) })
      : [];
    const messages = await this.messages.findBy({
      ticketId: In(tickets.map((t) => t.id)),
    });
    const agentMap = new Map(agents.map((a) => [a.id, a]));
    return tickets.map((ticket) => ({
      ...ticket,
      agent: ticket.assignedAgentId
        ? this.publicAgent(agentMap.get(ticket.assignedAgentId))
        : null,
      messageCount: messages.filter((m) => m.ticketId === ticket.id).length,
    }));
  }

  private publicAgent(agent?: User | null) {
    if (!agent) return null;
    return {
      id: agent.id,
      name: displayName(agent),
      avatar: agent.avatar || 'sv:spark',
      title: agent.role === 'super' ? '客服主管' : '官方客服',
    };
  }

  async getMine(userId: number, id: number) {
    const ticket = await this.tickets.findOneBy({ id, userId });
    if (!ticket) throw new NotFoundException('工单不存在');
    const messages = await this.messages.find({
      where: { ticketId: id },
      order: { id: 'ASC' },
    });
    const transfers = await this.transfers.find({
      where: { ticketId: id },
      order: { id: 'ASC' },
    });
    const agent = ticket.assignedAgentId
      ? await this.users.findOneBy({ id: ticket.assignedAgentId })
      : null;
    let orderNo: string | null = null;
    if (ticket.orderId) {
      orderNo =
        (await this.orders.findOneBy({ id: ticket.orderId }))?.orderNo ?? null;
    }
    return {
      ...ticket,
      orderNo,
      agent: this.publicAgent(agent),
      messages: messages.map((m) => ({
        ...m,
        metadata: (() => {
          try {
            return JSON.parse(m.metadata || '{}');
          } catch {
            return {};
          }
        })(),
      })),
      transfers,
    };
  }

  async reply(userId: number, id: number, content: string) {
    const ticket = await this.tickets.findOneBy({ id, userId });
    if (!ticket) throw new NotFoundException('工单不存在');
    if (ticket.status === 'closed') {
      throw new BadRequestException('该工单已完成，如有新问题请发起新工单');
    }
    const customer = await this.users.findOneBy({ id: userId });
    await this.tickets.manager.transaction(async (manager) => {
      const ticketRepo = manager.getRepository(Ticket);
      const messageRepo = manager.getRepository(TicketMessage);
      if (ticket.status === 'resolved') {
        await messageRepo.save(
          messageRepo.create({
            ticketId: id,
            senderRole: 'system',
            senderId: null,
            senderName: '系统',
            messageType: 'system',
            metadata: '{}',
            content: '用户继续追问，工单已重新进入处理中。',
          }),
        );
        ticket.resolvedAt = null;
        ticket.resolvedBy = null;
        ticket.resolutionNote = '';
      }
      await messageRepo.save(
        messageRepo.create({
          ticketId: id,
          senderRole: 'user',
          senderId: userId,
          senderName: displayName(customer),
          messageType: 'text',
          metadata: '{}',
          content,
        }),
      );
      ticket.status = 'open';
      ticket.lastMessageAt = new Date();
      await ticketRepo.save(ticket);
    });
    return this.getMine(userId, id);
  }

  async transfer(
    user: JwtUser,
    id: number,
    toAgentId: number,
    reason = '用户主动选择客服',
  ) {
    const ticket = await this.tickets.findOneBy({ id, userId: user.sub });
    if (!ticket) throw new NotFoundException('工单不存在');
    if (ticket.status === 'closed') throw new BadRequestException('已完成工单不能转接');
    if (ticket.assignedAgentId === toAgentId) {
      throw new BadRequestException('当前已经由该客服处理');
    }
    const toAgent = await this.supportAgent(toAgentId);
    const fromAgent = ticket.assignedAgentId
      ? await this.users.findOneBy({ id: ticket.assignedAgentId })
      : null;
    const cleanReason = reason.trim().slice(0, 200) || '用户主动选择客服';
    await this.tickets.manager.transaction(async (manager) => {
      const ticketRepo = manager.getRepository(Ticket);
      const transferRepo = manager.getRepository(TicketTransfer);
      const messageRepo = manager.getRepository(TicketMessage);
      await transferRepo.save(
        transferRepo.create({
          ticketId: id,
          fromAgentId: fromAgent?.id ?? null,
          fromAgentName: displayName(fromAgent),
          toAgentId: toAgent.id,
          toAgentName: displayName(toAgent),
          initiatedBy: user.sub,
          initiatedRole: 'user',
          reason: cleanReason,
        }),
      );
      await messageRepo.save(
        messageRepo.create({
          ticketId: id,
          senderRole: 'system',
          senderId: null,
          senderName: '系统',
          messageType: 'transfer',
          metadata: JSON.stringify({
            fromAgentId: fromAgent?.id ?? null,
            toAgentId: toAgent.id,
            reason: cleanReason,
          }),
          content: `用户将客服从 ${displayName(fromAgent)} 切换为 ${displayName(toAgent)}。转接原因：${cleanReason}。完整会话记录已保留。`,
        }),
      );
      ticket.assignedAgentId = toAgent.id;
      ticket.assignedAt = new Date();
      ticket.transferCount += 1;
      ticket.status = 'open';
      ticket.lastMessageAt = new Date();
      await ticketRepo.save(ticket);
    });
    return this.getMine(user.sub, id);
  }

  async close(userId: number, id: number) {
    const ticket = await this.tickets.findOneBy({ id, userId });
    if (!ticket) throw new NotFoundException('工单不存在');
    if (ticket.status === 'closed') return this.getMine(userId, id);
    await this.tickets.manager.transaction(async (manager) => {
      const messageRepo = manager.getRepository(TicketMessage);
      await messageRepo.save(
        messageRepo.create({
          ticketId: id,
          senderRole: 'system',
          senderId: null,
          senderName: '系统',
          messageType: 'resolution',
          metadata: '{}',
          content: '用户确认问题已结束，本次服务已完成（未评价）。',
        }),
      );
      ticket.status = 'closed';
      ticket.closedAt = new Date();
      ticket.lastMessageAt = new Date();
      await manager.getRepository(Ticket).save(ticket);
    });
    return this.getMine(userId, id);
  }

  async rate(userId: number, id: number, rating: number, comment = '') {
    const ticket = await this.tickets.findOneBy({ id, userId });
    if (!ticket) throw new NotFoundException('工单不存在');
    if (!['resolved', 'closed'].includes(ticket.status)) {
      throw new BadRequestException('请在客服标记问题解决后进行评价');
    }
    if (ticket.rating) throw new BadRequestException('该工单已经评价过');
    const label = rating === 5 ? '优评' : rating >= 3 ? '中评' : '差评';
    await this.tickets.manager.transaction(async (manager) => {
      const cleanComment = comment.trim().slice(0, 500);
      await manager.getRepository(TicketMessage).save(
        manager.getRepository(TicketMessage).create({
          ticketId: id,
          senderRole: 'system',
          senderId: null,
          senderName: '系统',
          messageType: 'rating',
          metadata: JSON.stringify({ rating, label }),
          content: `用户完成服务评价：${label}（${rating} 星）${cleanComment ? `，${cleanComment}` : ''}`,
        }),
      );
      ticket.rating = rating;
      ticket.ratingComment = cleanComment;
      ticket.ratedAt = new Date();
      ticket.ratedAgentId = ticket.assignedAgentId || ticket.resolvedBy;
      ticket.status = 'closed';
      ticket.closedAt = ticket.closedAt || new Date();
      ticket.lastMessageAt = new Date();
      await manager.getRepository(Ticket).save(ticket);
    });
    return this.getMine(userId, id);
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
  @IsOptional()
  @IsInt()
  preferredAgentId?: number;
}

class MessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string;
}

class TransferDto {
  @IsInt()
  agentId: number;
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}

class RatingDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

@Controller()
@UseGuards(JwtAuthGuard)
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Get('support/agents')
  agents() {
    return this.tickets.listAgents();
  }

  @Post('tickets')
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateTicketDto) {
    return this.tickets.create(
      user.sub,
      dto.subject,
      dto.content,
      dto.orderId,
      dto.category,
      dto.subscriptionId,
      dto.preferredAgentId,
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

  @Post('tickets/:id/transfer')
  transfer(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TransferDto,
  ) {
    return this.tickets.transfer(user, id, dto.agentId, dto.reason);
  }

  @Post('tickets/:id/rating')
  rate(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RatingDto,
  ) {
    return this.tickets.rate(user.sub, id, dto.rating, dto.comment);
  }

  @Post('tickets/:id/close')
  close(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
    return this.tickets.close(user.sub, id);
  }
}

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Ticket,
      TicketMessage,
      TicketTransfer,
      User,
      Order,
      Subscription,
    ]),
  ],
  providers: [TicketsService],
  controllers: [TicketsController],
  exports: [TicketsService],
})
export class TicketsModule {}
