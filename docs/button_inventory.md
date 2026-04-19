# 前端按钮盘点与状态标识

更新日期：2026-04-19

## 设计边界

本项目的报告数据入口不放在普通前端表单中：

- 医疗报告 MD 解析、结构化提取、批量写库：由 Claude Code / Codex Agent 执行。
- 日常数据录入：由前端支持，范围限定为体重、用药、提醒等低风险高频数据。
- 附件与报告文件：前端优先做查看/下载，不承担报告解析。

## 状态定义

| 状态 | 含义 | 下一步 |
|---|---|---|
| `OK` | 当前已经有明确交互，能完成预期动作 | 保持 |
| `WIRE` | 视觉上像可点击，但没有业务行为或行为只是原型抽屉 | 补接线或移除 |
| `DAILY` | 符合前端日常录入边界，且后端已有主要接口 | 优先实现 |
| `API_GAP` | 前端应该可用，但后端能力不足 | 先补 API |
| `AGENT` | 属于 Agent 报告处理管线，不建议做普通前端录入 | 改入口文案、隐藏或跳转说明 |
| `AGENT_DONE` | Agent 类前端按钮已移除或改为静态边界说明 | 保持边界清晰 |
| `FILE_DONE` | 附件类控件已接只读文件预览/下载 | 保持只读，不做前端解析 |
| `DEFER` | 非核心能力，当前不影响主流程 | 暂缓或置灰 |

## 当前按钮清单

### 全局入口

| 位置 | 控件 | 当前状态 | 依据 | 建议 |
|---|---|---|---|---|
| `frontend/index.html:123` | 顶层导航：家庭总览 / 成员档案 | `OK` | `onClick={() => setScreen(s.key)}` | 保持 |
| `frontend/index.html:138` | API 加载失败：重试 | `OK` | 调用 `loadShellData` | 保持 |
| `frontend/index.html:165` | Tweaks：密度 | `OK` | 调用 `setDens` | 保持，属于编辑模式 |
| `frontend/index.html:175` | Tweaks：配色 | `OK` | 调用 `setPal` | 保持，属于编辑模式 |

### 家庭总览

| 位置 | 控件 | 当前状态 | 依据 | 建议 |
|---|---|---|---|---|
| `frontend/components/screen_family.jsx:94` | 家人卡片 | `OK` | 点击进入成员档案 | 保持 |
| `frontend/components/screen_family.jsx:160` | 提醒清单：查看 | `WIRE` | 无 `onClick` | 改为打开对应成员的提醒页，或改为 `设置` 并接提醒编辑 |
| `frontend/components/screen_family.jsx:186` | 最近上传：Agent 管线说明 | `AGENT_DONE` | 前端不负责医疗报告解析入库 | 已移除上传按钮，仅展示归档说明 |

### 成员档案：框架

| 位置 | 控件 | 当前状态 | 依据 | 建议 |
|---|---|---|---|---|
| `frontend/components/screen_member.jsx:340` | 左侧成员切换 | `OK` | 调用 `onChangeMember` | 保持 |
| `frontend/components/screen_member.jsx:352` | + 添加成员 | `API_GAP` | 后端缺 `POST /api/members` | 已移除按钮；成员维护暂不放前端 |
| `frontend/components/screen_member.jsx:443` | + 新增记录 | `DAILY` | 日常数据应由前端录入 | 已接日常记录弹窗：提醒 / 用药 / 宠物体重；医疗报告不从这里录 |
| `frontend/components/screen_member.jsx:382` | 成员页 Tabs | `OK` | 切换 `tab` 状态 | 保持 |

### 报告详情抽屉

| 位置 | 控件 | 当前状态 | 依据 | 建议 |
|---|---|---|---|---|
| `frontend/components/screen_member.jsx:200` | 打印 | `DEFER` | 无 `onClick` | 可先接 `window.print()`，但非核心 |
| `frontend/components/screen_member.jsx:201` | 下载 | `API_GAP` | 后端没有文件流接口 | 先补附件文件接口，再接下载 |
| `frontend/components/screen_member.jsx:202` | 返回 | `OK` | 调用 `onClose` | 保持 |
| `frontend/components/screen_member.jsx:214` | 上一页 | `DEFER` | 当前只是占位预览，未接 PDF/图片分页 | 文件预览完成前隐藏或置灰 |
| `frontend/components/screen_member.jsx:216` | 下一页 | `DEFER` | 当前只是占位预览，未接 PDF/图片分页 | 文件预览完成前隐藏或置灰 |
| `frontend/components/screen_member.jsx:218` | 放大 | `DEFER` | 当前只是占位预览，未接真实文件 | 文件预览完成前隐藏或置灰 |
| `frontend/components/screen_member.jsx:260` | 追问 AI | `DEFER` | 没有 AI 后端 | 暂缓；后续若做 AI 解读再新增独立接口 |

### 概览与趋势

| 位置 | 控件 | 当前状态 | 依据 | 建议 |
|---|---|---|---|---|
| `frontend/components/screen_member.jsx:420` | 查看趋势 | `OK` | 切换到指标趋势 tab | 保持 |
| `frontend/components/screen_member.jsx:457` | 最近事件：查看 | `OK` | 打开详情抽屉 | 保持，但详情仍是结构化摘要，不是真实文件 |
| `frontend/components/screen_member.jsx:519` | 趋势指标按钮 | `OK` | 调用 `setSelected` 并拉趋势 API | 保持 |
| `frontend/components/screen_member.jsx:545` | 导出 | `DEFER` | 无 `onClick` | 可后续导出 CSV；不是第一优先级 |

### 报告、影像、附件

| 位置 | 控件 | 当前状态 | 依据 | 建议 |
|---|---|---|---|---|
| `frontend/components/screen_member.jsx:867` | 报告列表：打开 | `FILE_DONE` | 已接 `/api/attachments/{id}/file` 和 `/text` | PDF/图片/MD 可只读预览；支持打开原文件与下载 |
| `frontend/components/screen_member.jsx:924` | 影像卡片 | `FILE_DONE` | 已接附件文件流 | 图片可在详情抽屉预览 |
| `frontend/components/screen_member.jsx:943` | 附件卡片 | `FILE_DONE` | 已接附件文件流与文本预览 | PDF/图片/MD 可在详情抽屉预览 |
| `frontend/components/screen_member.jsx:633` | 附件库：Agent 管线说明 | `AGENT_DONE` | 医疗报告解析不走前端 | 已移除上传占位入口，仅展示归档说明 |
| `frontend/components/screen_member.jsx:716` | 疫苗抗体：查看 | `WIRE` | 无 `onClick` | 可打开相关附件或该项指标详情 |

### 提醒、用药、体重

| 位置 | 控件 | 当前状态 | 依据 | 建议 |
|---|---|---|---|---|
| `frontend/components/screen_member.jsx:861` | 提醒：新增 / 编辑 / 完成 / 删除 | `DAILY` | 后端已有 `POST/PATCH/DELETE /api/reminders` | P1 已接线 |
| `frontend/components/screen_member.jsx:792` | 用药清单：新增 / 编辑 / 停用 / 删除 | `DAILY` | 后端已有 `POST/PATCH/DELETE /api/meds` | P1 已接线 |
| `frontend/components/screen_member.jsx:943` | 体重趋势：新增 / 删除 | `DAILY` | 后端已有 `POST/DELETE /api/weight` | P1 已接线 |

## 优先级

### P0：保留已可用交互

- 顶层导航、成员切换、tab 切换、趋势指标切换、错误重试。
- 不为这些功能做重构。

### P1：前端日常录入（已接线）

- 提醒：新增、编辑、标记完成、删除。
- 用药：新增、编辑、停用、删除。
- 宠物体重：新增、删除。
- `+ 新增记录` 应作为这些日常录入的统一入口，而不是医疗报告入口。

### P2：只读文件能力（已接线）

- 后端增加安全文件读取接口：`GET /api/attachments/{id}/file`、`GET /api/attachments/{id}/text`。
- 前端附件、影像、报告详情从占位预览升级为真实 PDF/JPG/MD 预览和下载。

### P3：成员维护

- 当前已移除 `+ 添加成员`。
- 如果家庭成员后续需要在前端维护，再新增 `POST /api/members` 并重新设计入口。

### P4：暂缓能力

- AI 追问。
- 打印高级样式。
- 分享。
- 趋势复杂导出。

## 下一步成功标准

第一轮编码已完成 P1：

1. 点击 `+ 新增记录` 能选择提醒、用药、宠物体重三类日常记录。
2. 提醒 tab 的 `设置` 能编辑、完成或删除提醒。
3. 用药 tab 能新增、编辑、停用或删除用药。
4. 宠物体重 tab 能新增和删除体重。
5. 医疗报告上传/解析按钮已不作为前端日常入口出现。
