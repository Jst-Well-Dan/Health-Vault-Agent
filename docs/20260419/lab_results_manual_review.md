# lab_results 人工复核清单

检查日期：2026-04-19

范围：`data/health.db` 的 `lab_results` 表，共 151 条记录。

执行状态：2026-04-19 已按本文“确定可修”项完成数据库修正，并在 `data/backups/health_before_lab_fix_20260419_180906.db` 保留修正前备份。修正后，数值/参考范围/status 冲突检查和 OCR 指标名/单位检查均无剩余命中。`id=99`、`id=100` 仍保守标记为 `unknown`，需要人工查看原 PDF 后再决定是否合并或删除。

结论：没有发现 `ref_low/ref_high` 大面积上下限反向的问题；数值与参考范围、`status` 的自动一致性检查没有命中明显冲突。主要问题是 OCR 单位错误、指标名拆行/错位、肺功能结构化方式不够严谨，以及少数缺参考值却被写成 `normal` 的记录。

## 必须人工修正

### 1. 春子血尿酸缺参考值但标 normal

记录：

| id | member | date | panel | test_name | value | unit | ref_low | ref_high | status | source_file |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | chunzi | 2025-09-02 | 血生化 | 血尿酸 | 386 | umol/L | NULL | NULL | normal | 20250902_安贞医院_春子_膝盖疼.md |

原始 MD 只写“辅助检查：血尿酸：386.”，没有参考范围。

问题：对成年女性，386 umol/L 可能高于不少实验室常见上限，但没有本报告参考值，不能直接判 normal。

建议修改：

```sql
UPDATE lab_results
SET status = 'unknown'
WHERE id = 1;
```

如果后续从原 PDF 或医院报告获得参考值，再补 `ref_low/ref_high`。

### 2. 开心猫血常规 MCH/MCHC 被 OCR 拆行

记录：

| id | date | test_name | value | unit | ref_low | ref_high | status | source_file |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 74 | 2025-09-18 | MCHC（平均红细胞血红蛋白浓 | 17.5 | pg | NULL | NULL | normal | 20250918_美联众合_开心_猫传腹.md |
| 75 | 2025-09-18 | 度） | 319 | g/L | 300.00 | 380.00 | normal | 20250918_美联众合_开心_猫传腹.md |
| 101 | 2025-10-03 | MCHC（平均红细胞血红蛋白浓 | 16.5 | pg | 13.00 | 21.00 | normal | 20251003_美联众合_开心_血常规.md |
| 102 | 2025-10-03 | 度） | 316 | g/L | 300.00 | 380.00 | normal | 20251003_美联众合_开心_血常规.md |

原始 MD 显示这几行来自表格换行：

- `MCH (平均血红蛋白量）` 的参考范围是 `13.00~21.00`，单位应为 `pg`。
- `MCHC（平均红细胞血红蛋白浓度）` 的参考范围是 `300.00~380.00`，单位应为 `g/L`。

建议人工确认 PDF 后修正为：

```sql
UPDATE lab_results
SET test_name = 'MCH（平均红细胞血红蛋白量）',
    unit = 'pg',
    ref_low = '13.00',
    ref_high = '21.00',
    status = 'normal'
WHERE id = 74;

UPDATE lab_results
SET test_name = 'MCHC（平均红细胞血红蛋白浓度）',
    unit = 'g/L',
    ref_low = '300.00',
    ref_high = '380.00',
    status = 'normal'
WHERE id = 75;

UPDATE lab_results
SET test_name = 'MCH（平均红细胞血红蛋白量）',
    unit = 'pg',
    ref_low = '13.00',
    ref_high = '21.00',
    status = 'normal'
WHERE id = 101;

UPDATE lab_results
SET test_name = 'MCHC（平均红细胞血红蛋白浓度）',
    unit = 'g/L',
    ref_low = '300.00',
    ref_high = '380.00',
    status = 'normal'
WHERE id = 102;
```

### 3. 开心猫 2025-10-03 MCV 缺参考范围

记录：

| id | test_name | value | unit | ref_low | ref_high | status |
| --- | --- | --- | --- | --- | --- | --- |
| 99 | MCV (平均红细胞体积） → | 37.9 | fL | NULL | NULL | normal |

同一报告原始 MD 中 `MCV` 一行 OCR 后参考值为空，但下一行 `MCH` 被写成 `39.00~52.00`，这组范围更像 MCV 的参考范围。不能自动改，需对照 PDF。

建议：人工查看 PDF。如果确认 `39.00~52.00` 属于 MCV，则：

```sql
UPDATE lab_results
SET test_name = 'MCV（平均红细胞体积）',
    ref_low = '39.00',
    ref_high = '52.00',
    status = 'low'
WHERE id = 99;
```

同时 `id=100` 的 MCH 当前 `value=52.2`、`ref_low=39.00`、`ref_high=52.00` 很可能是错位，见下一项。

### 4. 开心猫 2025-10-03 MCH 数值/参考值疑似错位

记录：

| id | test_name | value | unit | ref_low | ref_high | status |
| --- | --- | --- | --- | --- | --- | --- |
| 100 | MCH(平均血红蛋白量） | 52.2 | 空 | 39.00 | 52.00 | high |

问题：

- `MCH` 的单位通常应为 `pg`。
- `39.00~52.00` 更符合猫 MCV 的 `fL` 范围，而不是 MCH。
- 值 `52.2` 也更像 MCV 量级，不像 MCH。

建议：人工对照 PDF。若确认该行本质是 MCV 或 OCR 错位，应合并/删除重复错误行，不要保留为 MCH high。

### 5. 肺功能 VT%预计值不应套 ref_low=80

记录：

| id | test_name | value | unit | ref_low | ref_high | status |
| --- | --- | --- | --- | --- | --- | --- |
| 7 | VT%预计值 | 405.0 | % | 80 | NULL | normal |

问题：`VT%预计值` 是呼吸模式相关指标，不适合套“预计值百分比 ≥80 正常”的规则。这个 `ref_low=80` 会误导前端。

建议：

```sql
UPDATE lab_results
SET ref_low = NULL,
    ref_high = NULL,
    status = 'unknown'
WHERE id = 7;
```

### 6. FEV1/FVC 缺少 LLN，不能直接 normal

记录：

| id | test_name | value | unit | ref_low | ref_high | status |
| --- | --- | --- | --- | --- | --- | --- |
| 12 | FEV1%F | 78.72 | % | NULL | NULL | normal |
| 14 | FEV1%M | 78.72 | % | NULL | NULL | normal |
| 38 | FEV1FVC | 74.19 | % | NULL | NULL | normal |

问题：FEV1/FVC 是否异常应优先看报告 LLN/z-score 或报告解释。同一份 2026-03-10 报告医生意见写“V曲线异常符合阻塞图形”，因此 `id=38 status=normal` 至少不够稳妥。

建议：

```sql
UPDATE lab_results
SET status = 'unknown'
WHERE id IN (12, 14);

UPDATE lab_results
SET status = 'abnormal'
WHERE id = 38;
```

如果后续拿到 LLN，应补结构化字段；当前表没有 LLN 字段，只能先用 `status` 表达报告结论。

## 建议批量修正的 OCR 单位

这些不影响 `ref_low/ref_high` 方向，但会影响展示和后续趋势聚合。建议批量清洗。

| id | 当前 unit | 建议 unit |
| --- | --- | --- |
| 54, 55, 56, 98 | `g/` | `g/L` |
| 119, 141, 145 | `g/1` | `g/L` |
| 120 | `mmoI/L` | `mmol/L` |
| 121 | `mmo1/L` | `mmol/L` |
| 124 | `umo1/L` | `umol/L` |
| 143, 147, 149, 150 | `f1` | `fL` |
| 148 | `10*9/1` | `10^9/L` |
| 104 | `10^9/` | `10^9/L` |
| 129 | `10*9g/L` | `10^9/L` |
| 122 | `u/L` | `U/L` |
| 123 | `/L` | `U/L` |

建议 SQL：

```sql
UPDATE lab_results SET unit = 'g/L' WHERE id IN (54,55,56,98,119,141,145);
UPDATE lab_results SET unit = 'mmol/L' WHERE id IN (120,121);
UPDATE lab_results SET unit = 'umol/L' WHERE id = 124;
UPDATE lab_results SET unit = 'fL' WHERE id IN (143,147,149,150);
UPDATE lab_results SET unit = '10^9/L' WHERE id IN (104,129,148);
UPDATE lab_results SET unit = 'U/L' WHERE id IN (122,123);
```

## 建议清洗的指标名

| id | 当前 test_name | 建议 |
| --- | --- | --- |
| 59 | ALKP（碱性磷酸酶） 备注 | ALKP（碱性磷酸酶） |
| 73 | MCV(平均红细胞体积） ↑ | MCV（平均红细胞体积） |
| 99 | MCV (平均红细胞体积） → | MCV（平均红细胞体积） |
| 104 | PLT（血小板数目） → | PLT（血小板数目） |
| 131 | 淋巴细胞百分比（lyn%) | 淋巴细胞百分比（Lym%） |

建议 SQL：

```sql
UPDATE lab_results SET test_name = 'ALKP（碱性磷酸酶）' WHERE id = 59;
UPDATE lab_results SET test_name = 'MCV（平均红细胞体积）' WHERE id = 73;
UPDATE lab_results SET test_name = 'MCV（平均红细胞体积）' WHERE id = 99;
UPDATE lab_results SET test_name = 'PLT（血小板数目）' WHERE id = 104;
UPDATE lab_results SET test_name = '淋巴细胞百分比（Lym%）' WHERE id = 131;
```

`id=99` 是否同时补参考范围，需要先看 PDF。

## 暂不建议修改

### 猫 SAA 两次 ref_high 不一致

| id | date | value | ref_high | source_file |
| --- | --- | --- | --- | --- |
| 49 | 2025-09-18 | 169.44 | 2.00 | 德诺猫血清淀粉样蛋白 aSAA |
| 89 | 2025-10-03 | 7.02 | 4.00 | 纳百生物猫血清淀粉样蛋白A荧光检测试剂盒 |

两次试剂盒/报告不同，参考上限不同不能直接判定为错误。保留报告原值。

### 过敏原 IgE

`0.35 KUA/L` 阈值来自原报告备注，且与常见特异性 IgE 分级一致。保留。

### FeNO

`ref_high=50 ppb` 来自原报告 `>=50ppb` 高切点，成人适用。保留。

### 猫血常规/生化多数参考范围

多数范围来自原报告表格，不应被通用网上参考值覆盖。只修 OCR 单位、拆行和明确错位。

## 自动检查结果

运行以下一致性检查，未发现命中：

```sql
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
```

含义：当前问题不是“数值和上下限明显矛盾”，而是“结构化字段来源不稳、OCR 错位和缺少无法表达的肺功能字段”。
