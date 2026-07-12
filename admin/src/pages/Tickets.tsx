import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Button,
  Card,
  Drawer,
  Input,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  message,
} from 'antd';
import { api, TICKET_CATEGORY, TICKET_STATUS } from '../api';

interface TicketRow {
  id: number;
  subject: string;
  status: string;
  category?: string;
  userEmail: string;
  updatedAt: string;
  createdAt: string;
  orderId?: number | null;
  subscriptionId?: number | null;
}
interface TicketDetail extends TicketRow {
  orderNo: string | null;
  messages: { id: number; senderRole: string; content: string; createdAt: string }[];
}

export default function Tickets() {
  const [status, setStatus] = useState<string | undefined>('open');
  const [rows, setRows] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState<TicketDetail | null>(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    api<TicketRow[]>(`/admin/tickets${status ? `?status=${status}` : ''}`)
      .then(setRows)
      .catch((e) => message.error(e.message))
      .finally(() => setLoading(false));
  }, [status]);
  useEffect(load, [load]);

  useEffect(() => {
    bodyRef.current?.scrollTo(0, bodyRef.current.scrollHeight);
  }, [current?.messages?.length]);

  async function open(row: TicketRow) {
    setCurrent(await api<TicketDetail>(`/admin/tickets/${row.id}`));
  }

  async function send() {
    if (!current || !reply.trim()) return;
    setBusy(true);
    try {
      const updated = await api<TicketDetail>(`/admin/tickets/${current.id}/reply`, {
        method: 'POST',
        body: JSON.stringify({ content: reply.trim() }),
      });
      setCurrent(updated);
      setReply('');
      load();
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function close() {
    if (!current) return;
    await api(`/admin/tickets/${current.id}/close`, { method: 'POST' });
    message.success('工单已关闭');
    setCurrent(null);
    load();
  }

  /** 一键售后动作：直接联动交付引擎/订单退款 */
  async function doAction(action: 'reissue' | 'refund') {
    if (!current) return;
    setBusy(true);
    try {
      const updated = await api<TicketDetail>(
        `/admin/tickets/${current.id}/action`,
        { method: 'POST', body: JSON.stringify({ action }) },
      );
      setCurrent(updated);
      message.success(action === 'reissue' ? '已补发新凭据并自动回复用户' : '已退款至用户钱包并自动回复');
      load();
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="客服工单"
      extra={
        <Select
          allowClear
          placeholder="按状态筛选"
          style={{ width: 160 }}
          value={status}
          onChange={setStatus}
          options={Object.entries(TICKET_STATUS).map(([value, v]) => ({
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
          { title: 'ID', dataIndex: 'id', width: 60 },
          {
            title: '类型',
            dataIndex: 'category',
            width: 110,
            render: (c: string) => (
              <Tag color={TICKET_CATEGORY[c ?? 'general']?.color}>
                {TICKET_CATEGORY[c ?? 'general']?.text ?? c}
              </Tag>
            ),
          },
          { title: '主题', dataIndex: 'subject' },
          { title: '用户', dataIndex: 'userEmail' },
          {
            title: '状态',
            dataIndex: 'status',
            width: 100,
            render: (s: string) => (
              <Tag color={TICKET_STATUS[s]?.color}>{TICKET_STATUS[s]?.text ?? s}</Tag>
            ),
          },
          {
            title: '最近更新',
            dataIndex: 'updatedAt',
            render: (t: string) => new Date(t).toLocaleString('zh-CN'),
          },
          {
            title: '操作',
            width: 110,
            render: (_, row: TicketRow) => (
              <Button size="small" type="primary" ghost onClick={() => open(row)}>
                处理会话
              </Button>
            ),
          },
        ]}
      />

      <Drawer
        title={
          current ? (
            <Space>
              #{current.id} {current.subject}
              <Tag color={TICKET_STATUS[current.status]?.color}>
                {TICKET_STATUS[current.status]?.text}
              </Tag>
              {current.orderNo && <Tag>订单 {current.orderNo}</Tag>}
            </Space>
          ) : (
            ''
          )
        }
        width={560}
        open={!!current}
        onClose={() => setCurrent(null)}
        extra={
          current?.status !== 'closed' && (
            <Space>
              <Popconfirm
                title="补发新凭据（旧坑位作废）并自动回复用户？"
                onConfirm={() => doAction('reissue')}
              >
                <Button
                  size="small"
                  type="primary"
                  loading={busy}
                  disabled={!current?.subscriptionId && !current?.orderId}
                >
                  🔧 一键补发
                </Button>
              </Popconfirm>
              <Popconfirm
                title="整单退款至用户钱包并自动回复？"
                onConfirm={() => doAction('refund')}
              >
                <Button size="small" danger loading={busy} disabled={!current?.orderId}>
                  💸 一键退款
                </Button>
              </Popconfirm>
              <Popconfirm title="确认关闭该工单？" onConfirm={close}>
                <Button size="small">关闭</Button>
              </Popconfirm>
            </Space>
          )
        }
      >
        {current && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div
              ref={bodyRef}
              style={{
                flex: 1,
                overflowY: 'auto',
                background: '#f7f8fd',
                borderRadius: 10,
                padding: 14,
                marginBottom: 12,
              }}
            >
              {current.messages.map((m) => (
                <div
                  key={m.id}
                  style={{
                    maxWidth: '82%',
                    marginBottom: 12,
                    marginLeft: m.senderRole === 'admin' ? 'auto' : 0,
                  }}
                >
                  <div
                    style={{
                      padding: '9px 13px',
                      borderRadius: 12,
                      fontSize: 13.5,
                      background: m.senderRole === 'admin' ? '#4f46e5' : '#fff',
                      color: m.senderRole === 'admin' ? '#fff' : '#222',
                      border: m.senderRole === 'admin' ? 'none' : '1px solid #e7e9f2',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {m.content}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: '#999',
                      marginTop: 3,
                      textAlign: m.senderRole === 'admin' ? 'right' : 'left',
                    }}
                  >
                    {m.senderRole === 'admin' ? '客服' : '用户'} ·{' '}
                    {new Date(m.createdAt).toLocaleString('zh-CN')}
                  </div>
                </div>
              ))}
            </div>
            {current.status !== 'closed' && (
              <Space.Compact style={{ width: '100%' }}>
                <Input.TextArea
                  rows={2}
                  placeholder="输入回复内容…（Enter 发送）"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onPressEnter={(e) => {
                    e.preventDefault();
                    send();
                  }}
                />
                <Button type="primary" loading={busy} onClick={send} style={{ height: 'auto' }}>
                  回复
                </Button>
              </Space.Compact>
            )}
          </div>
        )}
      </Drawer>
    </Card>
  );
}
