# Operations Manual

## 目标

这份文档说明如何维护 `fedex-freight-checker`，避免协议价、旺季附加费、燃油费、汇率、统计和网页版本混在一起。

当前主线：

- 网页：Vercel / Next.js，目录 `vercel_app/`
- 运行数据：`vercel_app/data/fedex_ip_ie_data.json` 和 `vercel_app/data/rate_config.json`
- 统计：Vercel API 写入 Supabase
- 燃油费：Cloudflare Worker 定时检查，变化时更新 GitHub，Vercel 自动部署

长期维护前提：

- `vercel_app/` 必须被 Git 跟踪并推送到 GitHub。
- Vercel 项目必须连接 GitHub 仓库，Root Directory 为 `vercel_app`。
- Cloudflare Worker 必须更新 `vercel_app/data/rate_config.json`。
- 不再用手动 `vercel deploy` 快照作为长期生产发布方式。

## 常规更新流程

### 1. 更新 IP / IE 协议价

适用场景：FedEx 给了新的中国出口 IP / IE 协议价文件。

1. 把源文件放到 `data_raw/`。
2. 更新对应提取脚本和版本日期。
3. 确认仍只读取：
   - 中国 FedEx 国际出口
   - FedEx IP / IE
   - 包裹价格
4. 重新生成网页数据：

```bash
python3 scripts/07_build_vercel_ip_ie_data.py
```

5. 检查 `vercel_app/data/fedex_ip_ie_data.json`。
6. 运行网页烟测：

```bash
cd vercel_app
npm run smoke
npm run build
```

7. 更新 `CHANGELOG.md`。

### 2. 更新旺季附加费

适用场景：FedEx 发布新的 Demand Surcharge / 旺季附加费 PDF。

1. 把新 PDF 放到 `data_raw/`。
2. 只读取“中国大陆出口的国际货件”口径。
3. 按 PDF 后面脚注的区域国家清单重建国家到旺季大区映射。
4. 费率为 0 的区域，旺季附加费为 0。
5. 费率大于 0 的区域，按 PDF 最低收费规则计算。
6. 匹配不到的国家/地区保留 `Need Review`，不要猜。
7. 重新生成 `vercel_app/data/fedex_ip_ie_data.json`。
8. 跑 `npm run smoke` 和 `npm run build`。

### 3. 更新燃油附加费

当前规则：

- FedEx 官网燃油费 + 3% 冗余
- 网页读取 `vercel_app/data/rate_config.json`
- `fuel_schedule` 可提前写入下一适用周
- 到生效日当天，网页按北京时间自动切换适用周

自动检查方式：

1. Cloudflare Worker 读取 EIA 官方 USGC kerosene-type jet fuel 周价格。
2. 套用 FedEx APAC 燃油附加费表。
3. 计算 FedEx 官网燃油费和官网 +3% 后的工具值。
4. 如果配置变化，Worker 通过 GitHub API 更新 `vercel_app/data/rate_config.json`。
5. GitHub 有新 commit 后，Vercel 自动部署。
6. Telegram 通知检查结果和 GitHub 更新结果。

当前定时：

- Cloudflare Worker：北京时间周一 08:00 和 12:00。
- GitHub Actions watchdog：北京时间周一 08:20 和 12:20。

watchdog 用于检测 Cloudflare Cron 没触发或没完成的情况；若 Worker 已能给出新燃油周但 GitHub 配置仍旧，watchdog 会直接更新 `vercel_app/data/rate_config.json` 并提交 GitHub。

本地复核命令：

```bash
python3 scripts/06_check_fedex_fuel_official_sources.py
```

线上健康检查：

```bash
python3 scripts/08_health_check.py
```

按 Worker 公开结果同步本地配置：

```bash
python3 scripts/09_sync_fuel_config_from_worker.py
```

Cloudflare Worker 详见：

```text
cloudflare/fuel-surcharge-worker/README.md
```

### 4. 更新汇率

当前网页运行时读取 ECB 汇率接口：

```text
vercel_app/app/api/exchange-rate/route.ts
```

规则：

- 正常时自动显示 ECB 来源日期和 CNY/USD 汇率。
- 页面输入框允许人工覆盖。
- 接口失败时回退 `vercel_app/data/rate_config.json` 中的默认值。

### 5. 更新网页

网页入口：

```bash
cd vercel_app
npm run dev
```

原则：

- 不扩大业务范围。
- 不增加 IPE、进口、重货等服务。
- 销售常看的结果放上面，细节放下面。
- 改 UI 前后都跑 `npm run smoke` 和 `npm run build`。
- 不把抓取逻辑放到用户打开网页时执行，避免页面变慢。

## 发布前必须确认

- 网页版本日期已更新。
- IP / IE 协议价日期已更新。
- 旺季附加费日期已更新。
- 燃油费适用周、官网燃油费和 +3% 后工具值正确。
- 汇率日期和汇率值显示正常。
- `Need Review` 项不会假装报价成功。
- 默认美国逻辑仍是美国其他地区 Zone 2。
- 线上地址可访问：`https://microsensor-fedex.vercel.app/`。
- Vercel Production Deployment 来源应为 GitHub commit，而不是孤立的手动快照。

## Git 规则

每次业务规则、数据源、自动化或网页逻辑变化，都要单独 commit。

建议 commit message：

```text
Update FedEx fuel schedule for 2026-06-08
Refresh seasonal surcharge mapping
Refine Vercel release documentation
```

不要把 `.env`、密码、账号、API key、Telegram token、Supabase secret 或 GitHub token 提交进 Git。
