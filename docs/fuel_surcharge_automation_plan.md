# Fuel Surcharge Automation Plan

## 当前结论

FedEx 燃油附加费自动更新可行，但不建议只靠普通 `curl` 抓网页正文。FedEx 页面会对部分脚本请求返回拦截页，稳定方案应该优先抓官方 PDF 表，其次用浏览器自动化兜底。

## 官方来源

- FedEx 中国燃油附加费页面：`https://www.fedex.com/zh-cn/shipping/surcharges.html`
- 2026 年 5 月 APAC 燃油费表：`https://www.fedex.com/content/dam/fedex/international/rates/fedex-fuel-table-may-2026-apac.pdf`

官方页面说明：

- 燃油附加费每周调整。
- 调整通常每周一生效。
- 国际燃油费基于 USGC 航空燃油价格，并存在两周滞后。

## 当前业务口径

- FedEx 官网燃油费：48%
- 内部冗余：+5%
- 工具默认燃油附加费率：53%
- 当前页面显示的燃油版本：2026-04-06 至 2026-05-17

## 推荐云端方案

### 方案 A：Cloudflare Workers Cron + KV

适合后续云端部署。

1. Worker 每周一运行一次。
2. 周一下午或周二再跑一次兜底。
3. 抓取 FedEx 官方燃油表 PDF 或页面。
4. 解析最新适用日期和百分比。
5. 写入 Cloudflare KV：

```json
{
  "source_rate": 0.48,
  "buffer_rate": 0.05,
  "effective_rate": 0.53,
  "source_url": "https://www.fedex.com/zh-cn/shipping/surcharges.html",
  "effective_label": "2026-04-06 至 2026-05-17",
  "fetched_at": "2026-05-17T06:00:00Z"
}
```

优点：不依赖本机，适合长期运行。

风险：如果 FedEx 对 Cloudflare Worker IP 拦截，需要改用浏览器抓取或 GitHub Actions。

### 方案 B：GitHub Actions 定时抓取

适合先做 MVP。

1. GitHub Actions 每周一和周二运行。
2. 用 Python 下载官方 PDF。
3. 解析燃油表。
4. 生成 `data_processed/fuel_surcharge.json`。
5. 自动提交或打开 PR。

优点：日志清楚、失败容易看、和 Git 版本天然结合。

风险：公开仓库不适合放内部协议价；需要私有仓库。

## 建议执行顺序

1. 先做本地脚本 `scripts/03_fetch_fuel_surcharge.py`。
2. 稳定解析 PDF 后，再接 GitHub Actions。
3. 如果网页部署在 Cloudflare，再把燃油结果迁到 KV 或 D1。
4. 网页读取云端 JSON，不再硬编码 48%。

## 失败处理

- 抓取失败：保留上一次成功结果。
- 连续两次失败：页面显示 `Fuel Needs Review`。
- 解析到的费率变化超过 10 个百分点：标记人工复核。
- 每次抓取都保存来源 URL、抓取时间、适用日期和原始值。
