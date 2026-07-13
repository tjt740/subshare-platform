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
  /**
   * 演示商品：8 个真实品牌订阅（品牌名与图标仅用于演示，正式商用需获授权）
   * meta.brand 决定前台/后台展示的品牌图标
   */
  const brandProduct = (o: any) => o;
  const catalog: any[] = [
    brandProduct({
      product: {
        slug: 'chatgpt-plus', title: 'ChatGPT Plus', category: 'AI 工具',
        rating: 4.9, soldCount: 32871, sort: 1,
        description: 'OpenAI ChatGPT Plus 团队席位：GPT-5 旗舰模型不限量、深度思考、图像生成、数据分析与 GPTs。席位数据隔离，会话独立，官方直连低延迟。',
        meta: {
          brand: 'chatgpt', badge: '热销 TOP1', officialPriceUsd: 20,
          features: [
            { icon: 'ai', title: '旗舰模型不限量', desc: '高峰期优先响应，配额远超免费版' },
            { icon: 'shield', title: '会话数据隔离', desc: '独立席位，工作区管理员看不到你的对话' },
            { icon: 'sparkle', title: '多模态全解锁', desc: '图像生成 / 数据分析 / 文件解读 / GPTs' },
            { icon: 'bolt', title: '60 秒开通', desc: '支付后自动分配席位并发送凭据' },
          ],
          faq: [
            { q: '和官方个人版有什么区别？', a: '功能与配额一致（团队版通常更高）。区别在于以团队席位方式使用，成本大幅降低。' },
            { q: '我的对话别人能看到吗？', a: '不能。团队版席位之间数据完全隔离，工作区管理员也无法查看成员会话内容。' },
            { q: '支持 API 吗？', a: '本席位为网页/App 使用授权，不含 API 额度；如需 API 请联系客服单独开通。' },
          ],
          reviews: [
            { user: 'Dev***k', rating: 5, date: '2026-07-05', content: '写代码神器，团队版比个人版还稳，这价格离谱地划算。' },
            { user: '陈**', rating: 5, date: '2026-06-27', content: '付款一分钟收到席位，用了一个月零问题。' },
          ],
          delivery: { method: '团队席位账号', time: '支付后 60 秒内自动发放', steps: ['支付成功', '自动分配团队席位', '发放登录凭据', '登录即用，会话独立'] },
          warranty: '席位失效免费补发；高峰限流可申请换区',
          aftersales: [
            { issue: '席位无法登录', way: '订阅卡点「申请补发」自动换新席位', sla: '≤ 1 小时' },
            { issue: '对话数据异常', way: '提交工单，技术排查', sla: '≤ 6 小时' },
            { issue: '效果不满意', way: '48 小时内可申请退款', sla: '≤ 24 小时' },
          ],
        },
      },
      plans: [
        { plan: { name: '团队席位 · 1 个月', type: 'shared', periodMonths: 1 },
          prices: [{ region: 'GLOBAL', currency: 'USD', price: 8.9 }, { region: 'US', currency: 'USD', price: 9.9 }, { region: 'EU', currency: 'EUR', price: 8.9 }, { region: 'CN', currency: 'CNY', price: 59 }],
          pool: [
            { credentials: { username: 'gpt_team_01@pool.demo', password: 'Pool#Gpt1', note: '团队工作区 · 席位 1-5' }, maxSlots: 5 },
            { credentials: { username: 'gpt_team_02@pool.demo', password: 'Pool#Gpt2', note: '团队工作区 · 席位 1-5' }, maxSlots: 5 },
          ] },
        { plan: { name: '团队席位 · 3 个月', type: 'shared', periodMonths: 3 },
          prices: [{ region: 'GLOBAL', currency: 'USD', price: 24.9 }, { region: 'CN', currency: 'CNY', price: 168 }],
          pool: [{ credentials: { username: 'gpt_team_03@pool.demo', password: 'Pool#Gpt3', note: '团队工作区 · 席位 1-5' }, maxSlots: 5 }] },
      ],
    }),
    brandProduct({
      product: {
        slug: 'claude-pro', title: 'Claude Pro', category: 'AI 工具',
        rating: 4.9, soldCount: 24190, sort: 2,
        description: 'Anthropic Claude Pro 团队席位：Opus / Sonnet 旗舰模型、超长上下文、Projects 知识库与 Artifacts 可视化，长文与代码能力顶尖。',
        meta: {
          brand: 'claude', badge: '增长最快', officialPriceUsd: 20,
          features: [
            { icon: 'ai', title: 'Opus / Sonnet 全开', desc: '旗舰模型 5 倍用量，长文与代码更强' },
            { icon: 'study', title: '超长上下文', desc: '整本文档、整个代码库一次读完' },
            { icon: 'sparkle', title: 'Projects + Artifacts', desc: '知识库长期记忆，实时可视化产物' },
            { icon: 'shield', title: '数据不用于训练', desc: '席位独立，隐私边界清晰' },
          ],
          faq: [
            { q: '和 ChatGPT 有什么区别？', a: 'Claude 在长文写作、代码理解与遵循复杂指令上表现突出，上下文更长。' },
            { q: '用量够吗？', a: 'Pro 席位约为免费版 5 倍用量，高峰期优先。' },
          ],
          reviews: [
            { user: 'Ray***7', rating: 5, date: '2026-07-08', content: '长文档分析无敌，写代码比我同事强。' },
            { user: '刘**', rating: 5, date: '2026-06-30', content: 'Projects 存知识库太好用了，续了半年。' },
          ],
          delivery: { method: '团队席位账号', time: '支付后 60 秒内自动发放', steps: ['支付成功', '分配团队席位', '发放凭据', '登录即用'] },
          warranty: '有效期内席位失效免费补发',
          aftersales: [
            { issue: '席位失效', way: '一键申请补发', sla: '≤ 1 小时' },
            { issue: '用量受限', way: '提交工单换席位', sla: '≤ 4 小时' },
          ],
        },
      },
      plans: [
        { plan: { name: '团队席位 · 1 个月', type: 'shared', periodMonths: 1 },
          prices: [{ region: 'GLOBAL', currency: 'USD', price: 9.9 }, { region: 'EU', currency: 'EUR', price: 9.5 }, { region: 'CN', currency: 'CNY', price: 65 }],
          pool: [
            { credentials: { username: 'cla_team_01@pool.demo', password: 'Pool#Cla1', note: '团队工作区 · 席位 1-5' }, maxSlots: 5 },
            { credentials: { username: 'cla_team_02@pool.demo', password: 'Pool#Cla2', note: '团队工作区 · 席位 1-5' }, maxSlots: 5 },
          ] },
        { plan: { name: '团队席位 · 12 个月', type: 'shared', periodMonths: 12 },
          prices: [{ region: 'GLOBAL', currency: 'USD', price: 99 }, { region: 'CN', currency: 'CNY', price: 668 }],
          pool: [{ credentials: { username: 'cla_team_03@pool.demo', password: 'Pool#Cla3', note: '年付席位 1-5' }, maxSlots: 5 }] },
      ],
    }),
    brandProduct({
      product: {
        slug: 'elevenlabs-creator', title: 'ElevenLabs Creator', category: 'AI 工具',
        rating: 4.8, soldCount: 9862, sort: 3,
        description: 'ElevenLabs 语音合成 Creator 席位：超拟真 TTS、声音克隆、29 种语言配音与商用授权，音频创作者与出海内容团队首选。',
        meta: {
          brand: 'elevenlabs', badge: '创作者之选', officialPriceUsd: 22,
          features: [
            { icon: 'music', title: '超拟真语音', desc: '情感与呼吸细节，接近真人配音' },
            { icon: 'sparkle', title: '声音克隆', desc: '上传样本即可生成专属音色' },
            { icon: 'study', title: '29 种语言', desc: '一稿多语，出海内容一键本地化' },
            { icon: 'shield', title: '商用授权', desc: 'Creator 档含商业使用权' },
          ],
          faq: [
            { q: '生成的音频可以商用吗？', a: 'Creator 席位包含商业使用授权，可用于视频、播客与广告。' },
            { q: '字符额度共享吗？', a: '席位额度按月分配，用完可申请加量或升级套餐。' },
          ],
          reviews: [
            { user: 'Vid***o', rating: 5, date: '2026-07-02', content: '做 YouTube 配音成本直接砍半。' },
            { user: '周**', rating: 4, date: '2026-06-19', content: '中文音色略机械，英文非常自然。' },
          ],
          delivery: { method: '账号密码', time: '支付后 5 分钟内发放', steps: ['支付成功', '分配 Creator 席位', '发放账号密码', '登录开始合成'] },
          warranty: '额度异常免费补发或补额',
          aftersales: [
            { issue: '额度不足 / 异常', way: '提交工单补额或换号', sla: '≤ 4 小时' },
            { issue: '账号无法登录', way: '一键申请补发', sla: '≤ 2 小时' },
          ],
        },
      },
      plans: [
        { plan: { name: 'Creator 席位 · 1 个月', type: 'shared', periodMonths: 1 },
          prices: [{ region: 'GLOBAL', currency: 'USD', price: 7.9 }, { region: 'CN', currency: 'CNY', price: 52 }],
          pool: [{ credentials: { username: 'el_creator_01@pool.demo', password: 'Pool#El01', note: 'Creator 席位 1-3' }, maxSlots: 3 }] },
      ],
    }),
    brandProduct({
      product: {
        slug: 'notion-business', title: 'Notion 商业版', category: '办公',
        rating: 4.8, soldCount: 15420, sort: 4,
        description: 'Notion Business 工作区席位：无限文件上传、私有团队空间、高级权限与 Notion AI 加持，知识库与项目管理一体化。',
        meta: {
          brand: 'notion', badge: '团队协作首选', officialPriceUsd: 18,
          features: [
            { icon: 'office', title: '私有团队空间', desc: 'Business 档专属，权限颗粒度更细' },
            { icon: 'ai', title: 'Notion AI', desc: '写作、总结、翻译、自动填表' },
            { icon: 'box', title: '无限文件上传', desc: '附件不再受 5MB 限制' },
            { icon: 'shield', title: '版本历史 90 天', desc: '误删可回滚，团队协作更安心' },
          ],
          faq: [
            { q: '会和别人共用同一个工作区吗？', a: '你会加入平台维护的工作区，但可创建仅自己可见的私有空间；如需完全独立空间请选企业方案。' },
            { q: '数据能导出吗？', a: '可随时导出 Markdown / CSV / PDF，数据归你所有。' },
          ],
          reviews: [
            { user: 'PM***a', rating: 5, date: '2026-07-01', content: 'AI 写周报太香了，团队全员迁过来了。' },
            { user: '孙**', rating: 4, date: '2026-06-22', content: '无限上传是刚需，价格只要官方三分之一。' },
          ],
          delivery: { method: '工作区邀请', time: '支付后 10 分钟内发送邀请', steps: ['支付成功', '收到工作区邀请', '用自己的账号接受', 'Business 权限生效'] },
          warranty: '有效期内被移出工作区免费重邀',
          aftersales: [
            { issue: '被移出工作区', way: '一键申请补发重新邀请', sla: '≤ 2 小时' },
            { issue: 'AI 额度异常', way: '提交工单排查', sla: '≤ 6 小时' },
          ],
        },
      },
      plans: [
        { plan: { name: '工作区席位 · 1 个月', type: 'shared', periodMonths: 1 },
          prices: [{ region: 'GLOBAL', currency: 'USD', price: 5.9 }, { region: 'EU', currency: 'EUR', price: 5.5 }, { region: 'CN', currency: 'CNY', price: 39 }],
          pool: [{ credentials: { username: 'notion_biz_01@pool.demo', password: 'Pool#Nt01', note: 'Business 工作区 · 席位 1-6' }, maxSlots: 6 }] },
        { plan: { name: '工作区席位 · 12 个月', type: 'shared', periodMonths: 12 },
          prices: [{ region: 'GLOBAL', currency: 'USD', price: 59 }, { region: 'CN', currency: 'CNY', price: 399 }],
          pool: [{ credentials: { username: 'notion_biz_02@pool.demo', password: 'Pool#Nt02', note: '年付工作区席位' }, maxSlots: 6 }] },
      ],
    }),
    brandProduct({
      product: {
        slug: 'canva-pro', title: 'Canva Pro', category: '办公',
        rating: 4.9, soldCount: 28734, sort: 5,
        description: 'Canva Pro 团队席位：1 亿+ 高级素材、品牌套件、一键去背景、Magic Studio AI 设计与 1TB 云空间，设计小白也能出稿。',
        meta: {
          brand: 'canva', badge: '口碑之选', officialPriceUsd: 15,
          features: [
            { icon: 'sparkle', title: 'Magic Studio AI', desc: '一句话生成海报、扩图、消除物体' },
            { icon: 'gift', title: '1 亿+ 高级素材', desc: '模板/图片/视频/音频全解锁' },
            { icon: 'edit', title: '一键去背景', desc: '出图效率翻倍，无需 PS' },
            { icon: 'box', title: '1TB 云空间', desc: '团队资产集中管理' },
          ],
          faq: [
            { q: '我的设计稿会被别人看到吗？', a: '你的个人文件夹默认私有；只有主动分享到团队才可见。' },
            { q: '素材可以商用吗？', a: 'Pro 素材含商用授权，请遵守 Canva 内容许可条款。' },
          ],
          reviews: [
            { user: 'Ann***e', rating: 5, date: '2026-07-06', content: '去背景 + 模板，出图速度快到飞起。' },
            { user: '赵**', rating: 5, date: '2026-06-25', content: '公司全员用，价格不到官方两折。' },
          ],
          delivery: { method: '团队邀请', time: '支付后 5 分钟内发送邀请', steps: ['支付成功', '收到团队邀请链接', '用自己账号接受', 'Pro 权限即刻生效'] },
          warranty: '有效期内席位失效免费重邀',
          aftersales: [
            { issue: '席位失效 / 被移出团队', way: '一键申请补发', sla: '≤ 2 小时' },
            { issue: '素材无法下载', way: '提交工单排查', sla: '≤ 6 小时' },
          ],
        },
      },
      plans: [
        { plan: { name: '团队席位 · 1 个月', type: 'shared', periodMonths: 1 },
          prices: [{ region: 'GLOBAL', currency: 'USD', price: 3.9 }, { region: 'US', currency: 'USD', price: 4.5 }, { region: 'EU', currency: 'EUR', price: 3.9 }, { region: 'CN', currency: 'CNY', price: 26 }],
          pool: [
            { credentials: { username: 'canva_team_01@pool.demo', password: 'Pool#Cv01', note: 'Pro 团队 · 席位 1-5' }, maxSlots: 5 },
            { credentials: { username: 'canva_team_02@pool.demo', password: 'Pool#Cv02', note: 'Pro 团队 · 席位 1-5' }, maxSlots: 5 },
          ] },
        { plan: { name: '团队席位 · 12 个月', type: 'shared', periodMonths: 12 },
          prices: [{ region: 'GLOBAL', currency: 'USD', price: 39 }, { region: 'CN', currency: 'CNY', price: 259 }],
          pool: [{ credentials: { username: 'canva_team_03@pool.demo', password: 'Pool#Cv03', note: '年付 Pro 席位' }, maxSlots: 5 }] },
      ],
    }),
    brandProduct({
      product: {
        slug: 'figma-professional', title: 'Figma Professional', category: '办公',
        rating: 4.8, soldCount: 11208, sort: 6,
        description: 'Figma Professional 团队席位：无限项目与版本历史、组件库共享、Dev Mode 与 FigJam，产品设计与研发协作标配。',
        meta: {
          brand: 'figma', badge: '设计师必备', officialPriceUsd: 15,
          features: [
            { icon: 'edit', title: '无限项目 / 版本历史', desc: '免费版 3 文件限制彻底解除' },
            { icon: 'box', title: '共享组件库', desc: '团队设计系统统一维护' },
            { icon: 'ai', title: 'Dev Mode', desc: '设计稿一键转交付规范与代码' },
            { icon: 'chat', title: 'FigJam 白板', desc: '头脑风暴与流程图无限使用' },
          ],
          faq: [
            { q: '我的设计文件安全吗？', a: '你在自己的项目下工作，未主动分享的文件他人不可见。' },
            { q: '可以邀请同事一起编辑吗？', a: '席位为个人授权；如需多人协作请购买多个席位。' },
          ],
          reviews: [
            { user: 'UX***n', rating: 5, date: '2026-07-04', content: 'Dev Mode 直接省掉标注工作，值。' },
            { user: '吴**', rating: 4, date: '2026-06-17', content: '偶尔要重新登录，但客服补发很快。' },
          ],
          delivery: { method: '团队邀请', time: '支付后 10 分钟内发送邀请', steps: ['支付成功', '收到 Figma 团队邀请', '接受邀请', 'Professional 权限生效'] },
          warranty: '席位失效免费重邀',
          aftersales: [
            { issue: '席位被移除', way: '一键申请补发', sla: '≤ 2 小时' },
            { issue: '权限不足', way: '提交工单调整', sla: '≤ 6 小时' },
          ],
        },
      },
      plans: [
        { plan: { name: '团队席位 · 1 个月', type: 'shared', periodMonths: 1 },
          prices: [{ region: 'GLOBAL', currency: 'USD', price: 4.9 }, { region: 'CN', currency: 'CNY', price: 33 }],
          pool: [{ credentials: { username: 'figma_team_01@pool.demo', password: 'Pool#Fg01', note: 'Professional 席位 1-4' }, maxSlots: 4 }] },
      ],
    }),
    brandProduct({
      product: {
        slug: 'autocad-subscription', title: 'AutoCAD 订阅', category: '办公',
        rating: 4.7, soldCount: 4386, sort: 7,
        description: 'Autodesk AutoCAD 订阅席位：完整 2D/3D 制图、专业工具集、云端协作与移动端 App，工程与建筑从业者刚需。',
        meta: {
          brand: 'autocad', badge: '专业刚需', officialPriceUsd: 235,
          features: [
            { icon: 'office', title: '完整 2D / 3D 制图', desc: '官方正版功能，无阉割' },
            { icon: 'box', title: '专业工具集', desc: '机械 / 建筑 / 电气工具箱' },
            { icon: 'refresh', title: '云端协作', desc: '跨设备同步图纸与批注' },
            { icon: 'shield', title: '正版授权', desc: '账户内可见订阅状态与到期时间' },
          ],
          faq: [
            { q: '可以装在几台电脑？', a: '同一席位建议 2 台以内，不可同时在线。' },
            { q: '图纸会上传到共享账号吗？', a: '本地图纸不会自动上传；云端保存由你自行选择。' },
          ],
          reviews: [
            { user: 'Eng***r', rating: 5, date: '2026-06-28', content: '官方一年两千多，这里几百块，救命。' },
            { user: '郑**', rating: 4, date: '2026-06-11', content: '安装需要看下教程，客服有指导。' },
          ],
          delivery: { method: '账号密码', time: '支付后 30 分钟内人工发放', steps: ['支付成功', '客服核验并分配席位', '发放账号与激活指引', '登录 Autodesk 桌面端'] },
          warranty: '有效期内席位异常免费更换',
          aftersales: [
            { issue: '无法激活 / 登录', way: '提交工单，客服人工处理', sla: '≤ 6 小时' },
            { issue: '版本不符', way: '换发对应版本席位', sla: '≤ 12 小时' },
          ],
        },
      },
      plans: [
        { plan: { name: '订阅席位 · 3 个月', type: 'shared', periodMonths: 3 },
          prices: [{ region: 'GLOBAL', currency: 'USD', price: 79 }, { region: 'CN', currency: 'CNY', price: 529 }],
          pool: [{ credentials: { username: 'acad_seat_01@pool.demo', password: 'Pool#Ac01', note: 'AutoCAD 席位 1-2' }, maxSlots: 2 }] },
        { plan: { name: '订阅席位 · 12 个月', type: 'shared', periodMonths: 12 },
          prices: [{ region: 'GLOBAL', currency: 'USD', price: 269 }, { region: 'CN', currency: 'CNY', price: 1799 }],
          pool: [{ credentials: { username: 'acad_seat_02@pool.demo', password: 'Pool#Ac02', note: '年付席位 1-2' }, maxSlots: 2 }] },
      ],
    }),
    brandProduct({
      product: {
        slug: 'youtube-premium', title: 'YouTube Premium', category: '流媒体',
        rating: 4.9, soldCount: 41265, sort: 8,
        description: 'YouTube Premium 家庭组席位：全平台无广告、后台与画中画播放、离线缓存，并附赠 YouTube Music Premium 无广告听歌。',
        meta: {
          brand: 'youtube', badge: '销量第一', officialPriceUsd: 13.99,
          features: [
            { icon: 'stream', title: '全平台无广告', desc: '手机 / 电脑 / 电视端统统免广告' },
            { icon: 'music', title: '含 YouTube Music', desc: '无广告听歌 + 后台播放' },
            { icon: 'box', title: '离线缓存', desc: '下载视频，通勤不耗流量' },
            { icon: 'user', title: '用自己的账号', desc: '家庭组邀请制，订阅与历史全保留' },
          ],
          faq: [
            { q: '需要换账号吗？', a: '不需要。用你自己的 Google 账号接受家庭组邀请即可。' },
            { q: '家庭组地址校验怎么办？', a: '平台已统一配置家庭组信息，正常使用不会触发；如遇提示请联系客服。' },
            { q: '订阅记录会被别人看到吗？', a: '不会。家庭组成员之间的观看记录与订阅相互独立。' },
          ],
          reviews: [
            { user: 'Tom***5', rating: 5, date: '2026-07-09', content: '无广告 + 后台播放，回不去了。' },
            { user: '林**', rating: 5, date: '2026-06-29', content: '邀请秒到，用自己账号，记录都还在。' },
            { user: 'Kay***1', rating: 4, date: '2026-06-14', content: '偶尔要重新接受邀请，客服处理很快。' },
          ],
          delivery: { method: '家庭组邀请', time: '支付后 5 分钟内发送邀请', steps: ['支付成功', '收到家庭组邀请', '用自己的 Google 账号接受', 'Premium 立即生效'] },
          warranty: '有效期内被移出家庭组免费重新拉入',
          aftersales: [
            { issue: '被移出家庭组 / 会员失效', way: '订阅卡一键「申请补发」自动重邀', sla: '≤ 2 小时' },
            { issue: '邀请链接未收到', way: '提交工单，客服人工重发', sla: '≤ 1 小时' },
            { issue: '不想用了', way: '48 小时内未使用可全额退款', sla: '≤ 24 小时' },
          ],
        },
      },
      plans: [
        { plan: { name: '家庭位 · 1 个月', type: 'shared', periodMonths: 1 },
          prices: [{ region: 'GLOBAL', currency: 'USD', price: 2.9 }, { region: 'US', currency: 'USD', price: 3.2 }, { region: 'EU', currency: 'EUR', price: 2.9 }, { region: 'CN', currency: 'CNY', price: 19.9 }],
          pool: [
            { credentials: { username: 'yt_family_01@pool.demo', password: 'Pool#Yt01', note: '家庭组 · 位置 1-5' }, maxSlots: 5 },
            { credentials: { username: 'yt_family_02@pool.demo', password: 'Pool#Yt02', note: '家庭组 · 位置 1-5' }, maxSlots: 5 },
          ] },
        { plan: { name: '家庭位 · 12 个月', type: 'shared', periodMonths: 12 },
          prices: [{ region: 'GLOBAL', currency: 'USD', price: 29.9 }, { region: 'CN', currency: 'CNY', price: 199 }],
          pool: [{ credentials: { username: 'yt_family_03@pool.demo', password: 'Pool#Yt03', note: '年付家庭组 · 位置 1-5' }, maxSlots: 5 }] },
      ],
    }),
  ];

  for (const entry of catalog) {
    const { meta, ...productData } = entry.product;
    // 演示：热销品挂 48 小时特惠倒计时
    if (productData.slug === 'chatgpt-plus') {
      meta.sale = { endsAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(), label: '限时特惠' };
    }
    if (productData.slug === 'youtube-premium') {
      meta.sale = { endsAt: new Date(Date.now() + 26 * 3600 * 1000).toISOString(), label: '闪购' };
    }
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
