# 家庭健康档案 · 实施总结

更新日期：2026-04-19

本文档总结本轮基于 `docs/backend_plan.md` 完成的开发、数据导入、前端 API 对接，以及计划中仍未完成或存在偏离的事项。

## 已完成事项

### 1. 目录结构改造

已按计划建立前后端分离目录：

```text
health/
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── components/
│       ├── primitives.jsx
│       ├── screen_family.jsx
│       └── screen_member.jsx
├── backend/
│   ├── requirements.txt
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   ├── routers/
│   └── scripts/
└── data/
    ├── health.db
    └── reports/
```

原前端文件已迁移：

- `family_health_archive.html` -> `frontend/index.html`
- `styles_v2.css` -> `frontend/style.css`
- `v2/primitives.jsx` -> `frontend/components/primitives.jsx`
- `v2/screen_family.jsx` -> `frontend/components/screen_family.jsx`
- `v2/screen_member.jsx` -> `frontend/components/screen_member.jsx`

### 2. 报告文件复制归档

已将用户指定的源目录复制到英文 member key 目录下，源目录保留不动：

- `报告md/春子` -> `data/reports/chunzi/md`
- `报告pdf/春子` -> `data/reports/chunzi/pdf`
- `报告md/开心` -> `data/reports/kaixin/md`
- `报告pdf/开心` -> `data/reports/kaixin/pdf`
- `报告md/波妞` -> `data/reports/boniu/md`
- `报告pdf/波妞` -> `data/reports/boniu/pdf`

### 3. FastAPI 后端

已实现：

- `backend/main.py`：FastAPI 应用入口、CORS、路由注册、前端静态托管。
- `backend/database.py`：SQLite 连接、WAL、建表、索引初始化。
- `backend/models.py`：Pydantic v2 请求/响应模型。
- `backend/requirements.txt`：依赖列表。
- `backend/routers/common.py`：JSON 字段、布尔字段和行转换辅助函数。

已实现路由：

- `backend/routers/members.py`
  - `GET /api/members`
  - `GET /api/members/{key}`
  - `PATCH /api/members/{key}`
- `backend/routers/visits.py`
  - `GET /api/visits?member={key}&limit=...&offset=...`
  - `GET /api/visits/{id}`
- `backend/routers/labs.py`
  - `GET /api/labs?member={key}`
  - `GET /api/labs?member={key}&panel={panel}`
  - `GET /api/labs/available?member={key}`
  - `GET /api/labs/trend?member={key}&test_name={name}`
- `backend/routers/meds.py`
  - `GET /api/meds?member={key}`
  - `POST /api/meds`
  - `PATCH /api/meds/{id}`
  - `DELETE /api/meds/{id}`
- `backend/routers/weight.py`
  - `GET /api/weight?member={key}`
  - `POST /api/weight`
  - `DELETE /api/weight/{id}`
- `backend/routers/reminders.py`
  - `GET /api/reminders`
  - `GET /api/reminders?member={key}`
  - `GET /api/reminders?include_done=true`
  - `POST /api/reminders`
  - `PATCH /api/reminders/{id}`
  - `DELETE /api/reminders/{id}`
- `backend/routers/attachments.py`
  - `GET /api/attachments?member={key}`
  - `GET /api/attachments/recent?limit=8`

### 4. 数据库 Schema

已在 `backend/database.py` 中实现计划中的 7 张表和索引：

- `members`
- `visits`
- `lab_results`
- `meds`
- `weight_log`
- `reminders`
- `attachments`

数据库文件为：

```text
data/health.db
```

当前数据量：

| 表 | 当前记录数 |
|---|---:|
| `members` | 3 |
| `visits` | 8 |
| `lab_results` | 151 |
| `meds` | 13 |
| `weight_log` | 31 |
| `reminders` | 0 |
| `attachments` | 22 |

### 5. 初始化和导入脚本

已实现：

- `backend/scripts/seed_members.py`
  - 初始化 3 个成员：`chunzi`、`kaixin`、`boniu`
  - 使用 `INSERT OR IGNORE`
- `backend/scripts/import_md.py`
  - 接收 `--data` JSON
  - 写入 `visits`
  - 批量写入关联 `lab_results`
  - 批量写入关联 `meds`
  - 批量写入关联 `attachments`
  - 单事务执行，失败回滚

### 6. 报告结构化数据写入

已将现有报告中的可确定信息写入数据库。

春子：

- 安贞医院骨科膝关节就诊记录
- 安贞医院哮喘复查
- 肺功能指标
- FeNO 指标
- 协和医院过敏原 IgE
- 协和医院皮内试验
- 协和医院脱敏治疗
- 协和医院 2026-03-10 复诊
- 相关用药和附件索引

开心：

- 2025-09-18 猫传腹相关实验室检查
- SAA、生化、血常规、疫苗抗体
- 2025-10-03 血常规复查
- 体重趋势
- 相关 PDF、截图、MD 附件索引

波妞：

- 2025-11-07 免疫抗体
- 术前生化
- 血常规
- 体重历史
- 相关 PDF、截图、MD 附件索引

SAA 数据已按要求写入并校正：

| 成员 | 日期 | 指标 | 值 | 单位 | 参考上限 | 状态 |
|---|---|---|---:|---|---:|---|
| 开心 | 2025-09-18 | SAA（猫血清淀粉样蛋白） | 169.44 | mg/L | 2.00 | high |
| 开心 | 2025-10-03 | SAA（猫血清淀粉样蛋白） | 7.02 | mg/L | 4.00 | high |

### 7. 前端 API 对接

已彻底废弃并删除 `frontend/components/data.jsx`。

`frontend/index.html` 已移除：

```html
<script type="text/babel" src="components/data.jsx"></script>
```

当前前端数据来源全部改为 API。

家庭总览 `frontend/components/screen_family.jsx` 使用：

- `/api/members`
- `/api/reminders`
- `/api/attachments/recent?limit=8`

成员档案 `frontend/components/screen_member.jsx` 使用：

- `/api/visits?member={key}&limit=50`
- `/api/labs?member={key}`
- `/api/labs/available?member={key}`
- `/api/labs/trend?member={key}&test_name={name}`
- `/api/meds?member={key}`
- `/api/weight?member={key}`
- `/api/reminders?member={key}`
- `/api/attachments?member={key}`

已确认前端中没有残留以下 mock 全局变量引用：

- `FAMILY`
- `REPORTS`
- `MEDS`
- `REMINDERS`
- `PERSON_METRICS`
- `data.jsx`

### 8. 验证结果

已验证：

- `python backend/scripts/seed_members.py` 可运行。
- `GET /api/members` 返回 3 个成员。
- `GET /api/reminders` 当前返回空数组。
- `POST /api/reminders`、`PATCH /api/reminders/{id}`、`GET /api/reminders` 曾用 TestClient 验证通过；验证后数据库已恢复为无提醒状态。
- `POST /api/weight`、`GET /api/weight?member=kaixin` 曾用 TestClient 验证通过；随后正式导入了真实体重数据。
- `backend/scripts/import_md.py --data ...` 曾验证可写入 `visits/labs/meds/attachments`。
- `GET /api/labs/available?member=chunzi` 可返回记录次数达到 2 次以上的指标。
- `GET /api/labs/trend?member=chunzi&test_name=FEV1` 可返回时间序列。
- `GET /api/labs?member=kaixin&panel=SAA` 返回 2 条 SAA 记录。
- 浏览器打开 `http://127.0.0.1:8000/`，家庭总览、成员档案、指标趋势、宠物体重页均可从 API 加载数据。
- 浏览器控制台无业务错误；仅有 React DevTools 和 Babel Standalone 的开发提示。

## 与 backend_plan.md 的完成情况对照

### 已完成

`backend_plan.md` 中以下项目已完成：

- 创建 `frontend/`、`frontend/components/`、`backend/routers/`、`backend/scripts/`、`data/reports/...` 目录结构。
- 前端文件迁移到 `frontend/`。
- `frontend/index.html` 更新 CSS 和 JSX 路径。
- `backend/requirements.txt`。
- `backend/database.py`。
- `backend/scripts/seed_members.py`。
- `backend/models.py`。
- `backend/main.py`。
- `backend/routers/members.py`。
- `backend/routers/reminders.py`。
- `backend/routers/weight.py`。
- `backend/routers/meds.py`。
- `backend/routers/visits.py`。
- `backend/routers/labs.py`。
- `backend/routers/attachments.py`。
- `backend/scripts/import_md.py`。
- SQLite 数据库初始化。
- FastAPI 静态托管前端。
- API 文档地址 `/docs` 可访问。
- 前端由 API 加载数据，不再依赖 `data.jsx` mock。

### 已完成但与原计划有差异

1. 报告源目录名称不同

原计划写的是：

```text
历史报告md/
历史报告pdf/
```

实际用户指定并使用的是：

```text
报告md/
报告pdf/
```

处理方式：复制到 `data/reports/{member}/{md,pdf}`，并保留源目录。

2. 前端改造超出了原计划阶段

`backend_plan.md` 第 9 节写明“前端改造不是 Codex 此阶段的任务，但需预留接口对接点”。  
后续用户明确要求“把前端从 data.jsx mock 改为读取这些 API，彻底废弃并删除 data.jsx mock”，因此已完成前端 API 对接。

3. `GET /api/labs/trend` 的行为略宽松

计划说明“单项指标历史趋势（≥2条时返回）”。  
当前实现会返回该指标所有可解析数值点，即使只有 1 条也返回 `points`。  
`/api/labs/available` 仍严格只返回记录数 `>=2` 的指标，所以前端趋势筛选不会主动展示单点指标。

4. 报告结构化导入方式

计划中的 `import_md.py` 只负责接收结构化 JSON 写入数据库，不负责 AI/规则解析。  
当前已实现 `import_md.py`，并完成了一次实际报告数据导入；但这次批量解析导入逻辑是在工作过程中执行的，不是独立固化的批量导入脚本。

## 仍未完成或后续待办

### 1. 前端写入表单未实现

API 已支持写入：

- `POST/PATCH/DELETE /api/meds`
- `POST/DELETE /api/weight`
- `POST/PATCH/DELETE /api/reminders`

但前端按钮仍未接入真实表单流程：

- `+ 新增记录`
- `+ 上传报告`
- `+ 添加成员`
- 提醒设置
- 用药新增/编辑/删除
- 体重新增/删除

这属于 `backend_plan.md` 第 9 节提到的“弹窗表单写入接口”后续前端工作。

### 2. 附件打开/下载未实现

数据库已经记录 `attachments.file_path`，前端也能展示附件列表。  
但目前 `打开 ->`、附件缩略卡片还没有绑定真实文件访问。

需要后续补充：

- 后端安全地托管 `data/reports/` 文件，或新增 `/api/files/...`。
- 前端点击附件时打开 PDF/JPG/MD。

### 3. 缺少批量可重复报告导入脚本

当前有通用写入脚本：

```bash
python backend/scripts/import_md.py --data '{...}'
```

但没有将这次“扫描 `data/reports`、解析已知 MD 格式、批量写入数据库”的逻辑固化为仓库脚本。

建议新增：

```text
backend/scripts/import_reports.py
```

用于可重复执行报告复制、解析、清表/增量导入、数据校验。

### 4. 自动化测试未落地为测试文件

本轮使用了 `py_compile`、FastAPI `TestClient` 和浏览器手工验证。  
但仓库中还没有正式测试文件，例如：

```text
backend/tests/test_members.py
backend/tests/test_reminders.py
backend/tests/test_import_md.py
```

### 5. 生产化前端构建未完成

当前仍使用：

- React UMD
- Babel Standalone
- 浏览器端 JSX 编译

这符合原型阶段，但不适合生产部署。  
后续可改为 Vite 或其他构建方式。

### 6. 数据质量仍需人工校对

部分 MD 来源是 OCR 文本，存在识别错误。已修正明确发现的 SAA 字段，但以下数据仍建议人工复核：

- 开心 2025-10-03 SAA 原始 OCR 文本。
- 春子肺功能表格中的部分指标列位。
- 宠物血常规单位和部分异常标记。
- 波妞体重历史中 2025-08-31 有日期但缺少明确体重值，未写入 `weight_log`。

### 7. 提醒数据目前为空

当前 `reminders` 表为 0 条。  
这符合当前数据库状态，但如果需要家庭日历显示真实提醒，需要新增：

- 春子脱敏复诊提醒
- 开心/波妞疫苗或复查提醒
- 宠物驱虫提醒

## 当前启动方式

从项目根目录执行：

```bash
cd backend
uvicorn main:app --reload --port 8000
```

访问：

- 前端：`http://127.0.0.1:8000/`
- API 文档：`http://127.0.0.1:8000/docs`

## 建议下一步

1. 新增 `backend/scripts/import_reports.py`，把报告批量解析导入逻辑固化。
2. 给前端添加用药、体重、提醒的新增/编辑/删除弹窗。
3. 给附件卡片增加真实打开 PDF/JPG/MD 的能力。
4. 增加后端自动化测试，覆盖 CRUD、导入脚本和趋势接口。
5. 对 OCR 导入结果做一次人工校对，尤其是 SAA、肺功能、宠物血常规。
