# fedex-freight-checker / 运费核价助手

当前版本：V3.1-web-2026-06-15

这是一个内部 FedEx 运费快速预估工具。当前主线是 Vercel / Next.js 网页版，Excel 和 Streamlit 版本保留为历史验证资产。

线上地址：

- 主网址：<https://microsensor-fedex.vercel.app/>
- 备用网址：<https://vercelapp-brown-mu.vercel.app/>

## 业务范围

包含：

- 中国 FedEx 国际出口
- FedEx IP 和 IE
- 包裹价格
- 0.5kg-20.5kg 固定费率
- 21kg 及以上每公斤费率
- 旺季附加费
- 燃油附加费
- CNY/USD 汇率

不包含：

- IPE
- 进口
- 第三方支付
- 重货
- 快递封、快递袋
- 税费、偏远地区附加费、特殊处理费等其它附加费

## 当前网页

网页目录：

```text
vercel_app/
```

本地启动：

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

部署方式：

- Vercel 项目：`microsensor-fedex`
- GitHub 有新 commit 后，Vercel 自动部署 Production
- Vercel Domains 已绑定 `microsensor-fedex.vercel.app`

## 输入输出

输入：

- `destination`：目的地，下拉或手输
- `weight_kg`：实际重量 kg，保留两位小数
- `fuel_surcharge_rate`：燃油附加费率，默认读取配置
- `markup`：冗余系数，默认 1.1
- `exchange_rate_cny_usd`：CNY/USD 汇率，默认从汇率接口读取，失败时回退配置值

输出：

- IP 报价
- IE 报价
- 匹配国家/地区
- IP / IE 分区
- 旺季大区
- 查表重量
- 基础运费 CNY
- 旺季附加费 CNY
- 燃油附加费 CNY
- 最终 CNY
- 最终 USD
- 状态：`OK` 或 `Need Review`

计算公式：

```text
Final USD = (Base Freight CNY + Seasonal Surcharge CNY) × (1 + Fuel Rate) × Markup / Exchange Rate
```

## 美国逻辑

- `U.S. Western Region` / `美国西部` = Zone 1
- `美国其他地区` = Zone 2
- 用户输入 `USA` / `United States` / `美国` 默认映射为美国其他地区 Zone 2
- 只有明确输入美国西部，或后续增加邮编判断，才映射 Zone 1

## 数据和版本

- 网页版本：2026-06-15
- IP / IE 协议价：2026-01-05
- 旺季附加费：2026-05-11
- 燃油冗余：官网燃油费 + 3%
- 当前燃油费：2026-06-15 至 2026-06-21，FedEx 43%，工具 46%
- 汇率：网页运行时读取 ECB 汇率接口，人工仍可覆盖

网页运行数据：

- `vercel_app/data/fedex_ip_ie_data.json`
- `vercel_app/data/rate_config.json`

历史加工数据：

- `data_processed/`
- `outputs/`

## 统计

网页底部显示：

- 访问人数
- 打开次数
- 试算次数

统计链路：

- 前端调用 `vercel_app/app/api/stats/route.ts`
- Vercel Serverless Function 写入 Supabase
- Supabase 表结构见 `vercel_app/supabase_usage_stats.sql`

说明：

- Vercel Analytics 用来看页面访问趋势。
- Supabase 统计用于网页底部的业务计数。
- 这两套统计口径不同，不要混用。

## 燃油费自动更新

`cloudflare/fuel-surcharge-worker/` 用于定时检查燃油费：

1. 读取 EIA 官方 USGC 航空燃油周价格
2. 套用 FedEx APAC 燃油附加费表
3. 生成当前适用周和下一适用周的燃油配置
4. 如果配置变化，提交 GitHub
5. Vercel 连接 GitHub 后，监听 GitHub commit 自动部署
6. Telegram Bot 发送检查结果

当前策略：

- 燃油费提前写入 `fuel_schedule`
- 到生效日期当天，网页按北京时间自动切换当前适用燃油费
- 网页打开时不实时抓 FedEx 或 EIA，避免首屏变慢

## 项目维护

- 运维手册：`docs/operations_manual.md`
- 发布检查清单：`docs/release_checklist.md`
- 燃油费自动更新方案：`docs/fuel_surcharge_automation_plan.md`
- Cloudflare Worker：`cloudflare/fuel-surcharge-worker/`
- 每次更新价格表、旺季附加费、燃油费、汇率逻辑或网页逻辑，都要更新 `CHANGELOG.md`

## 当前风险点

- FedEx 燃油表目前由代码推导区间，后续应沉淀成显式 JSON/CSV 表并抽查。
- 反馈留言入口暂未接数据库，当前不作为正式反馈系统。
- 超过 68kg、偏远地区、特殊处理、税费等特殊案例仍需人工复核。
