# OpenSkills 分析与 Killer-Skills CLI 对比报告

## 1. 项目概览

### OpenSkills (numman-ali/openskills)
**定位**: AI 编码 Agent 的通用 Skills 加载器 (Universal skills loader)。
**核心理念**: "Universal installer for SKILL.md"。它旨在将 Anthropic 的 Skills 系统带给所有 AI Agent (Claude Code, Cursor, Windsurf, Aider 等)。
**关键特性**:
- **标准化**: 严格遵循 Anthropic 的 `SKILL.md` 格式。
- **通用性**: 生成通用的 `<available_skills>` XML 到 `AGENTS.md`，任何能读取该文件的 Agent 都能使用。
- **渐进式加载**: 通过 `npx openskills read <skill>` 按需加载 Skill 内容，保持 Context 干净。
- **元数据追踪**: 记录安装源，支持 `update` 命令。

### Killer-Skills CLI
**定位**: 跨平台 AI Agent Skills 安装与发布工具。
**核心理念**: 面向多 IDE 的一键安装与 Skills 开发者生态工具。
**关键特性**:
- **多 IDE 适配**: 原生支持 17+ 种 IDE/Agent (Cursor, Windsurf, VSCode, Kiro, etc.) 的路径和配置。
- **开发者生态**: 提供 `create` (脚手架)、`publish` (发布到 GitHub)、`search` (搜索) 等全生命周期管理。
- **注册表机制**: 尝试建立中心化的 Skills 索引 (Registry)。

---

## 2. 核心功能深度对比

| 功能维度 | OpenSkills (参考标杆) | Killer-Skills CLI (现状) | 差异分析 |
| :--- | :--- | :--- | :--- |
| **安装 (Install)** | `openskills install <repo>`<br>- 支持 GitHub Repo, Local<br>- 自动处理 `AGENTS.md`<br>- 记录详细元数据 (`installedAt`, `source`, `hash`) | `killer add <repo>`<br>- 支持 Registry 别名, GitHub<br>- 针对不同 IDE 写入不同目录<br>- 简单的 `SKILL.md` 生成 | **Killer 优势**: 多 IDE 适配更细致。<br>**OpenSkills 优势**: 元数据管理更完善，支持 Private Repo 更好。 |
| **更新 (Update)** | `openskills update [skills...]`<br>- 基于记录的元数据自动拉取最新版<br>- 智能检测 Commit 变化 | 暂无原生 `update` 命令 (需重新 install) | **OpenSkills 完胜**: 具备完整的依赖更新机制。 |
| **同步 (Sync)** | `openskills sync`<br>- 核心功能。交互式选择 Skills 写入 `AGENTS.md`<br>- 生成标准化的 XML Prompt | 暂无类似功能<br>(目前主要依赖 IDE 自身的文件读取能力) | **OpenSkills 核心**: 这是它"通用性"的来源，通过 Prompt Engineering 让所有 Agent 学会使用 Skills。 |
| **读取 (Read)** | `openskills read <skill>`<br>- 输出标准化的 Claude 格式内容<br>- 用于动态工具调用 | 无导出内容命令 | **理念差异**: OpenSkills 假设 Agent 通过 Tool Call 读取；Killer 目前主要侧重于"静态文件放置"。 |
| **管理 (Manage)** | `list`, `remove`, `manage` (交互式) | `list`, `remove`, `search` | Killer 有 `search` 是亮点；OpenSkills 的交互式管理体验更佳。 |
| **开发 (Dev)** | 简单的脚手架指引 | `create`, `publish` | **Killer 优势**: 提供了完整的开发者工具链，更像 `npm`。 |

---

## 3. 技术实现深入分析

### 3.1 架构设计
- **OpenSkills**:
    - **轻量级**: 核心逻辑围绕 `SKILL.md` 文件操作和 `AGENTS.md` 文本生成。
    - **Prompt 驱动**: 它的核心魔法在于生成的 `AGENTS.md` 中包含了一段 Prompt，教 AI 如何使用 `npx openskills read`。这使得它不需要为每个 Agent 写插件，只要 Agent 能读文件并执行终端命令即可。
    - **Git Centric**: 强依赖 Git 操作，将 GitHub 视为无限的 Skills 仓库。

- **Killer-Skills**:
    - **配置驱动**: `IDE_CONFIG` 极其详尽，定义了不同 IDE 的路径、格式 (`SKILL.md` vs `rules.md` vs `agent.json`)。
    - **适配器模式**: `installers/` 目录下有针对不同 IDE 的具体实现逻辑。

### 3.2 关键代码比对

**OpenSkills 的元数据管理 (`src/utils/skill-metadata.ts`):**
它会在安装目录写入 `.openskills-meta.json` (或隐含在 metadata 中)，记录：
```typescript
interface SkillSourceMetadata {
  source: string;      // git url
  sourceType: 'git' | 'local';
  repoUrl?: string;
  subpath?: string;
  installedAt: string;
  // hash?: string;    // 可能用于版本检测
}
```
这使得 `update` 命令成为可能。

**OpenSkills 的 Prompt 注入 (`src/utils/agents-md.ts`):**
它会向 `AGENTS.md` 注入如下 Prompt：
```xml
<usage>
How to use skills:
- Invoke: `npx openskills read <skill-name>` (run in your shell)
...
</usage>
```
这种 "Inversion of Control" (控制反转) 的设计非常巧妙，把调用逻辑交给 LLM。

---

## 4. Killer-Skills 的优缺点评估

### 优点 (Pros)
1.  **覆盖面广**: 支持 17+ 种 IDE，特别是对 VSCode, Windsurf, Cursor 的原生目录支持做得更好。OpenSkills 主要关注通用协议，对特定 IDE 的目录结构适配不如 Killer 细致。
2.  **开发者体验好**: `create` 和 `publish` 命令填补了 Skills 制作和发布的空白，OpenSkills 缺乏这部分工具。
3.  **UI/UX**: CLI 界面从设计上更注重极客风格 (Neon Cyan)，定位更高端。

### 缺点 (Cons)
1.  **缺乏标准化 Prompt 注入**: 目前并未解决 "安装了文件后 AI 怎么知道怎么用" 的问题。OpenSkills 通过 `sync` 命令生成 Prompt 完美解决了这个问题。
2.  **缺乏版本管理 (Update)**: 安装由于是一次性的文件拷贝，无法方便地更新。
3.  **交互性较弱**: 在工具使用层面（Read）没有提供给 Agent 调用的接口。

---

## 5. 改进建议 (Action Plan)

为了让 Killer-Skills 成为更终极的工具，建议吸收 OpenSkills 的精华：

### 5.1 引入 `sync` / `inject` 功能 (高优先级)
**目标**: 让安装的 Skills 能被 AI 真正"看到"和"懂得调用"。
- 参考 OpenSkills 的 `AGENTS.md` 生成逻辑。
- 为不同 IDE 生成对应的 System Prompt 配置 (如 Cursor 的 `.cursorrules`, Windsurf 的 `.windsurfrules`)。

### 5.2 实现元数据追踪与 Update (中优先级)
- 在安装 Skill 时，在目录下生成隐藏的 `.killer-metadata.json`。
- 实现 `killer update` 命令，读取元数据并重新拉取代码。

### 5.3 增强 `read` 接口 (中优先级)
- 实现 `killer read <skill>`。
- 这样不仅可以静态使用（Agent直接读文件），也可以动态使用（Agent 执行命令读取），支持更灵活的 Context 管理。

### 5.4 兼容 OpenSkills 协议
- 考虑兼容 `npx openskills` 的调用方式，或者在生成的 Prompt 中教 AI 使用 `killer read`。

## 6. 总结
OpenSkills 胜在**架构设计的精巧性**（用 Prompt 解决通用性问题）和**生命周期管理**（Update/Sync）。
Killer-Skills 胜在**广度**（多 IDE 适配）和**开发者生态**（Create/Publish）。

通过引入 `sync` 机制和元数据管理，Killer-Skills 完全可以涵盖 OpenSkills 的能力，并凭借更广泛的 IDE 支持和更好的 UI 成为该领域的最佳选择。
