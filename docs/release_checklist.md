# Release Checklist

每次准备给别人试用或更新云端网页前，按这份清单检查。

## 数据源

- [ ] IP / IE 协议价文件和生效日期正确。
- [ ] 旺季附加费文件和生效日期正确。
- [ ] 旺季附加费只使用“中国大陆出口的国际货件”口径。
- [ ] 燃油费显示为当前适用周，且冗余口径为官网燃油费 + 3%。
- [ ] 汇率日期和汇率数值显示正常。
- [ ] `vercel_app/data/fedex_ip_ie_data.json` 是网页实际读取的数据。
- [ ] `vercel_app/data/rate_config.json` 是网页实际读取的版本和费率配置。

## 业务范围

- [ ] 只做中国 FedEx 国际出口。
- [ ] 只做 IP 和 IE。
- [ ] 只做包裹。
- [ ] 不包含 IPE、进口、第三方支付、重货、快递封、快递袋。
- [ ] 不包含税费、偏远地区附加费、特殊处理费。

## 关键规则

- [ ] 美国默认 `USA / United States / 美国` 映射到美国其他地区 Zone 2。
- [ ] 美国西部必须人工选择 `United States - Western Region (美国西部)` 才映射 Zone 1。
- [ ] 0.5kg-20.5kg 使用固定费率。
- [ ] 21kg 及以上使用实际重量乘以每公斤费率。
- [ ] 旺季附加费费率为 0 时，旺季附加费为 0。
- [ ] 旺季附加费费率大于 0 时，按最低收费规则计算。
- [ ] 最终公式为 `(基础运费 + 旺季附加费) × (1 + 燃油费率) × 冗余系数 ÷ 汇率`。

## 验证样例

- [ ] IP 美国其他地区 10kg。
- [ ] IE 美国其他地区 10kg。
- [ ] IE 英国 10kg。
- [ ] IE 韩国 25kg。
- [ ] 美国西部 10kg。
- [ ] 德国 21kg。
- [ ] 新加坡 500kg。

## 网页检查

- [ ] `cd vercel_app && npm run smoke` 通过。
- [ ] `cd vercel_app && npm run build` 通过。
- [ ] 本地网页可以启动。
- [ ] 页面标题、网址版本、协议价日期、旺季附加费日期正确。
- [ ] 燃油费显示当前适用周、官网燃油费和 +3% 后的工具值。
- [ ] 汇率显示日期和两位小数汇率。
- [ ] 目的地下拉可以选择。
- [ ] 手输目的地优先于下拉。
- [ ] 修改重量后才计入试算次数，打开网页不应直接计入试算。
- [ ] IP 和 IE 同屏报价都能显示。
- [ ] Need Review 时不会继续假装报价成功。

## 云端检查

- [ ] Production 地址可以访问：`https://microsensor-fedex.vercel.app/`。
- [ ] 备用网址可以访问：`https://vercelapp-brown-mu.vercel.app/`。
- [ ] Vercel Analytics 可查看页面访问趋势。
- [ ] Supabase 统计表可写入访问和试算事件。
- [ ] 页面底部统计显示访问人数、打开次数、试算次数。
- [ ] Cloudflare Worker `/fuel-current` 能返回当前燃油状态。
- [ ] Telegram `/check` 能返回燃油检查结果。

## Excel / 历史资产

- [ ] 如更新 Excel，`scripts/02_build_excel.py` 可以生成文件。
- [ ] Excel 打开不弹修复。
- [ ] `validation_checks` 已更新。
- [ ] Excel 与网页数据源差异已说明。

## 发布记录

- [ ] `CHANGELOG.md` 已更新。
- [ ] 关键版本说明已写入 `docs/version_notes/`，如果只是小文档维护可不新增。
- [ ] Git commit 已创建。
- [ ] 如已部署网页，记录访问地址和部署方式。
