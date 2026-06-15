# Fuel Surcharge Automation Plan

## 当前结论

FedEx 燃油附加费自动检查采用：

```text
EIA USGC 周价格 + FedEx APAC 燃油表 + Cloudflare Worker + GitHub commit + Vercel 自动部署 + Telegram 通知
```

网页不会在用户打开时实时抓 FedEx 或 EIA。燃油费写入 `vercel_app/data/rate_config.json`，Vercel 部署后随静态配置一起发布。

## 当前业务口径

- FedEx 官方燃油费：按 FedEx APAC 燃油表匹配。
- 内部冗余：+3%。
- 网页默认燃油附加费率：`FedEx 官方燃油费 + 3%`。
- 网页按北京时间从 `fuel_schedule` 选择当前适用周。
- 可提前写入下一周配置，到生效日当天自动切换。

## 官方来源

- FedEx 中国燃油附加费页面：`https://www.fedex.com/zh-cn/shipping/surcharges.html`
- FedEx 中国燃油附加费英文页面：`https://www.fedex.com/en-cn/shipping/surcharges.html`
- FedEx 燃油附加费表 PDF：`https://www.fedex.com/content/dam/fedex/international/rates/fedex-fuel-table-may-2026-apac.pdf`
- EIA USGC Kerosene-Type Jet Fuel 周价格：`https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?f=W&n=PET&s=EER_EPJK_PF4_RGC_DPG`

说明：

- FedEx 燃油附加费每周调整。
- 调整通常每周一生效。
- 国际燃油费基于 USGC 航空燃油价格，并存在两周滞后。
- FedEx 页面会对部分脚本请求返回拦截页，所以当前不把 FedEx 页面当前行作为唯一自动抓取源。

## 当前实现

### 本地复核脚本

脚本：

```text
scripts/06_check_fedex_fuel_official_sources.py
```

用途：

- 读取 EIA 官方 USGC 周价格。
- 套用 FedEx APAC 燃油表。
- 输出 FedEx 适用周、官方燃油费和工具燃油费。
- 可选发送 Telegram 通知。

运行：

```bash
python3 scripts/06_check_fedex_fuel_official_sources.py
```

### Cloudflare Worker

目录：

```text
cloudflare/fuel-surcharge-worker/
```

用途：

1. 定时读取 EIA 周价格。
2. 套用 FedEx APAC 燃油表。
3. 生成燃油配置。
4. 如果 `vercel_app/data/rate_config.json` 需要更新，提交 GitHub commit。
5. 通过 Telegram 发送检查结果。

关键接口：

```text
/fuel-current
/check?key=<MANUAL_CHECK_TOKEN>
/publish-fuel-config?notify=1&key=<MANUAL_CHECK_TOKEN>
/set-telegram-webhook?key=<MANUAL_CHECK_TOKEN>
/telegram-webhook-info?key=<MANUAL_CHECK_TOKEN>
/telegram
```

`/fuel-current` 是公开检查接口。网页不依赖它加载首屏。

## 定时规则

Cloudflare Cron 使用 UTC：

- `0 2 * * 1`：北京时间周一 10:00
- `0 6 * * 1`：北京时间周一 14:00

这两个时间点用于确认本周或下周燃油费是否已经可计算。若配置有变化，Worker 会提交 GitHub。

## GitHub / Vercel 链路

Worker 更新的文件：

```text
vercel_app/data/rate_config.json
```

更新方式：

1. Worker 通过 GitHub Contents API 读取当前文件。
2. 生成新的 `fuel_schedule`。
3. 如果内容变化，提交 commit 到主分支。
4. Vercel 监听 GitHub commit。
5. Vercel 自动部署 Production。
6. 网页顶部显示新的燃油适用周和燃油费率。

## Telegram 通知

通知内容：

- 检查状态：`OK` 或 `NEED_REVIEW`
- EIA 周结束日
- EIA 周价格
- FedEx 适用周
- FedEx 表区间
- FedEx 官方燃油费
- 工具燃油费：官方燃油费 + 3% 冗余
- GitHub 更新状态

命令：

```text
/check
/status
/stats
/help
```

说明：

- `/check` 和 `/status` 只返回燃油检查结果。
- `/stats` 只提示当前统计由 Vercel API 写入 Supabase，Worker 不直接读取 Supabase。

## 需要配置的 Secret

Cloudflare Secret：

```text
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
MANUAL_CHECK_TOKEN
GITHUB_TOKEN
```

可选变量：

```text
GITHUB_OWNER
GITHUB_REPO
GITHUB_BRANCH
FUEL_BUFFER_RATE
```

`GITHUB_TOKEN` 只需要当前仓库 Contents 写权限。不要写进代码或文档。

## 失败处理

- EIA 抓取失败：不更新 GitHub，Telegram 发送 `NEED_REVIEW`。
- FedEx 表区间未匹配：不更新 GitHub，Telegram 发送 `NEED_REVIEW`。
- GitHub 更新失败：Telegram 显示失败原因，网页继续使用上一次部署配置。
- 解析到的费率变化异常大时，应人工复核后再接受。

## 已知风险

- FedEx 燃油表目前由代码推导区间，后续应沉淀成显式 JSON/CSV 表并抽查。
- Cloudflare Worker 是否能稳定提交 GitHub，依赖 `GITHUB_TOKEN` 权限和有效期。
- Vercel 自动部署依赖 GitHub 集成状态。

## 验收标准

1. `/check` 返回 `OK`。
2. `/publish-fuel-config?notify=1&key=...` 在有变化时能提交 GitHub。
3. Telegram 能收到检查结果。
4. Vercel 能因 GitHub commit 自动部署。
5. 网页顶部燃油适用周和燃油费率更新正确。
