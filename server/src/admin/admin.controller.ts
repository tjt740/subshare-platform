import {
  Body,
  Controller,
  Delete,
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
  CurrentUser,
  JwtAuthGuard,
  JwtUser,
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
  @Delete('products/:id')
  @Perm('products')
  deleteProduct(@Param('id', ParseIntPipe) id: number) {
    return this.admin.deleteProduct(id);
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
  @Delete('plans/:id')
  @Perm('products')
  deletePlan(@Param('id', ParseIntPipe) id: number) {
    return this.admin.deletePlan(id);
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
    @Body() body: { items: any[] },
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
  createInventory(@Body() body: any, @CurrentUser() user: JwtUser) {
    return this.admin.createInventory(body, user.sub);
  }
  @Patch('inventory/:id')
  @Perm('inventory')
  updateInventory(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
    @CurrentUser() user: JwtUser,
  ) {
    return this.admin.updateInventory(id, body, user.sub);
  }
  @Post('inventory/:id/costs')
  @Perm('inventory')
  addInventoryCost(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
    @CurrentUser() user: JwtUser,
  ) {
    return this.admin.addAccountCost(id, body, user.sub);
  }
  @Patch('inventory/:id/health')
  @Perm('inventory')
  setHealth(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { health: 'ok' | 'banned' },
    @CurrentUser() user: JwtUser,
  ) {
    return this.admin.setInventoryHealth(id, body.health, user.sub);
  }

  // ---------- 订单 ----------
  @Get('orders')
  @Perm('orders')
  listOrders(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.admin.listOrders({
      status: status || undefined,
      search: search || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 20,
    });
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
  @Patch('users/:id/level')
  @Perm('users')
  setUserLevel(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { level: number | null },
  ) {
    return this.admin.setUserLevel(id, body.level ?? null);
  }
  @Patch('users/:id/status')
  @Perm('users')
  setUserStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: 'active' | 'banned' },
  ) {
    return this.admin.setUserStatus(id, body.status);
  }

  // ---------- 站点配置 ----------
  @Get('site-config')
  @Perm('settings')
  getSiteConfig() {
    return this.admin.getSiteConfigWorkspace();
  }
  @Post('site-config/revisions')
  @Perm('settings')
  submitSiteConfig(@Body() body: any, @CurrentUser() user: JwtUser) {
    return this.admin.submitSiteConfig(body?.config ?? {}, user.sub);
  }
  @Post('site-config/revisions/:id/review')
  @Roles('super')
  reviewSiteConfig(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { approve: boolean; reviewNote?: string },
    @CurrentUser() user: JwtUser,
  ) {
    return this.admin.reviewSiteConfig(
      id,
      !!body.approve,
      body.reviewNote || '',
      user.sub,
    );
  }

  // ---------- 库存坑位下钻 ----------
  @Get('inventory/:id/slots')
  @Perm('inventory')
  accountSlots(@Param('id', ParseIntPipe) id: number) {
    return this.admin.accountSlots(id);
  }

  // ---------- 客服工单 ----------
  @Get('tickets')
  @Perm('tickets')
  listTickets(@Query('status') status?: string) {
    return this.admin.listTickets(status || undefined);
  }
  @Get('tickets-stats')
  @Perm('tickets')
  ticketStats() {
    return this.admin.ticketStats();
  }
  @Get('support-agents')
  @Perm('tickets')
  supportAgents() {
    return this.admin.listSupportAgents();
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
    @CurrentUser() user: JwtUser,
  ) {
    return this.admin.replyTicket(id, body.content || '', user.sub);
  }
  @Post('tickets/:id/close')
  @Perm('tickets')
  closeTicket(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { resolutionNote?: string },
    @CurrentUser() user: JwtUser,
  ) {
    return this.admin.resolveTicket(id, user.sub, body.resolutionNote);
  }
  @Post('tickets/:id/transfer')
  @Perm('tickets')
  transferTicket(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { agentId: number; reason: string },
    @CurrentUser() user: JwtUser,
  ) {
    return this.admin.transferTicket(id, Number(body.agentId), body.reason || '', {
      sub: user.sub,
      role: user.role as 'admin' | 'super',
    });
  }
  /** 一键售后动作：reissue 补发 / refund 退款 */
  @Post('tickets/:id/action')
  @Perm('tickets')
  ticketAction(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { action: 'reissue' | 'refund' },
    @CurrentUser() user: JwtUser,
  ) {
    return this.admin.ticketAction(id, body.action, user.sub);
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
    @CurrentUser() user: JwtUser,
  ) {
    return this.admin.reviewSubmission(
      id,
      !!body.approve,
      body.reviewNote || '',
      user.sub,
    );
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
