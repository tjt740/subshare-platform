import React, { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  message,
} from 'antd';
import { api, CURRENCIES, REGIONS } from '../api';

interface ProductRow {
  id: number;
  slug: string;
  title: string;
  category: string;
  description: string;
  meta?: string;
  status: 'on' | 'off';
  sort: number;
}

const parseMeta = (m?: string) => {
  try {
    return JSON.parse(m || '{}');
  } catch {
    return {};
  }
};
interface PlanRow {
  id: number;
  productId: number;
  name: string;
  type: string;
  periodMonths: number;
  status: 'on' | 'off';
  stock: number;
  prices: { region: string; currency: string; price: number }[];
}

/** 商品 / 套餐 / 地区定价 三级管理 */
export default function Products() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(false);

  // 商品编辑
  const [productModal, setProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null);
  const [productForm] = Form.useForm();

  // 套餐抽屉
  const [drawerProduct, setDrawerProduct] = useState<ProductRow | null>(null);
  const [plans, setPlans] = useState<PlanRow[]>([]);

  // 套餐编辑
  const [planModal, setPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanRow | null>(null);
  const [planForm] = Form.useForm();

  // 定价编辑
  const [priceModal, setPriceModal] = useState(false);
  const [pricingPlan, setPricingPlan] = useState<PlanRow | null>(null);
  const [priceForm] = Form.useForm();

  const loadProducts = useCallback(() => {
    setLoading(true);
    api<ProductRow[]>('/admin/products')
      .then(setProducts)
      .catch((e) => message.error(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(loadProducts, [loadProducts]);

  const loadPlans = useCallback((productId: number) => {
    api<PlanRow[]>(`/admin/plans?productId=${productId}`)
      .then(setPlans)
      .catch((e) => message.error(e.message));
  }, []);

  async function saveProduct() {
    const values = await productForm.validateFields();
    // 交付/售后配置合并进 meta（前台商品页/订阅卡实时展示 -> 前后台连贯）
    const { deliveryMethod, deliveryTime, warranty, saleEndsAt, saleLabel, ...rest } = values;
    const meta = parseMeta(editingProduct?.meta);
    meta.delivery = {
      ...(meta.delivery || {}),
      method: deliveryMethod || meta.delivery?.method || '账号密码',
      time: deliveryTime || meta.delivery?.time || '支付后自动交付',
    };
    if (warranty !== undefined) meta.warranty = warranty;
    if (saleEndsAt) {
      meta.sale = {
        endsAt: new Date(saleEndsAt).toISOString(),
        label: saleLabel || '⚡ 限时特惠',
      };
    } else {
      delete meta.sale;
    }
    const payload = { ...rest, meta: JSON.stringify(meta) };
    try {
      if (editingProduct) {
        await api(`/admin/products/${editingProduct.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await api('/admin/products', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      message.success('已保存（前台商品页即时生效）');
      setProductModal(false);
      loadProducts();
    } catch (e: any) {
      message.error(e.message);
    }
  }

  async function toggleProduct(row: ProductRow, on: boolean) {
    try {
      await api(`/admin/products/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: on ? 'on' : 'off' }),
      });
      loadProducts();
    } catch (e: any) {
      message.error(e.message);
    }
  }

  async function savePlan() {
    const values = await planForm.validateFields();
    if (!drawerProduct) return;
    try {
      if (editingPlan) {
        await api(`/admin/plans/${editingPlan.id}`, {
          method: 'PATCH',
          body: JSON.stringify(values),
        });
      } else {
        await api('/admin/plans', {
          method: 'POST',
          body: JSON.stringify({ ...values, productId: drawerProduct.id }),
        });
      }
      message.success('已保存');
      setPlanModal(false);
      loadPlans(drawerProduct.id);
    } catch (e: any) {
      message.error(e.message);
    }
  }

  function openPricing(plan: PlanRow) {
    setPricingPlan(plan);
    const initial: any = {};
    for (const region of REGIONS) {
      const row = plan.prices.find((p) => p.region === region);
      initial[`price_${region}`] = row?.price ?? null;
      initial[`currency_${region}`] =
        row?.currency ?? (region === 'EU' ? 'EUR' : region === 'CN' ? 'CNY' : 'USD');
    }
    priceForm.setFieldsValue(initial);
    setPriceModal(true);
  }

  async function savePricing() {
    if (!pricingPlan || !drawerProduct) return;
    const values = priceForm.getFieldsValue();
    const items = REGIONS.filter(
      (region) => values[`price_${region}`] != null,
    ).map((region) => ({
      region,
      currency: values[`currency_${region}`],
      price: values[`price_${region}`],
    }));
    try {
      await api(`/admin/plans/${pricingPlan.id}/prices`, {
        method: 'PUT',
        body: JSON.stringify({ items }),
      });
      message.success('定价已更新，前台立即生效');
      setPriceModal(false);
      loadPlans(drawerProduct.id);
    } catch (e: any) {
      message.error(e.message);
    }
  }

  return (
    <Card
      title="商品与定价"
      extra={
        <Button
          type="primary"
          onClick={() => {
            setEditingProduct(null);
            productForm.resetFields();
            setProductModal(true);
          }}
        >
          + 新建商品
        </Button>
      }
    >
      <Table
        rowKey="id"
        loading={loading}
        dataSource={products}
        pagination={false}
        columns={[
          { title: 'ID', dataIndex: 'id', width: 60 },
          { title: '商品', dataIndex: 'title' },
          {
            title: 'slug',
            dataIndex: 'slug',
            render: (s: string) => <code>{s}</code>,
          },
          { title: '分类', dataIndex: 'category', width: 100 },
          { title: '排序', dataIndex: 'sort', width: 70 },
          {
            title: '上架',
            dataIndex: 'status',
            width: 80,
            render: (s: string, row: ProductRow) => (
              <Switch
                checked={s === 'on'}
                onChange={(on) => toggleProduct(row, on)}
              />
            ),
          },
          {
            title: '操作',
            width: 220,
            render: (_, row: ProductRow) => (
              <Space>
                <Button
                  size="small"
                  onClick={() => {
                    setEditingProduct(row);
                    const meta = parseMeta(row.meta);
                    const saleIso = meta.sale?.endsAt;
                    productForm.setFieldsValue({
                      ...row,
                      deliveryMethod: meta.delivery?.method,
                      deliveryTime: meta.delivery?.time,
                      warranty: meta.warranty,
                      saleLabel: meta.sale?.label,
                      saleEndsAt: saleIso
                        ? new Date(new Date(saleIso).getTime() - new Date().getTimezoneOffset() * 60000)
                            .toISOString()
                            .slice(0, 16)
                        : undefined,
                    });
                    setProductModal(true);
                  }}
                >
                  编辑
                </Button>
                <Button
                  size="small"
                  type="primary"
                  ghost
                  onClick={() => {
                    setDrawerProduct(row);
                    loadPlans(row.id);
                  }}
                >
                  套餐与定价
                </Button>
                <Popconfirm
                  title="删除商品及其全部套餐/定价/库存？有订单引用将被拒绝"
                  onConfirm={async () => {
                    try {
                      await api(`/admin/products/${row.id}`, { method: 'DELETE' });
                      message.success('商品已删除');
                      loadProducts();
                    } catch (e: any) {
                      message.error(e.message);
                    }
                  }}
                >
                  <Button size="small" danger>
                    删除
                  </Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      {/* 商品编辑 */}
      <Modal
        title={editingProduct ? '编辑商品' : '新建商品'}
        open={productModal}
        onOk={saveProduct}
        onCancel={() => setProductModal(false)}
        destroyOnClose
      >
        <Form form={productForm} layout="vertical">
          <Form.Item label="标题" name="title" rules={[{ required: true }]}>
            <Input placeholder="StreamMax Premium 4K" />
          </Form.Item>
          <Form.Item
            label="slug（URL 标识，唯一）"
            name="slug"
            rules={[{ required: true, pattern: /^[a-z0-9-]+$/, message: '仅小写字母/数字/中划线' }]}
          >
            <Input placeholder="streammax-premium" disabled={!!editingProduct} />
          </Form.Item>
          <Form.Item label="分类" name="category" initialValue="流媒体">
            <Select
              options={['流媒体', '音乐', 'AI 工具', '办公', '学习', '游戏'].map(
                (c) => ({ value: c, label: c }),
              )}
            />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item label="排序（越小越靠前）" name="sort" initialValue={0}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <div style={{ borderTop: '1px dashed #ddd', margin: '4px 0 14px', paddingTop: 10, fontWeight: 700, fontSize: 13 }}>
            🚚 交付与售后（前台商品页/订阅卡展示）
          </div>
          <Form.Item label="交付方式" name="deliveryMethod" initialValue="账号密码">
            <Select
              options={['账号密码', '家庭组邀请', '团队席位账号', '代充值', '其他'].map(
                (v) => ({ value: v, label: v }),
              )}
            />
          </Form.Item>
          <Form.Item label="交付时效说明" name="deliveryTime">
            <Input placeholder="支付后 60 秒内自动发放" />
          </Form.Item>
          <Form.Item label="质保/售后政策" name="warranty">
            <Input placeholder="有效期内封号免费补发，工单 2 小时内响应" />
          </Form.Item>
          <div style={{ borderTop: '1px dashed #ddd', margin: '4px 0 14px', paddingTop: 10, fontWeight: 700, fontSize: 13 }}>
            ⏳ 特惠倒计时（前台商品卡与详情页展示）
          </div>
          <Form.Item label="特惠截止时间（留空=关闭特惠）" name="saleEndsAt">
            <Input type="datetime-local" />
          </Form.Item>
          <Form.Item label="特惠标签" name="saleLabel">
            <Input placeholder="⚡ 限时特惠" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 套餐抽屉 */}
      <Drawer
        title={`套餐与定价 — ${drawerProduct?.title ?? ''}`}
        width={760}
        open={!!drawerProduct}
        onClose={() => setDrawerProduct(null)}
        extra={
          <Button
            type="primary"
            onClick={() => {
              setEditingPlan(null);
              planForm.resetFields();
              setPlanModal(true);
            }}
          >
            + 新建套餐
          </Button>
        }
      >
        <Table
          rowKey="id"
          dataSource={plans}
          pagination={false}
          size="small"
          columns={[
            { title: '套餐', dataIndex: 'name' },
            {
              title: '周期',
              dataIndex: 'periodMonths',
              width: 70,
              render: (m: number) => `${m} 月`,
            },
            {
              title: '类型',
              dataIndex: 'type',
              width: 80,
              render: (t: string) =>
                t === 'shared' ? <Tag color="blue">合租</Tag> : <Tag>代充</Tag>,
            },
            {
              title: '库存',
              dataIndex: 'stock',
              width: 70,
              render: (n: number) =>
                n > 0 ? n : <Tag color="orange">缺货</Tag>,
            },
            {
              title: '地区定价',
              render: (_, plan: PlanRow) =>
                plan.prices.length === 0 ? (
                  <Tag color="red">未定价</Tag>
                ) : (
                  <Space size={4} wrap>
                    {plan.prices.map((p) => (
                      <Tag key={p.region}>
                        {p.region} {p.currency} {p.price}
                      </Tag>
                    ))}
                  </Space>
                ),
            },
            {
              title: '上架',
              dataIndex: 'status',
              width: 70,
              render: (s: string, plan: PlanRow) => (
                <Switch
                  size="small"
                  checked={s === 'on'}
                  onChange={async (on) => {
                    await api(`/admin/plans/${plan.id}`, {
                      method: 'PATCH',
                      body: JSON.stringify({ status: on ? 'on' : 'off' }),
                    });
                    drawerProduct && loadPlans(drawerProduct.id);
                  }}
                />
              ),
            },
            {
              title: '操作',
              width: 150,
              render: (_, plan: PlanRow) => (
                <Space>
                  <Button
                    size="small"
                    onClick={() => {
                      setEditingPlan(plan);
                      planForm.setFieldsValue(plan);
                      setPlanModal(true);
                    }}
                  >
                    编辑
                  </Button>
                  <Button size="small" type="primary" ghost onClick={() => openPricing(plan)}>
                    定价
                  </Button>
                  <Popconfirm
                    title="删除该套餐(SKU)及其定价/库存？有订单引用将被拒绝"
                    onConfirm={async () => {
                      try {
                        await api(`/admin/plans/${plan.id}`, { method: 'DELETE' });
                        message.success('套餐已删除');
                        drawerProduct && loadPlans(drawerProduct.id);
                        loadProducts();
                      } catch (e: any) {
                        message.error(e.message);
                      }
                    }}
                  >
                    <Button size="small" danger>
                      删
                    </Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Drawer>

      {/* 套餐编辑 */}
      <Modal
        title={editingPlan ? '编辑套餐' : '新建套餐'}
        open={planModal}
        onOk={savePlan}
        onCancel={() => setPlanModal(false)}
        destroyOnClose
      >
        <Form form={planForm} layout="vertical">
          <Form.Item label="套餐名" name="name" rules={[{ required: true }]}>
            <Input placeholder="合租位 · 1 个月" />
          </Form.Item>
          <Form.Item label="周期（月）" name="periodMonths" initialValue={1}>
            <InputNumber min={1} max={36} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="类型" name="type" initialValue="shared">
            <Select
              options={[
                { value: 'shared', label: '合租（坑位交付）' },
                { value: 'topup', label: '代充（充值用户自有账号）' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 地区定价 */}
      <Modal
        title={`地区定价 — ${pricingPlan?.name ?? ''}`}
        open={priceModal}
        onOk={savePricing}
        onCancel={() => setPriceModal(false)}
        destroyOnClose
      >
        <p style={{ color: '#888', fontSize: 13 }}>
          留空表示该地区不售卖；前台查价回退顺序：精确地区 → GLOBAL。
        </p>
        <Form form={priceForm} layout="horizontal" labelCol={{ span: 6 }}>
          {REGIONS.map((region) => (
            <Form.Item key={region} label={region} style={{ marginBottom: 12 }}>
              <Space.Compact style={{ width: '100%' }}>
                <Form.Item name={`currency_${region}`} noStyle>
                  <Select style={{ width: 90 }} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
                </Form.Item>
                <Form.Item name={`price_${region}`} noStyle>
                  <InputNumber
                    min={0}
                    step={0.01}
                    style={{ flex: 1, width: '100%' }}
                    placeholder="留空=不售卖"
                  />
                </Form.Item>
              </Space.Compact>
            </Form.Item>
          ))}
        </Form>
      </Modal>
    </Card>
  );
}
