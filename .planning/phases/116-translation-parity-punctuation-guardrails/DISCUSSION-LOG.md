# Phase 116 Discussion Log

Generated on: 2026-06-22

## Discussed Areas & Q&A

### 1. Guard Scope
- **Question:** Which approach for Guard Scope?
- **Selection:** (Recommended) 仅对核心元数据和已富化的编辑字段进行 10 语种覆盖性校验，排除深度嵌套字段。
- **Decision:** Validate core collection metadata fields only; ignore nested execution details for now.

### 2. Punctuation Scope
- **Question:** Which approach for Punctuation Scope?
- **Selection:** (Recommended) 仅对描述性长文本字段校验句尾标点，排除 title 和 keywords 等短标题字词。
- **Decision:** Validate terminal punctuation on description-like fields only.

### 3. CI Integration Mode
- **Question:** Which approach for CI Integration Mode?
- **Selection:** (Recommended) 集成进 validate:public-surface 门禁脚本中，作为编译和部署的前置 Release Gate。
- **Decision:** Run punctuation checks inside the main validation CI pipeline.
