# Fuel Surcharge Automation Plan

## 当前结论

FedEx 燃油附加费自动检查可行，但现阶段只做“抓取 + Telegram 通知 + 人工确认”，不自动修改正式报价。

2026-05-24 口径调整：

- Cloudflare Worker 每周一北京时间 10:00 和 14:00 各检查一次。
- 当前方案不再抓 FedEx 页面当前行，而是读取 EIA 官方 USGC 周价格，并套用 FedEx 官方燃油附加费表。
- 2026-05-24 实测：Cloudflare Browser Rendering 能启动浏览器，但 FedEx 返回 `It appears you don't have permission to view this webpage`，因此不能作为稳定抓取入口。
- 当前可用方向：`scripts/06_check_fedex_fuel_official_sources.py` 和 `cloudflare/fuel-surcharge-worker/`。
- 抓到燃油费后发 Telegram，人工确认后再更新 `data_processed/rate_config.json`。
- 抓不到或返回 `FedEx | System Down` 时发 `NEED_REVIEW`，网站继续使用上一次确认值。

注意：FedEx 页面会对部分脚本请求返回拦截页，所以自动检查必须判断页面标题、页面长度、关键词和是否解析到可靠日期区间，不允许只看 HTTP 200。

2026-05-20 实测：

- `scripts/03_probe_fedex_surcharges.py` 可以发起请求并写出结构化 JSON。
- 普通 Python HTTP 请求访问 FedEx 燃油费页面、旺季附加费页面和对应 PDF 时，FedEx 返回 `FedEx | System Down` HTML，而不是有效业务页面或 PDF。
- 因此首版自动化不能只依赖 `urllib` / `requests`。需要增加浏览器抓取、人工确认或第三方稳定抓取环境。
- `data_processed/fedex_surcharge_probe.json` 保留本次探测结果，作为后续排查依据。

## 官方来源

- FedEx 中国燃油附加费页面：`https://www.fedex.com/zh-cn/shipping/surcharges.html`
- FedEx 中国燃油附加费英文页面：`https://www.fedex.com/en-cn/shipping/surcharges.html`
- FedEx 燃油附加费表 PDF：`https://www.fedex.com/content/dam/fedex/international/rates/fedex-fuel-table-may-2026-apac.pdf`
- EIA USGC Kerosene-Type Jet Fuel 周价格：`https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?f=W&n=PET&s=EER_EPJK_PF4_RGC_DPG`
- FedEx 中国旺季附加费页面：`https://www.fedex.com/en-cn/shipping/surcharges/demand-surcharge.html`
- 2026 年 5 月旺季附加费 PDF：`https://www.fedex.com/content/dam/fedex/international/rates/fedex-ds-2026-may9-638-en-cn.pdf`

官方页面说明：

- 燃油附加费每周调整。
- 调整通常每周一生效。
- 国际燃油费基于 USGC 航空燃油价格，并存在两周滞后。

## 当前业务口径

- FedEx 官网燃油费：48%
- 内部冗余：+5%
- 工具默认燃油附加费率：53%
- 当前页面显示的燃油版本：2026-04-06 至 2026-05-17

## 当前云端方案

### EIA 周价格 + FedEx 官方燃油表

已新增脚本：`scripts/06_check_fedex_fuel_official_sources.py`

用途：

- 读取 EIA 官方 USGC kerosene-type jet fuel 周价格。
- 套用 FedEx 官方燃油附加费表。
- 计算 FedEx 官网燃油费和官网 +5% 后的工具建议值。
- 可选发送 Telegram。

手动检查：

```bash
python3 scripts/06_check_fedex_fuel_official_sources.py
```

发送 Telegram：

```bash
TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... python3 scripts/06_check_fedex_fuel_official_sources.py --notify
```

### Cloudflare Workers Cron + Telegram

已新增目录：`cloudflare/fuel-surcharge-worker/`，当前正式用途是读取 EIA 周价格并套用 FedEx 官方燃油表后发送 Telegram。它不再访问 FedEx 页面当前行。

同时提供公开接口：

```text
https://fedex-fuel-surcharge-checker.a1exwithkey.workers.dev/fuel-current
```

Streamlit 打开时优先读取这个接口更新默认燃油费；接口失败时回退到 `data_processed/rate_config.json`。

运行规则：

- `0 2 * * 1`：北京时间周一 10:00
- `0 6 * * 1`：北京时间周一 14:00

Worker 输出：

- `OK`：识别到 EIA 周价格，并匹配到 FedEx 表区间。
- `NEED_REVIEW`：未识别到 EIA 周价格，或价格超出 FedEx 表区间。

Telegram 通知内容：

- EIA 周结束日
- EIA 周价格
- FedEx 适用周
- FedEx 表区间
- 官网燃油费
- 工具建议值，即官网燃油费 + 5% 冗余
- 异常原因

需要配置的 Cloudflare Secret：

```text
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
MANUAL_CHECK_TOKEN
```

部署命令见 `cloudflare/fuel-surcharge-worker/README.md`。

### 后续可选：统计持久化

访问次数、试算次数和留言如果要跨 Streamlit 重启保留，需要迁到 Cloudflare KV/D1 或其它外部存储。燃油费通知本身不会触发 Streamlit 重新部署。

## 旧方案记录

GitHub Actions 方案仍保留为探测记录，但当前优先使用 Cloudflare Worker 做 Telegram 通知。GitHub Actions 不作为燃油费正式更新入口。

## 建议执行顺序

1. 部署 Cloudflare Worker。
2. 手动访问 `/check`，确认 EIA 周价格和 FedEx 表匹配结果。
3. 如果结果为 `OK`，启用 Telegram 通知。
4. 每周一 10:00 和 14:00 自动检查。
5. 人工确认后，用 `scripts/05_update_fuel_config.py` 更新正式燃油费配置并部署网站。

## 失败处理

- 抓取失败：保留上一次成功结果。
- 连续两次失败：页面显示 `Fuel Needs Review`。
- 解析到的费率变化超过 10 个百分点：标记人工复核。
- 每次抓取都保存来源 URL、抓取时间、适用日期和原始值。
