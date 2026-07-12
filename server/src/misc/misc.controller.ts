import { Controller, Get, Req } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { SiteSetting } from '../entities';

const VERSION = 'v4';
const BOOT_AT = Date.now();

/** 健康检查 + 地区/语言探测（前台状态时钟与 i18n 自动跟随使用） */
@Controller()
export class MiscController {
  constructor(
    @InjectRepository(SiteSetting)
    private readonly settings: Repository<SiteSetting>,
  ) {}

  /** 前台站点配置（后台「站点设置」可改；空值走前台内置默认） */
  @Get('site-config')
  async siteConfig() {
    const row = await this.settings.findOneBy({ key: 'site' });
    try {
      return row ? JSON.parse(row.value) : {};
    } catch {
      return {};
    }
  }

  /** 前台状态条轮询：证明 API 存活 */
  @Get('health')
  health() {
    return {
      ok: true,
      version: VERSION,
      time: new Date().toISOString(),
      uptimeSec: Math.floor((Date.now() - BOOT_AT) / 1000),
    };
  }

  /**
   * 语言/地区探测：
   * 1) 优先 CDN 地理头（Cloudflare CF-IPCountry / 常见反代头）——生产环境即"跟随 IP"
   * 2) 本地/内网 IP 无地理信息时回退 Accept-Language（演示环境的等效信号）
   */
  @Get('geo')
  geo(@Req() req: Request) {
    const headerCountry =
      (req.headers['cf-ipcountry'] as string) ||
      (req.headers['x-country-code'] as string) ||
      '';
    const acceptLanguage = (req.headers['accept-language'] as string) || '';
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      '';

    let country = headerCountry.toUpperCase();
    if (!country) {
      // 从 Accept-Language 推断地区（如 zh-CN / en-US / ja-JP）
      const m = acceptLanguage.match(/[a-z]{2}-([A-Z]{2})/);
      country = m?.[1] ?? '';
    }

    const zhCountries = ['CN', 'HK', 'MO', 'TW', 'SG'];
    const prefersZh =
      (country && zhCountries.includes(country)) ||
      /^zh\b|,\s*zh\b/i.test(acceptLanguage);

    // 地区 -> 前台默认售卖地区
    const region = country === 'CN' ? 'CN' : ['DE','FR','ES','IT','NL','PT','IE','AT','BE','FI','GR','PL','SE'].includes(country) ? 'EU' : 'US';

    return {
      ip,
      country: country || 'UNKNOWN',
      suggestedLocale: prefersZh ? 'zh' : 'en',
      suggestedRegion: region,
      source: headerCountry ? 'ip-geo' : 'accept-language',
    };
  }
}
