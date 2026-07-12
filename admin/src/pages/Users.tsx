import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, Popconfirm, Table, Tag, message } from 'antd';
import { api } from '../api';

interface UserRow {
  id: number;
  email: string;
  role: 'user' | 'admin';
  status: 'active' | 'banned';
  balance: number;
  createdAt: string;
}

export default function Users() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api<UserRow[]>('/admin/users')
      .then(setRows)
      .catch((e) => message.error(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

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
      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        columns={[
          { title: 'ID', dataIndex: 'id', width: 60 },
          { title: '邮箱', dataIndex: 'email' },
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
            width: 120,
            render: (_, row: UserRow) =>
              row.role === 'admin' ? null : row.status === 'active' ? (
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
              ),
          },
        ]}
      />
    </Card>
  );
}
