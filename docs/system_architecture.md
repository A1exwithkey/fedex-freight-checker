# System Architecture / 系统架构

本文档定义当前项目主线，避免 Excel、Streamlit、Next.js、Cloudflare Worker 等历史阶段混在一起。

## 当前定位

`fedex-freight-checker` 是一个内部 FedEx 运费快速预估工具。当前生产主线是：

```text
Vercel / Next.js 网页
+ JSON 费率数据
+ Supabase 轻量统计
+ Cloudflare Worker 燃油自动更新
```

Excel 和 Streamlit 版本只作为历史验证资产，不再作为生产入口。

## 主线目录

| 目录 / 文件 | 作用 | 是否生产主线 |
| --- | --- | --- |
| `vercel_app/` | Next.js 网页应用 | 是 |
| `vercel_app/data/fedex_ip_ie_data.json` | IP / IE 报价核心数据 | 是 |
| `vercel_app/data/rate_config.json` | 网页版本、燃油、汇率默认值 | 是 |
| `vercel_app/lib/calculator.ts` | 运费核价核心计算逻辑 | 是 |
| `vercel_app/app/api/exchange-rate/route.ts` | 汇率接口 | 是 |
| `vercel_app/app/api/stats/route.ts` | Supabase 统计接口 | 是 |
| `cloudflare/fuel-surcharge-worker/` | 燃油费自动检查和发布 | 是 |
| `scripts/08_health_check.py` | 线上健康检查 | 是 |
| `data_processed/` | 历史加工数据和中间产物 | 否，参考 |
| `app/streamlit_app.py` | Streamlit 历史版本 | 否，归档候选 |
| `scripts/01_*` - `07_*` | PDF/Excel/JSON 加工脚本 | 部分，仅数据更新时使用 |

## 分层架构

### 前端层

- `vercel_app/app/page.tsx`
- `vercel_app/app/globals.css`

负责页面展示、用户输入、IP/IE 报价结果、版本信息和统计展示。

### 业务逻辑层

- `vercel_app/lib/calculator.ts`

负责国家匹配、分区匹配、固定费率、每公斤费率、旺季附加费、燃油费、冗余和汇率换算。

### 数据层

- `vercel_app/data/fedex_ip_ie_data.json`
- `vercel_app/data/rate_config.json`
- Supabase `usage_visitors` / `usage_events`

网页运行时只应依赖 `vercel_app/data/` 和 API，不应读取 `data_processed/`。

### 集成层

- Vercel：网页部署
- GitHub：代码和配置版本
- Cloudflare Worker：燃油费定时检查和自动发布
- Supabase：访问和试算统计
- Telegram：燃油检查通知
- ECB：汇率来源
- EIA + FedEx 燃油表：燃油费来源

### 配置层

- `vercel_app/data/rate_config.json`
- `cloudflare/fuel-surcharge-worker/wrangler.toml`
- Vercel Environment Variables
- Cloudflare Secrets

任何 secret 不得写入代码、日志、文档或提交记录。

## 关键数据流

### 用户报价

```text
目的地 + 重量
→ alias 匹配
→ 国家/地区 + Zone
→ IP/IE 费率表
→ 旺季附加费
→ 燃油费
→ 冗余系数
→ 汇率
→ 最终 CNY / USD
```

### 燃油自动更新

```text
Cloudflare Cron
→ EIA 周价格
→ FedEx APAC 燃油表
→ 当前适用周燃油费
→ 更新 GitHub rate_config.json
→ Vercel 自动部署
→ 网页显示新燃油费
```

## AI 参与边界

生产运行时没有 AI 参与。AI 只用于开发、排查、数据整理、文档和自动化辅助。报价计算必须保持确定性。

## 维护原则

- 生产主线只看 `vercel_app/` 和 `cloudflare/fuel-surcharge-worker/`。
- 改业务规则必须跑 `npm run smoke` 和 `npm run build`。
- 改燃油自动化必须跑 `scripts/08_health_check.py`。
- 新数据先进入结构化 JSON，再进入网页。
- 不在用户打开网页时抓 FedEx / EIA，避免首屏变慢。
