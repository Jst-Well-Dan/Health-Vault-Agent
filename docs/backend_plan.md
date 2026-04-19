# 家庭健康档案 · 后端实施计划

## 1. 项目定位

个人家庭健康数据管理系统。后端提供 REST API，前端 React 原型通过 API 读写数据，不再依赖静态 mock 数据。  
Claude Code Agent 负责解析医疗报告 MD 文件并批量写入数据库；体重、用药、提醒等日常数据支持前端页面直接录入。

---

## 2. 技术栈

| 层 | 技术 |
|---|---|
| 数据库 | SQLite（单文件 `data/health.db`） |
| 后端框架 | Python 3.11+ · FastAPI · uvicorn |
| 数据校验 | Pydantic v2 |
| 数据库驱动 | Python 内置 `sqlite3` |
| 跨域 | FastAPI CORSMiddleware，允许 `localhost` 全端口 |

依赖列表（`backend/requirements.txt`）：

```
fastapi>=0.111.0
uvicorn[standard]>=0.29.0
pydantic>=2.7.0
python-multipart>=0.0.9
```

启动命令（从项目根目录执行）：

```bash
cd backend
uvicorn main:app --reload --port 8000
```

- 前端页面：`http://localhost:8000/`（FastAPI 直接托管 `frontend/`）
- API 接口：`http://localhost:8000/api/...`
- 自动文档：`http://localhost:8000/docs`

---

## 3. 目录结构

```
health/
├── frontend/                      # 前端（FastAPI 静态托管，访问 localhost:8000/）
│   ├── index.html                 # 原 family_health_archive.html
│   ├── style.css                  # 原 styles_v2.css
│   └── components/                # 原 v2/
│       ├── primitives.jsx
│       ├── screen_family.jsx
│       └── screen_member.jsx
│
├── backend/
│   ├── requirements.txt
│   ├── main.py                    # FastAPI 入口，托管前端 + 注册路由
│   ├── database.py                # 建表 + 连接管理
│   ├── models.py                  # Pydantic 请求/响应模型
│   ├── routers/
│   │   ├── members.py
│   │   ├── visits.py
│   │   ├── labs.py
│   │   ├── meds.py
│   │   ├── weight.py
│   │   ├── reminders.py
│   │   └── attachments.py
│   └── scripts/
│       ├── seed_members.py        # 初始化成员数据（一次性运行）
│       └── import_md.py           # Agent 调用：解析 MD 写入数据库
│
├── data/
│   ├── health.db                  # SQLite 数据库（自动创建）
│   └── reports/                   # 原始报告，按成员 key 归档
│       ├── chunzi/
│       │   ├── md/                # 原 历史报告md/春子/
│       │   └── pdf/               # 原 历史报告pdf/春子/
│       ├── kaixin/
│       │   ├── md/
│       │   └── pdf/
│       └── boniu/
│           ├── md/
│           └── pdf/
│
└── docs/
    ├── backend_plan.md
    └── overview.md
```

**目录说明：**
- `frontend/` 去掉 `v2` 版本前缀，`components/` 替代原来的 `v2/`，`data.jsx` 不再需要（数据从 API 加载）
- `data/reports/` 用英文 member key 命名，避免中文路径在脚本中出问题；`md/` 和 `pdf/` 分开存放
- `backend/` 与 `frontend/` 并列，职责清晰
- `health.db` 放在 `data/` 下而非根目录，数据文件集中管理

---

## 4. 数据库 Schema

文件：`backend/database.py`  
在模块导入时自动执行 `CREATE TABLE IF NOT EXISTS`，无需手动迁移。  
`DB_PATH` 指向 `../data/health.db`（相对于 `backend/` 目录）。

### 4.1 members（成员主表）

```sql
CREATE TABLE IF NOT EXISTS members (
  key         TEXT PRIMARY KEY,
  name        TEXT NOT NULL,          -- 昵称，如"春子"
  full_name   TEXT,                   -- 全名，如"杨昭春子"
  initial     TEXT,                   -- 头像字，如"春"
  birth_date  TEXT,                   -- ISO 日期 '1997-03-21'
  sex         TEXT,                   -- '女' / '男' / '雌' / '雄'
  blood_type  TEXT,                   -- 'A' / 'B' / 'O' / 'AB' / NULL
  role        TEXT,                   -- '本人' / '伴侣' / '猫咪' 等
  species     TEXT NOT NULL DEFAULT 'human',  -- 'human' / 'cat'
  chip_id     TEXT,                   -- 宠物芯片号
  doctor      TEXT,                   -- 主治医生备注
  allergies   TEXT DEFAULT '[]',      -- JSON 字符串数组
  chronic     TEXT DEFAULT '[]',      -- JSON 字符串数组（慢性病）
  notes       TEXT,
  created_at  TEXT DEFAULT (datetime('now','localtime')),
  updated_at  TEXT DEFAULT (datetime('now','localtime'))
);
```

### 4.2 visits（就诊记录）

```sql
CREATE TABLE IF NOT EXISTS visits (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  member_key      TEXT NOT NULL REFERENCES members(key),
  date            TEXT NOT NULL,       -- '2025-09-02'
  hospital        TEXT,                -- '北京安贞医院'
  department      TEXT,                -- '呼吸与危重症医学科'
  doctor          TEXT,
  chief_complaint TEXT,                -- 主诉，如'哮喘复查'
  diagnosis       TEXT DEFAULT '[]',  -- JSON 字符串数组
  notes           TEXT,                -- 医嘱/备注
  source_file     TEXT,                -- 来源 MD 文件名
  created_at      TEXT DEFAULT (datetime('now','localtime'))
);
```

### 4.3 lab_results（检验指标）

每个检验项目单独一行，支持跨次就诊的趋势查询。

```sql
CREATE TABLE IF NOT EXISTS lab_results (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  member_key  TEXT NOT NULL REFERENCES members(key),
  visit_id    INTEGER REFERENCES visits(id),
  date        TEXT NOT NULL,
  panel       TEXT NOT NULL,   -- 检验板块：'血常规'/'肺功能'/'过敏原IgE'/'FeNO'/'血生化'/'体重'等
  test_name   TEXT NOT NULL,   -- 指标名：'WBC'/'FEV1'/'猫皮屑'/'FeNO' 等
  value       TEXT,            -- 统一字符串（兼容数字和等级描述）
  unit        TEXT,
  ref_low     TEXT,            -- 参考下限
  ref_high    TEXT,            -- 参考上限
  status      TEXT,            -- 'normal' / 'high' / 'low' / 'abnormal'
  source_file TEXT,
  created_at  TEXT DEFAULT (datetime('now','localtime'))
);
```

### 4.4 meds（用药记录）

```sql
CREATE TABLE IF NOT EXISTS meds (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  member_key  TEXT NOT NULL REFERENCES members(key),
  visit_id    INTEGER REFERENCES visits(id),  -- 可为 NULL（手动录入）
  name        TEXT NOT NULL,   -- 药品名
  dose        TEXT,            -- '1粒' / '60mg'
  freq        TEXT,            -- '每日1次' / '每日3次'
  route       TEXT,            -- '口服' / '喷吸' / '外用' / '喷鼻'
  start_date  TEXT,
  end_date    TEXT,            -- NULL 表示长期/按需
  ongoing     INTEGER NOT NULL DEFAULT 0,  -- 1=长期在服
  notes       TEXT,
  created_at  TEXT DEFAULT (datetime('now','localtime')),
  updated_at  TEXT DEFAULT (datetime('now','localtime'))
);
```

### 4.5 weight_log（体重记录，仅宠物）

```sql
CREATE TABLE IF NOT EXISTS weight_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  member_key  TEXT NOT NULL REFERENCES members(key),
  date        TEXT NOT NULL,
  weight_kg   REAL NOT NULL,
  notes       TEXT,
  created_at  TEXT DEFAULT (datetime('now','localtime'))
);
```

### 4.6 reminders（提醒）

```sql
CREATE TABLE IF NOT EXISTS reminders (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  member_key  TEXT NOT NULL REFERENCES members(key),
  date        TEXT NOT NULL,
  title       TEXT NOT NULL,
  kind        TEXT NOT NULL,   -- '就医' / '疫苗' / '体检' / '驱虫' / '宠物' / '其他'
  priority    TEXT NOT NULL DEFAULT 'normal',  -- 'high' / 'normal'
  done        INTEGER NOT NULL DEFAULT 0,      -- 0=待办 1=已完成
  done_at     TEXT,            -- 标记完成时间
  notes       TEXT,
  created_at  TEXT DEFAULT (datetime('now','localtime'))
);
```

### 4.7 attachments（附件索引）

```sql
CREATE TABLE IF NOT EXISTS attachments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  member_key  TEXT NOT NULL REFERENCES members(key),
  visit_id    INTEGER REFERENCES visits(id),
  date        TEXT NOT NULL,
  title       TEXT NOT NULL,   -- 展示名，如'肺功能报告'
  org         TEXT,            -- 机构名
  tag         TEXT,            -- '体检'/'就医'/'影像'/'疫苗'/'驱虫'/'用药'/'其他'
  filename    TEXT,            -- 原始文件名
  file_path   TEXT,            -- 相对于项目根目录的路径，如 'data/reports/chunzi/pdf/xxx.pdf'
  notes       TEXT,
  created_at  TEXT DEFAULT (datetime('now','localtime'))
);
```

### 4.8 索引

```sql
CREATE INDEX IF NOT EXISTS idx_visits_member       ON visits(member_key, date);
CREATE INDEX IF NOT EXISTS idx_labs_member         ON lab_results(member_key, test_name, date);
CREATE INDEX IF NOT EXISTS idx_labs_panel          ON lab_results(member_key, panel);
CREATE INDEX IF NOT EXISTS idx_meds_member         ON meds(member_key);
CREATE INDEX IF NOT EXISTS idx_weight_member       ON weight_log(member_key, date);
CREATE INDEX IF NOT EXISTS idx_reminders_member    ON reminders(member_key, date);
CREATE INDEX IF NOT EXISTS idx_attachments_member  ON attachments(member_key, date);
```

---

## 5. API 接口规范

所有接口前缀 `/api`，返回 JSON，错误统一格式：

```json
{ "detail": "错误描述" }
```

### 5.1 Members

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/members` | 获取全部成员列表，含每人最新关键指标 |
| GET | `/api/members/{key}` | 获取单个成员详情 |
| PATCH | `/api/members/{key}` | 更新成员基础信息 |

**GET /api/members 响应示例：**

```json
[
  {
    "key": "chunzi",
    "name": "春子",
    "full_name": "杨昭春子",
    "initial": "春",
    "birth_date": "1997-03-21",
    "sex": "女",
    "blood_type": "A",
    "role": "本人",
    "species": "human",
    "chip_id": null,
    "doctor": "张萌（协和变态反应科）",
    "allergies": ["猫皮屑"],
    "chronic": ["支气管哮喘", "过敏性鼻炎"],
    "notes": null,
    "latest_kpis": [
      { "test_name": "FeNO", "value": "185.4", "unit": "ppb", "date": "2025-09-02", "status": "high" },
      { "test_name": "FEV1%", "value": "92", "unit": "%", "date": "2025-09-02", "status": "normal" }
    ],
    "next_reminder": { "id": 1, "date": "2026-05-10", "title": "协和脱敏复诊", "kind": "就医" }
  }
]
```

**PATCH /api/members/{key} 请求体（所有字段可选）：**

```json
{
  "doctor": "新主治医生",
  "allergies": ["猫皮屑", "花粉"],
  "chronic": ["支气管哮喘"],
  "notes": "备注信息"
}
```

### 5.2 Visits

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/visits?member={key}&limit=20&offset=0` | 分页获取就诊记录 |
| GET | `/api/visits/{id}` | 获取单条就诊详情（含关联指标和处方） |

**GET /api/visits 响应示例：**

```json
{
  "total": 5,
  "items": [
    {
      "id": 1,
      "member_key": "chunzi",
      "date": "2025-09-02",
      "hospital": "北京安贞医院",
      "department": "呼吸与危重症医学科",
      "doctor": "李阁",
      "chief_complaint": "哮喘复查",
      "diagnosis": ["支气管哮喘(未控制)", "过敏性鼻炎"],
      "notes": "激发试验强阳性，FeNO 185.4ppb",
      "source_file": "20250902_安贞医院_春子_哮喘.md"
    }
  ]
}
```

**GET /api/visits/{id} 响应（包含关联数据）：**

```json
{
  "visit": { ...同上... },
  "labs": [ ...该次就诊的检验指标列表... ],
  "meds": [ ...该次开具的处方列表... ],
  "attachments": [ ...关联附件... ]
}
```

### 5.3 Labs（检验指标）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/labs?member={key}` | 获取该成员所有检验板块及最新值 |
| GET | `/api/labs?member={key}&panel={panel}` | 按板块筛选 |
| GET | `/api/labs/trend?member={key}&test_name={name}` | 单项指标历史趋势（≥2条时返回） |
| GET | `/api/labs/available?member={key}` | 返回该成员记录≥2次的指标列表（供前端筛选按钮用） |

**GET /api/labs/available 响应示例：**

```json
[
  { "test_name": "FeNO", "panel": "FeNO", "unit": "ppb", "count": 3 },
  { "test_name": "FEV1", "panel": "肺功能", "unit": "L", "count": 2 },
  { "test_name": "WBC", "panel": "血常规", "unit": "10^3/uL", "count": 2 }
]
```

**GET /api/labs/trend 响应示例：**

```json
{
  "test_name": "FeNO",
  "unit": "ppb",
  "ref_low": null,
  "ref_high": "50",
  "points": [
    { "date": "2025-09-02", "value": 185.4, "visit_id": 1 },
    { "date": "2025-10-15", "value": 142.0, "visit_id": 3 },
    { "date": "2026-03-10", "value": 98.5,  "visit_id": 7 }
  ]
}
```

### 5.4 Meds（用药）

前端支持新增、更新、删除。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/meds?member={key}` | 获取用药列表（默认按 ongoing 和 start_date 排序） |
| POST | `/api/meds` | 新增用药记录 |
| PATCH | `/api/meds/{id}` | 更新用药记录 |
| DELETE | `/api/meds/{id}` | 删除用药记录 |

**POST /api/meds 请求体：**

```json
{
  "member_key": "chunzi",
  "name": "布地奈德鼻喷雾剂",
  "dose": "4喷",
  "freq": "每日1次",
  "route": "喷鼻",
  "start_date": "2025-09-16",
  "end_date": null,
  "ongoing": true,
  "notes": "控制过敏性鼻炎"
}
```

### 5.5 Weight（体重，仅宠物）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/weight?member={key}` | 获取体重历史（按日期升序） |
| POST | `/api/weight` | 新增一条体重记录 |
| DELETE | `/api/weight/{id}` | 删除一条记录 |

**POST /api/weight 请求体：**

```json
{
  "member_key": "kaixin",
  "date": "2026-04-19",
  "weight_kg": 4.14,
  "notes": ""
}
```

### 5.6 Reminders（提醒）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/reminders` | 获取全家提醒（默认只返回未完成，按日期升序） |
| GET | `/api/reminders?member={key}` | 按成员筛选 |
| GET | `/api/reminders?include_done=true` | 包含已完成 |
| POST | `/api/reminders` | 新增提醒 |
| PATCH | `/api/reminders/{id}` | 更新提醒（含标记完成） |
| DELETE | `/api/reminders/{id}` | 删除提醒 |

**PATCH /api/reminders/{id} 标记完成：**

```json
{ "done": true }
```

**POST /api/reminders 请求体：**

```json
{
  "member_key": "chunzi",
  "date": "2026-05-10",
  "title": "协和脱敏复诊",
  "kind": "就医",
  "priority": "normal",
  "notes": "第4针"
}
```

### 5.7 Attachments（附件）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/attachments?member={key}` | 按成员获取附件列表 |
| GET | `/api/attachments/recent?limit=8` | 最近上传（家庭总览页用） |

---

## 6. 后端代码规范

### 6.1 main.py

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from database import init_db
from routers import members, visits, labs, meds, weight, reminders, attachments
import os

app = FastAPI(title="家庭健康档案 API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # 本地开发，全开
    allow_methods=["*"],
    allow_headers=["*"],
)

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")

@app.on_event("startup")
def startup():
    init_db()

app.include_router(members.router,     prefix="/api")
app.include_router(visits.router,      prefix="/api")
app.include_router(labs.router,        prefix="/api")
app.include_router(meds.router,        prefix="/api")
app.include_router(weight.router,      prefix="/api")
app.include_router(reminders.router,   prefix="/api")
app.include_router(attachments.router, prefix="/api")

# 前端静态文件托管——必须在所有 API 路由注册后挂载
# 访问 / 返回 frontend/index.html
@app.get("/")
def serve_index():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

app.mount("/", StaticFiles(directory=FRONTEND_DIR), name="frontend")
```

### 6.2 database.py

提供：
- `DB_PATH`：`../data/health.db` 的绝对路径（`Path(__file__).parent.parent / "data" / "health.db"`）
- `get_conn()`：返回 `sqlite3.Connection`，设置 `row_factory = sqlite3.Row`（行可按列名访问），开启 WAL 模式（`PRAGMA journal_mode=WAL`）
- `init_db()`：执行所有 `CREATE TABLE IF NOT EXISTS` 和 `CREATE INDEX IF NOT EXISTS`

### 6.3 models.py

为每个表定义 Pydantic BaseModel，分为三类：
- `XxxCreate`：POST 请求体
- `XxxUpdate`：PATCH 请求体（所有字段 `Optional`）
- `XxxOut`：响应体

JSON 字段（allergies/chronic/diagnosis）在数据库中存储为 JSON 字符串，读取时自动 `json.loads`，写入时自动 `json.dumps`。

### 6.4 路由文件结构

每个路由文件：
- 使用 `APIRouter(tags=[...])`
- 每个函数用 `with get_conn() as conn:` 管理连接
- 查询结果通过 `[dict(row) for row in cursor.fetchall()]` 转为字典

---

## 7. 初始化脚本：seed_members.py

文件：`backend/scripts/seed_members.py`

插入以下成员（如已存在则跳过，使用 `INSERT OR IGNORE`）：

| key | name | full_name | birth_date | sex | species | role | chronic |
|---|---|---|---|---|---|---|---|
| chunzi | 春子 | 杨昭春子 | 1997-03-21 | 女 | human | 本人 | ["支气管哮喘","过敏性鼻炎"] |
| kaixin | 开心 | 开心 | 2020-09-01 | 雌 | cat | 猫咪 | [] |
| boniu | 波妞 | 波妞 | 2025-05-01 | 雌 | cat | 猫咪 | [] |

日期为估算值，可后期修改。allergies 也可后期通过 PATCH /api/members/{key} 更新。

运行方式（从项目根目录执行）：

```bash
python backend/scripts/seed_members.py
```

---

## 8. 导入脚本：import_md.py

文件：`backend/scripts/import_md.py`

此脚本由 Claude Code Agent 调用，将一份 MD 文件的内容解析后写入数据库。

**调用方式（Agent 提取结构化数据后传入 JSON）：**

```bash
python backend/scripts/import_md.py --data '{"visit":{...},"labs":[...],"meds":[...],"attachments":[...]}'
```

Agent 的职责是读取 MD 文件并提取结构化字段，脚本只负责数据库写入，不做 AI 解析。

**import_md.py 接收的 JSON 结构：**

```json
{
  "visit": {
    "member_key": "chunzi",
    "date": "2025-09-02",
    "hospital": "北京安贞医院",
    "department": "呼吸与危重症医学科",
    "doctor": "李阁",
    "chief_complaint": "哮喘复查",
    "diagnosis": ["支气管哮喘(未控制)", "过敏性鼻炎"],
    "notes": "激发试验强阳性",
    "source_file": "20250902_安贞医院_春子_哮喘.md"
  },
  "labs": [
    {
      "panel": "肺功能",
      "test_name": "FVC",
      "value": "3.83",
      "unit": "L",
      "ref_low": null,
      "ref_high": null,
      "status": "normal"
    },
    {
      "panel": "FeNO",
      "test_name": "FeNO",
      "value": "185.4",
      "unit": "ppb",
      "ref_low": null,
      "ref_high": "50",
      "status": "high"
    }
  ],
  "meds": [
    {
      "name": "芘达格莫吸入粉雾剂",
      "dose": "1粒",
      "freq": "每日1次",
      "route": "喷吸",
      "start_date": "2025-09-16",
      "end_date": null,
      "ongoing": false
    }
  ],
  "attachments": [
    {
      "title": "肺功能+FeNO报告",
      "org": "北京安贞医院",
      "tag": "就医",
      "filename": "20250902_安贞医院_春子_哮喘.md",
      "file_path": "data/reports/chunzi/md/20250902_安贞医院_春子_哮喘.md"
    }
  ]
}
```

**脚本写入逻辑：**

1. 插入 `visits` 表，获得 `visit_id`
2. 批量插入 `lab_results`（date 继承 visit.date，member_key 继承 visit.member_key）
3. 批量插入 `meds`（visit_id 关联）
4. 批量插入 `attachments`（visit_id 关联）
5. 全部在一个事务中执行，失败整体回滚

---

## 9. 前端改造要点

前端改造不是 Codex 此阶段的任务，但需预留接口对接点：

- `frontend/index.html` 中的 `<script src>` 路径从 `v2/xxx.jsx` 改为 `components/xxx.jsx`
- 原 `v2/data.jsx` 不再需要，数据改为从 API 加载：`FAMILY` → `fetch('/api/members')`，`REMINDERS` → `fetch('/api/reminders')`
- 成员档案页各 Tab 对应的 API：
  - 概览 → `/api/members/{key}` + `/api/visits?member={key}&limit=4`
  - 指标趋势 → `/api/labs/available?member={key}` + `/api/labs/trend?member={key}&test_name={name}`
  - 体检报告/就医记录 → `/api/visits?member={key}`
  - 用药 → `/api/meds?member={key}`
  - 影像/附件库 → `/api/attachments?member={key}`
  - 提醒 → `/api/reminders?member={key}`
  - 宠物体重趋势 → `/api/weight?member={key}`
- 弹窗表单写入接口：POST/PATCH `/api/meds`、`/api/weight`、`/api/reminders`

---

## 10. 实施顺序

Codex 按以下顺序实现，每步可独立验证：

**准备阶段**
1. 创建目录结构：`frontend/`、`frontend/components/`、`backend/routers/`、`backend/scripts/`、`data/reports/chunzi/md`、`data/reports/chunzi/pdf`、`data/reports/kaixin/md`、`data/reports/kaixin/pdf`、`data/reports/boniu/md`、`data/reports/boniu/pdf`
2. 将现有文件迁移到新位置：`family_health_archive.html` → `frontend/index.html`，`styles_v2.css` → `frontend/style.css`，`v2/*.jsx` → `frontend/components/`，`历史报告md/春子/*` → `data/reports/chunzi/md/`，以此类推
3. `frontend/index.html` 中更新 CSS 和 JSX 的 `<script src>` 路径

**后端实现**
4. **`backend/requirements.txt`** — 写入依赖列表
5. **`backend/database.py`** — 建表逻辑，`DB_PATH` 指向 `../data/health.db`
6. **`backend/scripts/seed_members.py`** — 写入初始 3 条成员记录
7. **`backend/models.py`** — 全部 Pydantic 模型
8. **`backend/main.py`** — 应用框架，CORS，路由注册，前端静态托管
9. **`backend/routers/members.py`** — GET /api/members（含 latest_kpis 和 next_reminder 聚合）、GET /api/members/{key}、PATCH /api/members/{key}
10. **`backend/routers/reminders.py`** — GET/POST/PATCH/DELETE
11. **`backend/routers/weight.py`** — GET/POST/DELETE
12. **`backend/routers/meds.py`** — GET/POST/PATCH/DELETE
13. **`backend/routers/visits.py`** — GET（只读）
14. **`backend/routers/labs.py`** — GET available + GET trend
15. **`backend/routers/attachments.py`** — GET
16. **`backend/scripts/import_md.py`** — 接收 `--data` JSON 写入数据库

**验证**
17. `python backend/scripts/seed_members.py` 初始化成员
18. `cd backend && uvicorn main:app --reload --port 8000`，访问 `http://localhost:8000/docs` 逐一测试接口

---

## 11. 验证检查清单

- [ ] `python backend/scripts/seed_members.py` 运行无报错，`data/health.db` 中有 3 条成员记录
- [ ] `GET /api/members` 返回 3 条成员，含 `latest_kpis` 和 `next_reminder` 字段
- [ ] `GET /api/reminders` 返回空数组（初始无数据）
- [ ] `POST /api/reminders` 新增成功，`GET /api/reminders` 可查到
- [ ] `PATCH /api/reminders/{id}` 传 `{"done": true}` 后，GET 默认不再返回该条
- [ ] `POST /api/weight` 为 kaixin 新增体重，`GET /api/weight?member=kaixin` 可查
- [ ] `python backend/scripts/import_md.py --data '{...}'` 写入后，visits/labs/meds/attachments 均有数据
- [ ] `GET /api/labs/available?member=chunzi` 返回记录≥2次的指标列表
- [ ] `GET /api/labs/trend?member=chunzi&test_name=FeNO` 返回时间序列数据
