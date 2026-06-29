# Data Version Manifest / 数据版本清单

本文档说明哪些数据是生产网页真实读取的数据，哪些只是历史加工产物。

## 当前生产版本

| 项目 | 当前值 | 来源文件 |
| --- | --- | --- |
| 网页版本 | 2026-06-29 | `vercel_app/data/rate_config.json` |
| IP / IE 协议价 | 2026-01-05 | `vercel_app/data/fedex_ip_ie_data.json` |
| 旺季附加费 | 2026-06-29 | `vercel_app/data/fedex_ip_ie_data.json` |
| 燃油适用周 | 2026-06-29 至 2026-07-05 | `vercel_app/data/rate_config.json` |
| FedEx 燃油费 | 38.50% | `vercel_app/data/rate_config.json` |
| 工具燃油费 | 41.50% | `vercel_app/data/rate_config.json` |
| 燃油冗余 | +3% | `vercel_app/data/rate_config.json` |
| 汇率 | 运行时读取 ECB，失败回退 6.8 | `vercel_app/app/api/exchange-rate/route.ts` |

## 生产数据文件

### `vercel_app/data/fedex_ip_ie_data.json`

用途：

- 国家/地区 alias
- IP / IE 分区
- IP / IE 固定费率
- IP / IE 每公斤费率
- 旺季大区和费率

这是网页报价核心数据。

### `vercel_app/data/rate_config.json`

用途：

- 网页版本日期
- 协议价日期
- 旺季附加费日期
- 当前燃油费
- `fuel_schedule`
- 默认汇率
- 燃油自动更新来源说明

这是网页版本和燃油配置核心数据。

## 历史和加工数据

| 路径 | 说明 |
| --- | --- |
| `data_raw/` | 原始 PDF 和人工提供资料 |
| `data_processed/` | CSV / JSON 中间数据，供复核和生成使用 |
| `outputs/` | 历史 Excel 输出 |
| `app/streamlit_app.py` | Streamlit 历史版本 |
| `scripts/01_*` - `07_*` | 数据提取、Excel 生成、网页 JSON 生成脚本 |

历史数据不应被生产网页直接读取。

## 健康检查

运行：

```bash
python3 scripts/08_health_check.py
```

检查内容：

- Cloudflare Worker 当前燃油周和费率
- GitHub `rate_config.json` 当前燃油周和费率
- 线上网页是否显示同样的燃油周和费率
- 汇率 API 是否可用

若健康检查失败，按顺序定位：

```text
Worker 旧 → 燃油算法 / 数据源 / Cron 问题
Worker 新、GitHub 旧 → Worker → GitHub 发布问题
GitHub 新、网页旧 → Vercel 自动部署或缓存问题
汇率旧 → 先看 ECB 原始源是否已发布新日期
```
