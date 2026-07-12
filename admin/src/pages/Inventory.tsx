import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popover,
  Progress,
  Row,
  Select,
  Space,
  Statistic,
  Tag,
  message,
} from 'antd';
import { api } from '../api';

interface AccountRow {
  id: number;
  planId: number;
  credentials: string;
  maxSlots: number;
  usedSlots: number;
  freeSlots: number;
  health: 'ok' | 'banned';
  supplierEmail?: string | null;
  createdAt: string;
}
interface PlanOption {
  id: number;
  name: string;
  productTitle: string;
}
interface SlotRow {
  id: number;
  status: 'free' | 'assigned' | 'revoked';
  orderId: number | null;
  orderNo: string | null;
  userEmail: string | null;
}

const parseCred = (c: string) => {
  try {
    return JSON.parse(c);
  } catch {
    return { note: c };
  }
};
const maskAcct = (name?: string) =>
  name ? name.replace(/(.{3}).+(@.*)?$/, '$1***$2') : '***';

/** 库存账号池：卡片面板 + 坑位下钻 */
export default function Inventory() {
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [planId, setPlanId] = useState<number | undefined>();
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [form] = Form.useForm();
  // 下钻
  const [drillAccount, setDrillAccount] = useState<AccountRow | null>(null);
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [slotLoading, setSlotLoading] = useState(false);

  useEffect(() => {
    api<PlanOption[]>('/admin/plans')
      .then(setPlans)
      .catch((e) => message.error(e.message));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    api<AccountRow[]>(`/admin/inventory${planId ? `?planId=${planId}` : ''}`)
      .then(setRows)
      .catch((e) => message.error(e.message))
      .finally(() => setLoading(false));
  }, [planId]);
  useEffect(load, [load]);

  const planLabel = (id: number) => {
    const p = plans.find((x) => x.id === id);
    return p ? `${p.productTitle} / ${p.name}` : `#${id}`;
  };

  const stats = useMemo(() => {
    const total = rows.reduce((s, r) => s + r.maxSlots, 0);
    const used = rows.reduce((s, r) => s + r.usedSlots, 0);
    const banned = rows.filter((r) => r.health === 'banned').length;
    return { accounts: rows.length, total, used, free: total - used, banned };
  }, [rows]);

  async function openDrill(account: AccountRow) {
    setDrillAccount(account);
    setSlotLoading(true);
    try {
      setSlots(await api<SlotRow[]>(`/admin/inventory/${account.id}/slots`));
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setSlotLoading(false);
    }
  }

  async function submit() {
    const values = await form.validateFields();
    try {
      await api('/admin/inventory', {
        method: 'POST',
        body: JSON.stringify({
          planId: values.planId,
          maxSlots: values.maxSlots,
          credentials: JSON.stringify({
            username: values.username,
            password: values.password,
            note: values.note || '',
          }),
        }),
      });
      message.success('账号已入池，坑位已生成；排队订单已自动补发');
      setModal(false);
      form.resetFields();
      load();
    } catch (e: any) {
      message.error(e.message);
    }
  }

  async function toggleHealth(row: AccountRow) {
    const health = row.health === 'ok' ? 'banned' : 'ok';
    try {
      await api(`/admin/inventory/${row.id}/health`, {
        method: 'PATCH',
        body: JSON.stringify({ health }),
      });
      message.success(health === 'banned' ? '已标记封号（停止分配）' : '已恢复');
      load();
      if (drillAccount?.id === row.id) setDrillAccount({ ...row, health });
    } catch (e: any) {
      message.error(e.message);
    }
  }

  return (
    <Card
      title="库存账号池"
      extra={
        <Space>
          <Select
            allowClear
            placeholder="按套餐筛选"
            style={{ width: 260 }}
            value={planId}
            onChange={setPlanId}
            options={plans.map((p) => ({
              value: p.id,
              label: `${p.productTitle} / ${p.name}`,
            }))}
          />
          <Button type="primary" onClick={() => setModal(true)}>
            + 录入账号
          </Button>
        </Space>
      }
    >
      <Row gutter={12} style={{ marginBottom: 18 }}>
        <Col span={5}><Card size="small"><Statistic title="账号数" value={stats.accounts} /></Card></Col>
        <Col span={5}><Card size="small"><Statistic title="坑位总数" value={stats.total} /></Card></Col>
        <Col span={5}><Card size="small"><Statistic title="已占用" value={stats.used} valueStyle={{ color: '#4f46e5' }} /></Card></Col>
        <Col span={5}><Card size="small"><Statistic title="空闲" value={stats.free} valueStyle={{ color: '#16a34a' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="封号账号" value={stats.banned} valueStyle={{ color: stats.banned ? '#dc2626' : undefined }} /></Card></Col>
      </Row>

      {loading ? (
        <Empty description="加载中…" />
      ) : rows.length === 0 ? (
        <Empty description="暂无账号，点击右上角录入" />
      ) : (
        <Row gutter={[14, 14]}>
          {rows.map((a) => {
            const cred = parseCred(a.credentials);
            const usedPct = a.maxSlots ? Math.round((a.usedSlots / a.maxSlots) * 100) : 0;
            const banned = a.health === 'banned';
            return (
              <Col key={a.id} xs={24} sm={12} lg={8} xxl={6}>
                <Card
                  size="small"
                  hoverable
                  onClick={() => openDrill(a)}
                  style={{
                    borderColor: banned ? '#fca5a5' : '#e5e7ef',
                    background: banned ? '#fff5f5' : '#fff',
                  }}
                  styles={{ body: { padding: 14 } }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <b style={{ fontSize: 13 }}>#{a.id} · {planLabel(a.planId)}</b>
                    {banned ? <Tag color="red">封号</Tag> : <Tag color="green">正常</Tag>}
                  </div>
                  <Popover
                    content={
                      <div style={{ fontSize: 13 }}>
                        <div>账号：{cred.username}</div>
                        <div>密码：{cred.password}</div>
                        {cred.note && <div>备注：{cred.note}</div>}
                      </div>
                    }
                  >
                    <code style={{ fontSize: 12, color: '#555' }}>{maskAcct(cred.username)}</code>
                  </Popover>
                  <div style={{ margin: '10px 0 4px', fontSize: 12, color: '#888' }}>
                    坑位 {a.usedSlots}/{a.maxSlots} 占用 · 空闲 {a.freeSlots}
                  </div>
                  <Progress
                    percent={usedPct}
                    size="small"
                    strokeColor={banned ? '#dc2626' : '#4f46e5'}
                    showInfo={false}
                  />
                  <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                    <Button size="small" type="primary" ghost onClick={(e) => { e.stopPropagation(); openDrill(a); }}>
                      查看坑位
                    </Button>
                    <Button
                      size="small"
                      danger={!banned}
                      onClick={(e) => { e.stopPropagation(); toggleHealth(a); }}
                    >
                      {banned ? '恢复' : '标记封号'}
                    </Button>
                    {a.supplierEmail && <Tag color="cyan" style={{ marginLeft: 'auto' }}>供:{a.supplierEmail}</Tag>}
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      {/* 坑位下钻抽屉 */}
      <Drawer
        title={drillAccount ? `坑位明细 — 账号 #${drillAccount.id}` : ''}
        width={520}
        open={!!drillAccount}
        onClose={() => setDrillAccount(null)}
      >
        {drillAccount && (
          <>
            <Card size="small" style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, lineHeight: 2 }}>
                <div>套餐：{planLabel(drillAccount.planId)}</div>
                <div>账号：<code>{parseCred(drillAccount.credentials).username}</code></div>
                <div>密码：<code>{parseCred(drillAccount.credentials).password}</code></div>
                <div>
                  健康度：
                  {drillAccount.health === 'ok' ? <Tag color="green">正常</Tag> : <Tag color="red">封号</Tag>}
                  <Button size="small" danger={drillAccount.health === 'ok'} onClick={() => toggleHealth(drillAccount)}>
                    {drillAccount.health === 'ok' ? '标记封号' : '恢复正常'}
                  </Button>
                </div>
              </div>
            </Card>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>
              坑位（{slots.length}）：绿=空闲 蓝=已占用 灰=作废
            </div>
            {slotLoading ? (
              <Empty description="加载中…" />
            ) : (
              <Row gutter={[10, 10]}>
                {slots.map((s, idx) => {
                  const color =
                    s.status === 'free' ? '#16a34a' : s.status === 'assigned' ? '#4f46e5' : '#9ca3af';
                  const bg =
                    s.status === 'free' ? '#e8f7ee' : s.status === 'assigned' ? '#eef0ff' : '#f3f4f6';
                  return (
                    <Col key={s.id} xs={12} sm={8}>
                      <div style={{ border: `1.5px solid ${color}`, background: bg, borderRadius: 10, padding: '10px 12px' }}>
                        <div style={{ fontWeight: 800, color, fontSize: 13 }}>
                          坑位 {idx + 1}
                          <span style={{ float: 'right', fontSize: 11 }}>
                            {s.status === 'free' ? '空闲' : s.status === 'assigned' ? '占用' : '作废'}
                          </span>
                        </div>
                        {s.status === 'assigned' && (
                          <div style={{ fontSize: 11.5, color: '#555', marginTop: 4, lineHeight: 1.6 }}>
                            <div>👤 {s.userEmail}</div>
                            <div>🧾 {s.orderNo}</div>
                          </div>
                        )}
                      </div>
                    </Col>
                  );
                })}
              </Row>
            )}
          </>
        )}
      </Drawer>

      <Modal title="录入官方账号" open={modal} onOk={submit} onCancel={() => setModal(false)} destroyOnClose>
        <p style={{ color: '#888', fontSize: 13 }}>
          演示项目凭据为明文存储；生产环境必须 AES-GCM 字段加密 + KMS 管理密钥。
        </p>
        <Form form={form} layout="vertical">
          <Form.Item label="所属套餐" name="planId" rules={[{ required: true }]}>
            <Select
              options={plans.map((p) => ({ value: p.id, label: `${p.productTitle} / ${p.name}` }))}
            />
          </Form.Item>
          <Form.Item label="账号" name="username" rules={[{ required: true }]}>
            <Input placeholder="family_01@pool.demo" />
          </Form.Item>
          <Form.Item label="密码" name="password" rules={[{ required: true }]}>
            <Input placeholder="Pool#2026" />
          </Form.Item>
          <Form.Item label="备注" name="note">
            <Input placeholder="家庭组 · 位置 1-4" />
          </Form.Item>
          <Form.Item label="坑位数" name="maxSlots" initialValue={4}>
            <InputNumber min={1} max={50} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
