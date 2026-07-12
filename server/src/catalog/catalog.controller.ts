import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';

const norm = (region?: string) =>
  ['US', 'EU', 'CN', 'GLOBAL'].includes((region || '').toUpperCase())
    ? (region as string).toUpperCase()
    : 'GLOBAL';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('products')
  list(@Query('region') region?: string) {
    return this.catalog.listProducts(norm(region));
  }

  @Get('products/:slug')
  detail(@Param('slug') slug: string, @Query('region') region?: string) {
    return this.catalog.getProduct(slug, norm(region));
  }

  @Get('plans/:id')
  plan(@Param('id') id: string, @Query('region') region?: string) {
    return this.catalog.getPlan(Number(id), norm(region));
  }

  /** 购物车报价（公开） */
  @Post('quote')
  quote(@Body() body: { planIds: number[]; region?: string }) {
    return this.catalog.quote(
      Array.isArray(body.planIds) ? body.planIds : [],
      norm(body.region),
    );
  }
}
