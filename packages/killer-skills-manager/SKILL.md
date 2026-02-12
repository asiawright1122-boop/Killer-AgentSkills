---
name: killer-skills-manager
description: 在 IDE 中通过自然语言管理 AI Skills - 安装、卸载、搜索、查看技能
triggers: 技能, skills, 安装技能, 卸载技能, 搜索技能, 列出技能, skill help, install skill, uninstall skill, remove skill, list skills
---

# Killer-Skills 技能管理器

你是一个技能管理助手。当用户提到与技能管理相关的请求时，按照以下指令执行。

## 自然语言命令识别

识别用户意图并执行相应操作：

| 用户说 | 操作 |
|--------|------|
| "安装 browser 技能" / "install browser skill" | → 安装技能 |
| "卸载 xxx 技能" / "remove xxx skill" | → 卸载技能 |
| "搜索 xxx" / "search xxx" / "找一个能xxx的技能" | → 搜索技能 |
| "列出已安装的技能" / "show my skills" / "我有哪些技能" | → 列出技能 |
| "技能帮助" / "skills help" | → 显示帮助 |

---

## 1. 列出已安装技能

**触发词:** "列出技能", "show skills", "我的技能", "已安装的技能"

**执行步骤:**

1. 检测当前 IDE 环境的技能目录：
   - **Claude Code:** `~/.claude/skills/`
   - **Antigravity:** `~/.gemini/antigravity/skills/`
   - **Cursor:** `~/.cursor/skills/`
   
2. 列出目录中的所有子文件夹

3. 读取每个子目录下的 `SKILL.md` 文件，提取 frontmatter 中的 `name` 和 `description`

4. 以 Markdown 表格呈现：
```
| 技能名称 | 描述 |
|----------|------|
| xxx | xxx 的描述 |
```

---

## 2. 搜索技能

**触发词:** "搜索技能 xxx", "找一个能xxx的技能", "有没有xxx技能", "search skills xxx"

**执行步骤:**

1. 提取用户搜索关键词

2. 调用搜索 API：
```
https://killer-skills.vercel.app/api/skills/search?q=<关键词>
```

3. 展示前 5 个结果：
   - 技能名称
   - 描述
   - 安装命令

---

## 3. 安装技能

**触发词:** "安装技能 xxx", "install skill xxx", "添加 xxx 技能", "我想要 xxx 功能"

**执行步骤:**

1. 识别技能标识：
   - 如果是完整格式 (如 `owner/repo`)，直接使用
   - 如果是简称，先搜索确认完整名称

2. 在终端执行安装命令：
```bash
npx killer-skills install <owner/repo>
```

3. 监控输出，报告安装结果

4. 如果成功，告知用户技能已可用

---

## 4. 卸载技能

**触发词:** "卸载技能 xxx", "删除 xxx 技能", "remove skill xxx", "uninstall xxx"

**执行步骤:**

1. 执行卸载命令：
```bash
npx killer-skills remove <技能名>
```

2. 报告卸载结果

---

## 5. 技能帮助

**触发词:** "技能帮助", "skills help", "怎么管理技能"

**展示信息:**

```
🔧 Killer-Skills 技能管理器

可用命令:
• "列出技能" - 查看已安装的技能
• "搜索 xxx" - 在市场中搜索技能  
• "安装技能 owner/repo" - 安装新技能
• "卸载技能 xxx" - 移除技能

技能市场: https://killer-skills.vercel.app
```

---

## 智能建议

当用户描述某个需求但没有明确要求安装技能时，你可以：

1. 根据描述推荐相关技能
2. 提供安装建议：*"我发现一个可能满足您需求的技能：xxx，要安装吗？"*

## IDE 环境检测

优先级顺序检测：
1. Claude Code (`.claude/` 目录存在)
2. Antigravity (`.gemini/` 或 `.agent/` 目录存在)  
3. Cursor (`.cursor/` 目录存在)
