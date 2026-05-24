# fedex-freight-checker / 运费核价助手

当前版本：V2.6.1-fuel-worker-2026-05-24

这是一个内部 FedEx 运费核价小工具项目。当前阶段同时维护 Excel 计算母版和 Streamlit 本地网页试算版；等真实订单校验稳定后，再考虑内网或云端访问。

## 业务范围

只包含：

- 中国 FedEx 国际出口
- FedEx 国际优先快递服务出口，即 IP
- 包裹价格
- 0.5kg-20.5kg 固定费率
- 21kg 及以上每公斤费率

不包含：

- IPE、IE
- 进口
- 第三方支付
- 重货
- 快递封、快递袋
- 税费、偏远地区附加费、特殊处理费等其它附加费

## 使用方式

先安装依赖：

```bash
python3 -m pip install -r requirements.txt
```

重新提取并校验数据：

```bash
python3 scripts/01_extract_ip_data.py
```

重新生成 Excel：

```bash
python3 scripts/02_build_excel.py
```

生成文件：

```text
outputs/运费核价助手_FedEx_IP_V2.5_网页试算版.xlsx
```

本地启动网页试算版：

```bash
streamlit run app/streamlit_app.py
```

## 输入输出

Excel 的 `calculator` sheet 输入：

- `country_dropdown`：英文 A-Z 目的地下拉，显示格式为 `English (中文)`
- `country_manual_input`：可选手动输入，填写时优先于下拉，例如 `USA`、`Germany`、`德国`
- `weight_kg`：实际重量 kg
- `fuel_surcharge_rate`：燃油附加费率，默认 0.48
- `redundancy_factor`：冗余系数，默认 1.1
- `exchange_rate_cny_usd`：汇率，默认 6.8

输出：

- `ip_zone`
- `matched_country`
- `chargeable_weight_for_lookup`
- `rate_type`
- `base_freight_cny`
- `demand_region`
- `demand_surcharge_cny`
- `freight_before_fuel_cny`
- `freight_with_fuel_cny`
- `final_cny`
- `final_usd`
- `status`

## 美国逻辑

- `U.S. Western Region` / `美国西部` = Zone 1
- `美国其他地区` = Zone 2
- 用户输入 `USA` / `United States` / `美国` 默认映射为美国其他地区 Zone 2
- 只有明确输入美国西部，或后续增加邮编判断，才映射 Zone 1

## 版本日期

- 工具版本：2026-05-24
- IP 协议价：2026-01-05
- 旺季附加费：2026-05-11，仅使用”中国大陆出口的国际货件”列
- 燃油附加费：配置化维护，当前 FedEx 49.50%，本工具 54.50%（含 5% 冗余），每周一 Cloudflare Worker 自动检查更新

## 当前数据状态

- IP 包裹固定费率：943 行，等于 41 个重量档 × 23 个 Zone
- IP 21kg+ 每公斤费率：161 行，等于 7 个重量段 × 23 个 Zone
- V1 Excel 费率表与 PDF 抽取值对比：0 个差异
- V1 Excel 国家分区表发现换行粘连风险：14 行，V2 已按 PDF 重新解析
- 需求附加费区域：210 个 OK，3 个 Need Review

## 后续网页计划

Streamlit 本地网页已读取：

- `data_processed/country_alias.csv`
- `data_processed/ip_parcel_rate_0_20_5kg.csv`
- `data_processed/ip_parcel_rate_21kg_plus.csv`

网页逻辑先复刻 Excel 的 `calculator`，不要新增业务范围。美国邮编自动分区、访问控制可以作为后续增强项。

## Cloudflare Worker 燃油费自动更新

`cloudflare/fuel-surcharge-worker/` 每周一 10:00 和 14:00（北京时间）通过 Cloudflare Cron 自动：

1. 抓取 EIA 官方 USGC 航空燃油周价格
2. 匹配 FedEx 官方燃油附加费表
3. 更新 `data_processed/rate_config.json` 并自动 push 到 GitHub
4. Streamlit Cloud 检测到 repo 变更后自动重新部署
5. 通过 Telegram Bot 通知更新结果

Worker 公开 `/fuel-current` 端点供查询，支持 `/check`、`/status`、`/stats` 等 Telegram 命令。
详见 `cloudflare/fuel-surcharge-worker/README.md`。

## 项目维护

- 运维手册：`docs/operations_manual.md`
- 发布检查清单：`docs/release_checklist.md`
- 燃油费自动更新方案：`docs/fuel_surcharge_automation_plan.md`
- 燃油费 Cloudflare 定时通知 Worker：`cloudflare/fuel-surcharge-worker/`
- 云端部署方案：`docs/deployment_plan.md`
- 每次更新价格表、需求附加费、燃油费或网页逻辑，都要更新 `CHANGELOG.md` 并提交 Git。

## 外部经验参考

调研笔记见 `docs/online_research_notes.md`。当前结论：我们的 Excel 版先坚持“协议价静态核价”，不要提前混入实时 API；网页版优先补国家/邮编校验、体积重、附加费提示和版本化数据源。
