import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon, { IconName } from './Icon';
import { track } from '../track';

/**
 * 新手引导（首次访问自动出现，支持随时跳过；桌面居中卡片、移动端底部抽屉）
 * 进度写入 localStorage，看过/跳过后不再打扰；可在页脚「新手引导」重新打开。
 */
const KEY = 'ss_onboarded';

interface Step {
  icon: IconName;
  title: string;
  desc: string;
  tip?: string;
}

const STEPS: Step[] = [
  {
    icon: 'sparkle',
    title: '欢迎来到 SubShare',
    desc: '官方正版订阅按席位拆分共享，ChatGPT / Claude / Canva / YouTube 等最高省 80%。',
    tip: '整个流程 3 步：选套餐 → 支付 → 自动收到账号',
  },
  {
    icon: 'search',
    title: '① 挑选服务与套餐',
    desc: '在首页按分类、销量、价格筛选，进入商品页选择周期（1/3/12 个月），可加入购物车合并结算。',
    tip: '价格随地区自动切换币种，右上角可手动改地区',
  },
  {
    icon: 'card',
    title: '② 支付并自动交付',
    desc: '支持银行卡 / 支付宝 / USDT / 钱包余额。支付成功后系统 60 秒内自动分配席位并发放凭据。',
    tip: '钱包余额支付即时到账，还能累计成长值升级',
  },
  {
    icon: 'shield',
    title: '③ 售后与质保',
    desc: '在「我的订阅」查看账号凭据与剩余天数；账号异常可一键申请补发、退款或换车，全程工单跟踪。',
    tip: '右下角客服 7×24 在线，平均 10 分钟响应',
  },
];

export default function Onboarding() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (!localStorage.getItem(KEY)) {
      const timer = setTimeout(() => {
        setOpen(true);
        track('onboarding_start');
      }, 900);
      return () => clearTimeout(timer);
    }
  }, []);

  // 页脚/菜单可重新打开
  useEffect(() => {
    const handler = () => {
      setStep(0);
      setOpen(true);
      track('onboarding_start', { source: 'manual' });
    };
    window.addEventListener('ss-onboarding', handler);
    return () => window.removeEventListener('ss-onboarding', handler);
  }, []);

  function finish(skipped: boolean) {
    localStorage.setItem(KEY, '1');
    setOpen(false);
    track(skipped ? 'onboarding_skip' : 'onboarding_done', { step: step + 1 });
  }

  if (!open) return null;
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <div className="ob-mask" role="dialog" aria-modal="true" aria-label="新手引导">
      <div className="ob-card">
        <button className="ob-skip" onClick={() => finish(true)} aria-label="跳过新手引导">
          跳过 <Icon name="close" size={14} />
        </button>

        <div className="ob-icon">
          <Icon name={s.icon} size={30} />
        </div>
        <h3>{s.title}</h3>
        <p>{s.desc}</p>
        {s.tip && (
          <div className="ob-tip">
            <Icon name="info" size={13} /> {s.tip}
          </div>
        )}

        <div className="ob-dots" aria-hidden>
          {STEPS.map((_, i) => (
            <i key={i} className={i === step ? 'on' : ''} />
          ))}
        </div>

        <div className="ob-actions">
          {step > 0 && (
            <button className="btn btn-ghost" onClick={() => setStep((x) => x - 1)}>
              上一步
            </button>
          )}
          {!last ? (
            <button className="btn btn-primary btn-block" onClick={() => setStep((x) => x + 1)}>
              下一步 <Icon name="arrowRight" size={15} />
            </button>
          ) : (
            <button
              className="btn btn-primary btn-block"
              onClick={() => {
                finish(false);
                navigate('/#catalog');
              }}
            >
              开始选购 <Icon name="arrowRight" size={15} />
            </button>
          )}
        </div>
        <button className="ob-later" onClick={() => finish(true)}>
          以后再说
        </button>
      </div>
    </div>
  );
}

/** 供页脚/菜单调用：重新打开引导 */
export const openOnboarding = () =>
  window.dispatchEvent(new CustomEvent('ss-onboarding'));
