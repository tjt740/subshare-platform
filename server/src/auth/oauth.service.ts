import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { LoginLog, User } from '../entities';

/**
 * 第三方登录（Google / GitHub / Microsoft）
 *
 * 标准 OAuth 2.0 授权码流程：
 *   前台 → GET /api/auth/oauth/:provider/start
 *        → 302 到厂商授权页（带 state 防 CSRF）
 *        → 用户授权后厂商回调 GET /api/auth/oauth/:provider/callback?code&state
 *        → 后端用 code 换 access_token，再拉取用户信息
 *        → upsert 用户，签发本站 JWT，302 回前台 /oauth/callback#token=...
 *
 * 演示兜底：未配置 Client ID/Secret 时，:provider/start 直接生成一个演示账号并
 * 302 回同一个前台回调地址。前端流程完全一致，日后填上密钥即自动切换为真实登录。
 */

export type ProviderName = 'google' | 'github' | 'microsoft';

interface ProviderDef {
  name: ProviderName;
  label: string;
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  /** 用 access_token 拉取用户信息，返回统一结构 */
  fetchUser: (accessToken: string) => Promise<OAuthUser>;
}
interface OAuthUser {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
}

const env = (k: string) => (process.env[k] || '').trim();

/** 回调基址：厂商把用户送回后端的地址（必须与厂商后台登记的一致） */
const API_BASE = () => env('OAUTH_CALLBACK_BASE') || 'http://localhost:3001';
/** 前台地址：后端签完 token 后把用户送回这里 */
const WEB_ORIGIN = () => env('WEB_ORIGIN') || 'http://localhost:5173';

const PROVIDERS: Record<ProviderName, ProviderDef> = {
  google: {
    name: 'google',
    label: 'Google',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
    async fetchUser(token) {
      const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error(`Google userinfo ${r.status}`);
      const u: any = await r.json();
      return { id: u.sub, email: u.email, name: u.name, avatar: u.picture };
    },
  },
  github: {
    name: 'github',
    label: 'GitHub',
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scope: 'read:user user:email',
    async fetchUser(token) {
      const headers = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      };
      const r = await fetch('https://api.github.com/user', { headers });
      if (!r.ok) throw new Error(`GitHub user ${r.status}`);
      const u: any = await r.json();
      let email: string = u.email;
      if (!email) {
        // GitHub 用户可能隐藏了公开邮箱，需要单独取
        const re = await fetch('https://api.github.com/user/emails', { headers });
        if (re.ok) {
          const list = (await re.json()) as any[];
          email = (list.find((e) => e.primary && e.verified) || list[0])?.email;
        }
      }
      if (!email) email = `${u.id}+${u.login}@users.noreply.github.com`;
      return { id: String(u.id), email, name: u.name || u.login, avatar: u.avatar_url };
    },
  },
  microsoft: {
    name: 'microsoft',
    label: 'Microsoft',
    authorizeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scope: 'openid email profile User.Read',
    async fetchUser(token) {
      const r = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error(`Microsoft me ${r.status}`);
      const u: any = await r.json();
      return {
        id: u.id,
        email: u.mail || u.userPrincipalName,
        name: u.displayName,
      };
    },
  },
};

@Injectable()
export class OAuthService {
  private readonly log = new Logger('OAuth');

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(LoginLog) private readonly logs: Repository<LoginLog>,
    private readonly jwt: JwtService,
  ) {}

  private def(name: string): ProviderDef {
    const p = PROVIDERS[name as ProviderName];
    if (!p) throw new BadRequestException(`不支持的登录方式: ${name}`);
    return p;
  }

  private creds(name: ProviderName) {
    const prefix = name.toUpperCase();
    return {
      clientId: env(`${prefix}_CLIENT_ID`),
      clientSecret: env(`${prefix}_CLIENT_SECRET`),
    };
  }

  /** 是否已配置真实密钥 */
  isConfigured(name: ProviderName) {
    const { clientId, clientSecret } = this.creds(name);
    return !!clientId && !!clientSecret;
  }

  /** 供前台渲染按钮：哪些可用、是否演示模式 */
  listProviders() {
    return (Object.keys(PROVIDERS) as ProviderName[]).map((name) => ({
      name,
      label: PROVIDERS[name].label,
      configured: this.isConfigured(name),
      mode: this.isConfigured(name) ? 'oauth' : 'demo',
    }));
  }

  private redirectUri(name: ProviderName) {
    return `${API_BASE()}/api/auth/oauth/${name}/callback`;
  }

  /** state：短时效签名令牌，防 CSRF / 重放 */
  private makeState(name: ProviderName, next: string) {
    return this.jwt.sign(
      { p: name, n: next, nonce: randomBytes(8).toString('hex') },
      { expiresIn: '10m' },
    );
  }
  private readState(state: string) {
    try {
      return this.jwt.verify(state) as { p: ProviderName; n: string };
    } catch {
      throw new BadRequestException('登录状态已过期，请重新发起');
    }
  }

  /** 第 1 步：拿到要跳转的地址（真实授权页，或演示直通回调） */
  async startUrl(name: string, next = '/') {
    const p = this.def(name);
    if (!this.isConfigured(p.name)) {
      // —— 演示模式：直接建号发 token，回到与真实流程相同的前台回调 ——
      const demo = await this.upsert(
        p.name,
        {
          id: `demo-${randomBytes(4).toString('hex')}`,
          email: `demo_${p.name}_${randomBytes(3).toString('hex')}@${p.name}.demo`,
          name: `${p.label} 演示用户`,
        },
        '',
        'demo',
      );
      return this.frontendCallback(demo, next, true);
    }

    const { clientId } = this.creds(p.name);
    const q = new URLSearchParams({
      client_id: clientId,
      redirect_uri: this.redirectUri(p.name),
      response_type: 'code',
      scope: p.scope,
      state: this.makeState(p.name, next),
    });
    if (p.name === 'google') {
      q.set('access_type', 'offline');
      q.set('prompt', 'select_account');
    }
    if (p.name === 'microsoft') q.set('response_mode', 'query');
    return `${p.authorizeUrl}?${q.toString()}`;
  }

  /** 第 2 步：厂商回调 —— code 换 token，拉用户信息，签发本站 JWT */
  async handleCallback(
    name: string,
    code: string,
    state: string,
    ip = '',
    ua = '',
  ) {
    const p = this.def(name);
    const { n: next } = this.readState(state);
    const { clientId, clientSecret } = this.creds(p.name);

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: this.redirectUri(p.name),
    });
    const tr = await fetch(p.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json', // GitHub 默认返回 form-encoded，必须显式要 JSON
      },
      body,
    });
    if (!tr.ok) {
      this.log.error(`${p.name} token 交换失败 ${tr.status}: ${await tr.text()}`);
      throw new BadRequestException(`${p.label} 授权失败，请重试`);
    }
    const tok: any = await tr.json();
    if (!tok.access_token) throw new BadRequestException(`${p.label} 未返回 access_token`);

    const profile = await p.fetchUser(tok.access_token);
    if (!profile.email) throw new BadRequestException(`${p.label} 未返回邮箱，无法创建账号`);

    const user = await this.upsert(p.name, profile, ip, ua);
    return this.frontendCallback(user, next, false);
  }

  /** 落库：已绑定 → 直接登录；同邮箱已存在 → 自动绑定；否则新建账号 */
  private async upsert(
    provider: ProviderName,
    profile: OAuthUser,
    ip: string,
    ua: string,
  ) {
    const email = profile.email.trim().toLowerCase();
    let user = await this.users.findOneBy({ email });

    if (!user) {
      // 第三方账号没有密码：随机一段占位哈希，用户可后续用「忘记密码」设置本站密码
      user = this.users.create({
        email,
        passwordHash: await bcrypt.hash(randomBytes(24).toString('hex'), 10),
        nickname: (profile.name || '').slice(0, 40),
        avatar: profile.avatar?.startsWith('http') ? profile.avatar : 'sv:spark',
        role: 'user',
        provider,
        providerIds: JSON.stringify({ [provider]: profile.id }),
      });
    } else {
      // 同邮箱已有账号 → 绑定该第三方，而不是报「邮箱已注册」
      let ids: Record<string, string> = {};
      try {
        ids = JSON.parse(user.providerIds || '{}');
      } catch {
        ids = {};
      }
      ids[provider] = profile.id;
      user.providerIds = JSON.stringify(ids);
      if (!user.nickname && profile.name) user.nickname = profile.name.slice(0, 40);
    }
    if (user.status === 'banned') throw new BadRequestException('账号已被封禁，请联系客服');
    user = await this.users.save(user);

    await this.logs.save(
      this.logs.create({
        userId: user.id,
        ip,
        userAgent: (`${provider} · ${ua}`).slice(0, 200),
      }),
    );
    return user;
  }

  /** 统一回前台：token 放 URL fragment（不进服务端日志、不进 Referer） */
  private frontendCallback(user: User, next: string, demo: boolean) {
    let permissions: string[] = [];
    try {
      permissions = JSON.parse(user.permissions || '[]');
    } catch {
      permissions = [];
    }
    const token = this.jwt.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      permissions,
    });
    const safeNext = next.startsWith('/') ? next : '/';
    const frag = new URLSearchParams({
      token,
      provider: user.provider,
      next: safeNext,
      ...(demo ? { demo: '1' } : {}),
    });
    return `${WEB_ORIGIN()}/oauth/callback#${frag.toString()}`;
  }
}
