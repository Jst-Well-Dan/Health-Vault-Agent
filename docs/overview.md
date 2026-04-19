# 家庭健康档案 · 档案簿 v2 — 项目说明

## 项目概述

这是一个纯前端的家庭健康信息管理原型，定位为中高保真交互原型（Mid-Fi Wireframe）。页面无需构建工具，直接在浏览器中打开 `family_health_archive.html` 即可运行。

技术栈：React 18（UMD）+ Babel Standalone（浏览器端实时编译 JSX）+ 原生 CSS。

---

## 文件结构

```
health/
├── family_health_archive.html   入口文件，挂载 React 根组件
├── styles_v2.css                全局样式，定义视觉语言
└── v2/
    ├── primitives.jsx           通用 UI 原语组件
    ├── data.jsx                 静态演示数据
    ├── screen_family.jsx        家庭总览页
    └── screen_member.jsx        成员档案页及所有子标签
```

入口文件按 `primitives.jsx → data.jsx → screen_family.jsx → screen_member.jsx` 顺序加载，后续文件直接使用前者挂在 `window` 上的全局变量。

---

## 入口文件 `family_health_archive.html`

### 外部依赖

| 资源 | 版本 | 用途 |
|---|---|---|
| Google Fonts | — | Caveat / Kalam / JetBrains Mono |
| React UMD | 18.3.1 | UI 渲染 |
| ReactDOM UMD | 18.3.1 | DOM 挂载 |
| Babel Standalone | 7.29.0 | 浏览器端编译 JSX |

### 根组件 `App`

`App` 是全局状态中心，管理以下状态：

| 状态 | 初始值 | 持久化 | 作用 |
|---|---|---|---|
| `screen` | `family` | `localStorage.fhv2_screen` | 当前顶层页（家庭总览 / 成员档案） |
| `memberKey` | `me` | `localStorage.fhv2_member` | 当前查看的成员 |
| `density` | `cozy` | — | 页面间距密度 |
| `palette` | `warm` | — | 主题配色 |
| `tweaksOpen` | `false` | — | Tweaks 调试面板开关 |

`density` 和 `palette` 写入 `document.documentElement.dataset`，由 CSS 变量响应切换，无需修改任何组件代码。

### 编辑模式通信

页面支持被父窗口嵌入并控制：

- 接收 `__activate_edit_mode`：打开 Tweaks 面板
- 接收 `__deactivate_edit_mode`：关闭 Tweaks 面板
- 发送 `__edit_mode_available`：通知父窗口已就绪
- 发送 `__edit_mode_set_keys`：把 density / palette 变更上报父窗口

### 顶层导航

两个顶层页面，定义在 `SCREENS` 数组中：

| key | 编号 | 标题 |
|---|---|---|
| `family` | 00 | 家庭总览 |
| `member` | 01 | 成员档案 |

切换方式：顶部 Tab 点击，或在家庭总览中点击家人卡片（自动跳转至成员档案）。

---

## 样式文件 `styles_v2.css`

### 视觉风格

页面模拟手绘纸质档案簿风格：纸张底色、手写字体、粗描边、偏转角度、虚线分割、邮戳标签。

### CSS 变量体系

核心变量定义在 `:root`，通过 `data-density` / `data-palette` 属性覆盖：

**色彩**

| 变量 | 默认值 | 说明 |
|---|---|---|
| `--bg` | `#f7f1e4` | 页面背景 |
| `--paper` | `#fffdf6` | 卡片主色 |
| `--paper-2` | `#f3ebd8` | 卡片次色 |
| `--ink` | `#1f1b16` | 主文字 |
| `--ink-soft` | `#6b6354` | 辅助文字 |
| `--ink-ghost` | `#b6ab94` | 弱化文字 |
| `--line` | `#2a241c` | 边框描边 |
| `--rule` | `#d9cfb8` | 分割线 |
| `--accent` | oklch(0.72 0.12 50) | 主强调色（暖橙） |
| `--accent-2` | oklch(0.78 0.06 170) | 次强调色（薄荷） |
| `--accent-3` | oklch(0.82 0.08 80) | 三级强调色（柔黄） |
| `--danger` | oklch(0.62 0.15 25) | 警告 / 异常 |
| `--ok` | oklch(0.62 0.10 160) | 正常 / 完成 |

**配色主题**（`data-palette`）

| 值 | 说明 |
|---|---|
| `warm`（默认） | 暖橙系 |
| `mint` | 薄荷绿系 |
| `mono` | 墨黑无彩 |

**间距密度**（`data-density`）

| 值 | `--pad` | `--gap` |
|---|---|---|
| `compact` | 12px | 10px |
| `cozy`（默认） | 18px | 14px |
| `spacious` | 26px | 22px |

### 主要布局类

| 类名 | 作用 |
|---|---|
| `.app` | 全局容器，最大宽 1320px，水平居中 |
| `.mast` | 页头，标题左侧 + 操作右侧 |
| `.screen-tabs` | 顶层 Tab 导航 |
| `.binder` | 成员档案左右档案夹布局（220px 侧边 + 弹性内容区） |
| `.binder__side` | 档案夹侧边栏 |
| `.binder__body` | 档案夹内容区 |
| `.tabs-row` | 成员档案内部 Tab 行 |
| `.row-list` | 报告 / 提醒 / 用药列表 |
| `.tile` | 指标统计卡片 |
| `.grid-2/3/4/6` | 网格辅助类 |

---

## 组件文件 `v2/primitives.jsx`

定义全部通用 UI 原语，通过 `Object.assign(window, {...})` 暴露为全局变量。

| 组件 | Props | 说明 |
|---|---|---|
| `Placeholder` | `label`, `w`, `h`, `style` | 斜纹占位框，用于文件、图片缩略图 |
| `Chip` | `children`, `variant`, `style` | 圆角标签，支持 `accent/accent-2/accent-3/danger/ok` |
| `Stamp` | `children` | 虚线边框邮戳 |
| `Avatar` | `label`, `size`, `ring`, `cat`, `style` | 成员头像，尺寸 `xs/sm/md/lg/xl`，猫咪背景色，高亮环 |
| `Scribble` | `children` | 带手绘下划线的文字强调 |
| `Btn` | `children`, `primary`, `ghost`, `onClick`, `style` | 统一按钮 |
| `LineChart` | `points`, `w`, `h`, `color`, `refBand`, `labels` | SVG 折线图，支持参考区间色带 |
| `Bars` | `values`, `w`, `h`, `color` | SVG 柱状图 |
| `DashLabel` | `children`, `right` | 带虚线分隔的区块标题，可选右侧文字 |
| `Tile` | `k`, `v`, `u`, `warn`, `trend` | 指标统计卡片，可嵌入折线趋势 |

`LineChart` 的核心逻辑：把 `points` 数组映射为 SVG 坐标，绘制折线和数据点，可选叠加参考区间矩形色带（`refBand=[lo, hi]`）。

---

## 数据文件 `v2/data.jsx`

所有数据挂载为全局变量，供屏幕组件直接使用。

### `FAMILY` — 成员主数据

包含 6 名成员：妈妈（高血压）、爸爸（2型糖尿病）、我（血脂略高）、伴侣（健康）、小娃（4岁）、团子（英短猫）。

每个成员的字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `key` | string | 唯一标识，作为跨表外键 |
| `name/full/initial` | string | 昵称、全名、头像字 |
| `age/sex/blood/role` | — | 基础信息 |
| `status/tag` | string | 健康状态简述 / `warn` 或 `ok` |
| `doctor` | string | 主治医生信息 |
| `allergy/chronic` | string[] | 过敏史 / 慢性病 |
| `next` | `{t, d}` | 下一次预约事件 |
| `kpis` | `{k, v, u, trend, ref, warn}[]` | 关键健康指标 |
| `cat` | boolean | 是否为宠物（影响标签页和展示逻辑） |

### `REMINDERS` — 提醒列表

全家共 6 条近期提醒，字段：`who`（关联 `key`）、`d`（日期）、`t`（标题）、`kind`（就医/疫苗/体检/宠物）、`priority`。

### `REPORTS` — 医疗记录

按 `key` 分组的记录字典，字段：`d`、`t`、`org`、`tag`（体检/就医/影像/疫苗/驱虫/用药）、`abn`（异常或摘要）、`file`。

`tag` 值决定记录出现在哪个标签页：

| tag | 展示位置 |
|---|---|
| 体检 | 体检报告 |
| 就医 | 就医记录 |
| 影像 | 影像 |
| 其他 | 附件库（全量） |

### `MEDS` — 用药清单

按 `key` 分组，字段：`name`、`dose`、`freq`、`start`、`ongoing`（是否长期服用）。

---

## 页面组件 `v2/screen_family.jsx`

**`ScreenFamily`** 接收 `onOpenMember(key)` 回调，展示家庭级别信息。

### 布局结构

1. **顶部统计（4格）**：成员数量、需关注人数、30天内提醒数、本月上传数。
2. **家人卡片（3列网格）**：每张卡片含头像、姓名角色年龄血型、健康状态、3个关键指标、下一事件。点击跳转至成员档案。
3. **家庭日历（2列）**：
   - 提醒清单：按日期升序，距今天数 < 14 天时日期显示为警告色。
   - 最近上传：8份文件缩略图 + 上传按钮。

提醒清单天数基准固定为 `2026-04-19`，非动态 `new Date()`。

---

## 页面组件 `v2/screen_member.jsx`

**`ScreenMember`** 接收 `memberKey` 和 `onChangeMember(key)`，使用左右档案夹布局。

### 左侧成员列表（Rail）

展示所有家庭成员，当前成员高亮激活，点击切换。底部有"添加成员"占位按钮。

### 右侧内容区

**成员头部**：头像（XL）、全名（Scribble 样式）、基础信息（年龄/性别/血型/过敏/慢病，宠物显示芯片编号）、更新时间戳、打印/分享/新增记录按钮。

**标签页切换**：根据 `isCat` 布尔值切换两套标签：

| 人类标签 | 宠物标签 |
|---|---|
| 概览 | 概览 |
| 指标趋势 | 驱虫周期 |
| 体检报告 | 疫苗接种 |
| 就医记录 | 就医记录 |
| 用药 | 体重趋势 |
| 影像 | 附件库 |
| 附件库 | 提醒 |
| 提醒 | — |

成员类型切换时，若当前 Tab 不属于新类型，自动重置为"概览"。

### 各标签组件

| 组件 | 说明 |
|---|---|
| `TabOverview` | 关键指标 3 列（含折线）+ 最近 4 条记录 + 家庭医生 + 紧急联系人 |
| `TabTrend` | 多年季度折线趋势，可选择不同指标；含 AI 摘要文本生成 |
| `TabReports` | 按 tag 过滤的记录列表（日期/标题/机构/异常/操作） |
| `TabMeds` | 用药卡片网格（药名/剂量/频次/状态） |
| `TabImaging` | 影像资料 4 列卡片 + 占位图 |
| `TabAttachments` | 附件库 6 列缩略图 + 上传入口 |
| `TabReminders` | 提醒列表（日期/标题/类型/操作） |
| `TabPetOverview` | 宠物专属：体重/食量/饮水/排便指标 + 下一事件 + 饮食日常 |
| `TabDeworm` | 驱虫时间轴 + 历史记录列表 |
| `TabVax` | 疫苗记录列表 + 即将到期提示横幅 |
| `TabPetWeight` | 宠物 12 个月体重折线图 |

**`TabTrend`** 的 AI 摘要使用模板字符串生成，规则：对比最新值与一年前值，判断上升/下降/稳定，对比参考区间输出是否偏高。

多年趋势数据定义在 `PERSON_METRICS`，按 `key` 索引，每个指标含 12 个季度数据点，时间轴标签为 `QUARTERS` 数组。

---

## 已知局限

1. **日期不一致**：`ScreenFamily` 顶部统计用 `new Date()`，提醒清单用硬编码 `2026-04-19`。
2. **全局变量依赖加载顺序**：`primitives.jsx` 和 `data.jsx` 必须先于屏幕组件加载；模块化改造后需改为 `import/export`。
3. **SVG 宽度硬编码**：`LineChart` 在 `TabTrend` 中使用 `w={1020}`，移动端需响应式处理。
4. **操作按钮无行为**：打印、分享、上传、查看等按钮尚未绑定实际逻辑。
5. **无错误边界 / 加载态**：组件默认数据完整，对接真实接口时需补充。

---

## 修改速查

| 需求 | 文件 |
|---|---|
| 全局状态、顶层导航、编辑模式通信 | `family_health_archive.html` |
| 色彩、间距、字体、卡片、档案夹样式 | `styles_v2.css` |
| 通用 UI 组件（图表、按钮、标签等） | `v2/primitives.jsx` |
| 成员、报告、提醒、用药数据 | `v2/data.jsx` |
| 家庭总览布局和逻辑 | `v2/screen_family.jsx` |
| 成员详情、标签页、宠物逻辑 | `v2/screen_member.jsx` |
