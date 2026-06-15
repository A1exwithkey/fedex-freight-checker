# Web Operations Next Steps

## 当前状态

- 网页由 Vercel / Next.js 托管。
- 代码由 Git 管理，并通过 GitHub commit 触发 Vercel 自动部署。
- 访问人数、打开次数和试算次数写入 Supabase。
- Vercel Analytics 用于查看页面访问趋势。
- Cloudflare Worker 用于燃油费自动检查和 Telegram 通知。

## 访问和试算统计

当前已实现：

- `visit`：用户打开网页时记录。
- `quote`：用户修改输入触发试算后记录。
- `visitor`：用浏览器 localStorage 生成匿名访客 ID。

当前数据表：

```text
usage_visitors
usage_events
```

表结构：

```text
vercel_app/supabase_usage_stats.sql
```

后续优化：

- 增加汇总表 `usage_counters`，减少每次请求实时 count。
- 增加管理员只读接口，用于查看最近使用记录。
- 保留匿名统计，不记录客户敏感信息。

## 反馈留言

当前状态：

- 页面上有反馈入口 UI。
- 尚未接正式保存逻辑。

建议下一步：

1. 新增 Supabase 表 `feedback_messages`。
2. 前端提交留言到 Vercel API。
3. 留言字段只保留：
   - `message`
   - `created_at`
   - `visitor_id`
   - `page_version`
4. 暂不做复杂账号系统。

如果暂时不做留言系统，应该把入口改成邮箱提示，避免用户误以为已经提交成功。

## 燃油费自动更新

当前方案：

- Cloudflare Worker 每周定时检查。
- 读取 EIA 周价格。
- 套用 FedEx APAC 燃油表。
- 写入 `vercel_app/data/rate_config.json`。
- Vercel 自动部署。
- Telegram 通知结果。

后续需要做一次端到端验收：

- `/check` 返回 `OK`。
- `/publish-fuel-config` 能在有变化时提交 GitHub。
- Vercel 能自动部署。
- 页面顶部燃油适用周和费率正确更新。

## 旺季附加费更新

当前仍以人工提供 PDF 后更新为主。

建议流程：

1. 收到新的旺季附加费 PDF。
2. 提取“中国大陆出口的国际货件”口径。
3. 按 PDF 区域脚注重建国家映射。
4. 更新 `vercel_app/data/fedex_ip_ie_data.json`。
5. 跑 `npm run smoke` 和 `npm run build`。
6. 提交 GitHub，等待 Vercel 自动部署。

## 汇率更新

当前网页运行时读取 ECB 汇率接口。

后续优化：

- 增加失败告警。
- 增加最近一次成功汇率缓存。
- 页面继续保留人工覆盖输入。

## 推荐近期任务

1. 清理并提交当前 Vercel 版代码。
2. 做 Cloudflare Worker 到 GitHub 到 Vercel 的端到端验收。
3. 决定反馈入口：接 Supabase 留言表，或改成邮箱提示。
4. 将 FedEx 燃油表沉淀成显式 JSON/CSV，并加抽查测试。
5. 后续如用户变多，再做管理员统计页。
