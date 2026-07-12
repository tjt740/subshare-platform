import React, { useState } from 'react';
import {
  Layout,
  Menu,
  Button,
  Form,
  Input,
  Card,
  message,
  Space,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import {
  AdminProfile,
  api,
  getProfile,
  getToken,
  setProfile,
  setToken,
} from './api';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Inventory from './pages/Inventory';
import Orders from './pages/Orders';
import Users from './pages/Users';
import Tickets from './pages/Tickets';
import Suppliers from './pages/Suppliers';
import Admins from './pages/Admins';
import SupplierPortal from './pages/SupplierPortal';
import SiteSettings from './pages/SiteSettings';

const { Header, Sider, Content } = Layout;

function Login({ onLogin }: { onLogin: () => void }) {
  const [loading, setLoading] = useState(false);

  async function doLogin(values: { email: string; password: string }) {
    setLoading(true);
    try {
      const data = await api<{ token: string; user: AdminProfile }>(
        '/auth/login',
        { method: 'POST', body: JSON.stringify(values) },
      );
      if (!['admin', 'super', 'supplier'].includes(data.user.role)) {
        message.error('该账号无后台访问权限（仅管理员/供应商）');
        return;
      }
      setToken(data.token);
      setProfile(data.user);
      onLogin();
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function doRegisterSupplier(values: { email: string; password: string }) {
    setLoading(true);
    try {
      const data = await api<{ token: string; user: AdminProfile }>(
        '/auth/register-supplier',
        { method: 'POST', body: JSON.stringify(values) },
      );
      setToken(data.token);
      setProfile(data.user);
      message.success('供应商入驻成功！');
      onLogin();
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  const loginForm = (
    <Form layout="vertical" onFinish={doLogin}>
      <Form.Item
        label="邮箱"
        name="email"
        rules={[{ required: true, type: 'email', message: '请输入邮箱' }]}
      >
        <Input placeholder="admin@demo.com" />
      </Form.Item>
      <Form.Item label="密码" name="password" rules={[{ required: true, message: '请输入密码' }]}>
        <Input.Password placeholder="Admin123!" />
      </Form.Item>
      <Button type="primary" htmlType="submit" block loading={loading}>
        登录
      </Button>
      <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0, fontSize: 12 }}>
        超管：admin@demo.com / Admin123!
        <br />
        子管理员：staff@demo.com / Staff123!（仅订单+工单权限）
        <br />
        供应商：supplier@demo.com / Supp123!
      </Typography.Paragraph>
    </Form>
  );

  const supplierForm = (
    <Form layout="vertical" onFinish={doRegisterSupplier}>
      <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
        成为供应商后，可向平台提交共享账号与新产品提议，审核通过自动入库。
      </Typography.Paragraph>
      <Form.Item
        label="邮箱"
        name="email"
        rules={[{ required: true, type: 'email', message: '请输入邮箱' }]}
      >
        <Input placeholder="supplier@example.com" />
      </Form.Item>
      <Form.Item
        label="密码"
        name="password"
        rules={[{ required: true, min: 6, message: '密码至少 6 位' }]}
      >
        <Input.Password placeholder="至少 6 位" />
      </Form.Item>
      <Button type="primary" htmlType="submit" block loading={loading}>
        注册并入驻
      </Button>
    </Form>
  );

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #eef0ff 0%, #f6f0ff 60%, #eafcff 100%)',
        padding: 16,
      }}
    >
      <Card style={{ width: 400 }} title="⚙️ SubShare 运营后台">
        <Tabs
          items={[
            { key: 'login', label: '账号登录', children: loginForm },
            { key: 'supplier', label: '供应商入驻', children: supplierForm },
          ]}
        />
      </Card>
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(!!getToken());
  const location = useLocation();
  const profile = getProfile();

  if (!authed || !profile) return <Login onLogin={() => setAuthed(true)} />;

  const isSupplier = profile.role === 'supplier';
  const can = (perm: string) =>
    profile.role === 'super' || profile.permissions.includes(perm);

  const menuItems = isSupplier
    ? [{ key: '/supplier', label: <Link to="/supplier">供应商中心</Link> }]
    : [
        can('dashboard') && { key: '/', label: <Link to="/">数据看板</Link> },
        can('products') && { key: '/products', label: <Link to="/products">商品与定价</Link> },
        can('inventory') && { key: '/inventory', label: <Link to="/inventory">库存账号池</Link> },
        can('orders') && { key: '/orders', label: <Link to="/orders">订单管理</Link> },
        can('tickets') && { key: '/tickets', label: <Link to="/tickets">客服工单</Link> },
        can('suppliers') && { key: '/suppliers', label: <Link to="/suppliers">供应商审核</Link> },
        can('users') && { key: '/users', label: <Link to="/users">用户管理</Link> },
        can('settings') && { key: '/settings', label: <Link to="/settings">站点设置</Link> },
        profile.role === 'super' && {
          key: '/admins',
          label: <Link to="/admins">管理员管理</Link>,
        },
      ].filter(Boolean) as { key: string; label: React.ReactNode }[];

  const fallback = isSupplier
    ? '/supplier'
    : (menuItems[0]?.key as string) || '/';

  const roleTag =
    profile.role === 'super' ? (
      <Tag color="purple">超级管理员</Tag>
    ) : profile.role === 'admin' ? (
      <Tag color="blue">子管理员</Tag>
    ) : (
      <Tag color="cyan">供应商</Tag>
    );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="dark" width={210} breakpoint="lg" collapsedWidth={64}>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 17, padding: '18px 22px' }}>
          ⚙️ SubShare
        </div>
        <Menu theme="dark" mode="inline" selectedKeys={[location.pathname]} items={menuItems} />
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#fff',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            paddingInline: 24,
            gap: 8,
          }}
        >
          <Space wrap>
            {roleTag}
            <span style={{ color: '#888' }}>{profile.email}</span>
            <Button
              onClick={() => {
                setToken(null);
                setProfile(null);
                setAuthed(false);
              }}
            >
              退出登录
            </Button>
          </Space>
        </Header>
        <Content style={{ margin: 24 }}>
          <Routes>
            {isSupplier ? (
              <Route path="/supplier" element={<SupplierPortal />} />
            ) : (
              <>
                {can('dashboard') && <Route path="/" element={<Dashboard />} />}
                {can('products') && <Route path="/products" element={<Products />} />}
                {can('inventory') && <Route path="/inventory" element={<Inventory />} />}
                {can('orders') && <Route path="/orders" element={<Orders />} />}
                {can('tickets') && <Route path="/tickets" element={<Tickets />} />}
                {can('suppliers') && <Route path="/suppliers" element={<Suppliers />} />}
                {can('users') && <Route path="/users" element={<Users />} />}
                {can('settings') && <Route path="/settings" element={<SiteSettings />} />}
                {profile.role === 'super' && <Route path="/admins" element={<Admins />} />}
              </>
            )}
            <Route path="*" element={<Navigate to={fallback} />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}
