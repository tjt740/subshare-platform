import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import {
  InventoryAccount,
  Plan,
  PriceBook,
  Product,
  Slot,
  User,
} from './entities';

/** 种子数据逻辑（复用：CLI npm run seed / 服务端空库自动初始化） */
export async function runSeed(ds: DataSource) {
  const users = ds.getRepository(User);
  const products = ds.getRepository(Product);
  const plans = ds.getRepository(Plan);
  const prices = ds.getRepository(PriceBook);
  const accounts = ds.getRepository(InventoryAccount);
  const slots = ds.getRepository(Slot);

  const ensureUser = async (
    email: string,
    password: string,
    role: User['role'],
    permissions: string[] = [],
  ) => {
    if (await users.findOneBy({ email })) return;
    await users.save(
      users.create({
        email,
        passwordHash: await bcrypt.hash(password, 10),
        role,
        permissions: JSON.stringify(permissions),
      }),
    );
    console.log(`✔ ${role} ${email} / ${password}`);
  };

  await ensureUser('admin@demo.com', 'Admin123!', 'super');
  await ensureUser('staff@demo.com', 'Staff123!', 'admin', ['orders', 'tickets']);
  await ensureUser('supplier@demo.com', 'Supp123!', 'supplier');
  await ensureUser('user@demo.com', 'User123!', 'user');

  if ((await products.count()) > 0) {
    console.log('✔ 商品数据已存在，跳过（如需重置请删除 server/data/app.db）');
    return;
  }

  // 演示商品使用虚构品牌，避免直接使用真实商标
  const catalog: any[] = [
    {
      product: {
        slug: 'streammax-premium',
        title: 'StreamMax Premium 4K',
        category: '流媒体',
        rating: 4.9,
        soldCount: 12873,
        description:
          'StreamMax 高级家庭套餐合租位：4K 超高清 + 杜比全景声 + 独立观影档案。平台统一采购官方家庭组，你获得专属位置，观影记录与推荐完全独立，互不打扰。',
        meta: {
          badge: '🔥 热销 TOP1',
          officialPriceUsd: 22.99,
          features: [
            { icon: '📺', title: '4K + HDR 超高清', desc: '官方最高画质档位，支持杜比视界与全景声' },
            { icon: '👤', title: '独立观影档案', desc: '专属个人位置，片单、进度、推荐互不干扰' },
            { icon: '⚡', title: '秒级自动交付', desc: '支付成功后系统自动分配坑位并发放凭据' },
            { icon: '🛡️', title: '有效期内质保', desc: '账号异常免费补发，客服 7×24 在线' },
          ],
          faq: [
            { q: '合租位安全吗？会不会影响我的观看记录？', a: '每位用户使用独立档案位，观看记录、片单与推荐算法完全隔离。平台统一管理主账号，密码变更会自动同步补发。' },
            { q: '支付后多久可以使用？', a: '支付成功后系统自动分配坑位，通常 1 分钟内即可在「我的订阅」中查看凭据并开始观看。' },
            { q: '如果账号被封或失效怎么办？', a: '有效期内出现账号异常，平台免费补发新坑位；也可在工单中心一键申请人工处理。' },
            { q: '可以在几台设备上使用？', a: '同一档案位支持常见的手机/平板/电视端登录，建议同时在线不超过 2 台设备以避免风控。' },
          ],
          reviews: [
            { user: 'Leo***2', rating: 5, date: '2026-06-30', content: '第二年续费了，秒发货，画质拉满，比官方省了七成。' },
            { user: 'Ame***a', rating: 5, date: '2026-06-21', content: '中途遇到一次掉线，工单十分钟就补发了新位置，服务不错。' },
            { user: '张**', rating: 4, date: '2026-06-12', content: '价格真香，就是高峰期客服回复稍慢。' },
          ],
          delivery: {
            method: '账号密码',
            time: '支付后 60 秒内自动发放',
            steps: ['支付成功', '系统自动分配观影位', '发放账号密码', '登录选择你的专属档案'],
          },
          warranty: '有效期内封号/失效免费补发，工单 2 小时内响应',
          aftersales: [
            { issue: '账号无法登录 / 密码被改', way: '订阅卡点「申请补发」，系统自动换新位置', sla: '≤ 2 小时' },
            { issue: '买错了 / 不想要了', way: '点「申请退款」，按汇率退回钱包余额', sla: '≤ 24 小时' },
            { issue: '想换个观影位', way: '提交「换车」工单，客服协助迁移', sla: '≤ 12 小时' },
          ],
        },
        sort: 1,
      },
      plans: [
        {
          plan: { name: '合租位 · 1 个月', type: 'shared', periodMonths: 1 },
          prices: [
            { region: 'GLOBAL', currency: 'USD', price: 3.99 },
            { region: 'US', currency: 'USD', price: 4.49 },
            { region: 'EU', currency: 'EUR', price: 3.99 },
            { region: 'CN', currency: 'CNY', price: 25.9 },
          ],
          pool: [
            { credentials: { username: 'sm_family_01@pool.demo', password: 'Pool#Sm01', note: '4K 家庭组 · 位置 1-4' }, maxSlots: 4 },
            { credentials: { username: 'sm_family_02@pool.demo', password: 'Pool#Sm02', note: '4K 家庭组 · 位置 1-4' }, maxSlots: 4 },
          ],
        },
        {
          plan: { name: '合租位 · 12 个月', type: 'shared', periodMonths: 12 },
          prices: [
            { region: 'GLOBAL', currency: 'USD', price: 39.9 },
            { region: 'US', currency: 'USD', price: 42.9 },
            { region: 'EU', currency: 'EUR', price: 38.9 },
            { region: 'CN', currency: 'CNY', price: 259 },
          ],
          pool: [
            { credentials: { username: 'sm_family_03@pool.demo', password: 'Pool#Sm03', note: '年付家庭组 · 位置 1-4' }, maxSlots: 4 },
          ],
        },
      ],
    },
    {
      product: {
        slug: 'musicpro-family',
        title: 'MusicPro 家庭会员',
        category: '音乐',
        rating: 4.8,
        soldCount: 9541,
        description:
          'MusicPro 家庭组席位：无广告 + 无损音质 + 离线下载。以家庭组邀请方式加入，使用你自己的账号，歌单、收藏与年度报告完全不受影响。',
        meta: {
          badge: '💎 口碑之选',
          officialPriceUsd: 11.99,
          features: [
            { icon: '🎧', title: '无损音质', desc: '最高 24-bit/192kHz，支持空间音频' },
            { icon: '🙋', title: '用自己的账号', desc: '家庭组邀请制，歌单收藏零迁移成本' },
            { icon: '📩', title: '邀请链接交付', desc: '支付后收到家庭组邀请，点击即加入' },
            { icon: '🔁', title: '到期无感续费', desc: '续费后自动顺延，无需重新进组' },
          ],
          faq: [
            { q: '加入家庭组需要改密码或换账号吗？', a: '不需要。你使用自己的账号接受邀请即可，所有个人数据保持不变。' },
            { q: '家庭组地址校验怎么办？', a: '平台已统一配置家庭组地址信息，正常使用不会触发校验；如遇提示请联系客服协助。' },
            { q: '到期后会怎样？', a: '到期前 3 天会收到提醒，未续费则会被移出家庭组，账号本身不受影响。' },
          ],
          reviews: [
            { user: 'Mia***7', rating: 5, date: '2026-07-01', content: '邀请秒到，无损音质没话说，一年下来省了一大截。' },
            { user: '王**', rating: 5, date: '2026-06-18', content: '一直担心要换账号，结果直接邀请进组，歌单都在，太省心。' },
          ],
          delivery: {
            method: '家庭组邀请',
            time: '支付后 5 分钟内发送邀请链接',
            steps: ['支付成功', '收到家庭组邀请链接', '用自己的账号接受邀请', '会员立即生效'],
          },
          warranty: '有效期内被移出家庭组免费重新拉入',
          aftersales: [
            { issue: '被移出家庭组 / 会员失效', way: '点「申请补发」自动重新邀请', sla: '≤ 2 小时' },
            { issue: '邀请链接未收到', way: '提交工单，客服人工重发', sla: '≤ 1 小时' },
            { issue: '不想用了', way: '点「申请退款」按剩余价值退钱包', sla: '≤ 24 小时' },
          ],
        },
        sort: 2,
      },
      plans: [
        {
          plan: { name: '家庭位 · 1 个月', type: 'shared', periodMonths: 1 },
          prices: [
            { region: 'GLOBAL', currency: 'USD', price: 2.49 },
            { region: 'CN', currency: 'CNY', price: 15.9 },
          ],
          pool: [
            { credentials: { username: 'mp_family_01@pool.demo', password: 'Pool#Mp01', note: '家庭组邀请制 · 位置 1-5' }, maxSlots: 5 },
          ],
        },
        {
          plan: { name: '家庭位 · 12 个月', type: 'shared', periodMonths: 12 },
          prices: [
            { region: 'GLOBAL', currency: 'USD', price: 24.9 },
            { region: 'EU', currency: 'EUR', price: 22.9 },
            { region: 'CN', currency: 'CNY', price: 165 },
          ],
          pool: [
            { credentials: { username: 'mp_family_02@pool.demo', password: 'Pool#Mp02', note: '年付家庭组 · 位置 1-5' }, maxSlots: 5 },
          ],
        },
      ],
    },
    {
      product: {
        slug: 'ai-assistant-pro',
        title: 'AI Assistant Pro',
        category: 'AI 工具',
        rating: 4.9,
        soldCount: 21406,
        description:
          '旗舰 AI 助手团队席位：无限对话 + 图像生成 + 代码助手 + 文件分析。团队工作区席位彼此隔离，你的会话与数据独立存储，官方直连低延迟。',
        meta: {
          badge: '🚀 增长最快',
          officialPriceUsd: 20,
          features: [
            { icon: '🧠', title: '旗舰模型不限量', desc: '官方团队版配额，高峰期优先响应' },
            { icon: '🔒', title: '数据隔离', desc: '独立席位与会话空间，管理员不可见你的对话' },
            { icon: '🖼️', title: '多模态全解锁', desc: '图像生成、文件分析、代码解释器全部可用' },
            { icon: '⚡', title: '1 分钟开通', desc: '支付后自动分配席位并发送登录凭据' },
          ],
          faq: [
            { q: '和官方个人版有什么区别？', a: '功能与配额一致（团队版通常更高）。区别在于你以团队席位方式使用，成本大幅降低。' },
            { q: '我的对话记录别人能看到吗？', a: '不能。团队版席位之间数据完全隔离，工作区管理员也无法查看成员会话内容。' },
            { q: '支持 API 吗？', a: '本席位为网页/App 使用授权，不包含 API 额度；如需 API 请联系客服单独开通。' },
          ],
          reviews: [
            { user: 'Dev***k', rating: 5, date: '2026-07-05', content: '写代码神器，团队版比个人版还稳，这价格离谱地划算。' },
            { user: '陈**', rating: 5, date: '2026-06-27', content: '本来将信将疑，付款一分钟就收到席位邀请，用了一个月零问题。' },
            { user: 'Sam***9', rating: 4, date: '2026-06-15', content: '整体满意，唯一希望是以后能加上 API 席位。' },
          ],
          delivery: {
            method: '团队席位账号',
            time: '支付后 60 秒内自动发放',
            steps: ['支付成功', '自动分配团队席位', '发放登录凭据', '登录即用，会话独立'],
          },
          warranty: '席位失效免费补发；高峰限流可申请换区',
          aftersales: [
            { issue: '席位无法登录', way: '点「申请补发」自动换新席位', sla: '≤ 1 小时' },
            { issue: '对话数据异常', way: '提交工单，技术排查', sla: '≤ 6 小时' },
            { issue: '效果不满意', way: '48 小时内可点「申请退款」', sla: '≤ 24 小时' },
          ],
        },
        sort: 3,
      },
      plans: [
        {
          plan: { name: '团队席位 · 1 个月', type: 'shared', periodMonths: 1 },
          prices: [
            { region: 'GLOBAL', currency: 'USD', price: 8.9 },
            { region: 'US', currency: 'USD', price: 9.9 },
            { region: 'EU', currency: 'EUR', price: 8.9 },
            { region: 'CN', currency: 'CNY', price: 59 },
          ],
          pool: [
            { credentials: { username: 'ai_team_01@pool.demo', password: 'Pool#Ai01', note: '团队工作区 · 席位 1-5' }, maxSlots: 5 },
            { credentials: { username: 'ai_team_02@pool.demo', password: 'Pool#Ai02', note: '团队工作区 · 席位 1-5' }, maxSlots: 5 },
          ],
        },
        {
          plan: { name: '团队席位 · 3 个月', type: 'shared', periodMonths: 3 },
          prices: [
            { region: 'GLOBAL', currency: 'USD', price: 24.9 },
            { region: 'CN', currency: 'CNY', price: 168 },
          ],
          pool: [
            { credentials: { username: 'ai_team_03@pool.demo', password: 'Pool#Ai03', note: '团队工作区 · 席位 1-5' }, maxSlots: 5 },
          ],
        },
      ],
    },
    {
      product: {
        slug: 'officeplus-365',
        title: 'OfficePlus 365 全家桶',
        category: '办公',
        rating: 4.7,
        soldCount: 6382,
        description:
          'OfficePlus 365 家庭版席位：Word/Excel/PPT 桌面全套 + 1TB 云盘。绑定你自己的账号开通，正版授权跨设备同步。',
        meta: {
          badge: '📦 办公必备',
          officialPriceUsd: 9.99,
          features: [
            { icon: '📄', title: '桌面版全套', desc: 'Word / Excel / PowerPoint / Outlook 正版授权' },
            { icon: '☁️', title: '1TB 云存储', desc: '个人专属云盘空间，跨设备实时同步' },
            { icon: '🙋', title: '绑定自有账号', desc: '家庭组邀请开通，文件与设置零迁移' },
            { icon: '💻', title: '5 台设备', desc: '电脑/手机/平板同时登录使用' },
          ],
          faq: [
            { q: '是正版授权吗？', a: '是。通过官方家庭版共享机制开通，账户内可见订阅状态与到期时间。' },
            { q: '已有文件会受影响吗？', a: '不会。使用你自己的账号加入，云盘与文档保持原样，仅解锁高级功能。' },
          ],
          reviews: [
            { user: 'Ken***5', rating: 5, date: '2026-06-25', content: '1TB 云盘 + 全套桌面版，这个价格没有对手。' },
            { user: '李**', rating: 4, date: '2026-06-10', content: '开通流程比想象中简单，接受邀请就行。' },
          ],
          delivery: {
            method: '家庭组邀请',
            time: '支付后 10 分钟内发送邀请',
            steps: ['支付成功', '收到家庭席位邀请', '用自己账号接受', '订阅与 1TB 云盘生效'],
          },
          warranty: '有效期内席位失效免费重邀',
          aftersales: [
            { issue: '席位失效 / 订阅过期', way: '点「申请补发」重新拉入家庭组', sla: '≤ 4 小时' },
            { issue: '云盘容量未生效', way: '提交工单，客服核查', sla: '≤ 6 小时' },
            { issue: '不想用了', way: '点「申请退款」按剩余价值退钱包', sla: '≤ 24 小时' },
          ],
        },
        sort: 4,
      },
      plans: [
        {
          plan: { name: '家庭席位 · 12 个月', type: 'shared', periodMonths: 12 },
          prices: [
            { region: 'GLOBAL', currency: 'USD', price: 16.9 },
            { region: 'EU', currency: 'EUR', price: 15.9 },
            { region: 'CN', currency: 'CNY', price: 115 },
          ],
          pool: [
            { credentials: { username: 'op_family_01@pool.demo', password: 'Pool#Op01', note: '家庭组 · 席位 1-5' }, maxSlots: 5 },
          ],
        },
      ],
    },
  ];

  for (const entry of catalog) {
    const { meta, ...productData } = entry.product;
    const product = await products.save(
      products.create({
        ...productData,
        meta: JSON.stringify(meta),
      } as Partial<Product>),
    );
    for (const planEntry of entry.plans) {
      const plan = await plans.save(
        plans.create({
          ...planEntry.plan,
          productId: product.id,
        } as Partial<Plan>),
      );
      for (const price of planEntry.prices) {
        await prices.save(prices.create({ ...price, planId: plan.id }));
      }
      for (const pool of planEntry.pool) {
        const account = await accounts.save(
          accounts.create({
            planId: plan.id,
            credentials: JSON.stringify(pool.credentials),
            maxSlots: pool.maxSlots,
          }),
        );
        for (let i = 0; i < pool.maxSlots; i++) {
          await slots.save(
            slots.create({ accountId: account.id, status: 'free' }),
          );
        }
      }
    }
    console.log(`✔ 商品 ${product.title}`);
  }

  console.log('✔ 种子数据完成');
}
