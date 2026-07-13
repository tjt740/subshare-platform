import { Controller, Get, Injectable, Param, Post, UseGuards } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Notification } from '../entities';
import { CurrentUser, JwtAuthGuard, JwtUser } from '../auth/auth.common';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
  ) {}

  async listMine(userId: number) {
    const items = await this.repo.find({
      where: { userId },
      order: { id: 'DESC' },
      take: 50,
    });
    const unread = items.filter((n) => !n.read).length;
    return { items, unread };
  }

  async markRead(userId: number, id: number) {
    const n = await this.repo.findOneBy({ id, userId });
    if (n && !n.read) {
      n.read = true;
      await this.repo.save(n);
    }
    return { ok: true };
  }

  async markAllRead(userId: number) {
    await this.repo.update({ userId, read: false }, { read: true });
    return { ok: true };
  }
}

@Controller('me/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: JwtUser) {
    return this.svc.listMine(user.sub);
  }

  @Post('read-all')
  readAll(@CurrentUser() user: JwtUser) {
    return this.svc.markAllRead(user.sub);
  }

  @Post(':id/read')
  read(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.markRead(user.sub, Number(id));
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Notification])],
  providers: [NotificationsService],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
