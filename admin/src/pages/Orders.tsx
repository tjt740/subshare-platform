import React, { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Drawer,
  Input,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  message,
} from 'antd';
import { api, ORDER_STATUS } from '../api';

interface OrderItemRow {
  id: number;
  productTitle: string;
  planName: string;
  unitPrice: number;
  currency: string;
  status: string;
}
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
  paymentStatus?: string;
  fulfillmentStatus?: string;
  refundStatus?: string;
  settlementStatus?: string;
  paidAt?: string | null;
  deliveredAt?: string | null;
  refundedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  items?: OrderItemRow[];
}
interface OrderResponse {
  items: OrderRow[];
  total: number;
  page: number;
  pageSize: number;
  summary: Record<string, number>;
}

export default function Orders() {
  const [status, setStatus] = useState<string | undefined>();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const [current, setCurrent] = useState<OrderRow | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (status) params.set('status', status);
    if (search.trim()) params.set('search', search.trim());
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    api<OrderResponse>(`/admin/orders?${params}`)
      .then((data) => {
        setRows(data.items);
        setTotal(data.total);
        setSummary(data.summary || {});
      })
      .catch((e) => message.error(e.message))
      .finally(() => setLoading(false));
  }, [status, search, dateFrom, dateTo, page, pageSize]);
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
    await api(`/admin/orders/${row.id}/fulfill`, { method: 'POST' });
  }

  async function bulkFulfill() {
    const selected = rows.filter((row) => selectedKeys.includes(row.id) && row.status === 'allocating');
    if (!selected.length) return message.warning('请选择“排队分配中”的订单');
    let ok = 0;
    for (const row of selected) {
      try {
        await fulfill(row);
        ok += 1;
      } catch {
        // 继续处理其余订单，结果统一汇总。
      }
    }
    message.success(`批量补发完成：成功 ${ok} / ${selected.length}`);
    setSelectedKeys([]);
    load();
  }

  const summaryCards = [
    ['created', '待支付', '#d97706'],
    ['allocating', '库存不足/排队', '#b45309'],
    ['delivered', '已交付', '#16a34a'],
    ['refunded', '已退款', '#dc2626'],
  ];

  return (
    <div>
      <Row gutter={[12, 12]} style={{ marginBottom: 14 }}>
        {summaryCards.map(([key, label, color]) => (
          <Col xs={12} lg={6} key={key}>
            <Card size="small"><Statistic title={label} value={summary[key] || 0} valueStyle={{ color }} /></Card>
          </Col>
        ))}
      </Row>
      <Card
        title="订单运营中心"
        extra={<Tag color="blue">服务端分页 · 共 {total} 条</Tag>}
      >
        <Space wrap style={{ marginBottom: 14 }}>
          <Input.Search
            allowClear
            placeholder="订单号 / 用户邮箱"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onSearch={(value) => { setSearch(value); setPage(1); }}
            style={{ width: 260 }}
          />
          <Select
            allowClear
            placeholder="订单状态"
            style={{ width: 170 }}
            value={status}
            onChange={(value) => { setStatus(value); setPage(1); }}
            options={Object.entries(ORDER_STATUS).map(([value, v]) => ({ value, label: v.text }))}
          />
          <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} style={{ width: 145 }} />
          <span>至</span>
          <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} style={{ width: 145 }} />
          <Button onClick={() => { setStatus(undefined); setSearchInput(''); setSearch(''); setDateFrom(''); setDateTo(''); setPage(1); }}>清空筛选</Button>
          <Button type="primary" disabled={!selectedKeys.length} onClick={bulkFulfill}>批量重新交付</Button>
        </Space>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={rows}
          rowSelection={{ selectedRowKeys: selectedKeys, onChange: setSelectedKeys }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (n) => `共 ${n} 条`,
            onChange: (next, size) => { setPage(next); setPageSize(size); },
          }}
          scroll={{ x: 1250 }}
          columns={[
            {
              title: '订单号', dataIndex: 'orderNo', width: 190,
              render: (s: string, row: OrderRow) => <Button type="link" style={{ padding: 0 }} onClick={() => setCurrent(row)}><code>{s}</code></Button>,
            },
            { title: '用户', dataIndex: 'userEmail', width: 190 },
            {
              title: '商品/套餐', width: 220,
              render: (_, r: OrderRow) => <>{r.productTitle}<div style={{ color: '#999', fontSize: 12 }}>{r.planName}</div></>,
            },
            { title: '地区', dataIndex: 'region', width: 70 },
            { title: '金额', width: 110, render: (_, r: OrderRow) => `${r.currency} ${r.amount}` },
            { title: '订单状态', dataIndex: 'status', width: 105, render: (s: string) => <Tag color={ORDER_STATUS[s]?.color}>{ORDER_STATUS[s]?.text ?? s}</Tag> },
            { title: '付款', dataIndex: 'paymentStatus', width: 90, render: (s: string) => <Tag color={s === 'paid' ? 'green' : s === 'refunded' ? 'red' : 'default'}>{s || '-'}</Tag> },
            { title: '交付', dataIndex: 'fulfillmentStatus', width: 100, render: (s: string) => <Tag color={s === 'delivered' ? 'green' : s === 'partial' ? 'gold' : 'default'}>{s || '-'}</Tag> },
            { title: '创建时间', dataIndex: 'createdAt', width: 170, render: (t: string) => new Date(t).toLocaleString('zh-CN') },
            {
              title: '操作', fixed: 'right', width: 170,
              render: (_, row: OrderRow) => (
                <Space>
                  {row.status === 'allocating' && <Button size="small" type="primary" onClick={async () => { try { await fulfill(row); message.success('已重新交付'); load(); } catch (e: any) { message.error(e.message); } }}>补发</Button>}
                  {['paid', 'delivered', 'allocating'].includes(row.status) && (
                    <Popconfirm title="确认退款？将回收坑位并记录财务退款" onConfirm={() => refund(row)}><Button size="small" danger>退款</Button></Popconfirm>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>
      <Drawer title={current ? `订单详情 · ${current.orderNo}` : ''} width={620} open={!!current} onClose={() => setCurrent(null)}>
        {current && <>
          <Card size="small" title="状态时间线">
            <div style={{ lineHeight: 2 }}>
              <div>① 创建：{new Date(current.createdAt).toLocaleString('zh-CN')}</div>
              <div>② 支付：{current.paidAt ? new Date(current.paidAt).toLocaleString('zh-CN') : '未支付'} · {current.paymentStatus || '-'}</div>
              <div>③ 交付：{current.deliveredAt ? new Date(current.deliveredAt).toLocaleString('zh-CN') : '未完成'} · {current.fulfillmentStatus || '-'}</div>
              <div>④ 退款：{current.refundedAt ? new Date(current.refundedAt).toLocaleString('zh-CN') : '无'} · {current.refundStatus || '-'}</div>
              <div>⑤ 结算：{current.settlementStatus || 'unsettled'}</div>
            </div>
          </Card>
          <Card size="small" title="订单明细" style={{ marginTop: 12 }}>
            {(current.items || []).map((item) => <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}><span>{item.productTitle} / {item.planName}</span><b>{item.currency} {item.unitPrice}</b></div>)}
          </Card>
        </>}
      </Drawer>
    </div>
  );
}
