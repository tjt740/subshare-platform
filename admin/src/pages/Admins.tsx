import React, { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
  message,
} from 'antd';
import { api, PERM_OPTIONS } from '../api';

interface AdminRow {
  id: number;
  email: string;
  role: 'admin' | 'super';
  status: 'active' | 'banned';
  permissions: string[];
  createdAt: string;
}

/** 父子管理员：超管创建子管理员账号并按模块授权 */
export default function Admins() {
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AdminRow | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const load = useCallback(() => {
    setLoading(true);
    api<AdminRow[]>('/admin/admins')
      .then(setRows)
      .catch((e) => message.error(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  async function create() {
    const values = await createForm.validateFields();
    try {
      await api('/admin/admins', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      message.success('子管理员已创建，可用该邮箱登录后台');
      setCreateOpen(false);
      createForm.resetFields();
      load();
    } catch (e: any) {
      message.error(e.message);
    }
  }

  async function savePerms() {
    if (!editing) return;
    const values = editForm.getFieldsValue();
    try {
      await api(`/admin/admins/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ permissions: values.permissions || [] }),
      });
      message.success('权限已更新（该管理员重新登录后生效）');
      setEditing(null);
      load();
    } catch (e: any) {
      message.error(e.message);
    }
  }

  async function toggleStatus(row: AdminRow) {
    try {
      await api(`/admin/admins/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: row.status === 'active' ? 'banned' : 'active',
        }),
      });
      message.success(row.status === 'active' ? '已停用' : '已启用');
      load();
    } catch (e: any) {
      message.error(e.message);
    }
  }

  const permLabel = (p: string) =>
    PERM_OPTIONS.find((o) => o.value === p)?.label ?? p;

  return (
    <Card
      title="管理员管理（父子管理员）"
      extra={
        <Button type="primary" onClick={() => setCreateOpen(true)}>
          + 创建子管理员
        </Button>
      }
    >
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
            width: 120,
            render: (r: string) =>
              r === 'super' ? (
                <Tag color="purple">超级管理员</Tag>
              ) : (
                <Tag color="blue">子管理员</Tag>
              ),
          },
          {
            title: '模块权限',
            dataIndex: 'permissions',
            render: (perms: string[], row: AdminRow) =>
              row.role === 'super' ? (
                <Tag color="purple">全部权限</Tag>
              ) : perms.length === 0 ? (
                <Tag>未授权</Tag>
              ) : (
                <Space size={4} wrap>
                  {perms.map((p) => (
                    <Tag key={p}>{permLabel(p)}</Tag>
                  ))}
                </Space>
              ),
          },
          {
            title: '状态',
            dataIndex: 'status',
            width: 90,
            render: (s: string) =>
              s === 'active' ? (
                <Tag color="green">启用</Tag>
              ) : (
                <Tag color="red">已停用</Tag>
              ),
          },
          {
            title: '操作',
            width: 180,
            render: (_, row: AdminRow) =>
              row.role === 'admin' && (
                <Space>
                  <Button
                    size="small"
                    onClick={() => {
                      setEditing(row);
                      editForm.setFieldsValue({ permissions: row.permissions });
                    }}
                  >
                    改权限
                  </Button>
                  <Popconfirm
                    title={row.status === 'active' ? '确认停用？' : '确认启用？'}
                    onConfirm={() => toggleStatus(row)}
                  >
                    <Button size="small" danger={row.status === 'active'}>
                      {row.status === 'active' ? '停用' : '启用'}
                    </Button>
                  </Popconfirm>
                </Space>
              ),
          },
        ]}
      />

      <Modal
        title="创建子管理员"
        open={createOpen}
        onOk={create}
        onCancel={() => setCreateOpen(false)}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical">
          <Form.Item
            label="登录邮箱"
            name="email"
            rules={[{ required: true, type: 'email' }]}
          >
            <Input placeholder="ops@demo.com" />
          </Form.Item>
          <Form.Item
            label="初始密码"
            name="password"
            rules={[{ required: true, min: 6, message: '至少 6 位' }]}
          >
            <Input.Password placeholder="至少 6 位" />
          </Form.Item>
          <Form.Item label="模块权限" name="permissions" initialValue={['orders']}>
            <Checkbox.Group options={PERM_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`修改权限 — ${editing?.email ?? ''}`}
        open={!!editing}
        onOk={savePerms}
        onCancel={() => setEditing(null)}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical">
          <Form.Item label="模块权限" name="permissions">
            <Checkbox.Group options={PERM_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
