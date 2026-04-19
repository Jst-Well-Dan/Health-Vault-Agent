# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 启动与运行

### 后端（FastAPI + SQLite）

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

默认监听 `http://localhost:8000`，自动提供 `/api` REST 接口和前端静态文件。

### 前端

前端由 FastAPI 在 `http://localhost:8000/` 静态服务，无需单独构建。直接打开浏览器访问即可，也可以双击 `frontend/index.html`（仅预览用，API 不可用）。

### 初始化数据库

```bash
cd backend
python scripts/seed_members.py   # 初始化家庭成员（仅首次）
```

### 导入医疗报告

将 MD 报告解析为结构化 JSON 后调用导入脚本：

```bash
python backend/scripts/import_md.py --data '{"visit": {...}, "labs": [...], "meds": [...], "attachments": [...]}'
```

## 整体架构

```
报告md/ (Markdown 格式的医疗原始报告)
    └──Claude Code 解析──▶ backend/scripts/import_md.py
                                   │ 写入
                                   ▼
                            data/health.db (SQLite)
                                   │ 只读
                                   ▼
                        backend/main.py (FastAPI)
                                   │ /api REST 接口
                                   ▼
                        frontend/ (React 18 UMD + Babel)
```

## 后端结构（`backend/`）

- `main.py`：FastAPI 入口，挂载所有路由和静态文件服务
- `database.py`：SQLite 连接（WAL 模式）、建表（`init_db()`），数据库位于 `data/health.db`
- `models.py`：Pydantic v2 模型，`*Create / *Update / *Out` 三层分离
- `routers/`：按资源拆分的路由模块（members、visits、labs、meds、weight、reminders、attachments）
- `scripts/import_md.py`：接收 JSON payload，事务写入 visit + labs + meds + attachments

### 数据库表关系

`members`（主表）← `visits` ← `lab_results` / `meds` / `attachments`  
`members` ← `weight_log` / `reminders`

JSON 字段（`allergies`、`chronic`、`diagnosis`）以字符串形式存储，读取时需 `json.loads`。

## 前端结构（`frontend/`）

- `index.html`：全局状态中心（`App` 组件），管理 `screen`、`memberKey`、`density`、`palette`
- `style.css`：CSS 变量驱动，通过 `data-density` / `data-palette` 属性切换主题和密度
- `components/primitives.jsx`：通用 UI 原语，以 `Object.assign(window, {...})` 暴露为全局
- `components/screen_family.jsx`：家庭总览页，调用 `/api/members` 和 `/api/reminders`
- `components/screen_member.jsx`：成员档案页，含人类和宠物两套标签页逻辑

**组件加载顺序**：`primitives.jsx` → `screen_family.jsx` → `screen_member.jsx`（后者依赖前者的全局变量）。

## API 接口概览

| 路径 | 说明 |
|---|---|
| `GET /api/members` | 全部成员（含 `latest_kpis`、`next_reminder`） |
| `GET /api/members/{key}/visits` | 就诊记录 |
| `GET /api/members/{key}/labs` | 检验结果，支持 `?panel=` 过滤 |
| `GET /api/members/{key}/labs/{test_name}/trend` | 单指标历史趋势 |
| `GET /api/members/{key}/meds` | 用药清单 |
| `GET /api/members/{key}/weight` | 体重趋势 |
| `GET /api/members/{key}/reminders` | 成员提醒 |
| `GET /api/reminders` | 全家提醒（家庭总览用） |
| `GET /api/attachments/recent` | 最近上传附件 |

## 导入报告的标准流程

1. 将新 PDF 放入 `报告pdf/{成员名}/`
2. 将对应 Markdown 报告放入 `data/reports/{成员key}/md/`（文件名格式：`YYYYMMDD_医院_姓名_病症.md`）
3. 告知 Claude Code 报告路径和成员 key，由 Claude Code 解析 MD 并构造 JSON payload
4. 调用 `import_md.py` 写入数据库

## 已知注意事项

- 前端 `ScreenFamily` 提醒清单的基准日期硬编码为 `2026-04-19`，非动态 `new Date()`
- `LineChart` 在趋势页使用 `w={1020}` 硬编码宽度，移动端无响应式
- `species` 字段区分人类（`human`）和宠物（`cat`），前端据此切换标签套
