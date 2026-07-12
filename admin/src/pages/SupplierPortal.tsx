import React, { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Popover,
  Radio,
  Row,
  Select,
  Statistic,
  Table,
  Tag,
  message,
} from 'antd';
import { api, SUBMISSION_STATUS } from '../api';

interface PlanOpt {
  id: number;
  name: string;
  productTitle: string;
}
interface SubmissionRow {
  id: number;
  type: 'account' | 'product';
  planLabel: string | null;
  username: string;
  maxSlots: number;
  proposedTitle: string;
  status: string;
  reviewNote: string;
  createdAt: string;
}

/** 供应商门户：提交共享账号 / 新产品提议，跟踪审核进度 */
export default function SupplierPortal() {
  const [plans, setPlans] = useState<PlanOpt[]>([]);
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<'account' | 'product'>('account');
  const [form] = Form.useForm();

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api<PlanOpt[]>('/supplier/plans'),
      api<SubmissionRow[]>('/supplier/submissions'),
    ])
      .then(([p, s]) => {
        setPlans(p);
        setRows(s);
      })
      .catch((e) => message.error(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  async function submit() {
    const values = await form.validateFields();
    try {
      await api('/supplier/submissions', {
        method: 'POST',
        body: JSON.stringify({ ...values, type }),
      });
      message.success('已提交，等待平台审核');
      setOpen(false);
      form.resetFields();
      load();
    } catch (e: any) {
      message.error(e.message);
    }
  }

  const stat = (s: string) => rows.filter((r) => r.status === s).length;

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card>
            <Statistic title="累计提交" value={rows.length} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="待审核"
              value={stat('pending')}
              valueStyle={stat('pending') > 0 ? { color: '#d97706' } : undefined}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="已通过" value={stat('approved')} valueStyle={{ color: '#16a34a' }} />
          </Card>
        </Col>
      </Row>

      <Card
        title="我的提交"
        extra={
          <Button type="primary" onClick={() => setOpen(true)}>
            + 新提交
          </Button>
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
              dataIndex: 'type',
              width: 100,
              render: (t: string) =>
                t === 'account' ? <Tag color="blue">共享账号</Tag> : <Tag color="purple">产品提议</Tag>,
            },
            {
              title: '内容',
              render: (_, r: SubmissionRow) =>
                r.type === 'account' ? (
                  <>
                    {r.planLabel}
                    <div style={{ color: '#888', fontSize: 12 }}>
                      {r.username} · {r.maxSlots} 坑位
                    </div>
                  </>
                ) : (
                  <b>{r.proposedTitle}</b>
                ),
            },
            {
              title: '审核状态',
              dataIndex: 'status',
              width: 110,
              render: (s: string, r: SubmissionRow) => (
                <Popover content={r.reviewNote || '（暂无审核备注）'}>
                  <Tag color={SUBMISSION_STATUS[s]?.color}>
                    {SUBMISSION_STATUS[s]?.text ?? s}
                  </Tag>
                </Popover>
              ),
            },
            {
              title: '提交时间',
              dataIndex: 'createdAt',
              render: (t: string) => new Date(t).toLocaleString('zh-CN'),
            },
          ]}
        />
      </Card>

      <Modal
        title="新提交"
        open={open}
        onOk={submit}
        onCancel={() => setOpen(false)}
        destroyOnClose
      >
        <Radio.Group
          value={type}
          onChange={(e) => setType(e.target.value)}
          style={{ marginBottom: 16 }}
          options={[
            { value: 'account', label: '提交共享账号（供货）' },
            { value: 'product', label: '提议新产品' },
          ]}
          optionType="button"
          buttonStyle="solid"
        />
        <Form form={form} layout="vertical">
          {type === 'account' ? (
            <>
              <Form.Item label="供货套餐" name="planId" rules={[{ required: true }]}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={plans.map((p) => ({
                    value: p.id,
                    label: `${p.productTitle} / ${p.name}`,
                  }))}
                />
              </Form.Item>
              <Form.Item label="账号" name="username" rules={[{ required: true }]}>
                <Input placeholder="family_01@supplier.com" />
              </Form.Item>
              <Form.Item label="密码" name="password" rules={[{ required: true }]}>
                <Input placeholder="账号密码" />
              </Form.Item>
              <Form.Item label="可用坑位数" name="maxSlots" initialValue={5}>
                <InputNumber min={1} max={50} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="备注" name="note">
                <Input placeholder="如：家庭组位置 1-5，已开 4K" />
              </Form.Item>
            </>
          ) : (
            <>
              <Form.Item label="产品名称" name="proposedTitle" rules={[{ required: true }]}>
                <Input placeholder="如：CloudDrive 2TB 家庭版" />
              </Form.Item>
              <Form.Item label="产品说明" name="proposedDesc">
                <Input.TextArea rows={3} placeholder="套餐形态、可供货规模、建议售价…" />
              </Form.Item>
              <Form.Item label="备注" name="note">
                <Input placeholder="联系方式或补充信息" />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </div>
  );
}
