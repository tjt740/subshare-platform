import React, { useCallback, useEffect, useState } from 'react';
import {
  Card,
  Col,
  Empty,
  Progress,
  Row,
  Segmented,
  Select,
  Statistic,
  Table,
  Tabs,
  Tag,
  message,
} from 'antd';
import { api } from '../api';
import UserTrail from '../components/UserTrail';

/** 埋点分析：概览 / 漏斗 / 事件流 / 单用户行为轨迹 */
interface Overview {
  totals: {
    pv: number; uv: number; sessions: number; events: number;
    conversion: number; avgDwellSec: number; bounceRate: number;
  };
  byName: { name: string; count: number }[];
  funnel: { key: string; label: string; users: number; rate: number; dropFromPrev: number }[];
  topProducts: { title: string; views: number; carts: number; buys: number }[];
  topPages: { path: string; count: number }[];
  devices: { name: string; count: number }[];
  referrers: { name: string; count: number }[];
  trend: { date: string; pv: number; uv: number; orders: number }[];
  engagement: {
    avgDwellSec: number;
    bounceRate: number;
    scrollDist: { depth: string; count: number }[];
    dwellByPage: { path: string; avgSec: number; views: number }[];
    exitPages: { path: string; count: number }[];
  };
  searchTerms: { term: string; count: number }[];
  authSources: { method: string; logins: number; signups: number }[];
  errors: { message: string; count: number; path: string }[];
  rageClicks: { where: string; count: number }[];
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
  page_leave: '离开页面',
  scroll_depth: '滚动深度',
  rage_click: '暴力点击',
  js_error: '前端异常',
  oauth_start: '发起三方登录',
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
  // 用户轨迹（抽屉组件与「用户管理」共用）
  const [trailId, setTrailId] = useState<number | null>(null);

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
          <Col xs={12} md={4}><Card size="small"><Statistic title="页面浏览 PV" value={ov?.totals.pv ?? 0} /></Card></Col>
          <Col xs={12} md={4}><Card size="small"><Statistic title="独立访客 UV" value={ov?.totals.uv ?? 0} /></Card></Col>
          <Col xs={12} md={4}><Card size="small"><Statistic title="会话数" value={ov?.totals.sessions ?? 0} /></Card></Col>
          <Col xs={12} md={4}>
            <Card size="small">
              <Statistic title="人均停留" value={ov?.totals.avgDwellSec ?? 0} suffix="秒" />
            </Card>
          </Col>
          <Col xs={12} md={4}>
            <Card size="small">
              <Statistic
                title="跳出率"
                value={ov?.totals.bounceRate ?? 0}
                suffix="%"
                valueStyle={{ color: (ov?.totals.bounceRate ?? 0) > 70 ? '#dc2626' : undefined }}
              />
            </Card>
          </Col>
          <Col xs={12} md={4}>
            <Card size="small">
              <Statistic
                title="浏览→支付转化"
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
              key: 'engage',
              label: '参与度与可用性',
              children: (
                <Row gutter={[20, 20]}>
                  <Col xs={24} lg={12}>
                    <b style={{ fontSize: 13 }}>各页面平均停留</b>
                    <Table
                      size="small"
                      rowKey="path"
                      style={{ marginTop: 10 }}
                      pagination={false}
                      dataSource={ov?.engagement.dwellByPage ?? []}
                      columns={[
                        { title: '页面', dataIndex: 'path', ellipsis: true },
                        { title: '平均停留', dataIndex: 'avgSec', width: 100, render: (v: number) => `${v} 秒` },
                        { title: '样本', dataIndex: 'views', width: 70 },
                      ]}
                    />
                  </Col>
                  <Col xs={24} lg={12}>
                    <b style={{ fontSize: 13 }}>退出页 Top（用户从这里离开站点）</b>
                    <Table
                      size="small"
                      rowKey="path"
                      style={{ marginTop: 10 }}
                      pagination={false}
                      dataSource={ov?.engagement.exitPages ?? []}
                      columns={[
                        { title: '页面', dataIndex: 'path', ellipsis: true },
                        { title: '退出次数', dataIndex: 'count', width: 90 },
                      ]}
                    />
                  </Col>

                  <Col xs={24} lg={8}>
                    <b style={{ fontSize: 13 }}>滚动深度分布</b>
                    <div style={{ marginTop: 12 }}>
                      {(ov?.engagement.scrollDist ?? []).map((s) => {
                        const max = Math.max(1, ...(ov?.engagement.scrollDist ?? []).map((x) => x.count));
                        return (
                          <div key={s.depth} style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 12.5, display: 'flex', justifyContent: 'space-between' }}>
                              <span>滚动到 {s.depth}%</span>
                              <b>{s.count}</b>
                            </div>
                            <Progress percent={Math.round((s.count / max) * 100)} showInfo={false} size="small" />
                          </div>
                        );
                      })}
                    </div>
                  </Col>

                  <Col xs={24} lg={8}>
                    <b style={{ fontSize: 13 }}>搜索词 Top</b>
                    <Table
                      size="small"
                      rowKey="term"
                      style={{ marginTop: 10 }}
                      pagination={false}
                      locale={{ emptyText: '暂无搜索' }}
                      dataSource={ov?.searchTerms ?? []}
                      columns={[
                        { title: '关键词', dataIndex: 'term' },
                        { title: '次数', dataIndex: 'count', width: 70 },
                      ]}
                    />
                  </Col>

                  <Col xs={24} lg={8}>
                    <b style={{ fontSize: 13 }}>登录 / 注册来源</b>
                    <Table
                      size="small"
                      rowKey="method"
                      style={{ marginTop: 10 }}
                      pagination={false}
                      dataSource={ov?.authSources ?? []}
                      columns={[
                        {
                          title: '方式',
                          dataIndex: 'method',
                          render: (m: string) => (
                            <Tag color={m === 'password' ? 'default' : 'blue'}>
                              {m === 'password' ? '邮箱密码' : m}
                            </Tag>
                          ),
                        },
                        { title: '登录', dataIndex: 'logins', width: 60 },
                        { title: '注册', dataIndex: 'signups', width: 60 },
                      ]}
                    />
                  </Col>

                  <Col xs={24} lg={12}>
                    <b style={{ fontSize: 13, color: '#dc2626' }}>前端异常 Top</b>
                    <Table
                      size="small"
                      rowKey="message"
                      style={{ marginTop: 10 }}
                      pagination={false}
                      locale={{ emptyText: '无异常，很好' }}
                      dataSource={ov?.errors ?? []}
                      columns={[
                        { title: '错误信息', dataIndex: 'message', ellipsis: true },
                        { title: '页面', dataIndex: 'path', width: 130, ellipsis: true },
                        { title: '次数', dataIndex: 'count', width: 70 },
                      ]}
                    />
                  </Col>
                  <Col xs={24} lg={12}>
                    <b style={{ fontSize: 13, color: '#ea580c' }}>暴力点击（点了没反应的地方）</b>
                    <Table
                      size="small"
                      rowKey="where"
                      style={{ marginTop: 10 }}
                      pagination={false}
                      locale={{ emptyText: '无异常点击' }}
                      dataSource={ov?.rageClicks ?? []}
                      columns={[
                        { title: '位置', dataIndex: 'where', ellipsis: true },
                        { title: '次数', dataIndex: 'count', width: 70 },
                      ]}
                    />
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
                            <a onClick={() => setTrailId(r.userId)}>{r.userEmail}</a>
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

      {/* 单用户行为轨迹（与用户管理共用同一组件） */}
      <UserTrail userId={trailId} onClose={() => setTrailId(null)} />
    </div>
  );
}
