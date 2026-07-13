import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Divider,
  Input,
  Row,
  Segmented,
  Space,
  Tag,
  message,
} from 'antd';
import { api, getProfile } from '../api';

interface SiteConfig {
  hero?: { badge?: string; t1?: string; t2?: string; t3?: string; pct?: string; p?: string };
  trust?: { b?: string; s?: string }[];
  announce?: string[];
  footer?: { aboutP1?: string; aboutP2?: string; g1?: string; g2?: string; g3?: string };
  legal?: Record<string, unknown>;
}
interface Revision {
  id: number;
  config: SiteConfig;
  status: 'pending' | 'approved' | 'rejected';
  submittedByEmail: string;
  reviewedByEmail?: string | null;
  reviewNote: string;
  createdAt: string;
  reviewedAt?: string | null;
}
interface Workspace {
  published: SiteConfig;
  revisions: Revision[];
}

const F = ({ label, value, onChange, placeholder }: any) => (
  <div style={{ marginBottom: 12 }}>
    <div style={{ fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 4 }}>{label}</div>
    <Input value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
  </div>
);

export default function SiteSettings() {
  const [workspace, setWorkspace] = useState<Workspace>({ published: {}, revisions: [] });
  const [cfg, setCfg] = useState<SiteConfig>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState<'桌面' | '手机'>('桌面');
  const [reviewNote, setReviewNote] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const profile = getProfile();
  const isSuper = profile?.role === 'super';

  const previewUrl = useMemo(() => {
    const custom = (import.meta as any).env?.VITE_SITE_PREVIEW_URL;
    if (custom) return custom;
    if (window.location.port === '5174') return 'http://localhost:5173/';
    return `${window.location.origin}/`;
  }, []);
  const previewOrigin = useMemo(() => new URL(previewUrl).origin, [previewUrl]);

  const pushPreview = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'SUBSHARE_SITE_PREVIEW', config: cfg },
      previewOrigin,
    );
  }, [cfg, previewOrigin]);

  useEffect(pushPreview, [pushPreview]);

  const load = useCallback(() => {
    setLoading(true);
    api<Workspace>('/admin/site-config')
      .then((data) => {
        setWorkspace(data);
        setCfg(data.published || {});
      })
      .catch((e) => message.error(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const hero = cfg.hero ?? {};
  const footer = cfg.footer ?? {};
  const trust = cfg.trust ?? [];
  const announce = cfg.announce ?? [];
  const setHero = (k: string, v: string) => setCfg((c) => ({ ...c, hero: { ...c.hero, [k]: v } }));
  const setFooter = (k: string, v: string) => setCfg((c) => ({ ...c, footer: { ...c.footer, [k]: v } }));
  const setTrust = (i: number, k: 'b' | 's', v: string) => setCfg((c) => {
    const arr = [...(c.trust ?? [])];
    arr[i] = { ...arr[i], [k]: v };
    return { ...c, trust: arr };
  });

  async function submitForReview() {
    setSaving(true);
    try {
      await api('/admin/site-config/revisions', {
        method: 'POST',
        body: JSON.stringify({ config: cfg }),
      });
      message.success('修改单已提交，等待超级管理员审核；正式前台尚未改变');
      load();
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function review(id: number, approve: boolean) {
    try {
      const data = await api<Workspace>(`/admin/site-config/revisions/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({ approve, reviewNote }),
      });
      setWorkspace(data);
      if (approve) setCfg(data.published || {});
      setReviewNote('');
      message.success(approve ? '审核通过，正式前台已发布' : '修改单已驳回');
    } catch (e: any) {
      message.error(e.message);
    }
  }

  return (
    <div>
      <Card
        title="站点管理 · 编辑与审核发布"
        loading={loading}
        extra={
          <Space wrap>
            <Tag color="green">右侧实时预览不影响正式站点</Tag>
            <Button onClick={() => setCfg(workspace.published || {})}>撤销本地修改</Button>
            <Button onClick={() => setCfg({})}>恢复内置默认（预览）</Button>
            <Button type="primary" loading={saving} onClick={submitForReview}>提交超级管理员审核</Button>
          </Space>
        }
      >
        <Row gutter={20} align="top">
          <Col xs={24} xl={10}>
            <div style={{ maxHeight: 'calc(100vh - 190px)', overflowY: 'auto', paddingRight: 8 }}>
              <div style={{ background: '#f6f8ff', borderRadius: 10, padding: 12, fontSize: 12.5 }}>
                工作流：左侧编辑 → 右侧实时预览 → 提交修改单 → 超级管理员审核 → 审核通过后正式发布。
              </div>
              <Divider orientation="left">🦸 首页 Hero</Divider>
              <F label="徽章" value={hero.badge} onChange={(v: string) => setHero('badge', v)} placeholder="SAVE ✦ UP TO 80% ✦" />
              <F label="标题第一段" value={hero.t1} onChange={(v: string) => setHero('t1', v)} placeholder="高级订阅" />
              <F label="标题第二段" value={hero.t2} onChange={(v: string) => setHero('t2', v)} placeholder="一起分摊" />
              <F label="标题第三段" value={hero.t3} onChange={(v: string) => setHero('t3', v)} placeholder="最高省" />
              <F label="高亮数字" value={hero.pct} onChange={(v: string) => setHero('pct', v)} placeholder="80%" />
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 4 }}>副标题段落</div>
                <Input.TextArea rows={3} value={hero.p ?? ''} onChange={(e) => setHero('p', e.target.value)} />
              </div>

              <Divider orientation="left">📊 信任背书</Divider>
              {[0, 1, 2, 3].map((i) => (
                <Row gutter={8} key={i} style={{ marginBottom: 8 }}>
                  <Col span={9}><Input addonBefore={`#${i + 1}`} value={trust[i]?.b ?? ''} onChange={(e) => setTrust(i, 'b', e.target.value)} /></Col>
                  <Col span={15}><Input addonBefore="说明" value={trust[i]?.s ?? ''} onChange={(e) => setTrust(i, 's', e.target.value)} /></Col>
                </Row>
              ))}

              <Divider orientation="left">📣 顶部公告</Divider>
              <Input.TextArea
                rows={4}
                value={announce.join('\n')}
                placeholder="每行一条公告"
                onChange={(e) => setCfg((c) => ({ ...c, announce: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) }))}
              />

              <Divider orientation="left">🦶 页脚</Divider>
              <F label="关于第一句" value={footer.aboutP1} onChange={(v: string) => setFooter('aboutP1', v)} />
              <F label="关于第二句" value={footer.aboutP2} onChange={(v: string) => setFooter('aboutP2', v)} />
              <F label="服务保障 1" value={footer.g1} onChange={(v: string) => setFooter('g1', v)} />
              <F label="服务保障 2" value={footer.g2} onChange={(v: string) => setFooter('g2', v)} />
              <F label="服务保障 3" value={footer.g3} onChange={(v: string) => setFooter('g3', v)} />
            </div>
          </Col>

          <Col xs={24} xl={14}>
            <div style={{ position: 'sticky', top: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <b>👁 真实前台实时预览</b>
                <Segmented value={previewMode} onChange={(value) => setPreviewMode(value as '桌面' | '手机')} options={['桌面', '手机']} />
              </div>
              <div style={{ background: '#e8eaf0', border: '1px solid #d5d8e2', borderRadius: 12, padding: 10, minHeight: 660, display: 'flex', justifyContent: 'center' }}>
                <iframe
                  ref={iframeRef}
                  title="SubShare 前台实时预览"
                  src={previewUrl}
                  onLoad={pushPreview}
                  style={{
                    width: previewMode === '手机' ? 390 : '100%',
                    height: 640,
                    border: 0,
                    borderRadius: 8,
                    background: '#fff',
                    transition: 'width .2s ease',
                  }}
                />
              </div>
            </div>
          </Col>
        </Row>
      </Card>

      <Card title="站点修改审核记录" style={{ marginTop: 16 }}>
        {isSuper && <Input.TextArea rows={2} value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} placeholder="审核意见（通过或驳回时记录）" style={{ marginBottom: 12 }} />}
        {workspace.revisions.length === 0 ? <div style={{ color: '#999' }}>暂无修改单</div> : workspace.revisions.map((revision) => (
          <div key={revision.id} style={{ display: 'flex', gap: 12, alignItems: 'center', borderBottom: '1px solid #f0f0f0', padding: '10px 0' }}>
            <b>#{revision.id}</b>
            <Tag color={revision.status === 'approved' ? 'green' : revision.status === 'rejected' ? 'red' : 'gold'}>{revision.status === 'approved' ? '已通过' : revision.status === 'rejected' ? '已驳回' : '待审核'}</Tag>
            <span>{revision.submittedByEmail}</span>
            <span style={{ color: '#888' }}>{new Date(revision.createdAt).toLocaleString('zh-CN')}</span>
            {revision.reviewedByEmail && <span style={{ color: '#888' }}>审核：{revision.reviewedByEmail}</span>}
            {revision.reviewNote && <span style={{ color: '#666' }}>意见：{revision.reviewNote}</span>}
            <div style={{ marginLeft: 'auto' }}>
              <Space>
                <Button size="small" onClick={() => setCfg(revision.config)}>载入预览</Button>
                {isSuper && revision.status === 'pending' && <>
                  <Button size="small" type="primary" onClick={() => review(revision.id, true)}>通过并发布</Button>
                  <Button size="small" danger onClick={() => review(revision.id, false)}>驳回</Button>
                </>}
              </Space>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
