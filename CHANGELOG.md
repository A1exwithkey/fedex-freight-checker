# CHANGELOG

## V2.6.0-web-polish-2026-05-20 - 2026-05-20

- 网页计算接入 `demand_surcharge_latest.csv`，旺季附加费更新为 2026-05-11 版本。
- 新增 `data_processed/rate_config.json` 和 `scripts/05_update_fuel_config.py`，燃油费改为配置化更新，当前 FedEx 燃油费率为 48.75%，加 5% 冗余后默认 53.75%。
- 更新通知补充 V1 / V1.1 版本说明。
- 页面整体上移，反馈留言文案精简，基础运费计算表格数值统一两位小数。
- 新增 `scripts/04_extract_demand_surcharge_pdf.py`，用于从本地 FedEx 旺季附加费 PDF 提取中国大陆出口费率摘要。
- 新增 `scripts/03_probe_fedex_surcharges.py`，用于探测 FedEx 燃油费和旺季附加费页面、PDF 链接和版本日期。
- 网页版本更新为 `2026-05-20`。
- 页面文案统一将“需求附加费”改为“旺季附加费”。
- 顶部版本说明改为：网址版本、IP 协议价、旺季附加费、燃油费和燃油附加费率。
- 优化内部预估免责声明，补充超过 68kg、偏远地区、特殊处理、税费等特殊案例需单独复核。
- 试算次数改为用户实际修改输入后才记录，避免打开网页即计入试算。
- 反馈留言从邮件入口改为页面内留言入口，支持发送留言、点赞和删除本人留言。
- 基础运费计算表格改为统一左对齐展示。
- 新增 `docs/web_operations_next_steps.md`，记录访问统计、留言、燃油费和旺季附加费自动更新的后续方案。

## V2.5.0-local-web-trial-2026-05-17 - 2026-05-17

- 反馈留言改为引导用户发送邮件至 `ethan.du@microsensor.cn`。
- 云端试用版新增页面底部轻量统计，显示总访问次数、试算次数和最近使用记录，不展示英文后台表格。
- 使用日志按固定字段写入，避免访问记录和试算记录字段不同导致页面报错。
- 新增 `.streamlit/config.toml`，为云端试用版设置基础页面配置。
- 新增 `docs/deployment_plan.md`，记录最小云端部署方案。
- Streamlit 网页燃油费口径改为 FedEx 官网 48% + 5% 冗余，默认输入值为 53%。
- 页面顶部和输入区增加燃油来源说明：FedEx 中国燃油附加费页面，当前采用 2026-04-06 至 2026-05-17 版本。
- 修正目的地下拉和手输逻辑：最后改动的输入源优先。
- 报价结果新增最终 CNY，并将指标顺序调整为最终 USD、最终 CNY、基础运费、燃油附加费、需求附加费。
- 将“自动匹配”区域改名为“基础运费计算”，并展示基础运费算法。
- 输入区自动带出 IP Zone、需求附加费大区和预计需求附加费。
- 顶部新增“更新通知”和“反馈留言”轻量入口。
- 将“更新通知”和“反馈留言”移到标题同一行右上角，更新通知简化为“5月17日发布第一个版本”。
- 页面顶部新增内部预估免责声明。
- 新增 `docs/fuel_surcharge_automation_plan.md`，记录燃油费云端定时抓取方案。
- 新增项目正式化文档：`docs/operations_manual.md` 和 `docs/release_checklist.md`。
- 新增 `data_raw/FEDEX需求附加费-2026.4.13日生效至另行通知.pdf`。
- 需求附加费改用 2026-04-13 PDF，只读取“中国大陆出口的国际货件”列。
- 更新需求附加费区域费率：美国和波多黎各 0、加拿大 0、墨西哥 0、亚洲 0、澳新 0、印度 0、欧洲 8.0、以色列 24.0、MEISA 11.2、LAC 0。
- 需求附加费最低收费规则改为：费率大于 0 时按 `MAX(weight × rate, 1.80)`；费率为 0 时需求附加费为 0。
- Excel `calculator` 调整为四块：输入区、自动匹配区、报价结果、版本信息。
- Excel 顶部显示工具版本、IP 协议价日期、需求附加费日期和燃油费维护说明。
- Streamlit 本地网页从占位原型升级为可试算版本，支持目的地下拉、手输、重量、燃油、冗余、汇率和结果展示。
- Netherlands Antilles、Syrian Arab Republic、Yemen 仍保留 `Need Review`，不硬猜。
- 输出文件更新为 `outputs/运费核价助手_FedEx_IP_V2.5_网页试算版.xlsx`。

## V2.4.0-horizontal-quote-panel - 2026-05-16

- 将 `calculator` 从竖向输入/输出改为横向报价面板。
- 目的地下拉改为按英文 A-Z 排序，显示格式为 `English (中文)`。
- 下拉列表剔除美国西部邮编州行，仅保留国家/地区和美国西部汇总项。
- 顶部输入区保留目的地、手输、重量、燃油、冗余、汇率、旺季最低收费。
- 自动匹配区横向展示匹配国家、IP 分区、旺季大区、旺季费率、基础运费、旺季附加费、最终 USD。
- 字段名和公式行隐藏，保留可复核能力但不干扰使用。
- 旺季最低收费默认留空；空白时按 `实际重量 × 旺季费率` 计算。
- 修正美国西部旺季大区为北美区。
- 输出文件更新为 `outputs/运费核价助手_FedEx_IP_V2.4_横向报价版.xlsx`。

## V2.3.0-demand-surcharge - 2026-05-16

- 新增 FedEx Demand Surcharge 旺季附加费逻辑。
- 新增结构化数据：`demand_surcharge_rates.csv` 和 `country_demand_region.csv`。
- `country_alias` 增加旺季区域、区域代码、每公斤费率、最低收费、校验状态字段。
- Excel 计算器新增旺季附加费区域、旺季费率、旺季附加费、含旺季基础运费。
- 计算公式调整为：`(Base Freight CNY + Demand Surcharge CNY) × (1 + Fuel Rate) × Redundancy Factor ÷ Exchange Rate`。
- 旺季附加费按 `MAX(weight_kg × rate_cny_per_kg, minimum_cny)` 计算，默认最低 RMB 7.2/票。
- FedEx 官方旺季区域未明确列出的 Netherlands Antilles、Syrian Arab Republic、Yemen 保留 `Need Review`，不硬猜。
- Streamlit 原型同步加入旺季附加费计算。
- 输出文件更新为 `outputs/运费核价助手_FedEx_IP_V2.3_旺季附加费版.xlsx`。

## V2.2.0-excel-dropdown-fix - 2026-05-16

- 修正 Excel 计算器交互：新增中文目的地下拉，保留可选手动输入；手动输入优先于下拉。
- 将默认燃油附加费率从 18% 改为 48%。
- 将“安全系数”改名为“冗余系数”。
- 公式改用更传统的 `VLOOKUP` / `SUMIFS`，去掉 `XLOOKUP` / `LET`，降低打开修复和旧版兼容风险。
- 将字体改为 Calibri 风格，减少宋体感。
- 修复 PDF 换行导致的中文国家/地区名称内部空格，例如“中国香港特别行政区”。
- 新增隐藏数据源 sheet `country_dropdown`，下拉使用命名区域 `country_dropdown_list`。
- 输出文件更新为 `outputs/运费核价助手_FedEx_IP_V2.2_下拉修正版.xlsx`。

## V2.1.0-excel-ui-reference - 2026-05-16

- 根据外部同类工具经验新增 `docs/online_research_notes.md`。
- Excel 默认输出更新为 `outputs/运费核价助手_FedEx_IP_V2.1_中文美化版.xlsx`。
- 将 `calculator` 调整为第一个 sheet，打开文件后优先看到计算器。
- 计算器界面中文优先，保留英文字段名和公式文本，方便后续转 Python / Streamlit。
- 调整字体、列宽、填色、边框、冻结窗格和最终 USD 结果高亮。
- `country_zone_ip` Excel 展示改为中文显示名优先，同时保留英文/中文/Zone/页码/校验状态字段。
- 不改变核心数据抽取逻辑和计算公式。

## V2.0.0-excel-master - 2026-05-16

- 建立 `fedex-freight-checker` 项目结构。
- 将原始 PDF 和 V1 Excel 纳入 `data_raw/`。
- 新增 `scripts/01_extract_ip_data.py`，从 PDF 第 7-10 页提取 IP 包裹费率，从第 20-24 页提取 IP Zone。
- 新增 `scripts/02_build_excel.py`，从 `data_processed/fedex_ip_data.json` 生成 Excel 母版。
- 输出结构化 CSV/JSON 数据，便于后续 Streamlit 读取。
- 生成优化版 Excel：`outputs/运费核价助手_FedEx_IP_V2_优化版.xlsx`。
- 校验结果：V1 Excel 费率表与 PDF 抽取值对比 0 个差异。
- 发现并修正：V1 Excel 国家分区表存在 14 行换行粘连风险，V2 已重新解析国家/地区与 IP Zone。
- 明确美国默认逻辑：`USA` / `United States` / `美国` 默认按美国其他地区 Zone 2；美国西部 Zone 1 需要明确输入或后续邮编判断。
