import React, { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  Input,
  Modal,
  Popover,
  Select,
  Space,
  Table,
  Tag,
  message,
} from 'antd';
import { api, SUBMISSION_STATUS } from '../api';

interface SubmissionRow {
  id: number;
  type: 'account' | 'product';
  supplierEmail: string;
  planLabel: string | null;
  username: string;
  password: string;
  maxSlots: number;
  proposedTitle: string;
  proposedDesc: string;
  note: string;
  status: string;
  reviewNote: string;
  createdAt: string;
}

/** 供应商提交审核：账号通过自动入库生成坑位；产品提议通过生成草稿商品 */
export default function Suppliers() {
  const [status, setStatus] = useState<string | undefined>('pending');
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [reviewing, setReviewing] = useState<SubmissionRow | null>(null);
  const [approve, setApprove] = useState(true);
  const [note, setNote] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api<SubmissionRow[]>(
      `/admin/supplier-submissions${status ? `?status=${status}` : ''}`,
    )
      .then(setRows)
      .catch((e) => message.error(e.message))
      .finally(() => setLoading(false));
  }, [status]);
  useEffect(load, [load]);

  async function submitReview() {
    if (!reviewing) return;
    try {
      await api(`/admin/supplier-submissions/${reviewing.id}/review`, {
        method: 'POST',
        body: JSON.stringify({ approve, reviewNote: note }),
      });
      message.success(
        approve
          ? reviewing.type === 'account'
            ? '已通过：账号已入库并生成坑位，排队订单已自动补发'
            : '已通过：已创建草稿商品（下架状态），请到商品管理完善后上架'
          : '已驳回',
      );
      setReviewing(null);
      setNote('');
      load();
    } catch (e: any) {
      message.error(e.message);
    }
  }

  return (
    <Card
      title="供应商提交审核"
      extra={
        <Select
          allowClear
          placeholder="按状态筛选"
          style={{ width: 160 }}
          value={status}
          onChange={setStatus}
          options={Object.entries(SUBMISSION_STATUS).map(([value, v]) => ({
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
            dataIndex: 'type',
            width: 100,
            render: (t: string) =>
              t === 'account' ? <Tag color="blue">共享账号</Tag> : <Tag color="purple">产品提议</Tag>,
          },
          { title: '供应商', dataIndex: 'supplierEmail' },
          {
            title: '内容',
            render: (_, r: SubmissionRow) =>
              r.type === 'account' ? (
                <>
                  <div>{r.planLabel}</div>
                  <Popover
                    content={
                      <div style={{ fontSize: 13 }}>
                        <div>账号：{r.username}</div>
                        <div>坑位数：{r.maxSlots}</div>
                        {r.note && <div>备注：{r.note}</div>}
                      </div>
                    }
                  >
                    <code style={{ cursor: 'pointer', fontSize: 12 }}>
                      {r.username} · {r.maxSlots} 坑位
                    </code>
                  </Popover>
                </>
              ) : (
                <>
                  <b>{r.proposedTitle}</b>
                  <div style={{ color: '#888', fontSize: 12 }}>{r.proposedDesc}</div>
                </>
              ),
          },
          {
            title: '状态',
            dataIndex: 'status',
            width: 100,
            render: (s: string, r: SubmissionRow) => (
              <Popover content={r.reviewNote || '（无审核备注）'}>
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
          {
            title: '操作',
            width: 160,
            render: (_, row: SubmissionRow) =>
              row.status === 'pending' && (
                <Space>
                  <Button
                    size="small"
                    type="primary"
                    onClick={() => {
                      setReviewing(row);
                      setApprove(true);
                    }}
                  >
                    通过
                  </Button>
                  <Button
                    size="small"
                    danger
                    onClick={() => {
                      setReviewing(row);
                      setApprove(false);
                    }}
                  >
                    驳回
                  </Button>
                </Space>
              ),
          },
        ]}
      />

      <Modal
        title={approve ? '通过审核' : '驳回提交'}
        open={!!reviewing}
        onOk={submitReview}
        onCancel={() => setReviewing(null)}
        okText={approve ? '确认通过' : '确认驳回'}
        okButtonProps={approve ? {} : { danger: true }}
      >
        {reviewing?.type === 'account' && approve && (
          <p style={{ color: '#888', fontSize: 13 }}>
            通过后：账号自动入库 → 生成 {reviewing.maxSlots} 个坑位 →
            自动补发该套餐排队中的订单。
          </p>
        )}
        {reviewing?.type === 'product' && approve && (
          <p style={{ color: '#888', fontSize: 13 }}>
            通过后：自动创建「下架」状态草稿商品，请到商品管理补充套餐与定价后上架。
          </p>
        )}
        <Input.TextArea
          rows={3}
          placeholder="审核备注（供应商可见）"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Modal>
    </Card>
  );
}
