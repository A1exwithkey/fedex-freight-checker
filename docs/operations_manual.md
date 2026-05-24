# Operations Manual

## 目标

这份文档说明以后如何维护 `fedex-freight-checker`，避免价格表、需求附加费、燃油费和网页版本混在一起。

## 常规更新流程

### 1. 更新 IP 协议价

适用场景：FedEx 给了新的中国出口 IP 协议价 PDF。

1. 把新 PDF 放到 `data_raw/`。
2. 更新 `scripts/01_extract_ip_data.py` 中的源文件名和版本日期。
3. 确认仍只读取：
   - 中国 FedEx 国际出口
   - FedEx 国际优先快递服务出口 IP
   - 包裹价格
4. 运行：

```bash
python3 scripts/01_extract_ip_data.py
python3 scripts/02_build_excel.py
```

5. 检查 `data_processed/validation_checks.csv`。
6. 更新 `CHANGELOG.md` 和 `docs/version_notes/`。

### 2. 更新需求附加费

适用场景：FedEx 发布新的 Demand Surcharge / 需求附加费 PDF。

1. 把新 PDF 放到 `data_raw/`。
2. 只读取“中国大陆出口的国际货件”列。
3. 按 PDF 后面脚注的区域国家清单重建 `country_demand_region`。
4. 费率为 0 的区域，需求附加费为 0。
5. 费率大于 0 的区域，按 PDF 最低收费规则计算。
6. 匹配不到的国家/地区保留 `Need Review`，不要猜。
7. 重新生成数据和 Excel。

### 3. 更新燃油附加费

当前规则：网页按 FedEx 官网燃油费 + 5% 冗余；Excel V2.5 仍保留上一版输出，后续稳定后再同步生成 V2.6。

当前自动检查方式：

1. 读取 EIA 官方 USGC kerosene-type jet fuel 周价格。
2. 套用 FedEx 官方燃油附加费表（当前表：Effective May 18, 2026）。
3. 计算 FedEx 官网燃油费和官网 +5% 后的工具建议值。
4. 可选发送 Telegram 通知。
5. Streamlit 打开时优先读取 Cloudflare Worker `/fuel-current` 自动更新默认燃油费。
6. Worker 读取失败时保留 `data_processed/rate_config.json` 中的上一次确认值。

手动检查命令：

```bash
python3 scripts/06_check_fedex_fuel_official_sources.py
```

发送 Telegram：

```bash
TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... python3 scripts/06_check_fedex_fuel_official_sources.py --notify
```

详细方案见 `docs/fuel_surcharge_automation_plan.md`。

### 4. 更新网页

网页入口：

```bash
streamlit run app/streamlit_app.py
```

原则：

- 不扩大业务范围。
- 不增加 IPE、IE、进口、重货等服务。
- 先保持输入和输出简单。
- 销售常看的结果放上面，细节放下面。

## 发布前必须确认

- 工具版本日期已更新。
- IP 协议价日期已更新。
- 需求附加费日期已更新。
- 燃油费日期或暂定说明已更新。
- `Need Review` 项已列出。
- 默认美国逻辑仍是美国其他地区 Zone 2。

## Git 规则

每次业务规则或数据源变化，都要单独 commit。

建议 commit message：

```text
Update demand surcharge mapping from 2026-04-13 PDF
Refresh Streamlit quote layout
Add fuel surcharge source tracking
```

不要把 `.env`、密码、账号、API key 提交进 Git。
