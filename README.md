# 家庭健康档案

一个本地运行的家庭健康档案应用，用 FastAPI + SQLite 提供后端接口，用 React UMD + Babel 提供前端页面。项目用于管理家庭成员、宠物、就诊记录、体检指标、用药、体重、提醒和附件。

## 功能概览

- 家庭成员和宠物档案
- 就诊记录、体检报告、检验指标和趋势图
- 用药记录、提醒、宠物体重趋势和日常护理记录
- 附件预览，支持图片、PDF、Markdown 和文本类附件
- 本地 SQLite 数据库，默认使用 `data/health.db`
- 模拟模式，使用独立的公开演示数据库 `data/mock/health_mock.db`
- 成员头像从 `data/public` 自动匹配并通过 `/public` 静态服务加载

## 项目结构

```text
backend/              FastAPI 后端、SQLite 初始化、API 路由、导入脚本
frontend/             React 前端页面和样式
data/                 真实数据、报告、附件、数据库和公开静态资源
data/public/          公开静态资源，成员头像放在这里
data/mock/            本地生成的模拟模式数据库和附件
docs/                 项目文档
.codex/skills/        Codex 项目技能和数据库写入规则
```

## 快速启动

建议在项目根目录创建虚拟环境，然后安装后端依赖：

```powershell
cd E:\Python_Doc\My_Github\health
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
```

启动服务：

```powershell
cd backend
python -m uvicorn main:app --reload
```

打开浏览器访问：

```text
http://127.0.0.1:8000/
```

后端会同时提供 `/api` 接口、前端静态文件和 `/public` 静态资源。

## 初始化成员

首次使用可以运行成员初始化脚本：

```powershell
python backend\scripts\seed_members.py
```

脚本会写入 `members` 表中的基础成员信息。真实数据库路径默认是：

```text
data/health.db
```

## 成员头像

成员头像放在：

```text
data/public/
```

头像文件名必须等于成员的 `member_key`，扩展名支持：

```text
.jpg .jpeg .png .webp .gif
```

示例：

```text
member_key = demo-self   -> data/public/demo-self.png
member_key = demo-parent -> data/public/demo-parent.png
member_key = demo-cat    -> data/public/demo-cat.png
```

后端在 `GET /api/members` 中扫描 `data/public`，找到文件名与 `member_key` 精确匹配的图片后返回：

```json
{
  "key": "demo-self",
  "avatar_url": "/public/demo-self.png"
}
```

前端只读取 `avatar_url`。如果找不到头像，页面会回退显示成员首字头像。

## 模拟模式

模拟模式用于公开演示和前端调试，不会使用真实数据库。

PowerShell：

```powershell
$env:HEALTH_MOCK_MODE='1'
cd backend
python -m uvicorn main:app --reload
```

模拟数据库路径：

```text
data/mock/health_mock.db
```

重新生成模拟数据：

```powershell
cd backend
python scripts\seed_mock_data.py --reset
```

模拟数据源维护在 `backend/mock_data.py`，`data/mock/` 是本地生成目录，开源仓库不提交。

## GitHub Pages 静态预览

可以把现有模拟数据库导出成纯静态预览页，不需要 FastAPI 后端。若本地还没有模拟数据库，先运行一次 `python backend\scripts\seed_mock_data.py --reset`：

```powershell
python backend\scripts\export_static_preview.py
```

脚本会生成：

```text
docs/static-preview/
```

该目录包含前端文件、公开头像、模拟附件和 `data/static-data.json`。页面内置只读 API shim，会把 `/api/...` 请求映射到静态 JSON；新增、编辑、删除等写入操作在静态预览中不可用。

本地预览：

```powershell
python -m http.server 8765 --directory docs\static-preview
```

然后打开：

```text
http://127.0.0.1:8765/
```

部署到 GitHub Pages 时，可选择把 Pages source 指向 `docs/`，访问路径为 `/static-preview/`。

## 导入就诊数据

项目提供 JSON 导入脚本。写入真实数据库前请先 dry-run：

```powershell
python backend\scripts\import_visit_json.py --file path\to\visit.json --dry-run
python backend\scripts\import_visit_json.py --file path\to\visit.json --write
```

真实数据库包含个人和家庭健康记录。写入规则统一维护在 `.codex/skills/health-db-writer/`，写入真实数据库前请先 dry-run 并创建备份。

## 常用 API

```text
GET /api/meta
GET /api/members
GET /api/members/{key}
GET /api/visits?member={key}
GET /api/labs?member={key}
GET /api/meds?member={key}
GET /api/weight?member={key}
GET /api/reminders?member={key}
GET /api/attachments?member={key}
```

## 数据库路径

默认路径：

```text
data/health.db
```

可以通过环境变量覆盖：

```powershell
$env:HEALTH_DB_PATH='E:\tmp\health_demo.db'
```

模拟模式可以通过：

```powershell
$env:HEALTH_MOCK_MODE='1'
```

`HEALTH_DB_PATH` 优先级高于默认真实库和默认模拟库。

## 开发说明

- 前端文件由后端直接静态服务，无需构建步骤。
- 前端组件加载顺序是 `primitives.jsx`、`screen_family.jsx`、`screen_member.jsx`。
- 修改前端文件后，浏览器如仍显示旧内容，可以使用 `Ctrl + F5` 硬刷新。
- 修改后端路由后，使用 `uvicorn --reload` 会自动重载；如果没有重载，请手动重启服务。
