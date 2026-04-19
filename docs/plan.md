数据结构已经清楚了。现在给出完整设计方案。

---

## 整体架构

```
历史报告md/          Claude Code Agent
    └──读取解析──▶  backend/scripts/import_md.py
                           │ 写入
                           ▼
                      health.db (SQLite)
                           │ 只读
                           ▼
                  backend/main.py (FastAPI)
                           │ REST API
                           ▼
              family_health_archive.html (React前端)
```

**为什么这样设计：**
- SQLite 零配置、单文件，完全本地，适合个人使用
- FastAPI 自动生成 API 文档，运行一条命令即可
- Agent 只管写入，前端只管读取，职责分离干净

---

## 数据库 Schema

基于你的报告，共 7 张表：

```sql
-- 家庭成员（主表）
CREATE TABLE members (
  key         TEXT PRIMARY KEY,  -- 'chunzi', 'kaixin', 'boniu'
  name        TEXT,
  full_name   TEXT,
  birth_date  TEXT,
  sex         TEXT,
  blood_type  TEXT,
  role        TEXT,
  species     TEXT DEFAULT 'human',  -- human / cat
  chip_id     TEXT,
  allergies   TEXT,  -- JSON: ["猫皮屑", "花粉"]
  chronic     TEXT   -- JSON: ["哮喘", "过敏性鼻炎"]
);

-- 就诊记录（每次就诊一条）
CREATE TABLE visits (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  member_key      TEXT REFERENCES members(key),
  date            TEXT,  -- '2025-09-02'
  hospital        TEXT,  -- '北京安贞医院'
  department      TEXT,  -- '呼吸与危重症医学科'
  doctor          TEXT,
  chief_complaint TEXT,  -- '哮喘复查'
  diagnosis       TEXT,  -- JSON: ["支气管哮喘(未控制)", "过敏性鼻炎"]
  notes           TEXT,
  source_file     TEXT   -- '20250902_安贞医院_春子_哮喘.md'
);

-- 检验指标（支持趋势图，每个指标一行）
CREATE TABLE lab_results (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  member_key  TEXT REFERENCES members(key),
  visit_id    INTEGER REFERENCES visits(id),
  date        TEXT,
  panel       TEXT,   -- '血常规' / '肺功能' / '过敏原IgE' / 'FeNO'
  test_name   TEXT,   -- 'WBC' / 'FEV1' / '猫皮屑' / 'FeNO'
  value       TEXT,   -- 统一用字符串（兼容数字和等级）
  unit        TEXT,
  ref_low     TEXT,
  ref_high    TEXT,
  status      TEXT    -- normal / high / low
);

-- 处方/用药
CREATE TABLE meds (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  member_key  TEXT REFERENCES members(key),
  visit_id    INTEGER REFERENCES visits(id),
  name        TEXT,   -- '芘达格莫吸入粉雾剂'
  dose        TEXT,   -- '1粒'
  freq        TEXT,   -- '每日1次'
  route       TEXT,   -- '喷吸' / '口服' / '外用'
  start_date  TEXT,
  end_date    TEXT,
  ongoing     INTEGER DEFAULT 0
);

-- 体重记录（人猫通用）
CREATE TABLE weight_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  member_key  TEXT REFERENCES members(key),
  date        TEXT,
  weight_kg   REAL
);

-- 提醒（复诊/疫苗/驱虫等）
CREATE TABLE reminders (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  member_key  TEXT REFERENCES members(key),
  date        TEXT,
  title       TEXT,
  kind        TEXT,   -- 就医 / 疫苗 / 体检 / 驱虫 / 宠物
  priority    TEXT DEFAULT 'normal',
  done        INTEGER DEFAULT 0
);

-- 附件索引（指向原始文件）
CREATE TABLE attachments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  member_key  TEXT REFERENCES members(key),
  visit_id    INTEGER REFERENCES visits(id),
  date        TEXT,
  title       TEXT,
  org         TEXT,
  tag         TEXT,   -- 体检 / 就医 / 影像 / 疫苗 / 驱虫
  filename    TEXT,
  file_path   TEXT    -- 指向 历史报告pdf/ 中的原文件
);
```

---

## 后端 API 接口

```
GET  /api/members                      → 全部成员 + 关键指标（替代 FAMILY 静态数据）
GET  /api/members/{key}/overview       → KPI卡片 + 最近就诊 + 当前用药
GET  /api/members/{key}/visits         → 就诊记录列表（含诊断/处方）
GET  /api/members/{key}/labs?panel=肺功能  → 按检验板块过滤
GET  /api/members/{key}/labs/{test_name}/trend → 单项指标历史趋势（折线图用）
GET  /api/members/{key}/meds           → 当前用药
GET  /api/members/{key}/weight         → 体重趋势
GET  /api/members/{key}/reminders      → 成员提醒
GET  /api/reminders                    → 全家提醒（家庭总览页用）
GET  /api/attachments/recent           → 最近上传（家庭总览页用）
```

---

## Agent 写入流程

你用 Claude Code 处理新报告时，只需这一套动作：

```
1. 把新 PDF 放进 历史报告pdf/春子/
2. 告诉 Claude Code：
   "这是春子 2026-04-19 协和医院脱敏治疗的报告，请提取数据写入数据库"
3. Claude Code 读取 MD 文件，调用 backend/scripts/import_md.py
4. 脚本向 visits / lab_results / meds 表写入结构化数据
5. 前端刷新自动看到新数据
```

---

## 目录结构

```
health/
├── family_health_archive.html   (前端，改为调用 API)
├── styles_v2.css
├── v2/
├── 历史报告md/
├── 历史报告pdf/
├── health.db                    ← SQLite 数据库文件
└── backend/
    ├── main.py                  ← FastAPI 入口，uvicorn main:app
    ├── database.py              ← SQLite 连接 + 建表
    ├── routers/
    │   ├── members.py
    │   ├── visits.py
    │   ├── labs.py
    │   └── reminders.py
    └── scripts/
        ├── seed_members.py      ← 初始化成员数据（一次性）
        └── import_record.py     ← Agent 调用写入新记录
```

---

## 下一步建议

建议分两阶段推进：

**阶段一（先跑起来）**
1. 建 `backend/database.py`，建表，写 `seed_members.py` 初始化你的家人数据
2. 写 `backend/main.py`，先实现 `GET /api/members` 和 `GET /api/reminders`
3. 把前端 `ScreenFamily` 的静态 `FAMILY` 改为 `fetch('/api/members')` 调用

**阶段二（Agent 写入）**
4. 写 `import_record.py` 脚本：接收 MD 文件路径，让 Claude Code 提取结构化字段并插入数据库
5. 历史报告批量导入

---

要我现在开始实现其中某个部分吗？推荐先从 `database.py`（建表）+ `seed_members.py`（初始化你的真实家人数据）开始。