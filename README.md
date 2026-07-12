# SubShare — 订阅共享平台（GamsGo 同类）完整实现 v3

单仓库 Monorepo：**用户前台 + 运营后台 + 供应商门户 + 后端 API**。完整打通「供应商供货 → 后台审核入库 → 前台注册/充值/下单 → Mock 支付/余额支付 → 秒级自动交付 → 续费顺延 → 工单客服 → 退款返还钱包」全业务闭环。

> 技术演示/学习用途。订阅拆分转售业务普遍违反上游服务商 ToS，商用前请评估法律与支付通道风险（详见《订阅共享平台-完整项目规划.md》）。

## 技术栈

| 应用 | 目录 | 技术 | 端口 |
|---|---|---|---|
| 后端 API | `server/` | NestJS 10 + TypeORM + SQLite(sql.js 零原生依赖) + JWT + RBAC | 3001 |
| 用户前台 | `web/` | React 18 + Vite + React Router（自研设计系统 + CSS 动效 + 移动端适配） | 5173 |
| 运营后台 | `admin/` | React 18 + Vite + Ant Design 5（权限菜单 + 供应商门户） | 5174 |

## 快速启动

要求：Node.js ≥ 18

```bash
npm install
npm run dev     # 空库自动写入种子数据；旧版本数据库自动备份重建（无需手动 seed）
```

> 服务端启动自带**自愈**：检测到旧版本不兼容的 `app.db` 会自动备份为 `app.db.bak-<时间戳>` 并重建；空库启动自动执行种子数据。手动重置依然可用：`rm server/data/app.db` 后重启即可。

- 用户前台 <http://localhost:5173>
- 运营后台 <http://localhost:5174>（管理员与供应商共用入口）
- API <http://localhost:3001/api>

### 种子账号

| 角色 | 邮箱 | 密码 | 说明 |
|---|---|---|---|
| 超级管理员（父） | admin@demo.com | Admin123! | 全部权限 + 创建子管理员 |
| 子管理员 | staff@demo.com | Staff123! | 仅「订单+工单」权限（演示 RBAC） |
| 供应商 | supplier@demo.com | Supp123! | 供应商门户：提交账号/产品 |
| 用户 | user@demo.com | User123! | 前台购买 |

### 10 分钟体验完整业务闭环

1. **前台**注册新账号 → 右上角切地区（US/EU/CN 价格币种联动）
2. 商品详情页：官方价对比省 %、功能亮点、购买流程、FAQ、用户评价
3. 「我的账户 → 钱包」充值 $50（Mock 收银台）→ 余额到账
4. 任选套餐 → **订单确认页** → 选「钱包余额」支付 → 即时交付
5. 「我的订阅」查看凭据、剩余天数进度条 → 点「续费顺延」再买一单 → 到期时间 +1 周期（不换车）
6. 右下角 **💬 客服悬浮窗** → 发起工单（可关联订单）
7. **后台**用 admin 登录 → 工单会话中回复 → 前台悬浮窗收到客服回复
8. 后台「管理员管理」创建子管理员（勾选模块权限）→ 用 staff 登录体验受限菜单
9. 供应商入口注册/登录 → 提交共享账号 → admin 在「供应商审核」通过 → 库存自动 +N、排队订单自动补发
10. 后台订单退款 → 用户钱包按汇率返还（流水可查）

## v3 新增：完整购物与售后旅程（前后台闭环）

1. **购物车**：商品页「加入购物车」→ 购物车页实时按地区报价（跨币种自动折算合计）→ 合并一单结算（`order_items` 多商品明细）→ 支付后**逐项自动交付**；部分缺货项进入排队，补货后自动补发（明细级 done 守卫防重复交付/重复续费）
2. **每个产品自有交付流程与售后政策**：商品页展示该产品的交付方式/时效/步骤（账号密码 vs 家庭组邀请等）与售后条目（问题→处理方式→响应 SLA）；订阅卡同步显示交付方式与质保承诺；**后台商品编辑即可配置**，前台即时生效
3. **售后一键直达**：订阅卡「申请补发 / 申请退款 / 换车」、订单行「售后」→ 自动打开客服窗并预填类型/主题/关联订单与订阅 → 提交即成为**类型化售后工单**
4. **后台工单一键执行**（系统连贯性）：工单页看到售后类型标签，「🔧 一键补发」直接调交付引擎换新坑位（旧坑作废）并自动回复用户；「💸 一键退款」整单退回用户钱包、吊销订阅、回收坑位并自动回复——客服动作即业务动作，无需切页面
5. **多主题 UI**（v2.5）：🎨 5 套预置配色风格一键切换（红橙海报/极简黑白/午夜霓虹/奶油马卡龙/科技蓝），本地记忆
6. **购物动线**：移动端底部导航含购物车（角标数量）、订单确认页展示逐项清单与售后承诺

## v2 新增能力（对照反馈逐条）

1. **UI 全面美化**：渐变品牌视觉、卡片悬浮动效、骨架屏、进度条动画、信任背书条（用户数/好评率/交付时长）、评分与销量、官方价划线对比
2. **产品富信息**：功能亮点网格、四步购买流程、FAQ 折叠面板、用户评价（存储于 `products.meta` JSON，后台可编辑）
3. **对齐真实业务流**：商品 → 订单确认页（价格明细/服务时长/交付方式）→ 收银台 → 交付结果 → 订阅管理，三步进度指示
4. **客服 + 充值**：右下角客服悬浮窗（工单列表/新建/会话轮询/关闭）、后台工单会话处理；钱包充值（$10/25/50/100 Mock 通道）+ **余额支付**（按演示汇率折 USD 即时扣款）+ 退款返还钱包 + 完整流水
5. **已购服务信息**：订阅卡片显示起止日期、剩余天数进度条、套餐周期、订单号、凭据复制；**续费顺延**（同套餐续费自动延长到期时间，不重新分配坑位）
6. **移动端优化**：响应式断点（960/640px）、详情页吸底购买栏、单列卡片、悬浮窗适配、安全区 padding
7. **后台组织能力**：**父子管理员**（super 创建 admin 并按 7 个模块授权，菜单/接口双重校验）、**供应商体系**（入驻注册、提交共享账号或新产品提议、审核通过自动入库生成坑位/生成草稿商品、库存标记供货来源）

## 目录结构

```
subshare-platform/
├── server/src/
│   ├── entities.ts        # 13 张表：用户/商品/套餐/价格/账号池/坑位/订单/支付/钱包流水/订阅/工单×2/供应商提交
│   ├── auth/              # 注册登录 + JWT + RolesGuard + PermGuard(模块权限)
│   ├── catalog/           # 商品目录（富信息 meta + 地区计价 + 库存）
│   ├── orders/            # 下单 + 我的订单/订阅
│   ├── payments/          # Mock 支付/余额支付/充值 + 交付引擎(含续费顺延)
│   ├── wallet/            # 钱包总览与流水
│   ├── tickets/           # 用户侧工单
│   ├── supplier/          # 供应商门户接口
│   ├── admin/             # 管理端（看板/商品/定价/库存/订单/用户/工单/供应商审核/管理员管理）
│   └── seed.ts            # 4 角色账号 + 4 个富信息商品
├── web/src/
│   ├── pages/             # Home / ProductDetail / Checkout / Pay / Account / AuthPages
│   └── components/SupportWidget.tsx   # 客服悬浮窗
└── admin/src/pages/       # Dashboard / Products / Inventory / Orders / Users
                           # + Tickets / Suppliers / Admins / SupplierPortal
```

## 关键 API 增量（v2）

| 方法 | 路径 | 说明 | 权限 |
|---|---|---|---|
| POST | /api/auth/register-supplier | 供应商入驻 | 公开 |
| GET | /api/catalog/plans/:id?region= | 结算页套餐信息 | 公开 |
| GET | /api/wallet | 余额 + 流水 | 登录 |
| POST | /api/payments/recharge | 创建充值单 {amountUsd, provider} | 登录 |
| POST | /api/payments/:orderId/checkout | provider 支持 balance（余额即时支付） | 登录 |
| POST/GET | /api/tickets, /api/me/tickets, /api/tickets/:id(/messages, /close) | 工单 | 登录 |
| GET/POST | /api/supplier/plans, /api/supplier/submissions | 供应商提交 | supplier |
| GET/POST | /api/admin/tickets(/:id/reply, /:id/close) | 工单处理 | perm:tickets |
| GET/POST | /api/admin/supplier-submissions(/:id/review) | 供货审核 | perm:suppliers |
| GET/POST/PATCH | /api/admin/admins(/:id) | 父子管理员管理 | 仅 super |
| POST | /api/catalog/quote | 购物车实时报价 {planIds, region} | 公开 |
| POST | /api/orders | 支持 {planIds:[...]} 多商品合并下单 | 登录 |
| POST | /api/admin/tickets/:id/action | 工单一键补发/退款 {action} | perm:tickets |

权限模型：`super` 全通过；`admin` 需 permissions 包含对应模块（dashboard/products/inventory/orders/users/tickets/suppliers）；修改权限后需重新登录生效。

## 常用操作

```bash
rm server/data/app.db && npm run seed   # 重置数据库
npm run build                           # 构建三端
JWT_SECRET=xxx npm run dev:server       # 环境变量
```

## 从演示到生产的升级路径

1. **支付**：Provider 接口替换为 Stripe/Antom，confirm 换服务端 Webhook + 验签；余额与汇率接实时汇率 API
2. **数据库**：TypeORM 切 PostgreSQL + migration；坑位分配加行锁防并发超卖
3. **安全**：凭据 AES-GCM + KMS（当前演示明文）、后台 2FA、审计日志
4. **客服**：工单轮询升级 WebSocket；接入 LLM 机器人一线应答（查单/自助补发）
5. **异步化**：交付/补发/到期提醒移入 BullMQ 队列；邮件通知（SES/Resend）
6. **待扩展**：优惠券、联盟推广、多语言 i18n、汇率自动同步（规划文档已有设计）

## 已验证（沙箱实测）

- 三端 `tsc` 严格模式零错误 + vite 构建通过
- e2e：富信息目录 → 注册 → 充值 $50 → 余额支付即时交付 → 续费到期顺延（不换车）→ 工单用户/客服双向会话 → 供应商提交审核入库（库存 7→11、排队自动补发）→ 子管理员越权 403/授权模块 200 → 超管创建子管理员 → 退款钱包返还 → 看板指标齐全
