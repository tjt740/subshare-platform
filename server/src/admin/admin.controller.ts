import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import {
  JwtAuthGuard,
  Perm,
  PermGuard,
  Roles,
  RolesGuard,
} from '../auth/auth.common';

/**
 * 管理端接口：JWT + 角色（admin/super）+ 模块权限点 三重守卫。
 * super（父管理员）拥有全部权限；admin（子管理员）按 permissions 数组授权。
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
@Roles('admin', 'super')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('metrics')
  @Perm('dashboard')
  metrics() {
    return this.admin.metrics();
  }

  // ---------- 商品 ----------
  @Get('products')
  @Perm('products')
  listProducts() {
    return this.admin.listProducts();
  }
  @Post('products')
  @Perm('products')
  createProduct(@Body() body: any) {
    return this.admin.createProduct(body);
  }
  @Patch('products/:id')
  @Perm('products')
  updateProduct(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.admin.updateProduct(id, body);
  }

  // ---------- 套餐 ----------
  @Get('plans')
  @Perm('products')
  listPlans(@Query('productId') productId?: string) {
    return this.admin.listPlans(productId ? Number(productId) : undefined);
  }
  @Post('plans')
  @Perm('products')
  createPlan(@Body() body: any) {
    return this.admin.createPlan(body);
  }
  @Patch('plans/:id')
  @Perm('products')
  updatePlan(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.admin.updatePlan(id, body);
  }

  // ---------- 定价 ----------
  @Get('plans/:id/prices')
  @Perm('products')
  getPrices(@Param('id', ParseIntPipe) id: number) {
    return this.admin.getPrices(id);
  }
  @Put('plans/:id/prices')
  @Perm('products')
  setPrices(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { items: { region: string; currency: string; price: number }[] },
  ) {
    return this.admin.setPrices(id, body.items || []);
  }

  // ---------- 库存 ----------
  @Get('inventory')
  @Perm('inventory')
  listInventory(@Query('planId') planId?: string) {
    return this.admin.listInventory(planId ? Number(planId) : undefined);
  }
  @Post('inventory')
  @Perm('inventory')
  createInventory(@Body() body: any) {
    return this.admin.createInventory(body);
  }
  @Patch('inventory/:id/health')
  @Perm('inventory')
  setHealth(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { health: 'ok' | 'banned' },
  ) {
    return this.admin.setInventoryHealth(id, body.health);
  }

  // ---------- 订单 ----------
  @Get('orders')
  @Perm('orders')
  listOrders(@Query('status') status?: string) {
    return this.admin.listOrders(status || undefined);
  }
  @Post('orders/:id/refund')
  @Perm('orders')
  refund(@Param('id', ParseIntPipe) id: number) {
    return this.admin.refundOrder(id);
  }
  @Post('orders/:id/fulfill')
  @Perm('orders')
  fulfill(@Param('id', ParseIntPipe) id: number) {
    return this.admin.fulfillOrder(id);
  }

  // ---------- 用户 ----------
  @Get('users')
  @Perm('users')
  listUsers() {
    return this.admin.listUsers();
  }
  @Patch('users/:id/status')
  @Perm('users')
  setUserStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: 'active' | 'banned' },
  ) {
    return this.admin.setUserStatus(id, body.status);
  }

  // ---------- 客服工单 ----------
  @Get('tickets')
  @Perm('tickets')
  listTickets(@Query('status') status?: string) {
    return this.admin.listTickets(status || undefined);
  }
  @Get('tickets/:id')
  @Perm('tickets')
  getTicket(@Param('id', ParseIntPipe) id: number) {
    return this.admin.getTicket(id);
  }
  @Post('tickets/:id/reply')
  @Perm('tickets')
  replyTicket(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { content: string },
  ) {
    return this.admin.replyTicket(id, body.content || '');
  }
  @Post('tickets/:id/close')
  @Perm('tickets')
  closeTicket(@Param('id', ParseIntPipe) id: number) {
    return this.admin.closeTicket(id);
  }
  /** 一键售后动作：reissue 补发 / refund 退款 */
  @Post('tickets/:id/action')
  @Perm('tickets')
  ticketAction(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { action: 'reissue' | 'refund' },
  ) {
    return this.admin.ticketAction(id, body.action);
  }

  // ---------- 供应商审核 ----------
  @Get('supplier-submissions')
  @Perm('suppliers')
  listSubmissions(@Query('status') status?: string) {
    return this.admin.listSubmissions(status || undefined);
  }
  @Post('supplier-submissions/:id/review')
  @Perm('suppliers')
  review(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { approve: boolean; reviewNote?: string },
  ) {
    return this.admin.reviewSubmission(id, !!body.approve, body.reviewNote || '');
  }

  // ---------- 管理员管理（仅超级管理员） ----------
  @Get('admins')
  @Roles('super')
  listAdmins() {
    return this.admin.listAdmins();
  }
  @Post('admins')
  @Roles('super')
  createAdmin(
    @Body() body: { email: string; password: string; permissions: string[] },
  ) {
    return this.admin.createAdmin(body.email, body.password, body.permissions || []);
  }
  @Patch('admins/:id')
  @Roles('super')
  updateAdmin(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { permissions?: string[]; status?: 'active' | 'banned' },
  ) {
    return this.admin.updateAdmin(id, body);
  }
}
