import React, { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Divider,
  Input,
  Row,
  Space,
  Tag,
  message,
} from 'antd';
import { api } from '../api';

/**
 * 站点设置：后台可改前台的每一处文案/背书。
 * 保存后前台刷新即生效（前台读 /api/site-config；空字段回退内置默认）。
 */
interface SiteConfig {
  hero?: { badge?: string; t1?: string; t2?: string; t3?: string; pct?: string; p?: string };
  trust?: { b?: string; s?: string }[];
  announce?: string[];
  footer?: { aboutP1?: string; aboutP2?: string; g1?: string; g2?: string; g3?: string };
}

const F = ({ label, value, onChange, placeholder }: any) => (
  <div style={{ marginBottom: 12 }}>
    <div style={{ fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 4 }}>{label}</div>
    <Input value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
  </div>
);

export default function SiteSettings() {
  const [cfg, setCfg] = useState<SiteConfig>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    api<SiteConfig>('/admin/site-config')
      .then((c) => setCfg(c || {}))
      .catch((e) => message.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  const hero = cfg.hero ?? {};
  const footer = cfg.footer ?? {};
  const trust = cfg.trust ?? [];
  const announce = cfg.announce ?? [];

  const setHero = (k: string, v: string) => setCfg((c) => ({ ...c, hero: { ...c.hero, [k]: v } }));
  const setFooter = (k: string, v: string) => setCfg((c) => ({ ...c, footer: { ...c.footer, [k]: v } }));
  const setTrust = (i: number, k: 'b' | 's', v: string) =>
    setCfg((c) => {
      const arr = [...(c.trust ?? [])];
      arr[i] = { ...arr[i], [k]: v };
      return { ...c, trust: arr };
    });

  async function save() {
    setSaving(true);
    try {
      await api('/admin/site-config', { method: 'PUT', body: JSON.stringify(cfg) });
      message.success('已保存，前台刷新即生效');
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function resetAll() {
    setCfg({});
    try {
      await api('/admin/site-config', { method: 'PUT', body: JSON.stringify({}) });
      message.success('已恢复为前台内置默认文案');
    } catch (e: any) {
      message.error(e.message);
    }
  }

  return (
    <Card
      title="站点设置（改前台文案）"
      loading={loading}
      extra={
        <Space>
          <Button onClick={resetAll}>恢复默认</Button>
          <Button type="primary" loading={saving} onClick={save}>
            保存
          </Button>
        </Space>
      }
    >
      <p style={{ color: '#888', fontSize: 13 }}>
        留空 = 使用前台内置默认（含中英双语）。填写后即覆盖前台展示，无需改代码。
      </p>

      <Row gutter={24}>
        <Col xs={24} lg={12}>
          <Divider orientation="left">🦸 首页 Hero</Divider>
          <F label="徽章（右上转盘）" value={hero.badge} onChange={(v: string) => setHero('badge', v)} placeholder="SAVE ✦ UP TO 80% ✦" />
          <F label="标题第一段" value={hero.t1} onChange={(v: string) => setHero('t1', v)} placeholder="高级订阅" />
          <F label="标题第二段（描边）" value={hero.t2} onChange={(v: string) => setHero('t2', v)} placeholder=" 一起分摊" />
          <F label="标题第三段" value={hero.t3} onChange={(v: string) => setHero('t3', v)} placeholder="最高省 " />
          <F label="高亮数字" value={hero.pct} onChange={(v: string) => setHero('pct', v)} placeholder="80%" />
          <F label="副标题段落" value={hero.p} onChange={(v: string) => setHero('p', v)} placeholder="流媒体 / 音乐 / AI 工具…" />
        </Col>

        <Col xs={24} lg={12}>
          <Divider orientation="left">📊 信任背书条（4 项）</Divider>
          {[0, 1, 2, 3].map((i) => (
            <Row gutter={8} key={i} style={{ marginBottom: 8 }}>
              <Col span={10}>
                <Input
                  addonBefore={`#${i + 1} 数字`}
                  value={trust[i]?.b ?? ''}
                  placeholder={['50,000+', '99.6%', '< 60s', '7×24'][i]}
                  onChange={(e) => setTrust(i, 'b', e.target.value)}
                />
              </Col>
              <Col span={14}>
                <Input
                  addonBefore="说明"
                  value={trust[i]?.s ?? ''}
                  placeholder={['累计服务用户', '订单好评率', '平均交付时间', '在线客服支持'][i]}
                  onChange={(e) => setTrust(i, 's', e.target.value)}
                />
              </Col>
            </Row>
          ))}

          <Divider orientation="left">📣 顶部滚动公告</Divider>
          <Input.TextArea
            rows={3}
            value={announce.join('\n')}
            placeholder={'官方正版套餐\n秒级自动交付\n封号免费补发\n（每行一条，留空用默认）'}
            onChange={(e) =>
              setCfg((c) => ({
                ...c,
                announce: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean),
              }))
            }
          />
          {announce.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {announce.map((a, i) => (
                <Tag key={i}>{a}</Tag>
              ))}
            </div>
          )}
        </Col>
      </Row>

      <Divider orientation="left">🦶 页脚文案</Divider>
      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <F label="关于 · 第一句" value={footer.aboutP1} onChange={(v: string) => setFooter('aboutP1', v)} placeholder="高级订阅共享平台演示项目…" />
          <F label="关于 · 第二句" value={footer.aboutP2} onChange={(v: string) => setFooter('aboutP2', v)} placeholder="仅供学习与技术演示…" />
        </Col>
        <Col xs={24} lg={12}>
          <F label="服务保障 1" value={footer.g1} onChange={(v: string) => setFooter('g1', v)} placeholder="⚡ 自动秒发货" />
          <F label="服务保障 2" value={footer.g2} onChange={(v: string) => setFooter('g2', v)} placeholder="🛡️ 有效期内质保补发" />
          <F label="服务保障 3" value={footer.g3} onChange={(v: string) => setFooter('g3', v)} placeholder="💬 7×24 工单客服" />
        </Col>
      </Row>
    </Card>
  );
}
