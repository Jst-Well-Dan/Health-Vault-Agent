# 家庭健康档案

一个本地运行的家庭健康档案应用，用来整理家人和宠物的就诊记录、体检报告、检验指标、用药、提醒、体重和附件。

这个项目主要面向非技术人员和 AI agent：人负责提供报告和确认意图，AI agent 负责读取项目技能、安装运行、整理报告、写入数据库和配置手机访问。

> 数据默认保存在你自己电脑的 `data/health.db`。它是个人健康数据，请不要上传到公开仓库。

## 在线预览

可以先看 mock 数据预览，不需要下载或启动项目：

https://jst-well-dan.github.io/Health-Vault-Agent-Preview/

以下截图同样来自 mock 数据，可以公开展示。

![成员档案](data/public/screenshots/mock-members.png)

![个人概览](data/public/screenshots/mock-overview.png)

![体检指标](data/public/screenshots/mock-checkup.png)

## 适合谁

- 想把家人、宠物的体检报告和就诊记录集中保存的人。
- 希望 AI agent 帮忙整理 PDF、图片和 Markdown 报告的人。
- 希望数据留在本地电脑，同时可以用手机通过 Tailscale 查看的人。
- 想复用一套“报告转换、数据库写入、家庭部署”流程的人。

## 最简单的用法

把下面这段话发给你的 AI agent。

```text
请帮我使用这个家庭健康档案项目：
https://github.com/Jst-Well-Dan/Health-Vault-Agent

请先阅读 README.md、AGENTS.md 和 .codex/skills 下的项目技能。
然后先问我这次想做什么，再帮我完成初始化、添加家庭成员和宠物、导入报告或手机访问配置。
```

如果你只想让 agent 安装并启动：

```text
请克隆 https://github.com/Jst-Well-Dan/Health-Vault-Agent，并使用 health-app 帮我安装、初始化和启动家庭健康档案，然后引导我添加家庭成员和宠物。
```

如果你想导入一份报告：

```text
请把我提供的健康报告导入家庭健康档案。需要转换文档时使用 mineru；写入数据库时使用 health-db-writer。
```

如果你想在手机上查看：

```text
请先使用 health-app 确认家庭健康档案已经运行，再使用 health-deploy 引导我通过 Tailscale 在手机浏览器访问。
```

## AI Agent 能力

本仓库内置了 4 个项目技能，AI agent 应优先使用它们，而不是临时发明流程。

| 技能 | 用途 |
|---|---|
| `health-app` | 安装依赖、初始化项目、启动服务、停止服务和检查本机运行状态 |
| `mineru` | 把 PDF、图片、Word 或网页转换为 Markdown；需要表格识别时使用 MinerU token 的精确提取模式 |
| `health-db-writer` | 整理导入 JSON、校验数据、备份并写入 SQLite；包含数据库写入安全规则 |
| `health-deploy` | 配置 Tailscale 手机访问、远程访问排查和开机自启 |

## 使用流程

```text
看在线预览
  ↓
让 AI agent 克隆项目：
https://github.com/Jst-Well-Dan/Health-Vault-Agent
  ↓
agent 使用 health-app 安装、初始化并启动项目
  ↓
agent 引导你添加家庭成员和宠物
  ↓
把报告 PDF / 图片 / Markdown 交给 agent
  ↓
agent 使用 mineru 和 health-db-writer 导入数据
  ↓
agent 使用 health-deploy 配置 Tailscale 手机访问
```

## 手动启动

如果你熟悉 PowerShell，也可以手动启动：

```powershell
git clone <仓库地址>
cd health
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
python backend\scripts\seed_members.py
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

本机访问：

```text
http://127.0.0.1:8000/
```

同一 Tailscale 网络中的手机访问：

```text
http://<电脑的 Tailscale IP>:8000/
```

## 数据目录

```text
backend/              FastAPI 后端、SQLite 初始化、API 路由、导入脚本
frontend/             前端页面和样式
data/health.db        真实数据库，本地个人数据，不要公开提交
data/backups/         数据库备份
data/imports/         agent 生成的导入 JSON
data/reports/         原始报告、Markdown 和图片附件
data/public/          可公开访问的静态资源，如头像和 README 截图
data/mock/            mock 数据库和 mock 附件
docs/                 项目文档和静态预览
.codex/skills/        给 AI agent 使用的项目技能
```

## 真实数据安全

- 不要公开提交 `data/health.db`。
- 不要公开提交真实报告、真实附件或包含个人信息的导入 JSON。
- 数据库写入任务请交给 `health-db-writer`，让 agent 按项目规则执行。
- 不要让 agent 删除、重建、重置真实数据库，除非你明确要求。
- 不确定报告解析是否完整时，让 agent 先暂停并说明问题。

## 静态预览

本项目可以把 mock 数据导出成纯静态页面，用于 GitHub Pages 公开展示：

```powershell
python backend\scripts\export_static_preview.py
```

当前公开预览地址：

https://jst-well-dan.github.io/Health-Vault-Agent-Preview/

静态预览是只读的；新增、编辑、删除不会写入数据库。

## 给贡献者

这个项目的优先级是：数据安全、流程清晰、AI agent 可执行、非技术人员能理解。

- README 只保留用户入口、简单提示词和关键概念。
- 具体数据库写入要求放在 `health-db-writer` skill 中维护。
- 本机安装、初始化和启动流程放在 `health-app` skill 中维护。
- 手机访问、自启和 Tailscale 流程放在 `health-deploy` skill 中维护。
- 文档转换流程放在 `mineru` skill 中维护。
- UI 截图请使用 mock 数据，适合公开展示的图片放在 `data/public/`。
