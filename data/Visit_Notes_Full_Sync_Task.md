# Visit Notes Full Sync Task Master (Refined Extraction)

## System Prompt / Protocol
所有子任务执行者必须严格遵守以下规则：

1. **目标**：从 `visits` 表对应的原始 `.md` 报告中精细提取特定章节，并存入 `note_full` 字段。
2. **提取章节**：
   - **医生诊断**：包含初步诊断、临床诊断等。
   - **诊疗意见**：包含医生的建议、病情处置、随访要求等。
   - **治疗方案说明**：包含处方药品、用法用量、具体治疗操作方案等。
3. **输出格式**：
   ```markdown
   ### 医生诊断
   [提取内容]

   ### 诊疗意见
   [提取内容]

   ### 治疗方案说明
   [提取内容]
   ```
   *注意：如果某项在报告中不存在，请填写“报告中未明确标出”。*

4. **处理流程**：
   - 读取 `.md` 文件。
   - 识别语义并提取上述三部分。
   - 格式化后更新 `visits.note_full`。

## To-Do List

- [ ] Item 1: `id=1`, `member_key=chunzi`, `source_file=20250902_安贞医院_春子_膝盖疼.md`
- [ ] Item 2: `id=2`, `member_key=chunzi`, `source_file=20250902_安贞医院_春子_哮喘.md`
- [ ] Item 3: `id=3`, `member_key=chunzi`, `source_file=20250918_协和医院_春子_脱敏治疗.md`
- [ ] Item 4: `id=4`, `member_key=chunzi`, `source_file=20250925_协和医院_春子_脱敏治疗.md`
- [ ] Item 5: `id=5`, `member_key=chunzi`, `source_file=20260310_协和医院_春子_脱敏治疗.md`
- [ ] Item 6: `id=6`, `member_key=kaixin`, `source_file=20250918_美联众合_开心_猫传腹.md`
- [ ] Item 7: `id=7`, `member_key=kaixin`, `source_file=20251003_美联众合_开心_血常规.md`
- [ ] Item 8: `id=8`, `member_key=boniu`, `source_file=20251107_北京康信动物医院土桥分院_波妞_免疫检查.md`

## Completed Outputs
(等待重新提取...)
