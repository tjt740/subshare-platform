# 阿里云自动部署

生产结构：

- `http://47.106.176.71:9999/`：用户前台
- `http://47.106.176.71:9999/admin/`：运营后台
- `http://127.0.0.1:9998/api`：NestJS API，仅服务器本机监听
- `/var/lib/subshare-platform/app.db`：持久化 SQLite 数据库
- `subshare-platform.service`：systemd 常驻与自动重启

## 本机一键部署

```bash
cp .deploy.env.example .deploy.env
npm run deploy:aliyun
```

脚本会先在本机验证三端构建，再通过 rsync 上传代码，并在服务器上安装依赖、构建、更新静态文件、写入 Nginx/systemd 配置、重启服务和执行健康检查。

后端重启后，部署脚本会等待最多 30 秒确认 `9998` 健康接口就绪，再检查 `9999` 的 Nginx 代理，避免服务启动中的短暂连接拒绝被误判为部署失败。

首次部署会在 `/etc/subshare-platform.env` 自动生成随机 `JWT_SECRET`。后续部署保留该密钥，避免已有登录令牌全部失效。

## GitHub Actions 自动部署

仓库的 `master` 或 `main` 分支有新提交时，`.github/workflows/deploy-aliyun.yml` 会自动执行。需要在 GitHub 仓库配置：

- `ALIYUN_HOST`：`47.106.176.71`
- `ALIYUN_USER`：`admin`
- `ALIYUN_PORT`：`22`
- `ALIYUN_SSH_KEY`：部署私钥全文
- `ALIYUN_DEPLOY_PATH`：`/home/admin/subshare-platform`

部署配置缺失时工作流会直接失败并指出缺少的 Secret，避免出现“工作流成功、实际没有部署”的假成功状态。

阿里云安全组只需放行入方向 TCP `9999`。API 的 `9998` 只监听 `127.0.0.1`，不应对公网开放。

## 运维检查

```bash
sudo systemctl status subshare-platform
sudo journalctl -u subshare-platform -n 100 --no-pager
sudo nginx -t
curl http://127.0.0.1:9998/api/health
curl http://127.0.0.1:9999/api/health
```
