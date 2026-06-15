# Deployment Plan

## 当前目标

提供一个简单、稳定、可分享的内部网页，让用户通过链接访问 FedEx IP / IE 运费试算。

当前已采用 Vercel / Next.js，不再以 Streamlit Cloud 作为主部署方案。

## 当前部署方案

- 平台：Vercel
- 项目名：`microsensor-fedex`
- 应用目录：`vercel_app/`
- 主网址：`https://microsensor-fedex.vercel.app/`
- 备用网址：`https://vercelapp-brown-mu.vercel.app/`
- 部署触发：GitHub 主分支出现新 commit 后自动部署

重要：不要再把 Production 当作一次性 `vercel deploy` 快照维护。`vercel_app/` 必须提交到 GitHub，Vercel 项目必须连接同一个 GitHub 仓库，否则 Cloudflare Worker 自动更新燃油费后不会触发网页更新。

## 本地开发

```bash
cd vercel_app
npm install
npm run dev
```

本地验证：

```bash
cd vercel_app
npm run smoke
npm run build
```

## Vercel 配置

Build 设置：

```text
Framework Preset: Next.js
Root Directory: vercel_app
Build Command: npm run build
Install Command: npm install
Output Directory: 默认
```

Git 设置：

```text
Repository: A1exwithkey/fedex-freight-checker
Production Branch: main
Root Directory: vercel_app
```

环境变量：

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

说明：

- `SUPABASE_SERVICE_ROLE_KEY` 只放在 Vercel 环境变量里。
- 不要把 Supabase secret 写入代码、README 或截图。

## 域名

当前免费 Vercel 子域名：

```text
microsensor-fedex.vercel.app
```

Vercel 项目内路径：

```text
Project Settings -> Domains
```

如后续要绑定公司自有域名，需要在域名服务商处配置 DNS 记录，并按 Vercel 提示完成验证。

## 数据文件

网页运行需要：

```text
vercel_app/data/fedex_ip_ie_data.json
vercel_app/data/rate_config.json
```

不需要把原始 PDF 作为网页可下载资产暴露。

## 统计

当前统计方式：

- 前端记录访问和试算事件。
- `vercel_app/app/api/stats/route.ts` 写入 Supabase。
- 页面底部显示访问人数、打开次数、试算次数。
- Vercel Analytics 用来看页面访问趋势。

Supabase 表结构：

```text
vercel_app/supabase_usage_stats.sql
```

## 燃油费自动更新

当前由 Cloudflare Worker 负责：

1. 定时检查 EIA 周价格。
2. 套用 FedEx APAC 燃油表。
3. 更新 `vercel_app/data/rate_config.json`。
4. GitHub commit 触发 Vercel 自动部署。
5. Telegram 发送通知。

详见：

```text
docs/fuel_surcharge_automation_plan.md
cloudflare/fuel-surcharge-worker/README.md
```

## 反馈入口

当前网页的“反馈留言”仍不是正式反馈系统。

可选方案：

- 短期：改成邮箱提示。
- 中期：接 Supabase `feedback_messages` 表。
- 长期：做管理员页面查看和处理留言。

## 上线前检查

- `npm run smoke` 通过。
- `npm run build` 通过。
- 首页版本、协议价日期、旺季附加费日期、燃油适用周、汇率日期正确。
- 目的地下拉和手输都能工作。
- 修改重量后 IP / IE 同屏报价更新。
- 页面底部统计可读。
- 原始 PDF 没有作为公开下载入口。
- Vercel Production 部署成功。
