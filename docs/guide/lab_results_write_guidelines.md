# lab_results 写入指南

本文给后续 AI agent 使用，目标是把医疗报告中的检验、检查和量表结果稳定写入 `lab_results`，并避免把 OCR 噪声、医学推断和报告原文混在一起。

## 表结构语义

`lab_results` 当前字段：

| 字段 | 写入要求 |
| --- | --- |
| `member_key` | 成员 key，必须来自已存在成员。 |
| `visit_id` | 对应就诊记录 id。导入脚本通常先写 `visits`，再写 labs。 |
| `date` | 检查/采样日期。没有单独检查日期时，用就诊日期。 |
| `panel` | 检查板块，如 `血常规`、`血生化`、`肺功能`、`FeNO`、`过敏原IgE`、`SAA`。 |
| `test_name` | 指标名称。必须是清洗后的完整名称，不要带 OCR 箭头、备注、半截换行。 |
| `value` | 报告结果原值。数值指标尽量只写数字字符串；定性结果可写 `阳性`、`阴性`、`S4 (513)U` 等原文。 |
| `unit` | 单位。只写单位，不写参考值或备注。OCR 常见 `1` 应校正为 `L`。 |
| `ref_low` | 报告明确给出的参考下限。没有明确下限时留空。 |
| `ref_high` | 报告明确给出的参考上限。没有明确上限时留空。 |
| `status` | `normal` / `high` / `low` / `abnormal` / `unknown`。只有有依据时写正常或异常。 |
| `source_file` | 原始 MD 或 PDF 文件名，便于追溯。 |

## 核心原则

1. `ref_low/ref_high` 只写报告中明确给出的参考范围。
2. 不要因为参考值栏只有一个数字，就猜它是上限或下限。
3. 不要用通用医学常识覆盖报告自身参考值。不同医院、仪器、试剂盒、物种和年龄的参考范围可能不同。
4. 不要把 OCR 箭头写进 `test_name`。例如 `MCV ↑` 应写 `MCV`，箭头只影响 `status`。
5. 如果 OCR 表格明显错位、拆行或缺列，宁可少写或写 `unknown`，不要编造结构化范围。
6. `status=normal` 必须有依据：报告标正常，或数值在明确参考范围内。无法判断时写 `unknown`。
7. 宠物数据必须以原报告参考范围为准，不要套人类参考范围。

## 参考值拆分规则

| 原文参考值 | 写入方式 |
| --- | --- |
| `3.50~19.50` | `ref_low=3.50`, `ref_high=19.50` |
| `3.50-19.50` | `ref_low=3.50`, `ref_high=19.50` |
| `≤2.00` / `<2.00` | `ref_low=NULL`, `ref_high=2.00` |
| `≥80` / `>80` | `ref_low=80`, `ref_high=NULL` |
| `0-60` | `ref_low=0`, `ref_high=60` |
| `~` / 空白 / 未见参考值 | `ref_low=NULL`, `ref_high=NULL` |
| 单独 `80` 且没有 `≥`、`>`、字段语义 | 不要拆分；人工复核。 |

例外：肺功能报告中的 `%（前/预）` 或 `%预计值` 经人工确认是“实测/预计值百分比”时，可把常用筛查阈值写作 `ref_low=80`，但必须注意这不是严格 LLN。见“肺功能”章节。

## status 判断

推荐判断顺序：

1. 报告原文明确给出 `↑`、`↓`、`H`、`L`、`偏高`、`偏低`、`阳性`、`阴性`。
2. 数值与明确 `ref_low/ref_high` 比较。
3. 报告医生结论明确写出异常。
4. 仍不能判断时，写 `unknown`。

方向规则：

| 条件 | status |
| --- | --- |
| `value < ref_low` | `low` |
| `value > ref_high` | `high` |
| `ref_low <= value <= ref_high` | `normal` |
| 非数值阳性、皮试阳性、报告只说异常但无方向 | `abnormal` |
| 缺参考值、缺报告标记、无法确定 | `unknown` |

不要把“趋势上升/下降”写成 `high/low`。`high/low` 只表示相对参考范围异常方向，不表示相比上次变化。

## 单位清洗

常见 OCR 单位修正：

| OCR | 应写 |
| --- | --- |
| `g/1`、`g/` | `g/L` |
| `mmoI/L`、`mmo1/L` | `mmol/L` |
| `umo1/L` | `umol/L` |
| `f1` | `fL` |
| `10*9/1`、`10^9/` | `10^9/L` |
| `10*9g/L` | `10^9/L` |
| `u/L` | `U/L` |

只修明显 OCR 字符错误，不做单位换算，除非原报告和换算公式都很明确。

## 指标名清洗

写入前必须处理：

- 删除 `↑`、`↓`、`→`、`备注`、多余空格。
- 合并 OCR 拆行的指标名。
- 不写半截名称，例如 `度）` 不能作为单独 `test_name`。
- 同一指标尽量统一命名，例如 `MEF50` 与 `MEF 50` 应统一一种形式。

错误示例：

```json
{ "test_name": "MCHC（平均红细胞血红蛋白浓", "value": "16.5", "unit": "pg" }
{ "test_name": "度）", "value": "316", "unit": "g/L" }
```

正确示例：

```json
{ "test_name": "MCH", "value": "16.5", "unit": "pg", "ref_low": "13.00", "ref_high": "21.00", "status": "normal" }
{ "test_name": "MCHC", "value": "316", "unit": "g/L", "ref_low": "300.00", "ref_high": "380.00", "status": "normal" }
```

## 肺功能写入

肺功能比普通化验特殊。报告常同时给出：

- 预计值
- 实测值
- 前/预百分比
- FEV1/FVC 或 FEV1/VC

当前表只能存一行一个指标，因此建议：

1. 原始实测值写 `FEV1`、`FVC`、`PEF` 等，单位如 `L`、`L/s`。
2. 前/预百分比写 `FEV1%预计值`、`FVC%预计值` 等，单位 `%`。
3. 对 `%预计值`，如果报告没有 LLN，`ref_low=80` 只能作为粗略筛查阈值；`status` 可按报告标记或医生结论辅助判断。
4. `FEV1/FVC` 不要硬套 `80`。成人通常应看 LLN/z-score；没有 LLN 时，若医生结论写阻塞或报告标异常，可写 `abnormal` 或 `unknown`，不要轻易写 `normal`。
5. `VT%预计值`、`MV%预计值` 等通气/呼吸模式相关指标不要默认套 `ref_low=80`。

未来建议扩展字段：

- `predicted_value`
- `percent_predicted`
- `lln`
- `z_score`
- `status_source`

## 过敏原 IgE 与 FeNO

特异性 IgE：

- 报告写 `<0.35 KUA/L` 或分级阈值时，可写 `ref_high=0.35`。
- `>=0.35` 通常表示致敏阳性，但临床相关性仍需结合病史；`status=high` 或 `abnormal` 都可接受，项目内建议统一用 `high`。

FeNO：

- 成人报告若写 `>=50 ppb` 为高值，可写 `ref_high=50`，超过即 `high`。
- 儿童阈值不同，必须按报告年龄表或原文写入。

## 宠物报告

宠物血常规、生化、SAA、抗体检测优先使用报告自带参考范围。不同医院、仪器和试剂盒差异很大。

注意：

- SAA 不同试剂盒可能是 `≤2.00` 或 `≤4.00`，不要统一覆盖。
- 疫苗抗体常是分级/定性结果，不一定适合 `ref_low/ref_high`。可保留原文 `value`，`status` 按报告结论写。
- 猫血常规 OCR 容易把 `MCH`、`MCHC` 拆成两行，必须人工核对。

## 导入前自检 SQL

写入后至少跑以下检查：

```sql
-- 1. 数值与参考范围、status 明显冲突
SELECT id, member_key, panel, test_name, value, unit, ref_low, ref_high, status
FROM lab_results
WHERE
  (ref_low IS NOT NULL AND ref_low <> '' AND CAST(value AS REAL) < CAST(ref_low AS REAL) AND status NOT IN ('low','abnormal'))
  OR
  (ref_high IS NOT NULL AND ref_high <> '' AND CAST(value AS REAL) > CAST(ref_high AS REAL) AND status NOT IN ('high','abnormal'))
  OR
  (status='high' AND ref_high IS NOT NULL AND ref_high <> '' AND CAST(value AS REAL) <= CAST(ref_high AS REAL))
  OR
  (status='low' AND ref_low IS NOT NULL AND ref_low <> '' AND CAST(value AS REAL) >= CAST(ref_low AS REAL));

-- 2. OCR 可疑单位或指标名
SELECT id, panel, test_name, value, unit, ref_low, ref_high, status
FROM lab_results
WHERE unit LIKE '%1%'
   OR unit LIKE '%I%'
   OR test_name LIKE '%↑%'
   OR test_name LIKE '%↓%'
   OR test_name LIKE '%→%'
   OR test_name='度）'
   OR test_name LIKE '%备注%';

-- 3. 空参考值却被写 normal 的记录，抽样复核
SELECT id, member_key, panel, test_name, value, unit, status, source_file
FROM lab_results
WHERE (ref_low IS NULL OR ref_low = '')
  AND (ref_high IS NULL OR ref_high = '')
  AND status = 'normal';
```

## 推荐 JSON 形态

```json
{
  "panel": "血常规",
  "test_name": "WBC",
  "value": "13.2",
  "unit": "10^9/L",
  "ref_low": "5.50",
  "ref_high": "19.50",
  "status": "normal",
  "source_file": "20250918_美联众合_开心_猫传腹.md"
}
```

无法判断时：

```json
{
  "panel": "血生化",
  "test_name": "血尿酸",
  "value": "386",
  "unit": "umol/L",
  "ref_low": null,
  "ref_high": null,
  "status": "unknown",
  "source_file": "20250902_安贞医院_春子_膝盖疼.md"
}
```

