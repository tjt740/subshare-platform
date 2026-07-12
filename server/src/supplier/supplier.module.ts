import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Plan, Product, SupplierSubmission } from '../entities';
import {
  CurrentUser,
  JwtAuthGuard,
  JwtUser,
  Roles,
  RolesGuard,
} from '../auth/auth.common';

/** 供应商门户：提交共享账号（入库申请）或新产品提议，等待管理员审核 */
@Injectable()
export class SupplierService {
  constructor(
    @InjectRepository(SupplierSubmission)
    private readonly submissions: Repository<SupplierSubmission>,
    @InjectRepository(Plan) private readonly plans: Repository<Plan>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
  ) {}

  /** 可供货的套餐列表（含商品名） */
  async availablePlans() {
    const plans = await this.plans.findBy({ status: 'on' });
    const products = await this.products.find();
    const map = new Map(products.map((p) => [p.id, p.title]));
    return plans.map((p) => ({
      id: p.id,
      name: p.name,
      productTitle: map.get(p.productId) ?? '-',
    }));
  }

  async submit(supplierId: number, dto: any) {
    if (dto.type === 'account') {
      if (!dto.planId || !dto.username || !dto.password) {
        throw new BadRequestException('账号提交需选择套餐并填写账号密码');
      }
      const plan = await this.plans.findOneBy({ id: dto.planId });
      if (!plan) throw new BadRequestException('套餐不存在');
    } else if (!dto.proposedTitle) {
      throw new BadRequestException('产品提议需填写产品名称');
    }
    return this.submissions.save(
      this.submissions.create({
        supplierId,
        type: dto.type,
        planId: dto.planId ?? null,
        username: dto.username ?? '',
        password: dto.password ?? '',
        maxSlots: Math.max(1, Math.min(50, dto.maxSlots || 5)),
        proposedTitle: dto.proposedTitle ?? '',
        proposedDesc: dto.proposedDesc ?? '',
        note: dto.note ?? '',
      }),
    );
  }

  async listMine(supplierId: number) {
    const rows = await this.submissions.find({
      where: { supplierId },
      order: { id: 'DESC' },
    });
    const plans = await this.plans.find();
    const products = await this.products.find();
    const productMap = new Map(products.map((p) => [p.id, p.title]));
    const planMap = new Map(
      plans.map((p) => [p.id, `${productMap.get(p.productId) ?? ''} / ${p.name}`]),
    );
    return rows.map((r) => ({
      ...r,
      password: r.password ? '••••••' : '', // 提交后不回显明文
      planLabel: r.planId ? planMap.get(r.planId) ?? '-' : null,
    }));
  }
}

class SubmitDto {
  @IsIn(['account', 'product'])
  type: 'account' | 'product';
  @IsOptional() @IsInt() planId?: number;
  @IsOptional() @IsString() @MaxLength(120) username?: string;
  @IsOptional() @IsString() @MaxLength(120) password?: string;
  @IsOptional() @IsInt() maxSlots?: number;
  @IsOptional() @IsString() @MaxLength(120) proposedTitle?: string;
  @IsOptional() @IsString() @MaxLength(1000) proposedDesc?: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

@Controller('supplier')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('supplier')
export class SupplierController {
  constructor(private readonly supplier: SupplierService) {}

  @Get('plans')
  plans() {
    return this.supplier.availablePlans();
  }

  @Post('submissions')
  submit(@CurrentUser() user: JwtUser, @Body() dto: SubmitDto) {
    return this.supplier.submit(user.sub, dto);
  }

  @Get('submissions')
  mine(@CurrentUser() user: JwtUser) {
    return this.supplier.listMine(user.sub);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([SupplierSubmission, Plan, Product])],
  providers: [SupplierService],
  controllers: [SupplierController],
  exports: [SupplierService],
})
export class SupplierModule {}
