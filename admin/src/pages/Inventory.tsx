import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Divider,
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
import { FinanceLineChart } from '../components/SimpleCharts';

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
  updatedAt: string;
  accountCode?: string | null;
  lifecycleStatus: string;
  purchasedAt?: string | null;
  serviceStartedAt?: string | null;
  lastRechargedAt?: string | null;
  nextRechargeAt?: string | null;
  expiresAt?: string | null;
  serviceDays: number;
  costAmount: number;
  costCurrency: string;
  costUsd: number;
  purchaseOrderNo?: string;
  invoiceNo?: string;
  createdByEmail?: string;
  updatedByEmail?: string;
  autoRenew?: boolean;
  notes?: string;
  finance: {
    totalCostUsd: number;
    cashRevenueUsd: number;
    recognizedRevenueUsd: number;
    deferredRevenueUsd: number;
    recognizedCostUsd: number;
    paymentFeesUsd: number;
    grossProfitUsd: number;
    projectedProfitUsd: number;
    grossMargin: number;
    remainingDays: number | null;
  };
  financeSeries: { date: string; revenue: number; cost: number; profit: number }[];
  costEntries: {
    id: number; type: string; amount: number; currency: string; amountUsd: number;
    effectiveFrom?: string; effectiveTo?: string; note: string; createdAt: string;
  }[];
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
  const [editingAccount, setEditingAccount] = useState<AccountRow | null>(null);
  const [form] = Form.useForm();
  const [costAccount, setCostAccount] = useState<AccountRow | null>(null);
  const [costForm] = Form.useForm();
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
      await api(editingAccount ? `/admin/inventory/${editingAccount.id}` : '/admin/inventory', {
        method: editingAccount ? 'PATCH' : 'POST',
        body: JSON.stringify({
          planId: values.planId,
          maxSlots: values.maxSlots,
          credentials: JSON.stringify({
            username: values.username,
            password: values.password,
            note: values.note || '',
          }),
          accountCode: values.accountCode || undefined,
          purchasedAt: values.purchasedAt || undefined,
          serviceStartedAt: values.serviceStartedAt || undefined,
          lastRechargedAt: values.lastRechargedAt || undefined,
          nextRechargeAt: values.nextRechargeAt || undefined,
          expiresAt: values.expiresAt || undefined,
          costAmount: values.costAmount || 0,
          costCurrency: values.costCurrency || 'USD',
          purchaseOrderNo: values.purchaseOrderNo || '',
          invoiceNo: values.invoiceNo || '',
          autoRenew: !!values.autoRenew,
          notes: values.notes || '',
        }),
      });
      message.success(editingAccount ? '账号资料已更新并记录操作人' : '账号已入池，坑位已生成；排队订单已自动补发');
      setModal(false);
      setEditingAccount(null);
      form.resetFields();
      load();
    } catch (e: any) {
      message.error(e.message);
    }
  }

  function openCreate() {
    setEditingAccount(null);
    form.resetFields();
    form.setFieldsValue({ maxSlots: 4, costCurrency: 'USD' });
    setModal(true);
  }

  function openEdit(account: AccountRow) {
    const cred = parseCred(account.credentials);
    const date = (value?: string | null) => value ? value.slice(0, 10) : undefined;
    setEditingAccount(account);
    form.setFieldsValue({
      ...account,
      username: cred.username,
      password: cred.password,
      note: cred.note,
      purchasedAt: date(account.purchasedAt),
      serviceStartedAt: date(account.serviceStartedAt),
      lastRechargedAt: date(account.lastRechargedAt),
      nextRechargeAt: date(account.nextRechargeAt),
      expiresAt: date(account.expiresAt),
    });
    setModal(true);
  }

  async function submitCost() {
    if (!costAccount) return;
    const values = await costForm.validateFields();
    try {
      await api(`/admin/inventory/${costAccount.id}/costs`, {
        method: 'POST',
        body: JSON.stringify(values),
      });
      message.success('成本/充值流水已记录，账号收益已重新计算');
      setCostAccount(null);
      costForm.resetFields();
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
          <Button type="primary" onClick={openCreate}>
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
                  <div style={{ fontSize: 11.5, color: '#8b90a0', marginBottom: 5 }}>
                    {a.accountCode || '未设置编号'} · 到期 {a.expiresAt ? new Date(a.expiresAt).toLocaleDateString('zh-CN') : '未设置'}
                    {a.finance?.remainingDays != null && ` · 剩 ${a.finance.remainingDays} 天`}
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
                  <div style={{ marginTop: 9, background: '#f7f8fc', borderRadius: 8, padding: '8px 9px', fontSize: 11.5, lineHeight: 1.7 }}>
                    <div>
                      确认收入 <b style={{ color: '#4f46e5' }}>${a.finance?.recognizedRevenueUsd?.toFixed(2) ?? '0.00'}</b>
                      {' · '}摊销成本 <b>${a.finance?.recognizedCostUsd?.toFixed(2) ?? '0.00'}</b>
                    </div>
                    <div>
                      毛利润 <b style={{ color: (a.finance?.grossProfitUsd ?? 0) >= 0 ? '#16a34a' : '#dc2626' }}>
                        ${a.finance?.grossProfitUsd?.toFixed(2) ?? '0.00'}
                      </b>
                      {' = 收入 - 成本 - 手续费'}
                    </div>
                  </div>
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
                    <Button size="small" onClick={(e) => { e.stopPropagation(); openEdit(a); }}>编辑</Button>
                    <Button size="small" onClick={(e) => { e.stopPropagation(); setCostAccount(a); costForm.setFieldsValue({ type: 'recharge', currency: a.costCurrency || 'USD' }); }}>充值/成本</Button>
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
        width={760}
        open={!!drillAccount}
        onClose={() => setDrillAccount(null)}
      >
        {drillAccount && (
          <>
            <Card size="small" style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, lineHeight: 2 }}>
                <div>账号编号：<code>{drillAccount.accountCode || '-'}</code></div>
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
                <div>创建：{new Date(drillAccount.createdAt).toLocaleString('zh-CN')} · {drillAccount.createdByEmail || '-'}</div>
                <div>编辑：{new Date(drillAccount.updatedAt).toLocaleString('zh-CN')} · {drillAccount.updatedByEmail || '-'}</div>
                <div>服务期：{drillAccount.serviceStartedAt ? new Date(drillAccount.serviceStartedAt).toLocaleDateString('zh-CN') : '-'} 至 {drillAccount.expiresAt ? new Date(drillAccount.expiresAt).toLocaleDateString('zh-CN') : '-'}</div>
                <div>最近充值：{drillAccount.lastRechargedAt ? new Date(drillAccount.lastRechargedAt).toLocaleString('zh-CN') : '暂无'}</div>
              </div>
            </Card>
            <Card size="small" title="账号收益（随服务时间逐日确认）" style={{ marginBottom: 14 }}>
              <Row gutter={[8, 8]}>
                <Col span={8}><Statistic title="现金成交" prefix="$" value={drillAccount.finance?.cashRevenueUsd || 0} precision={2} /></Col>
                <Col span={8}><Statistic title="已确认收入" prefix="$" value={drillAccount.finance?.recognizedRevenueUsd || 0} precision={2} /></Col>
                <Col span={8}><Statistic title="递延收入" prefix="$" value={drillAccount.finance?.deferredRevenueUsd || 0} precision={2} /></Col>
                <Col span={8}><Statistic title="累计成本" prefix="$" value={drillAccount.finance?.totalCostUsd || 0} precision={2} /></Col>
                <Col span={8}><Statistic title="已摊销成本" prefix="$" value={drillAccount.finance?.recognizedCostUsd || 0} precision={2} /></Col>
                <Col span={8}><Statistic title="当前毛利润" prefix="$" value={drillAccount.finance?.grossProfitUsd || 0} precision={2} valueStyle={{ color: (drillAccount.finance?.grossProfitUsd || 0) >= 0 ? '#16a34a' : '#dc2626' }} /></Col>
              </Row>
              <div style={{ margin: '12px 0', background: '#fff7e6', borderRadius: 8, padding: 10, fontSize: 12.5 }}>
                <b>${drillAccount.finance?.grossProfitUsd?.toFixed(2) || '0.00'} 毛利润</b>
                {' = '}${drillAccount.finance?.recognizedRevenueUsd?.toFixed(2) || '0.00'} 确认收入
                {' - '}${drillAccount.finance?.recognizedCostUsd?.toFixed(2) || '0.00'} 摊销成本
                {' - '}${drillAccount.finance?.paymentFeesUsd?.toFixed(2) || '0.00'} 手续费
              </div>
              <FinanceLineChart data={drillAccount.financeSeries || []} height={190} />
            </Card>
            <Card size="small" title="成本/充值流水" style={{ marginBottom: 14 }}>
              {(drillAccount.costEntries || []).length ? drillAccount.costEntries.map((entry) => (
                <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0', padding: '7px 0', fontSize: 12 }}>
                  <span>{entry.type} · {entry.note || '无备注'}</span>
                  <b>{entry.currency} {entry.amount}（≈${entry.amountUsd}）</b>
                </div>
              )) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无成本流水" />}
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

      <Modal title={editingAccount ? `编辑账号 #${editingAccount.id}` : '录入官方账号'} open={modal} onOk={submit} onCancel={() => { setModal(false); setEditingAccount(null); }} destroyOnClose width={900}>
        <p style={{ color: '#888', fontSize: 13 }}>
          演示项目凭据为明文存储；生产环境必须 AES-GCM 字段加密 + KMS 管理密钥。
        </p>
        <Form form={form} layout="vertical">
          <Row gutter={14}>
            <Col span={12}><Form.Item label="所属套餐" name="planId" rules={[{ required: true }]}><Select options={plans.map((p) => ({ value: p.id, label: `${p.productTitle} / ${p.name}` }))} /></Form.Item></Col>
            <Col span={6}><Form.Item label="内部账号编号" name="accountCode"><Input placeholder="自动生成" /></Form.Item></Col>
            <Col span={6}><Form.Item label="坑位数" name="maxSlots" initialValue={4}><InputNumber min={1} max={50} disabled={!!editingAccount} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item label="账号" name="username" rules={[{ required: true }]}><Input placeholder="family_01@pool.demo" /></Form.Item></Col>
            <Col span={12}><Form.Item label="密码" name="password" rules={[{ required: true }]}><Input.Password placeholder="Pool#2026" /></Form.Item></Col>
            <Col span={8}><Form.Item label="采购时间" name="purchasedAt"><Input type="date" /></Form.Item></Col>
            <Col span={8}><Form.Item label="服务开始时间" name="serviceStartedAt"><Input type="date" /></Form.Item></Col>
            <Col span={8}><Form.Item label="到期时间" name="expiresAt"><Input type="date" /></Form.Item></Col>
            <Col span={8}><Form.Item label="最近充值时间" name="lastRechargedAt"><Input type="date" /></Form.Item></Col>
            <Col span={8}><Form.Item label="下次充值时间" name="nextRechargeAt"><Input type="date" /></Form.Item></Col>
            <Col span={8}><Form.Item label="自动续费" name="autoRenew"><Select options={[{ value: true, label: '是' }, { value: false, label: '否' }]} /></Form.Item></Col>
            {!editingAccount && <>
              <Col span={8}><Form.Item label="首次采购成本" name="costAmount"><InputNumber min={0} step={0.01} style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={8}><Form.Item label="成本币种" name="costCurrency"><Select options={['USD','CNY','EUR'].map((x) => ({ value: x, label: x }))} /></Form.Item></Col>
              <Col span={8}><Form.Item label="成本说明"><Input value="将自动生成采购成本流水" disabled /></Form.Item></Col>
            </>}
            <Col span={12}><Form.Item label="采购单号" name="purchaseOrderNo"><Input /></Form.Item></Col>
            <Col span={12}><Form.Item label="发票/付款凭证号" name="invoiceNo"><Input /></Form.Item></Col>
            <Col span={24}><Form.Item label="凭据备注" name="note"><Input placeholder="家庭组 · 位置 1-4" /></Form.Item></Col>
            <Col span={24}><Form.Item label="运营备注" name="notes"><Input.TextArea rows={2} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title={costAccount ? `账号 ${costAccount.accountCode || '#' + costAccount.id} · 新增成本/充值` : '新增成本'}
        open={!!costAccount}
        onOk={submitCost}
        onCancel={() => setCostAccount(null)}
        destroyOnClose
      >
        <div style={{ background: '#f6f8ff', padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 12.5 }}>
          每次充值单独记账，并按“覆盖开始时间 → 覆盖结束时间”逐日摊销成本。
        </div>
        <Form form={costForm} layout="vertical">
          <Row gutter={12}>
            <Col span={12}><Form.Item label="类型" name="type" rules={[{ required: true }]}><Select options={[{ value: 'recharge', label: '续费充值' }, { value: 'adjustment', label: '成本调账' }, { value: 'supplier_refund', label: '供应商退款（填负数）' }]} /></Form.Item></Col>
            <Col span={6}><Form.Item label="金额" name="amount" rules={[{ required: true }]}><InputNumber step={0.01} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={6}><Form.Item label="币种" name="currency" rules={[{ required: true }]}><Select options={['USD','CNY','EUR'].map((x) => ({ value: x, label: x }))} /></Form.Item></Col>
            <Col span={12}><Form.Item label="成本覆盖开始" name="effectiveFrom"><Input type="date" /></Form.Item></Col>
            <Col span={12}><Form.Item label="成本覆盖结束/新到期日" name="effectiveTo"><Input type="date" /></Form.Item></Col>
            <Col span={24}><Form.Item label="说明" name="note"><Input placeholder="例如：2026 年度家庭套餐续费" /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>
    </Card>
  );
}
