# CHANGELOG

## UI V3.3 - 2026-08-20

- 按用户提供的 A 版参考图重排核价页面，保留左窄右宽、细分割线、IP/IE 对称报价和克制的蓝/青绿服务身份色。
- 将目的地匹配状态、重量、汇率、燃油附加费率和额外冗余设为默认可见；版本与规则信息集中到右上角“数据参考”。
- 删除推荐、节省金额和服务选择建议；公开费用明细与最终 USD 计算公式。
- 更新 2026-09-02 中国大陆出口旺季附加费：首页亚洲费率拆分为澳大利亚/新西兰、关岛/日本、马来西亚、越南和其余亚洲。
- 将页面压缩到更适合首屏核价的密度；数据版本、燃油构成、汇率日期和状态集中到右上角“数据参考”。
- 更新说明补齐 V1.0 至 V3.3 的主要版本记录，移除无实际使用场景的反馈入口。
- 费用明细与计算方式改为紧凑并列布局；基础运费补充固定查表或每公斤费率乘重量说明。
- 左侧冗余输入改为“额外冗余 10%”，费用明细新增对应冗余金额行，最终计算结果保持不变。
- 实际重量改为完整输入框，清理计价参数多余分割线；计算方式补充旺季费日期、燃油周期和燃油构成。
- 页面主体收紧至居中宽度，标题放大并下沉；右侧费用明细与计算方式改为等高弹性布局，减少底部空白。
- 在不改变左右网格和报价数据的前提下，将页面纵向间距整体放宽约 15%，并额外增加标题与主体内容之间的留白。
- 将页面画布由浅灰调整为接近纯白的极浅灰，保留轻微层级但降低整体灰度。
- 完成 smoke、production build、桌面与手机端回归后发布。

## V3.4.1-fuel-worker-cron-retry-2026-07-06 - 2026-07-06

- 验证 Cloudflare Worker 可直接发布燃油费到 GitHub，并已更新网页燃油费至 2026-07-06 至 2026-07-12。
- 将 Cloudflare Cron 从 2 次增加到 3 次：北京时间周一 08:00、10:00、12:00，降低单次定时触发不稳定的风险。
- 明确 Cloudflare Worker 为燃油费主发布链路，GitHub Actions watchdog 只作为兜底。

## V3.4.0-demand-surcharge-2026-06-29 - 2026-06-29

- 更新旺季附加费至 `FEDEX需求附加费-2026.6.29日更新.pdf`，生效日期为 2026-06-29。
- 旺季附加费新增 IP / IE 分服务费率：美国和波多黎各、加拿大、墨西哥、拉丁美洲 IP 为 5.4 CNY/kg，IE 为 4.0 CNY/kg。
- 将 MEISA 拆分为第 1 组和第 2 组：第 1 组 11.2 CNY/kg，第 2 组 17.4 CNY/kg。
- 保留每票最低收费 1.80 CNY，并继续只使用“中国大陆出口的国际货件”口径，排除 ImportOne 和 G3P。
- 更新 `scripts/04_extract_demand_surcharge_pdf.py`、`data_processed/`、`vercel_app/data/`、README 和数据版本清单。

## V3.3.0-fuel-watchdog-2026-06-29 - 2026-06-29

- 将 Cloudflare Worker 燃油检查时间提前 2 小时，改为北京时间周一 08:00 和 12:00。
- 新增 GitHub Actions `FedEx fuel watchdog`，在北京时间周一 08:20 和 12:20 读取 Worker 公开燃油结果并兜底更新 `vercel_app/data/rate_config.json`。
- 新增 `scripts/09_sync_fuel_config_from_worker.py`，用于从 Worker 公开接口同步本地燃油配置，供 watchdog 和人工修复使用。
- 将网页燃油配置更新为 2026-06-29 至 2026-07-05：FedEx 38.50%，工具按 +3% 冗余后为 41.50%。
- 更新 README、燃油自动化方案、运维手册、发布检查清单和数据版本清单。

## V3.2.0-maintainability-2026-06-22 - 2026-06-22

- 明确当前生产主线为 `vercel_app/`、`vercel_app/data/` 和 `cloudflare/fuel-surcharge-worker/`，Excel / Streamlit 保留为历史验证资产。
- 新增 `docs/system_architecture.md`，记录前端、业务逻辑、数据、集成和配置分层。
- 新增 `docs/data_version_manifest.md`，明确生产数据文件、历史加工数据和当前版本。
- 新增 `scripts/08_health_check.py`，用于检查 Worker、GitHub 配置、线上网页和汇率 API 是否一致。
- 更新 `README.md` 当前版本、燃油费版本和健康检查入口，降低后续维护和 AI 接手成本。

## V3.1.2-fuel-week-2026-06-22 - 2026-06-22

- 将网页燃油配置更新为 2026-06-22 至 2026-06-28：FedEx 41.50%，工具按 +3% 冗余后为 44.50%。
- 为 Cloudflare Fuel Surcharge Worker 的 Cron 和手动发布路径增加结构化日志，记录燃油周、GitHub 更新状态、失败原因和 commit SHA，便于定位自动发布失败。
- 为 Cron 增加顶层错误捕获；若定时任务失败，会写入 Worker 日志并尝试发送 Telegram 失败通知。

## V3.1.1-worker-cache-2026-06-15 - 2026-06-15

- 重新部署 Cloudflare Fuel Surcharge Worker，将线上 `FUEL_BUFFER_RATE` 从 `0.05` 修正为 `0.03`。
- 将 Worker `/fuel-current` 缓存键升级为 v2，避免继续命中旧的 `+5%` 燃油冗余缓存。
- 将公开燃油缓存时间从 7 天缩短为 6 小时，减少部署后显示旧燃油口径的风险。

## V3.1.0-github-vercel-automation-2026-06-15 - 2026-06-15

- 将网页版本更新为 V3.1，网页版本日期更新为 2026-06-15。
- 将燃油费配置更新为 2026-06-15 至 2026-06-21：FedEx 43.00%，工具按 +3% 冗余后为 46.00%。
- 将 `vercel_app/` 作为 GitHub / Vercel 长期部署入口纳入项目管理，避免继续依赖手动 Vercel 快照。
- 明确长期自动更新链路：Cloudflare Worker 更新 `vercel_app/data/rate_config.json`，GitHub commit 触发 Vercel 自动部署。
- 更新 README、部署方案和运维手册，记录 GitHub/Vercel 连接要求和当前燃油费版本。

## V3.0.1-docs-maintenance-2026-06-07 - 2026-06-07

- 更新 `README.md`，将项目主线改为 Vercel / Next.js 网页版，并同步 IP + IE、3% 燃油冗余、Supabase 统计和当前线上地址。
- 更新 `docs/release_checklist.md`，将发布检查项从 Streamlit / IP 单服务调整为 Vercel / IP+IE 同屏报价。
- 更新 `docs/operations_manual.md`、`docs/fuel_surcharge_automation_plan.md`、`docs/deployment_plan.md` 和 `docs/web_operations_next_steps.md`，统一当前 Vercel / Supabase / Cloudflare Worker 维护口径。
- 更新 `cloudflare/fuel-surcharge-worker/README.md`，修正配置路径、3% 燃油冗余、Vercel 自动部署和 Telegram `/stats` 说明。
- 修正 Cloudflare Worker Telegram `/stats` 文案，不再引用已废弃的 Streamlit 本地 CSV 统计。
- 本次不改变报价公式、费率数据、UI 或部署配置。

## V2.6.1-fuel-worker-2026-05-24 - 2026-05-24

- 新增 `cloudflare/fuel-surcharge-worker/`，用于定时读取 EIA 官方 USGC 周价格并套用 FedEx 官方燃油附加费表后发送 Telegram 通知。
- 燃油费自动检查不自动修改正式报价，仍需人工确认后更新网页配置。
- Cloudflare Cron 设置为北京时间每周一 10:00 和 14:00 各检查一次。
- Telegram Token、Chat ID 和手动测试密钥改为 Cloudflare Secret 配置，不写入代码。
- Cloudflare 普通抓取和 Browser Rendering 均无法稳定读取 FedEx 页面当前行，Worker 改为读取 EIA 官方 USGC 周价格并套用 FedEx 官方燃油附加费表。
- 新增 `scripts/06_check_fedex_fuel_official_sources.py`，用于本地复核 EIA 周价格、FedEx 表匹配结果和官网 +5% 后的工具建议燃油费。
- Worker 新增 Telegram webhook：支持 `/check`、`/status`、`/stats`、`/help` 命令，并提供 `/set-telegram-webhook` 和 `/telegram-webhook-info` 管理入口。
- Worker 新增公开 `/fuel-current` 接口；Streamlit 打开时优先读取该接口自动更新默认燃油费，失败时回退到 `rate_config.json`。
- `/fuel-current` 改为优先读取 Cloudflare Cache；定时任务和手动刷新负责更新缓存，避免每个网页访问者触发 EIA 实时抓取。
- Streamlit 读取燃油接口的缓存时间从 6 小时改为 5 分钟，首屏读取超时降到 1.2 秒，并把本地兜底燃油费更新为 2026-05-25 至 2026-05-31 版本：FedEx 49.50%，本工具 54.50%。
- 为恢复首屏速度，Streamlit 暂停运行时读取 Worker，改为只读本地 `rate_config.json`；Worker 保留每周自动检查和 Telegram 通知。
- Worker 新增 GitHub 自动发布逻辑：燃油结果 `OK` 且配置发生变化时，自动更新 `data_processed/rate_config.json`，由 Streamlit 监听 GitHub commit 后自动部署。

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
