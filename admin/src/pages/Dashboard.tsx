import React, { useEffect, useState } from 'react';
import { Card, Col, Row, Statistic, Table, Tag, message } from 'antd';
import { api, ORDER_STATUS } from '../api';
import { FinanceLineChart } from '../components/SimpleCharts';

export default function Dashboard() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    api('/admin/metrics')
      .then(setData)
      .catch((e) => message.error(e.message));
  }, []);

  const revenueText = data
    ? Object.entries(data.revenueByCurrency || {})
        .map(([currency, amount]) => `${currency} ${amount}`)
        .join(' + ') || '0'
    : '-';

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col span={6}>
          <Card>
            <Statistic title="注册用户" value={data?.users ?? '-'} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="订单总数"
              value={data?.orders ?? '-'}
              suffix={
                data ? (
                  <span style={{ fontSize: 13, color: '#999' }}>
                    / 已付 {data.paidOrders}
                  </span>
                ) : null
              }
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="生效订阅" value={data?.activeSubscriptions ?? '-'} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="坑位（空闲/总数）"
              value={data ? `${data.slots.free} / ${data.slots.total}` : '-'}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="累计营收（≈USD）"
              value={data ? `$${data.revenueUsd}` : '-'}
              suffix={
                data ? (
                  <span style={{ fontSize: 12, color: '#999' }}>{revenueText}</span>
                ) : null
              }
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待处理工单"
              value={data?.openTickets ?? '-'}
              valueStyle={data?.openTickets > 0 ? { color: '#d97706' } : undefined}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待审核供应商提交"
              value={data?.pendingSubmissions ?? '-'}
              valueStyle={
                data?.pendingSubmissions > 0 ? { color: '#d97706' } : undefined
              }
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="排队订单 / 占用坑位"
              value={data ? `${data.allocatingOrders} / ${data.slots.assigned}` : '-'}
            />
          </Card>
        </Col>
      </Row>

      <Card title="经营利润（权责发生制）" style={{ marginTop: 16 }}>
        <Row gutter={[12, 12]}>
          <Col xs={12} lg={6}><Statistic title="现金成交收入" prefix="$" value={data?.finance?.cashRevenueUsd ?? 0} precision={2} /></Col>
          <Col xs={12} lg={6}><Statistic title="随服务确认收入" prefix="$" value={data?.finance?.recognizedRevenueUsd ?? 0} precision={2} valueStyle={{ color: '#4f46e5' }} /></Col>
          <Col xs={12} lg={6}><Statistic title="已摊销账号成本" prefix="$" value={data?.finance?.recognizedCostUsd ?? 0} precision={2} valueStyle={{ color: '#d97706' }} /></Col>
          <Col xs={12} lg={6}><Statistic title="当前毛利润" prefix="$" value={data?.finance?.grossProfitUsd ?? 0} precision={2} suffix={` / ${data?.finance?.grossMargin ?? 0}%`} valueStyle={{ color: (data?.finance?.grossProfitUsd ?? 0) >= 0 ? '#16a34a' : '#dc2626' }} /></Col>
        </Row>
        <div style={{ background: '#fff7e6', border: '1px solid #fde3ad', borderRadius: 10, padding: 12, margin: '14px 0' }}>
          <b>${Number(data?.finance?.grossProfitUsd || 0).toFixed(2)} 毛利润</b>
          {' = '}${Number(data?.finance?.recognizedRevenueUsd || 0).toFixed(2)} 已确认收入
          {' - '}${Number(data?.finance?.recognizedCostUsd || 0).toFixed(2)} 摊销成本
          {' - '}${Number(data?.finance?.paymentFeesUsd || 0).toFixed(2)} 支付手续费
          <div style={{ color: '#777', fontSize: 12, marginTop: 4 }}>
            未完成的服务收入暂列递延收入 ${Number(data?.finance?.deferredRevenueUsd || 0).toFixed(2)}，随着服务天数增加逐日转为确认收入。
          </div>
        </div>
        <FinanceLineChart data={data?.trend ?? []} />
      </Card>

      <Card title="最近订单" style={{ marginTop: 16 }}>
        <Table
          size="small"
          rowKey="id"
          pagination={false}
          dataSource={data?.recentOrders ?? []}
          columns={[
            { title: '订单号', dataIndex: 'orderNo' },
            { title: '商品', dataIndex: 'productTitle' },
            { title: '套餐', dataIndex: 'planName' },
            {
              title: '金额',
              render: (_, r: any) => `${r.currency} ${r.amount}`,
            },
            { title: '地区', dataIndex: 'region' },
            {
              title: '状态',
              dataIndex: 'status',
              render: (s: string) => (
                <Tag color={ORDER_STATUS[s]?.color}>{ORDER_STATUS[s]?.text ?? s}</Tag>
              ),
            },
            {
              title: '时间',
              dataIndex: 'createdAt',
              render: (t: string) => new Date(t).toLocaleString('zh-CN'),
            },
          ]}
        />
      </Card>
    </div>
  );
}
