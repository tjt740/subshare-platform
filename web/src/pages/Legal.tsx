import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApp } from '../store';

/**
 * 信任与条款体系：服务条款 / 隐私政策 / 退款规则 / 关于我们（运营主体与联系方式）
 * 文案支持后台「站点设置」覆盖（siteCfg.legal.*），未配置时使用内置模板。
 */
const DEFAULTS: Record<string, { title: string; body: string[] }> = {
  terms: {
    title: '服务条款',
    body: [
      '1. 服务性质：本平台提供数字订阅服务的合租席位/代充值服务。下单即表示你已阅读并同意本条款。',
      '2. 账号交付：支付成功后系统按商品页标注的交付方式自动发放（账号密码或家庭组邀请）。请勿修改共享账号的密码、绑定信息或将凭据转售、公开分享，违者平台有权终止服务且不予退款。',
      '3. 服务时长：以订单标注的周期为准，自交付之日起算。续费为在原到期时间上顺延，不重新分配席位。',
      '4. 质保与补发：有效期内因平台原因导致账号失效的，可申请免费补发（详见退款与售后规则）。',
      '5. 免责：因用户自身违规操作、上游服务商政策变更或不可抗力导致的服务中断，平台将尽力协助但不承担超出订单金额的赔偿责任。',
      '6. 条款更新：平台保留修订条款的权利，重大变更将在站内公告。',
    ],
  },
  privacy: {
    title: '隐私政策',
    body: [
      '1. 收集范围：注册邮箱、昵称与头像、订单与支付记录、登录 IP 与设备信息（用于异常登录识别）。',
      '2. 使用目的：账号身份识别、订单交付与售后、风控与安全审计、按地区展示价格与语言。',
      '3. 支付信息：平台不存储你的银行卡号或支付密码。真实支付由第三方支付机构（如 Stripe / 支付宝）在其页面完成并加密处理。',
      '4. 数据共享：除法律要求或为完成交付所必需外，不会向第三方出售或披露你的个人信息。',
      '5. 你的权利：可随时在「个人资料」修改昵称头像、修改密码、查看登录记录；如需注销账号或导出数据，请提交工单。',
      '6. Cookie：仅用于保持登录状态与记住语言/地区/主题偏好，不用于跨站广告追踪。',
    ],
  },
  refund: {
    title: '退款与售后规则',
    body: [
      '一、无理由退款窗口：交付后 48 小时内、且未发生实质使用（未登录/未加入家庭组）的订单，可申请全额退款。',
      '二、质保补发：有效期内账号失效、被移出家庭组、无法登录的，可在「我的订阅」一键申请补发，平台免费更换新席位（响应时效见商品页售后条款）。',
      '三、按比例退款：使用中的订单因平台无法继续提供服务的，按剩余天数比例退款。',
      '四、退款方式：退款默认返还至平台钱包余额（可用于全场消费），按下单时的汇率折算为 USD 计入；如需原路退回，请在工单中说明并提供支付凭据。',
      '五、不予退款情形：用户自行修改共享账号密码/绑定信息、转售或公开分享凭据、违反上游服务商条款导致封禁。',
      '六、争议处理：如对处理结果有异议，可在工单中申请复核，我们会在 3 个工作日内给出最终答复。',
    ],
  },
  about: {
    title: '关于我们 · 运营主体与联系方式',
    body: [
      '运营主体：SubShare Demo Team（示例；正式上线请在后台「站点设置」填写真实公司名称、注册地与统一社会信用代码/公司编号）',
      '联系邮箱：support@example.com（示例，请替换为真实客服邮箱）',
      '在线客服：站内右下角悬浮窗提交工单，7×24 响应，平均首次回复 < 10 分钟。',
      '支付安全：支付页由第三方支付机构托管，平台不接触你的卡号与密码；站点全站 HTTPS 传输加密。',
      '合规说明：本项目当前为技术演示环境，支付为 Mock 通道，不会产生真实扣款；正式商用前请完成主体资质、支付通道签约与法务审阅。',
    ],
  },
};

export default function Legal() {
  const { kind = 'terms' } = useParams();
  const { siteCfg } = useApp();
  const custom = siteCfg?.legal?.[kind];
  const doc = DEFAULTS[kind] ?? DEFAULTS.terms;
  const title = custom?.title || doc.title;
  const body: string[] = Array.isArray(custom?.body) && custom.body.length ? custom.body : doc.body;

  return (
    <div className="legal-wrap">
      <div className="section-eyebrow">✺ LEGAL</div>
      <h1 className="page-title">{title}</h1>
      <p className="muted small" style={{ marginBottom: 20 }}>
        最近更新：2026-07-13
      </p>
      <div className="panel legal-body">
        {body.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      <div className="legal-nav">
        <Link className="btn btn-ghost btn-sm" to="/legal/terms">服务条款</Link>
        <Link className="btn btn-ghost btn-sm" to="/legal/privacy">隐私政策</Link>
        <Link className="btn btn-ghost btn-sm" to="/legal/refund">退款规则</Link>
        <Link className="btn btn-ghost btn-sm" to="/legal/about">关于我们</Link>
      </div>
    </div>
  );
}
