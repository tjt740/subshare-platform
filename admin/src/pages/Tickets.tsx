import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Drawer,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  message,
} from 'antd';
import { api, TICKET_CATEGORY, TICKET_STATUS } from '../api';

interface Agent {
  id: number;
  name: string;
  email?: string;
  avatar?: string;
  activeTickets?: number;
  handledTickets?: number;
  replies?: number;
  avgRating?: number;
  ratingCount?: number;
  transfersIn?: number;
  transfersOut?: number;
}

interface TicketRow {
  id: number;
  subject: string;
  status: string;
  category?: string;
  userEmail: string;
  agentName?: string;
  assignedAgentId?: number | null;
  messageCount?: number;
  transferCount?: number;
  rating?: number | null;
  updatedAt: string;
  createdAt: string;
  orderId?: number | null;
  subscriptionId?: number | null;
}

interface TicketDetail extends TicketRow {
  orderNo: string | null;
  userName?: string;
  agent?: Agent | null;
  resolutionNote?: string;
  firstResponseAt?: string | null;
  resolvedAt?: string | null;
  ratingComment?: string;
  messages: {
    id: number;
    senderRole: 'user' | 'admin' | 'system';
    senderName?: string;
    messageType?: string;
    content: string;
    createdAt: string;
  }[];
  transfers: {
    id: number;
    fromAgentName: string;
    toAgentName: string;
    reason: string;
    initiatedRole: string;
    createdAt: string;
  }[];
}

interface TicketStats {
  total: number;
  open: number;
  answered: number;
  resolved: number;
  closed: number;
  messageCount: number;
  transferCount: number;
  avgFirstResponseMinutes: number;
  ratings: {
    total: number;
    average: number;
    excellent: number;
    medium: number;
    bad: number;
  };
  agents: Agent[];
}

export default function Tickets() {
  const [status, setStatus] = useState<string | undefined>('open');
  const [rows, setRows] = useState<TicketRow[]>([]);
  const [stats, setStats] = useState<TicketStats | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState<TicketDetail | null>(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferAgentId, setTransferAgentId] = useState<number>();
  const [transferReason, setTransferReason] = useState('');
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');
  const bodyRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api<TicketRow[]>(`/admin/tickets${status ? `?status=${status}` : ''}`),
      api<TicketStats>('/admin/tickets-stats'),
      api<Agent[]>('/admin/support-agents'),
    ])
      .then(([ticketRows, ticketStats, supportAgents]) => {
        setRows(ticketRows);
        setStats(ticketStats);
        setAgents(supportAgents);
      })
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
    if (!current || !reply.trim() || busy) return;
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

  async function resolve() {
    if (!current || !resolutionNote.trim()) return;
    setBusy(true);
    try {
      const updated = await api<TicketDetail>(`/admin/tickets/${current.id}/close`, {
        method: 'POST',
        body: JSON.stringify({ resolutionNote: resolutionNote.trim() }),
      });
      setCurrent(updated);
      setResolveOpen(false);
      setResolutionNote('');
      message.success('已标记解决，等待用户确认或评价');
      load();
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function transfer() {
    if (!current || !transferAgentId || !transferReason.trim()) return;
    setBusy(true);
    try {
      const updated = await api<TicketDetail>(`/admin/tickets/${current.id}/transfer`, {
        method: 'POST',
        body: JSON.stringify({
          agentId: transferAgentId,
          reason: transferReason.trim(),
        }),
      });
      setCurrent(updated);
      setTransferOpen(false);
      setTransferAgentId(undefined);
      setTransferReason('');
      message.success('转接完成，原客服及完整会话记录已保留');
      load();
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function doAction(action: 'reissue' | 'refund') {
    if (!current) return;
    setBusy(true);
    try {
      const updated = await api<TicketDetail>(
        `/admin/tickets/${current.id}/action`,
        { method: 'POST', body: JSON.stringify({ action }) },
      );
      setCurrent(updated);
      message.success(
        action === 'reissue'
          ? '已补发新凭据并自动回复用户'
          : '已退款至用户钱包并自动回复',
      );
      load();
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col xs={12} lg={4}><Card size="small"><Statistic title="待客服处理" value={stats?.open ?? 0} valueStyle={{ color: '#d97706' }} /></Card></Col>
        <Col xs={12} lg={4}><Card size="small"><Statistic title="待用户回复" value={stats?.answered ?? 0} /></Card></Col>
        <Col xs={12} lg={4}><Card size="small"><Statistic title="已解决待确认" value={stats?.resolved ?? 0} valueStyle={{ color: '#2563eb' }} /></Card></Col>
        <Col xs={12} lg={4}><Card size="small"><Statistic title="累计对话" value={stats?.messageCount ?? 0} /></Card></Col>
        <Col xs={12} lg={4}><Card size="small"><Statistic title="平均首次响应" value={stats?.avgFirstResponseMinutes ?? 0} suffix="分钟" precision={1} /></Card></Col>
        <Col xs={12} lg={4}><Card size="small"><Statistic title="服务评分" value={stats?.ratings.average ?? 0} suffix={`/ 5（${stats?.ratings.total ?? 0}）`} precision={1} /></Card></Col>
      </Row>

      <Card size="small" title="服务评价与客服统计" style={{ marginBottom: 12 }}>
        <Space wrap style={{ marginBottom: 12 }}>
          <Tag color="green">优评（5星）{stats?.ratings.excellent ?? 0}</Tag>
          <Tag color="gold">中评（3-4星）{stats?.ratings.medium ?? 0}</Tag>
          <Tag color="red">差评（1-2星）{stats?.ratings.bad ?? 0}</Tag>
          <Tag color="blue">累计转接 {stats?.transferCount ?? 0}</Tag>
        </Space>
        <Table
          size="small"
          rowKey="id"
          pagination={false}
          dataSource={stats?.agents || []}
          columns={[
            { title: '客服', dataIndex: 'name' },
            { title: '当前工单', dataIndex: 'activeTickets' },
            { title: '处理工单', dataIndex: 'handledTickets' },
            { title: '回复数', dataIndex: 'replies' },
            { title: '转入/转出', render: (_, a: Agent) => `${a.transfersIn || 0} / ${a.transfersOut || 0}` },
            { title: '评价', render: (_, a: Agent) => `${a.avgRating || 0} 分 / ${a.ratingCount || 0} 条` },
          ]}
        />
      </Card>

      <Card
        title="客服工单"
        extra={
          <Select
            allowClear
            placeholder="按状态筛选"
            style={{ width: 180 }}
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
              title: '类型', dataIndex: 'category', width: 110,
              render: (c: string) => <Tag color={TICKET_CATEGORY[c ?? 'general']?.color}>{TICKET_CATEGORY[c ?? 'general']?.text ?? c}</Tag>,
            },
            { title: '主题', dataIndex: 'subject' },
            { title: '用户', dataIndex: 'userEmail' },
            { title: '当前客服', dataIndex: 'agentName', width: 110 },
            { title: '对话', dataIndex: 'messageCount', width: 65 },
            { title: '转接', dataIndex: 'transferCount', width: 65 },
            {
              title: '评价', dataIndex: 'rating', width: 80,
              render: (r: number | null) => r ? `${r} 星` : '-',
            },
            {
              title: '状态', dataIndex: 'status', width: 115,
              render: (s: string) => <Tag color={TICKET_STATUS[s]?.color}>{TICKET_STATUS[s]?.text ?? s}</Tag>,
            },
            {
              title: '最近更新', dataIndex: 'updatedAt',
              render: (t: string) => new Date(t).toLocaleString('zh-CN'),
            },
            {
              title: '操作', width: 110,
              render: (_, row: TicketRow) => <Button size="small" type="primary" ghost onClick={() => open(row)}>处理会话</Button>,
            },
          ]}
        />
      </Card>

      <Drawer
        title={current ? <Space wrap>#{current.id} {current.subject}<Tag color={TICKET_STATUS[current.status]?.color}>{TICKET_STATUS[current.status]?.text}</Tag>{current.orderNo && <Tag>订单 {current.orderNo}</Tag>}</Space> : ''}
        width={760}
        open={!!current}
        onClose={() => setCurrent(null)}
        extra={current?.status !== 'closed' && (
          <Space wrap>
            <Button size="small" onClick={() => setTransferOpen(true)}>转接客服</Button>
            <Popconfirm title="补发新凭据并自动回复用户？" onConfirm={() => doAction('reissue')}>
              <Button size="small" type="primary" loading={busy} disabled={!current?.subscriptionId && !current?.orderId}>一键补发</Button>
            </Popconfirm>
            <Popconfirm title="整单退款至用户钱包并自动回复？" onConfirm={() => doAction('refund')}>
              <Button size="small" danger loading={busy} disabled={!current?.orderId}>一键退款</Button>
            </Popconfirm>
            <Button size="small" type="primary" onClick={() => setResolveOpen(true)}>标记已解决</Button>
          </Space>
        )}
      >
        {current && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label="客户">{current.userName || current.userEmail}</Descriptions.Item>
              <Descriptions.Item label="当前客服">{current.agent?.name || '待分配'}</Descriptions.Item>
              <Descriptions.Item label="对话条数">{current.messages.length}</Descriptions.Item>
              <Descriptions.Item label="转接次数">{current.transferCount || 0}</Descriptions.Item>
              <Descriptions.Item label="首次响应">{current.firstResponseAt ? new Date(current.firstResponseAt).toLocaleString('zh-CN') : '尚未响应'}</Descriptions.Item>
              <Descriptions.Item label="用户评价">{current.rating ? `${current.rating} 星 · ${current.ratingComment || '无文字评价'}` : '未评价'}</Descriptions.Item>
            </Descriptions>
            {current.status === 'resolved' && <Alert style={{ marginTop: 10 }} type="success" showIcon message="客服已标记解决，等待用户确认/评价" description={current.resolutionNote} />}
            {current.transfers.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <b>转接记录</b>
                {current.transfers.map((item) => (
                  <div key={item.id} style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                    {new Date(item.createdAt).toLocaleString('zh-CN')} · {item.fromAgentName} → {item.toAgentName} · {item.reason}
                  </div>
                ))}
              </div>
            )}
            <Divider style={{ margin: '12px 0' }} />
            <div ref={bodyRef} style={{ flex: 1, overflowY: 'auto', background: '#f7f8fd', borderRadius: 10, padding: 14, marginBottom: 12 }}>
              {current.messages.map((m) => m.senderRole === 'system' ? (
                <div key={m.id} style={{ width: '90%', margin: '8px auto 12px', padding: '7px 10px', border: '1px dashed #aaa', borderRadius: 8, textAlign: 'center', color: '#777', fontSize: 12 }}>
                  {m.content}<br /><small>{new Date(m.createdAt).toLocaleString('zh-CN')}</small>
                </div>
              ) : (
                <div key={m.id} style={{ maxWidth: '82%', marginBottom: 12, marginLeft: m.senderRole === 'admin' ? 'auto' : 0 }}>
                  <div style={{ padding: '9px 13px', borderRadius: 12, fontSize: 13.5, background: m.senderRole === 'admin' ? '#4f46e5' : '#fff', color: m.senderRole === 'admin' ? '#fff' : '#222', border: m.senderRole === 'admin' ? 'none' : '1px solid #e7e9f2', overflowWrap: 'anywhere' }}>{m.content}</div>
                  <div style={{ fontSize: 11, color: '#999', marginTop: 3, textAlign: m.senderRole === 'admin' ? 'right' : 'left' }}>
                    {m.senderRole === 'admin' ? (m.senderName || '客服') : (m.senderName || '用户')} · {new Date(m.createdAt).toLocaleString('zh-CN')}
                  </div>
                </div>
              ))}
            </div>
            {current.status !== 'closed' && (
              <Space.Compact style={{ width: '100%' }}>
                <Input.TextArea rows={2} placeholder={current.status === 'resolved' ? '用户继续追问后可在此跟进回复…' : '输入回复内容…（Enter 发送）'} value={reply} onChange={(e) => setReply(e.target.value)} onPressEnter={(e) => { if (!e.shiftKey) { e.preventDefault(); void send(); } }} />
                <Button type="primary" loading={busy} disabled={!reply.trim()} onClick={send} style={{ height: 'auto' }}>回复</Button>
              </Space.Compact>
            )}
          </div>
        )}
      </Drawer>

      <Modal title="转接客服" open={transferOpen} confirmLoading={busy} okText="确认转接" okButtonProps={{ disabled: !transferAgentId || !transferReason.trim() }} onOk={transfer} onCancel={() => setTransferOpen(false)}>
        <Alert type="info" showIcon message="转接只改变当前负责人，不会删除或改写任何历史消息与原客服信息。" style={{ marginBottom: 12 }} />
        <Select style={{ width: '100%', marginBottom: 12 }} placeholder="选择目标客服" value={transferAgentId} onChange={setTransferAgentId} options={agents.filter((a) => a.id !== current?.assignedAgentId).map((a) => ({ value: a.id, label: `${a.name} · ${a.email || ''}` }))} />
        <Input.TextArea rows={3} maxLength={200} showCount placeholder="请填写转接理由（必填，将永久记录）" value={transferReason} onChange={(e) => setTransferReason(e.target.value)} />
      </Modal>

      <Modal title="标记问题已解决" open={resolveOpen} confirmLoading={busy} okText="标记解决并通知用户" okButtonProps={{ disabled: !resolutionNote.trim() }} onOk={resolve} onCancel={() => setResolveOpen(false)}>
        <Alert type="warning" showIcon message="标记后用户仍可继续追问；用户确认解决后可选择评价或直接完成。" style={{ marginBottom: 12 }} />
        <Input.TextArea rows={4} maxLength={500} showCount placeholder="填写本次解决结果（必填）" value={resolutionNote} onChange={(e) => setResolutionNote(e.target.value)} />
      </Modal>
    </div>
  );
}
