# FedEx Fuel Surcharge Worker

这个 Cloudflare Worker 用于定时检查 FedEx 中国燃油费。它读取 EIA 官方 USGC 周价格，套用 FedEx APAC 燃油附加费表；如果结果可靠且网页配置需要更新，就自动提交 `vercel_app/data/rate_config.json`，再发 Telegram 通知。

## 口径

- EIA 来源：`https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?f=W&n=PET&s=EER_EPJK_PF4_RGC_DPG`
- FedEx 表来源：`https://www.fedex.com/content/dam/fedex/international/rates/fedex-fuel-table-may-2026-apac.pdf`
- 工具燃油费：FedEx 官方燃油费 + 3% 冗余。
- 网页读取 GitHub 仓库里的 `vercel_app/data/rate_config.json`。
- 用户打开网页时不会触发 EIA 或 FedEx 实时抓取。
- GitHub 出现新 commit 后，Vercel 自动部署。
- 抓取或匹配失败时发 `NEED_REVIEW`，不更新 GitHub 配置。

## 定时

Cloudflare Cron 使用 UTC。本项目是主发布链路，设置为：

- `0 0 * * 1`：北京时间周一 08:00
- `0 2 * * 1`：北京时间周一 10:00
- `0 4 * * 1`：北京时间周一 12:00

每次 Cron 都会读取 EIA、计算当前 FedEx 燃油费，并在 `rate_config.json` 需要变化时直接提交 GitHub。更新逻辑是幂等的，当前周已更新时不会重复提交。

GitHub Actions watchdog 仅作为独立平台兜底：

- `20 0 * * 1`：北京时间周一 08:20
- `20 4 * * 1`：北京时间周一 12:20

watchdog 会读取公开 `/fuel-current`，必要时更新 `vercel_app/data/rate_config.json` 并提交 GitHub。

## 环境变量和密钥

`wrangler.toml` 中的普通变量：

- `FUEL_BUFFER_RATE`，当前为 `0.03`

需要用 Cloudflare Secret 配置，不能写进代码：

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `MANUAL_CHECK_TOKEN`
- `GITHUB_TOKEN`

`GITHUB_TOKEN` 只需要能写入当前仓库 Contents 的权限，用于更新：

```text
vercel_app/data/rate_config.json
```

可选普通变量：

- `GITHUB_OWNER`，默认 `A1exwithkey`
- `GITHUB_REPO`，默认 `fedex-freight-checker`
- `GITHUB_BRANCH`，默认 `main`

## 部署

```bash
cd cloudflare/fuel-surcharge-worker
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID
npx wrangler secret put MANUAL_CHECK_TOKEN
npx wrangler secret put GITHUB_TOKEN
npx wrangler deploy
```

## 手动测试

部署后访问：

```text
https://<worker-url>/check?key=<MANUAL_CHECK_TOKEN>
```

需要同时发 Telegram：

```text
https://<worker-url>/check?notify=1&key=<MANUAL_CHECK_TOKEN>
```

公开燃油费检查接口：

```text
https://<worker-url>/fuel-current
```

这个接口不需要密钥，只返回公开燃油费计算结果。接口优先读 Cloudflare Cache，缓存约 6 小时；正常情况下不会因为用户打开网页而重新抓取 EIA。缓存键带版本号，避免部署后继续读到旧燃油冗余口径。

手动刷新缓存：

```text
https://<worker-url>/refresh-fuel-current?key=<MANUAL_CHECK_TOKEN>
```

手动发布到 GitHub 并通知 Telegram：

```text
https://<worker-url>/publish-fuel-config?notify=1&key=<MANUAL_CHECK_TOKEN>
```

这个接口会读取 EIA、计算燃油费、检查 GitHub 当前 `rate_config.json`，只有值变化时才提交新 commit。

返回里重点看：

- `status`
- `latest_eia_price`
- `newest_eia_price`
- `matched_fedex_table_row`
- `fedex_fuel_rate_percent`
- `tool_fuel_rate_percent`
- `github_update`

如果 `status` 是 `NEED_REVIEW`，说明没有可靠识别当前燃油费，不要更新正式报价。

## Telegram 命令

先在 BotFather 里设置命令：

```text
check - 立即检查FedEx燃油费
status - 查看当前燃油费状态
stats - 查看访问和试算次数
help - 查看使用说明
```

然后部署新版 Worker，访问：

```text
https://<worker-url>/set-telegram-webhook?key=<MANUAL_CHECK_TOKEN>
```

确认 webhook：

```text
https://<worker-url>/telegram-webhook-info?key=<MANUAL_CHECK_TOKEN>
```

当前命令：

- `/check`：立即读取 EIA 周价格并套 FedEx 表，回复燃油费。
- `/status`：返回当前燃油费状态。
- `/stats`：说明当前访问和试算统计由 Vercel API 写入 Supabase；Worker 不直接读取 Supabase。
- `/help`：返回命令说明。

## 验收标准

- `/check` 返回 `OK`。
- `/publish-fuel-config` 在有变化时能提交 GitHub。
- Telegram 能收到检查结果。
- Vercel 因 GitHub commit 自动部署。
- 网页顶部燃油适用周和费率显示正确。
