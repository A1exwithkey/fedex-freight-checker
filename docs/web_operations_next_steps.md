# Web Operations Next Steps

## 当前状态

- 网页前端由 Streamlit 托管。
- 代码由 Git 管理，并通过 GitHub 仓库部署。
- 访问次数、试算次数和留言当前写入运行环境本地 CSV，仅适合短期试用。

## 访问、试算和留言数据

短期：

- 使用本地 CSV 记录访问、试算和留言。
- 适合少量朋友试用和快速验证。
- Streamlit Cloud 重启后，本地 CSV 可能丢失。

长期：

- 改用 Google Sheet 或 Supabase 保存数据。
- Google Sheet 更适合当前阶段：低成本、容易查看、无需单独后台。
- 表建议拆为三张：`usage_events`、`feedback_messages`、`rate_update_log`。
- 如果要不丢数据，必须把访问、试算、留言写到外部存储；Streamlit Cloud 本地 CSV 只能作为临时缓存。
- 推荐下一步：创建一个只有管理员可见的 Google Sheet，并在 Streamlit Secrets 中配置服务账号凭据。

## 燃油费和旺季附加费抓取

建议流程：

1. 先做本地抓取脚本，确认能稳定解析 FedEx 页面或 PDF。
2. 将抓取结果写入 `data_processed/rate_versions.json`。
3. 网页读取 JSON，而不是在页面运行时实时抓官网。
4. 用 GitHub Actions 定时运行。

建议频率：

- 每周一抓一次。
- 每周五再抓一次，防止周一未更新或官网延迟。

GitHub 仓库权限：

- Streamlit Cloud 可以部署 private repo，但必须授权 Streamlit 访问 private repository。
- 如果 private repo 下自动部署不稳定，优先检查 Streamlit 的 GitHub 授权和 app deploy log。
- 对外试用阶段如果只追求省事，可以临时 public；正式内测再切回 private 并配置授权。

## 当前配置化方式

- 网页从 `data_processed/rate_config.json` 读取燃油费、IP 协议价日期、旺季附加费日期和网址版本。
- 手动更新燃油费时运行：

```bash
python3 scripts/05_update_fuel_config.py \
  --fedex-rate 0.5025 \
  --buffer-rate 0.05 \
  --effective-label "2026-05-18 起" \
  --note "FedEx fuel table effective May 18, 2026."
```

- 旺季附加费仍需先下载 PDF，再运行 `scripts/04_extract_demand_surcharge_pdf.py`，人工确认后推送。
