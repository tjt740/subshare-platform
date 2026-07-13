import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, Modal, Popconfirm, Select, Table, Tag, message } from 'antd';
import { api } from '../api';
import UserTrail from '../components/UserTrail';

interface UserRow {
  id: number;
  email: string;
  nickname?: string;
  avatar?: string;
  level?: number;
  autoLevel?: number;
  levelOverride?: number | null;
  growthUsd?: number;
  role: 'user' | 'admin';
  status: 'active' | 'banned';
  balance: number;
  createdAt: string;
}

const LV_COLOR: Record<number, string> = { 1: 'default', 2: 'blue', 3: 'gold', 4: 'purple', 5: 'volcano' };
const LV_NAME: Record<number, string> = { 1: '新星', 2: '白银', 3: '黄金', 4: '铂金', 5: '黑钻' };

export default function Users() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [trailId, setTrailId] = useState<number | null>(null);
  const [lvUser, setLvUser] = useState<UserRow | null>(null);
  const [lvValue, setLvValue] = useState<string>('auto');
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api<UserRow[]>('/admin/users')
      .then(setRows)
      .catch((e) => message.error(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  async function saveLevel() {
    if (!lvUser) return;
    try {
      await api(`/admin/users/${lvUser.id}/level`, {
        method: 'PATCH',
        body: JSON.stringify({ level: lvValue === 'auto' ? null : Number(lvValue) }),
      });
      message.success('等级已更新（前台头像/名字样式即时生效）');
      setLvUser(null);
      load();
    } catch (e: any) {
      message.error(e.message);
    }
  }

  async function setStatus(row: UserRow, status: 'active' | 'banned') {
    try {
      await api(`/admin/users/${row.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      message.success(status === 'banned' ? '已封禁' : '已解封');
      load();
    } catch (e: any) {
      message.error(e.message);
    }
  }

  return (
    <Card title="用户管理">
      {/* 行为轨迹抽屉：从表格「查看行为」进入 */}
      <UserTrail userId={trailId} onClose={() => setTrailId(null)} />
      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        columns={[
          { title: 'ID', dataIndex: 'id', width: 60 },
          {
            title: '用户',
            dataIndex: 'email',
            render: (email: string, r: UserRow) => (
              <span>
                {r.nickname ? `${r.nickname} · ` : ''}
                {email}
              </span>
            ),
          },
          {
            title: '等级',
            dataIndex: 'level',
            width: 160,
            render: (lv: number = 1, r: UserRow) => (
              <span>
                <Tag color={LV_COLOR[lv]}>
                  LV{lv} {LV_NAME[lv]}
                  {r.levelOverride ? ' ·手动' : ''}
                </Tag>
                <span style={{ color: '#999', fontSize: 12 }}>
                  成长 ${Number(r.growthUsd ?? 0).toFixed(0)}
                </span>
              </span>
            ),
          },
          {
            title: '角色',
            dataIndex: 'role',
            width: 100,
            render: (r: string) =>
              r === 'admin' ? <Tag color="purple">管理员</Tag> : <Tag>用户</Tag>,
          },
          {
            title: '状态',
            dataIndex: 'status',
            width: 100,
            render: (s: string) =>
              s === 'active' ? (
                <Tag color="green">正常</Tag>
              ) : (
                <Tag color="red">已封禁</Tag>
              ),
          },
          {
            title: '注册时间',
            dataIndex: 'createdAt',
            render: (t: string) => new Date(t).toLocaleString('zh-CN'),
          },
          {
            title: '操作',
            width: 220,
            render: (_, row: UserRow) =>
              row.role === 'admin' ? null : (
                <span style={{ display: 'inline-flex', gap: 6 }}>
                <Button size="small" onClick={() => setTrailId(row.id)}>
                  查看行为
                </Button>
                <Button
                  size="small"
                  onClick={() => {
                    setLvUser(row);
                    setLvValue(row.levelOverride ? String(row.levelOverride) : 'auto');
                  }}
                >
                  改等级
                </Button>
                {row.status === 'active' ? (
                <Popconfirm
                  title="确认封禁该用户？"
                  onConfirm={() => setStatus(row, 'banned')}
                >
                  <Button size="small" danger>
                    封禁
                  </Button>
                </Popconfirm>
              ) : (
                <Button size="small" onClick={() => setStatus(row, 'active')}>
                  解封
                </Button>
              )}
                </span>
              ),
          },
        ]}
      />

      <Modal
        title={`修改等级 — ${lvUser?.nickname || lvUser?.email || ''}`}
        open={!!lvUser}
        onOk={saveLevel}
        onCancel={() => setLvUser(null)}
        destroyOnClose
      >
        <p style={{ color: '#888', fontSize: 13 }}>
          自动 = 按成长值（累计充值+消费 USD）计算，当前自动等级 LV{lvUser?.autoLevel ?? 1}；
          选择 1-5 为人工锁定（尊享/惩罚场景）。
        </p>
        <Select
          style={{ width: '100%' }}
          value={lvValue}
          onChange={setLvValue}
          options={[
            { value: 'auto', label: `🌐 自动（当前 LV${lvUser?.autoLevel ?? 1}）` },
            ...[1, 2, 3, 4, 5].map((n) => ({
              value: String(n),
              label: `LV${n} ${LV_NAME[n]}`,
            })),
          ]}
        />
      </Modal>
    </Card>
  );
}
