# Field Dictionary

## country_zone_ip

| 字段 | 含义 |
|---|---|
| `display_name_cn` | Excel 展示用中文优先名称；仅在 Excel 中增加，CSV 原始结构不依赖它 |
| `country_region_en` | PDF 中的英文国家/地区名称 |
| `country_region_zh` | PDF 中的中文国家/地区名称 |
| `country_region_combined` | 英文和中文合并后的原始可读名称 |
| `ip_zone` | IP 服务对应 Zone，只读取 PDF 的 IP 列 |
| `source_pdf_page` | 来源 PDF 页码 |
| `source_note` | 提取说明 |
| `review_status` | `OK` 或 `Need Review` |

## ip_parcel_rate_0_20_5kg

| 字段 | 含义 |
|---|---|
| `weight_kg` | 固定费率重量档，0.5kg 到 20.5kg |
| `zone` | IP Zone |
| `base_rate_cny` | 基础运费，人民币 |
| `source_pdf_pages` | 来源 PDF 页码 |
| `service` | 服务范围，固定为 IP export parcel |

## ip_parcel_rate_21kg_plus

| 字段 | 含义 |
|---|---|
| `min_kg` | 重量段下限 |
| `max_kg` | 重量段上限 |
| `zone` | IP Zone |
| `rate_cny_per_kg` | 每公斤费率，人民币 |
| `source_pdf_pages` | 来源 PDF 页码 |
| `service` | 服务范围，固定为 IP export parcel |

## country_alias

| 字段 | 含义 |
|---|---|
| `alias` | 用户可能输入的国家/地区名称 |
| `alias_normalized` | 小写后的匹配键 |
| `canonical_country_region` | 匹配到的标准国家/地区 |
| `ip_zone` | 标准国家/地区对应 IP Zone |
| `match_note` | 匹配来源或人工规则说明 |
| `demand_region_cn` | 需求附加费中文区域 |
| `demand_region_code` | 需求附加费区域代码 |
| `demand_rate_cny_per_kg` | 中国大陆出口需求附加费 RMB/kg |
| `demand_minimum_cny` | 费率大于 0 时的最低需求附加费 RMB/票 |
| `demand_review_status` | 需求附加费区域匹配状态 |

## demand_surcharge_rates

| 字段 | 含义 |
|---|---|
| `demand_region_code` | 需求附加费区域代码 |
| `demand_region_cn` | 需求附加费区域中文名 |
| `demand_region_en` | 需求附加费区域英文名 |
| `priority_rate_cny_per_kg` | 中国大陆出口每公斤需求附加费 |
| `minimum_cny_per_shipment` | 费率大于 0 时的最低收费 |
| `source` | 来源说明 |
| `source_url` | 来源链接 |
| `effective_date` | 生效日期 |
| `notes` | 官方脚注范围 |

## country_demand_region

| 字段 | 含义 |
|---|---|
| `country_region_cn` | 国家/地区中文名 |
| `country_region_en` | 国家/地区英文名 |
| `demand_region_code` | 需求附加费区域代码 |
| `demand_region_cn` | 需求附加费区域中文名 |
| `demand_region_en` | 需求附加费区域英文名 |
| `priority_rate_cny_per_kg` | 中国大陆出口每公斤需求附加费 |
| `minimum_cny_per_shipment` | 费率大于 0 时的最低收费 |
| `source` | 来源说明 |
| `effective_date` | 生效日期 |
| `review_status` | `OK` 或 `Need Review` |
| `notes` | 备注 |

## validation_checks

| 字段 | 含义 |
|---|---|
| `test_case_id` | 测试用例编号 |
| `country_input` | 抽查输入 |
| `matched_country` | 匹配后的国家/地区 |
| `ip_zone` | 匹配后的 IP Zone |
| `weight_kg` | 抽查重量 |
| `pdf_page` | PDF 来源页 |
| `pdf_value` | PDF 原值 |
| `excel_value` | Excel 或结构化数据中的值 |
| `pass_fail` | `PASS`、`PASS_WITH_NOTE` 或 `FAIL` |
| `notes` | 备注 |
