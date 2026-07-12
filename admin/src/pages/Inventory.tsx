import React, { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Popover,
  Select,
  Space,
  Table,
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
  createdAt: string;
}
interface PlanOption {
  id: number;
  name: string;
  productTitle: string;
}

/** 账号池：录入官方账号 -> 自动生成坑位 -> 支付成功自动分配 */
export default function Inventory() {
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [planId, setPlanId] = useState<number | undefined>();
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [form] = Form.useForm();

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
            style={{ width: 280 }}
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
      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        columns={[
          { title: 'ID', dataIndex: 'id', width: 60 },
          {
            title: '所属套餐',
            dataIndex: 'planId',
            render: (id: number) => planLabel(id),
          },
          {
            title: '凭据',
            dataIndex: 'credentials',
            render: (c: string) => {
              let parsed: any = {};
              try {
                parsed = JSON.parse(c);
              } catch {
                parsed = { note: c };
              }
              return (
                <Popover
                  content={
                    <div style={{ fontSize: 13 }}>
                      <div>账号：{parsed.username}</div>
                      <div>密码：{parsed.password}</div>
                      {parsed.note && <div>备注：{parsed.note}</div>}
                    </div>
                  }
                >
                  <code style={{ cursor: 'pointer' }}>
                    {(parsed.username || '***').replace(/(.{3}).+(@.*)?$/, '$1***$2')}
                  </code>
                </Popover>
              );
            },
          },
          {
            title: '坑位（用/闲/总）',
            render: (_, r: AccountRow) =>
              `${r.usedSlots} / ${r.freeSlots} / ${r.maxSlots}`,
          },
          {
            title: '健康度',
            dataIndex: 'health',
            width: 90,
            render: (h: string) =>
              h === 'ok' ? <Tag color="green">正常</Tag> : <Tag color="red">封号</Tag>,
          },
          {
            title: '来源',
            dataIndex: 'supplierEmail',
            width: 140,
            render: (s: string | null) =>
              s ? <Tag color="cyan">供应商 {s}</Tag> : <Tag>自营</Tag>,
          },
          {
            title: '录入时间',
            dataIndex: 'createdAt',
            render: (t: string) => new Date(t).toLocaleString('zh-CN'),
          },
          {
            title: '操作',
            width: 120,
            render: (_, row: AccountRow) => (
              <Button
                size="small"
                danger={row.health === 'ok'}
                onClick={() => toggleHealth(row)}
              >
                {row.health === 'ok' ? '标记封号' : '恢复正常'}
              </Button>
            ),
          },
        ]}
      />

      <Modal
        title="录入官方账号"
        open={modal}
        onOk={submit}
        onCancel={() => setModal(false)}
        destroyOnClose
      >
        <p style={{ color: '#888', fontSize: 13 }}>
          演示项目凭据为明文存储；生产环境必须 AES-GCM 字段加密 + KMS 管理密钥。
        </p>
        <Form form={form} layout="vertical">
          <Form.Item label="所属套餐" name="planId" rules={[{ required: true }]}>
            <Select
              options={plans.map((p) => ({
                value: p.id,
                label: `${p.productTitle} / ${p.name}`,
              }))}
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
