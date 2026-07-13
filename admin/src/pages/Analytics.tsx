import React, { useCallback, useEffect, useState } from 'react';
import {
  Card,
  Col,
  Drawer,
  Empty,
  Progress,
  Row,
  Segmented,
  Select,
  Statistic,
  Table,
  Tabs,
  Tag,
  Timeline,
  message,
} from 'antd';
import { api } from '../api';

/** 埋点分析：概览 / 漏斗 / 事件流 / 单用户行为轨迹 */
interface Overview {
  totals: { pv: number; uv: number; sessions: number; events: number; conversion: number };
  byName: { name: string; count: number }[];
  funnel: { key: string; label: string; users: number; rate: number; dropFromPrev: number }[];
  topProducts: { title: string; views: number; carts: number; buys: number }[];
  topPages: { path: string; count: number }[];
  devices: { name: string; count: number }[];
  referrers: { name: string; count: number }[];
  trend: { date: string; pv: number; uv: number; orders: number }[];
}

const EVENT_LABEL: Record<string, string> = {
  page_view: '页面浏览',
  product_view: '商品浏览',
  add_to_cart: '加入购物车',
  remove_from_cart: '移出购物车',
  checkout_start: '进入结算',
  checkout_submit: '提交订单',
  payment_start: '发起支付',
  payment_success: '支付成功',
  payment_fail: '支付失败',
  recharge_success: '充值成功',
  signup: '注册',
  login: '登录',
  search: '搜索',
  click: '点击',
  support_open: '打开客服',
  ticket_submit: '提交工单',
  onboarding_start: '开始引导',
  onboarding_skip: '跳过引导',
  onboarding_done: '完成引导',
};
const label = (n: string) => EVENT_LABEL[n] ?? n;

export default function Analytics() {
  const [days, setDays] = useState(14);
  const [ov, setOv] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(false);
  // 事件流
  const [events, setEvents] = useState<any[]>([]);
  const [evTotal, setEvTotal] = useState(0);
  const [evPage, setEvPage] = useState(1);
  const [evName, setEvName] = useState<string | undefined>();
  // 用户轨迹
  const [trailUser, setTrailUser] = useState<any | null>(null);

  const loadOverview = useCallback(() => {
    setLoading(true);
    api<Overview>(`/admin/analytics/overview?days=${days}`)
      .then(setOv)
      .catch((e) => message.error(e.message))
      .finally(() => setLoading(false));
  }, [days]);
  useEffect(loadOverview, [loadOverview]);

  const loadEvents = useCallback(() => {
    api<any>(
      `/admin/analytics/events?page=${evPage}&pageSize=30${evName ? `&name=${evName}` : ''}`,
    )
      .then((r) => {
        setEvents(r.items);
        setEvTotal(r.total);
      })
      .catch((e) => message.error(e.message));
  }, [evPage, evName]);
  useEffect(loadEvents, [loadEvents]);

  async function openTrail(userId: number) {
    try {
      setTrailUser(await api(`/admin/analytics/user/${userId}`));
    } catch (e: any) {
      message.error(e.message);
    }
  }

  const maxTrend = Math.max(1, ...(ov?.trend.map((t) => Math.max(t.pv, t.uv)) ?? [1]));

  return (
    <div>
      <Card
        title="数据埋点 · 用户行为分析"
        loading={loading}
        extra={
          <Segmented
            value={days}
            onChange={(v) => setDays(Number(v))}
            options={[
              { label: '近 7 天', value: 7 },
              { label: '近 14 天', value: 14 },
              { label: '近 30 天', value: 30 },
            ]}
          />
        }
      >
        <Row gutter={[12, 12]}>
          <Col xs={12} md={6}><Card size="small"><Statistic title="页面浏览 PV" value={ov?.totals.pv ?? 0} /></Card></Col>
          <Col xs={12} md={6}><Card size="small"><Statistic title="独立访客 UV" value={ov?.totals.uv ?? 0} /></Card></Col>
          <Col xs={12} md={6}><Card size="small"><Statistic title="会话数" value={ov?.totals.sessions ?? 0} /></Card></Col>
          <Col xs={12} md={6}>
            <Card size="small">
              <Statistic
                title="浏览→支付转化率"
                value={ov?.totals.conversion ?? 0}
                suffix="%"
                valueStyle={{ color: (ov?.totals.conversion ?? 0) > 0 ? '#16a34a' : undefined }}
              />
            </Card>
          </Col>
        </Row>

        <Tabs
          style={{ marginTop: 16 }}
          items={[
            {
              key: 'funnel',
              label: '下单漏斗',
              children: (
                <Row gutter={20}>
                  <Col xs={24} lg={13}>
                    {(ov?.funnel ?? []).map((f, i) => (
                      <div key={f.key} style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                          <b>
                            {i + 1}. {f.label}
                          </b>
                          <span>
                            <b>{f.users}</b> 人 · {f.rate}%
                            {i > 0 && f.dropFromPrev > 0 && (
                              <Tag color="red" style={{ marginLeft: 8 }}>
                                流失 {f.dropFromPrev}%
                              </Tag>
                            )}
                          </span>
                        </div>
                        <Progress
                          percent={f.rate}
                          showInfo={false}
                          strokeColor={{ from: '#4f46e5', to: '#06b6d4' }}
                        />
                      </div>
                    ))}
                    {!ov?.funnel.length && <Empty description="暂无漏斗数据" />}
                  </Col>
                  <Col xs={24} lg={11}>
                    <b style={{ fontSize: 13 }}>商品热度（浏览 / 加购 / 成交）</b>
                    <Table
                      size="small"
                      rowKey="title"
                      style={{ marginTop: 10 }}
                      pagination={false}
                      dataSource={ov?.topProducts ?? []}
                      columns={[
                        { title: '商品', dataIndex: 'title' },
                        { title: '浏览', dataIndex: 'views', width: 70 },
                        { title: '加购', dataIndex: 'carts', width: 70 },
                        { title: '成交', dataIndex: 'buys', width: 70 },
                        {
                          title: '转化',
                          width: 80,
                          render: (_: any, r: any) =>
                            r.views ? `${Math.round((r.buys / r.views) * 100)}%` : '-',
                        },
                      ]}
                    />
                  </Col>
                </Row>
              ),
            },
            {
              key: 'trend',
              label: '趋势与分布',
              children: (
                <Row gutter={20}>
                  <Col xs={24} lg={14}>
                    <b style={{ fontSize: 13 }}>PV / UV / 成交趋势</b>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 180, marginTop: 14, borderBottom: '1px solid #eee' }}>
                      {(ov?.trend ?? []).map((t) => (
                        <div key={t.date} style={{ flex: 1, textAlign: 'center' }} title={`${t.date} PV${t.pv} UV${t.uv} 单${t.orders}`}>
                          <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', justifyContent: 'center', height: 150 }}>
                            <div style={{ width: 6, height: `${(t.pv / maxTrend) * 100}%`, background: '#4f46e5', borderRadius: 3 }} />
                            <div style={{ width: 6, height: `${(t.uv / maxTrend) * 100}%`, background: '#06b6d4', borderRadius: 3 }} />
                            {t.orders > 0 && <div style={{ width: 6, height: `${Math.min(100, t.orders * 20)}%`, background: '#16a34a', borderRadius: 3 }} />}
                          </div>
                          <div style={{ fontSize: 9, color: '#999', marginTop: 4 }}>{t.date.slice(5)}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 8, fontSize: 12 }}>
                      <Tag color="purple">PV</Tag><Tag color="cyan">UV</Tag><Tag color="green">成交</Tag>
                    </div>
                  </Col>
                  <Col xs={24} lg={10}>
                    <b style={{ fontSize: 13 }}>事件分布</b>
                    <Table
                      size="small"
                      rowKey="name"
                      style={{ marginTop: 10 }}
                      pagination={false}
                      scroll={{ y: 160 }}
                      dataSource={ov?.byName ?? []}
                      columns={[
                        { title: '事件', dataIndex: 'name', render: (n: string) => label(n) },
                        { title: '次数', dataIndex: 'count', width: 80 },
                      ]}
                    />
                    <Row gutter={10} style={{ marginTop: 14 }}>
                      <Col span={12}>
                        <b style={{ fontSize: 13 }}>设备</b>
                        {(ov?.devices ?? []).map((d) => (
                          <div key={d.name} style={{ fontSize: 12.5, marginTop: 4 }}>
                            <Tag>{d.name}</Tag> {d.count}
                          </div>
                        ))}
                      </Col>
                      <Col span={12}>
                        <b style={{ fontSize: 13 }}>来源</b>
                        {(ov?.referrers ?? []).map((r) => (
                          <div key={r.name} style={{ fontSize: 12.5, marginTop: 4 }}>
                            <Tag color="blue">{r.name}</Tag> {r.count}
                          </div>
                        ))}
                      </Col>
                    </Row>
                  </Col>
                </Row>
              ),
            },
            {
              key: 'events',
              label: '事件流（原始记录）',
              children: (
                <>
                  <Select
                    allowClear
                    placeholder="按事件筛选"
                    style={{ width: 200, marginBottom: 12 }}
                    value={evName}
                    onChange={(v) => {
                      setEvName(v);
                      setEvPage(1);
                    }}
                    options={(ov?.byName ?? []).map((e) => ({ value: e.name, label: label(e.name) }))}
                  />
                  <Table
                    size="small"
                    rowKey="id"
                    dataSource={events}
                    pagination={{
                      current: evPage,
                      pageSize: 30,
                      total: evTotal,
                      onChange: setEvPage,
                      showSizeChanger: false,
                    }}
                    columns={[
                      { title: '时间', dataIndex: 'createdAt', width: 150, render: (t: string) => new Date(t).toLocaleString('zh-CN') },
                      { title: '事件', dataIndex: 'name', width: 110, render: (n: string) => <Tag>{label(n)}</Tag> },
                      {
                        title: '用户',
                        width: 190,
                        render: (_: any, r: any) =>
                          r.userId ? (
                            <a onClick={() => openTrail(r.userId)}>{r.userEmail}</a>
                          ) : (
                            <span style={{ color: '#999' }}>匿名 {String(r.anonId).slice(0, 6)}</span>
                          ),
                      },
                      { title: '页面', dataIndex: 'path', ellipsis: true },
                      { title: '设备', dataIndex: 'device', width: 80 },
                      {
                        title: '属性',
                        ellipsis: true,
                        render: (_: any, r: any) => (
                          <code style={{ fontSize: 11 }}>{JSON.stringify(r.props).slice(0, 60)}</code>
                        ),
                      },
                    ]}
                  />
                </>
              ),
            },
          ]}
        />
      </Card>

      {/* 单用户行为轨迹 */}
      <Drawer
        title={trailUser?.user ? `用户行为轨迹 — ${trailUser.user.email}` : '用户轨迹'}
        width={560}
        open={!!trailUser}
        onClose={() => setTrailUser(null)}
      >
        {trailUser && (
          <>
            <Card size="small" style={{ marginBottom: 14 }}>
              <Row gutter={10}>
                <Col span={8}><Statistic title="事件数" value={trailUser.stats.events} /></Col>
                <Col span={8}><Statistic title="余额" value={trailUser.user?.balance ?? 0} prefix="$" /></Col>
                <Col span={8}><Statistic title="成长值" value={trailUser.user?.growthUsd ?? 0} prefix="$" /></Col>
              </Row>
              <div style={{ marginTop: 10, fontSize: 12.5, color: '#888' }}>
                首次：{trailUser.stats.firstSeen ? new Date(trailUser.stats.firstSeen).toLocaleString('zh-CN') : '-'} ·
                最近：{trailUser.stats.lastSeen ? new Date(trailUser.stats.lastSeen).toLocaleString('zh-CN') : '-'}
              </div>
              <div style={{ marginTop: 8 }}>
                {(trailUser.stats.byName ?? []).map((b: any) => (
                  <Tag key={b.name}>{label(b.name)} × {b.count}</Tag>
                ))}
              </div>
            </Card>
            <Timeline
              items={(trailUser.trail ?? []).map((e: any) => ({
                color:
                  e.name === 'payment_success' ? 'green'
                  : e.name === 'payment_fail' ? 'red'
                  : e.name.startsWith('checkout') ? 'blue' : 'gray',
                children: (
                  <div style={{ fontSize: 12.5 }}>
                    <b>{label(e.name)}</b>{' '}
                    <span style={{ color: '#999' }}>{new Date(e.createdAt).toLocaleString('zh-CN')}</span>
                    <div style={{ color: '#666' }}>{e.path}</div>
                    {Object.keys(e.props || {}).length > 0 && (
                      <code style={{ fontSize: 11, color: '#888' }}>{JSON.stringify(e.props)}</code>
                    )}
                  </div>
                ),
              }))}
            />
          </>
        )}
      </Drawer>
    </div>
  );
}
