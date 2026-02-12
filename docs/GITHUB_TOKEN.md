# GitHub Token 配置指南

## 为什么需要配置 Token？

Killer Skills 使用 GitHub API 搜索技能仓库。未配置 Token 时，GitHub 限制为：
- **60 次请求/小时**（未认证）
- **5000 次请求/小时**（认证后）

## 创建 Personal Access Token

1. 访问 [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. 点击 **Generate new token (classic)**
3. 设置 Token 名称，如 `killer-skills`
4. **权限选择**：无需任何特殊权限（只需 public repo 读取）
5. 点击 **Generate token**
6. **立即复制** Token（只显示一次！）

## 配置方法

### 方法一：环境变量（推荐）

**macOS/Linux:**
```bash
# 添加到 ~/.zshrc 或 ~/.bashrc
export GITHUB_TOKEN="ghp_your_token_here"
```

**Windows:**
```powershell
# 用户环境变量
[Environment]::SetEnvironmentVariable("GITHUB_TOKEN", "ghp_your_token_here", "User")
```

### 方法二：项目 .env 文件

在项目根目录创建 `.env.local` 文件：
```
GITHUB_TOKEN=ghp_your_token_here
```

> ⚠️ 确保 `.env.local` 已添加到 `.gitignore`

### 方法三：CLI 命令行

```bash
# 临时使用
GITHUB_TOKEN=ghp_xxx npx killer-skills add owner/repo

# 或在命令中指定
npx killer-skills add owner/repo --token ghp_xxx
```

## 验证配置

```bash
# 检查环境变量
echo $GITHUB_TOKEN

# 测试 API 配额
curl -H "Authorization: token $GITHUB_TOKEN" \
     https://api.github.com/rate_limit
```

## 安全提示

- ✅ 使用 classic token，无需任何特殊权限
- ✅ 定期轮换 Token
- ❌ 不要在代码中硬编码 Token
- ❌ 不要提交 `.env` 文件到 Git
