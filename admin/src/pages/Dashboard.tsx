import React, { useEffect, useState } from 'react';
import { Card, Col, Row, Statistic, Table, Tag, message } from 'antd';
import { api, ORDER_STATUS } from '../api';

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
