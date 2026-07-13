import React, { useEffect, useState } from 'react';
import { Card, Col, Drawer, Empty, Row, Spin, Statistic, Tag, Timeline, message } from 'antd';
import { api } from '../api';

/**
 * 单用户行为轨迹抽屉（用户管理 / 数据埋点 共用）
 * 展示：账号概况 + 行为统计 + 完整点击/浏览/下单时间线 + 设备与来源
 */

export const EVENT_LABEL: Record<string, string> = {
  page_view: '页面浏览',
  page_leave: '离开页面',
  product_view: '商品浏览',
  add_to_cart: '加入购物车',
  remove_from_cart: '移出购物车',
  checkout_start: '进入结算',
  checkout_submit: '提交订单',
  payment_start: '发起支付',
  payment_success: '支付成功',
  payment_fail: '支付失败',
  recharge_start: '发起充值',
  recharge_success: '充值成功',
  signup: '注册',
  login: '登录',
  oauth_start: '发起三方登录',
  search: '搜索',
  click: '点击',
  scroll_depth: '滚动深度',
  rage_click: '暴力点击',
  js_error: '前端异常',
  support_open: '打开客服',
  ticket_submit: '提交工单',
  onboarding_start: '开始引导',
  onboarding_skip: '跳过引导',
  onboarding_done: '完成引导',
};
export const evLabel = (n: string) => EVENT_LABEL[n] ?? n;

const COLOR: Record<string, string> = {
  payment_success: 'green',
  recharge_success: 'green',
  payment_fail: 'red',
  js_error: 'red',
  rage_click: 'orange',
  add_to_cart: 'blue',
  checkout_start: 'blue',
  checkout_submit: 'blue',
  signup: 'purple',
  login: 'purple',
};

export default function UserTrail({
  userId,
  onClose,
}: {
  userId: number | null;
  onClose: () => void;
}) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) {
      setData(null);
      return;
    }
    setLoading(true);
    api(`/admin/analytics/user/${userId}`)
      .then(setData)
      .catch((e: any) => message.error(e.message))
      .finally(() => setLoading(false));
  }, [userId]);

  const u = data?.user;
  const stats = data?.stats ?? {};
  const trail: any[] = data?.trail ?? [];

  return (
    <Drawer
      title={u ? `行为轨迹 — ${u.email}` : '用户行为轨迹'}
      width={580}
      open={!!userId}
      onClose={onClose}
      destroyOnClose
    >
      {loading && <Spin />}
      {!loading && data && (
        <>
          <Card size="small" style={{ marginBottom: 14 }}>
            <Row gutter={10}>
              <Col span={6}><Statistic title="事件数" value={stats.events ?? 0} /></Col>
              <Col span={6}><Statistic title="等级" value={`LV${u?.level ?? 1}`} /></Col>
              <Col span={6}><Statistic title="余额" value={u?.balance ?? 0} prefix="$" precision={2} /></Col>
              <Col span={6}><Statistic title="成长值" value={u?.growthUsd ?? 0} prefix="$" precision={2} /></Col>
            </Row>
            <div style={{ marginTop: 10, fontSize: 12.5, color: '#888', lineHeight: 1.8 }}>
              首次出现：{stats.firstSeen ? new Date(stats.firstSeen).toLocaleString('zh-CN') : '-'}
              <br />
              最近活跃：{stats.lastSeen ? new Date(stats.lastSeen).toLocaleString('zh-CN') : '-'}
              {u?.provider && u.provider !== 'local' && (
                <>
                  <br />
                  注册来源：<Tag color="blue">{u.provider}</Tag>
                </>
              )}
            </div>
            <div style={{ marginTop: 10 }}>
              {(stats.byName ?? []).map((b: any) => (
                <Tag key={b.name} style={{ marginBottom: 4 }}>
                  {evLabel(b.name)} × {b.count}
                </Tag>
              ))}
            </div>
          </Card>

          {trail.length === 0 ? (
            <Empty description="该用户暂无埋点记录" />
          ) : (
            <Timeline
              items={trail.map((e: any) => ({
                color: COLOR[e.name] ?? 'gray',
                children: (
                  <div style={{ fontSize: 12.5 }}>
                    <b>{evLabel(e.name)}</b>{' '}
                    <span style={{ color: '#aaa' }}>
                      {new Date(e.createdAt).toLocaleString('zh-CN')}
                    </span>
                    {e.device && <Tag style={{ marginLeft: 6 }}>{e.device}</Tag>}
                    <div style={{ color: '#666' }}>{e.path}</div>
                    {e.props && Object.keys(e.props).length > 0 && (
                      <code style={{ fontSize: 11, color: '#999', wordBreak: 'break-all' }}>
                        {JSON.stringify(e.props)}
                      </code>
                    )}
                  </div>
                ),
              }))}
            />
          )}
        </>
      )}
    </Drawer>
  );
}
