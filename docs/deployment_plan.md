# Deployment Plan

## 当前目标

先上一个最简单的云端试用版，让少数朋友可以通过网页链接访问和试算。

不做复杂权限系统，不做数据库，不做自动燃油抓取首版。

## 推荐方案

使用 Streamlit Community Cloud。

原因：

- 当前网页已经是 Streamlit。
- 不需要改成前后端项目。
- 可以直接从 GitHub 仓库部署。
- 适合先给少数人试用。

## 仓库建议

建议新建一个 GitHub 私有仓库，只放 `fedex-freight-checker` 这个项目。

不要把 `/Users/alex./Documents/New project` 外层其它历史文件推上去。

云端运行实际只需要：

```text
app/
data_processed/
.streamlit/
requirements.txt
README.md
calculation_rules.md
field_dictionary.md
CHANGELOG.md
docs/
```

`data_raw/` 和 `outputs/` 不需要给网页运行使用。首版部署时可以先不放进云端仓库，避免原始协议价 PDF 和历史 Excel 输出被不必要地上传。

## Streamlit Cloud 设置

部署入口：

```text
app/streamlit_app.py
```

Python 版本：

```text
3.12
```

依赖文件：

```text
requirements.txt
```

建议先设置为 private app，或者只分享给少数测试用户。

## 最小发布流程

1. 本地确认页面没问题。
2. 新建 GitHub 私有仓库。
3. 只上传云端运行所需文件。
4. 在 Streamlit Community Cloud 创建 app。
5. 选择仓库、分支和入口文件 `app/streamlit_app.py`。
6. 拿到网页链接后发给测试用户。

## 反馈入口

当前网页的“反馈留言”只是 UI 占位，不会自动发送。

首版建议先改成其中一种：

- `mailto:` 邮件链接，最简单。
- 飞书/企业微信/Google Form 表单链接。
- 后续再接数据库或自动邮件。

## 后续增强

1. 按需求附加费 PDF 第 3-4 页脚注重建区域国家映射。
2. 新增燃油费自动抓取脚本。
3. 每周一和周二定时抓取燃油费。
4. 把燃油费结果写入 JSON，网页读取 JSON。
5. 增加简单访问控制或私有分享名单。
6. 添加正式部署记录和回滚说明。

## 上云前检查

- `fedex-freight-checker/` Git 状态干净。
- `data_processed/` 数据已更新。
- 页面顶部版本日期正确。
- 页面免责声明存在。
- 原始 PDF 没有通过网页暴露下载入口。
- 反馈入口说明清楚。
