# FedEx Fuel Surcharge Worker

这个 Cloudflare Worker 只做一件事：定时读取 EIA 官方 USGC 周价格，再套用 FedEx 官方燃油附加费表，算出当前 FedEx 中国燃油费；如果结果可靠且和 GitHub 当前配置不同，就自动提交 `data_processed/rate_config.json`，再发 Telegram 通知。

## 口径

- EIA 来源：`https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?f=W&n=PET&s=EER_EPJK_PF4_RGC_DPG`
- FedEx 表来源：`https://www.fedex.com/content/dam/fedex/international/rates/fedex-fuel-table-may-2026-apac.pdf`
- Streamlit 仍只读取 GitHub 仓库里的 `data_processed/rate_config.json`，不在用户打开网页时抓 EIA 或请求 Worker。
- Worker 通过 GitHub API 更新配置文件；GitHub 出现新 commit 后，由 Streamlit 自动重新部署。
- 抓取或匹配失败时发 `NEED_REVIEW`，不更新 GitHub 配置。

## 定时

Cloudflare Cron 使用 UTC。本项目设置为：

- `0 2 * * 1`：北京时间周一 10:00
- `0 6 * * 1`：北京时间周一 14:00

## 环境变量和密钥

`wrangler.toml` 中的普通变量：

- `FUEL_BUFFER_RATE`

需要用 Cloudflare Secret 配置，不能写进代码：

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `MANUAL_CHECK_TOKEN`
- `GITHUB_TOKEN`：只需要能写入当前仓库 Contents 的 token，用于更新 `data_processed/rate_config.json`

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

网页自动燃油费接口：

```text
https://<worker-url>/fuel-current
```

这个接口不需要密钥，只返回公开燃油费计算结果，供 Streamlit 读取默认燃油费。接口优先读 Cloudflare Cache，正常情况下不会因为用户打开网页而重新抓取 EIA。

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
- `/stats`：统计持久化接入 D1 前，只提示待接入。
- `/help`：返回命令说明。
