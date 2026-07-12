import React, { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  message,
} from 'antd';
import { api, ORDER_STATUS } from '../api';

interface OrderRow {
  id: number;
  orderNo: string;
  userEmail: string;
  productTitle: string;
  planName: string;
  region: string;
  currency: string;
  amount: number;
  status: string;
  createdAt: string;
}

export default function Orders() {
  const [status, setStatus] = useState<string | undefined>();
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api<OrderRow[]>(`/admin/orders${status ? `?status=${status}` : ''}`)
      .then(setRows)
      .catch((e) => message.error(e.message))
      .finally(() => setLoading(false));
  }, [status]);
  useEffect(load, [load]);

  async function refund(row: OrderRow) {
    try {
      await api(`/admin/orders/${row.id}/refund`, { method: 'POST' });
      message.success('已退款并回收坑位');
      load();
    } catch (e: any) {
      message.error(e.message);
    }
  }

  async function fulfill(row: OrderRow) {
    try {
      await api(`/admin/orders/${row.id}/fulfill`, { method: 'POST' });
      message.success('已补发交付');
      load();
    } catch (e: any) {
      message.error(e.message);
    }
  }

  return (
    <Card
      title="订单管理"
      extra={
        <Select
          allowClear
          placeholder="按状态筛选"
          style={{ width: 180 }}
          value={status}
          onChange={setStatus}
          options={Object.entries(ORDER_STATUS).map(([value, v]) => ({
            value,
            label: v.text,
          }))}
        />
      }
    >
      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        columns={[
          {
            title: '订单号',
            dataIndex: 'orderNo',
            render: (s: string) => <code>{s}</code>,
          },
          { title: '用户', dataIndex: 'userEmail' },
          {
            title: '商品/套餐',
            render: (_, r: OrderRow) => (
              <>
                {r.productTitle}
                <div style={{ color: '#999', fontSize: 12 }}>{r.planName}</div>
              </>
            ),
          },
          { title: '地区', dataIndex: 'region', width: 80 },
          {
            title: '金额',
            render: (_, r: OrderRow) => `${r.currency} ${r.amount}`,
          },
          {
            title: '状态',
            dataIndex: 'status',
            render: (s: string) => (
              <Tag color={ORDER_STATUS[s]?.color}>{ORDER_STATUS[s]?.text ?? s}</Tag>
            ),
          },
          {
            title: '创建时间',
            dataIndex: 'createdAt',
            render: (t: string) => new Date(t).toLocaleString('zh-CN'),
          },
          {
            title: '操作',
            width: 170,
            render: (_, row: OrderRow) => (
              <Space>
                {row.status === 'allocating' && (
                  <Button size="small" type="primary" onClick={() => fulfill(row)}>
                    手动补发
                  </Button>
                )}
                {['paid', 'delivered', 'allocating'].includes(row.status) && (
                  <Popconfirm
                    title="确认退款？将同时回收坑位、吊销订阅"
                    onConfirm={() => refund(row)}
                  >
                    <Button size="small" danger>
                      退款
                    </Button>
                  </Popconfirm>
                )}
              </Space>
            ),
          },
        ]}
      />
    </Card>
  );
}
