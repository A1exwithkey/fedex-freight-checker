# Calculation Rules

## 服务范围

只计算中国 FedEx 国际出口 IP 包裹。

## 国家/地区匹配

1. 用户输入先做 `strip` 和小写标准化。
2. 到 `country_alias.alias_normalized` 中匹配。
3. 匹配成功后读取 `ip_zone`。
4. 匹配失败时返回 `Need Review`。

## 美国规则

- `U.S. Western Region` / `美国西部`：Zone 1
- `美国其他地区`：Zone 2
- `USA` / `United States` / `美国` 默认按美国其他地区 Zone 2
- 后续可加入邮编判断，把美国西部指定邮编段自动映射为 Zone 1

## 重量规则

### 0.5kg-20.5kg

使用 `ip_parcel_rate_0_20_5kg` 固定费率表。

Excel 当前按 0.5kg 向上取整：

```text
lookup_weight = CEILING(actual_weight_kg, 0.5)
```

### 20.5kg 之后

使用 `ip_parcel_rate_21kg_plus` 每公斤费率表。

```text
Base Freight CNY = actual_weight_kg × rate_cny_per_kg
```

## 最终价格

```text
Demand Surcharge CNY = 0, if demand_rate_cny_per_kg = 0
Demand Surcharge CNY = MAX(actual_weight_kg × demand_rate_cny_per_kg, 1.80), if demand_rate_cny_per_kg > 0
Freight Before Fuel CNY = Base Freight CNY + Demand Surcharge CNY
Freight with Fuel CNY = Freight Before Fuel CNY × (1 + Fuel Rate)
Final CNY = Freight with Fuel CNY × Markup
Final USD = Final CNY / Exchange Rate
```

默认值：

- Fuel Rate = 0.48
- Redundancy Factor = 1.1
- Exchange Rate = 6.8
- Demand Minimum = 1.80 CNY/shipment when surcharge applies

## 需求附加费

需求附加费使用 `FEDEX需求附加费-2026.4.13日生效至另行通知.pdf`，只读取“中国大陆出口的国际货件”列。

如果目的地无法明确匹配到 PDF 区域脚注，返回 `Need Review`，不猜测。

费率为 0 的区域，需求附加费为 0；不额外套 1.80 最低收费。
