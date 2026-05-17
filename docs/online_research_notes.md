# Online Research Notes

日期：2026-05-16

## 调研目标

参考前人做 FedEx / 多承运商运费计算器、报价工具、Rate API 工具时的经验，筛出对本项目有用的原则。

## 参考来源

1. FedEx Rates and Transit Times API  
   https://developer.fedex.com/api/en-gl/catalog/rate.html

2. FedEx Service Availability API  
   https://developer.fedex.com/api/en-us/catalog/service-availability/docs.html

3. FedEx Address Validation API  
   https://developer.fedex.com/api/en-kw/catalog/address-validation/v1/docs.html

4. FedEx Fuel Surcharge  
   https://www.fedex.com/en-us/shipping/fuel-surcharge.html

5. Purplship open-source multi-carrier shipping API  
   https://github.com/EzeeSpace/purplship

6. DimWeigh shipping tools  
   https://dimweigh.com/

7. ShippingRulesGuide calculator  
   https://shippingrulesguide.com/calculator

8. Atoship rate calculator accuracy article  
   https://atoship.com/blog/rate-calculator-accuracy-tested-6-tools

## 可借鉴经验

### 1. 协议价静态核价和实时 API 是两条路线

FedEx Rate API 的目标是返回可用服务、账号费率、标准费率、预计费用、附加费和其它影响价格的因素。我们的当前目标不是实时下单报价，而是把公司协议价 PDF 做成可复核的静态核价工具。

结论：V1/V2 继续坚持静态数据源，不提前接 FedEx API。等 Excel 版稳定后，再单独设计 API 对账模块。

### 2. 服务可用性要独立处理

FedEx Service Availability API 强调按发件地、收件地、账号、日期、货物信息返回可用服务和包装组合。也就是说“有 Zone 和价格”不等于“该地址一定可发该服务”。

结论：当前 Excel 只能叫“核价助手”，不能叫“可发性确认”。Streamlit 版应加提示：最终是否可发仍需 FedEx 系统确认。

### 3. 地址和邮编是报价准确性的关键

FedEx Address Validation API 用于规范和修正地址，但官方也说明它不是可派送性判断。很多工具会把地址校验、邮编、州/省、国家作为独立输入，而不是只输入国家。

结论：下一版网页应增加目的邮编字段，优先解决美国西部 Zone 1 自动识别。

### 4. 燃油费率会变动，不能写死

FedEx 官方燃油页说明燃油附加费可能按周调整，客户协议仍是最终依据。

结论：Excel 和网页都应把 Fuel Rate 留成人工输入；后续可以加“当前燃油费率维护表”，但不要在代码里写死。

### 5. 体积重和附加费是实际账单差异的常见来源

DimWeigh、ShippingRulesGuide、Atoship 等工具都把体积重、尺寸限制、地址类型、附加费作为运费准确性的关键模块。只按实际重量和国家分区算，适合快速估算，但不能完全等同最终账单。

结论：本项目当前结果应叫“基础运费估算 + 燃油 + 安全系数”。后续网页增加长宽高、计费重量和附加费提示。

### 6. 数据结构要版本化

开源多承运商工具通常把 carrier、service、package、rate、surcharge、tracking 等拆成明确对象。我们的项目暂时只做 IP 包裹，但也应该保留版本号、来源页、服务范围和校验状态。

结论：继续保留 `source_pdf_page`、`service`、`review_status`、版本说明和 `validation_checks`。

## 本项目当前采纳项

- Excel 第一页放计算器。
- 数据表保留结构化英文字段，便于 Python 读取。
- 人工界面中文优先。
- Fuel Rate、Markup、Exchange Rate 都可改。
- 国家别名和 Zone 独立成表。
- `validation_checks` 作为数据质量入口。

## 后续建议

1. Streamlit V2 先复刻 Excel 计算器，不新增复杂业务。
2. 增加美国邮编自动 Zone 判断。
3. 增加体积重输入：长、宽、高、体积重系数。
4. 增加“报价不含项”提示：偏远、特殊处理、税费、关税、地址修正等。
5. 保留协议价 PDF 版本和数据版本，避免销售用错费率。

