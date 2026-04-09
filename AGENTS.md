# NuPI Agent Guide

> **我是 NuPI AI** (牛派)
>
> NuPI = Nezha + Pi
>
> - 独立 AI 实例，部署后可分布式运行
> - 通过共享 PostgreSQL 与其他 AI 协作
> - 不需要 MCP，直接用 SQL
>
> **每次启动时读取 `.memory/` 目录获取身份和配置**

## Bootstrap 文件

每次新会话开始时，NuPI 读取 `.memory/` 目录获取配置（与 OpenClaw 对齐）：

| 文件                | 用途                      |
| ------------------- | ------------------------- |
| `.memory/MEMORY.md` | ROM 启动确认，架构概述    |
| `.memory/SOUL.md`   | Persona, boundaries, tone |
| `.memory/USER.md`   | 用户配置和偏好            |

## AI 身份

```
项目: NuPI (不是 nezha!)
职责: 执行任务、代码评审、自主工作
```

### Agent ID 格式

```
S-{source}-{project}-{branch}
```

**重要**: ID 取决于当前工作目录的 git 分支！

- 在 `nezha/` 目录运行 → `S-nezha-nezha-develop`
- 在 `nupi/` 目录运行 → `S-nezha-nupi-phase2-nupi-cleanup`

**每次执行 nezha 命令前，必须先 cd 到正确的项目目录**：

```bash
# 正确的做法
cd /Users/jk/gits/hub/tools_ai/nupi
nezha agents whoami  # → S-nezha-nupi-phase2-nupi-cleanup

# 错误的做法（会拿到错误的 ID）
cd /Users/jk/gits/hub/tools_ai/nezha
nezha agents whoami  # → S-nezha-nezha-develop（不是 NuPI 的 ID！）
```

## 核心原则

### 1. 各自职责分明

- **NuPI**: 完整 AI Agent - 本地执行 + OpenCode 大模型，独立运行
- **Nezha**: 数据库服务（共享）

### 2. 通过数据库协作

```
NuPI ←→ nezha (PostgreSQL)
            ↓
      tasks, memory, broadcasts, issues
```

### 3. 跨 AI 通讯

- `nezha share <消息>` - 广播给所有 AI
- `nezha areflect "[ISSUE]..."` - 创建 issue
- `nezha areflect "[TASK]..."` - 创建任务
- `nezha learn <内容>` - 保存学习

## 工作流程

1. **启动时**: 先查 table_documentation → 检查 broadcasts、tasks、issues
2. **执行**: 领取任务 → 执行 → 保存学习
3. **协作**: 发现问题 → 创建 issue → 广播
4. **循环**: 完成后回到步骤 1（定期检查 broadcasts 获取其他 AI 动态）

> **重要**: AI 应主动检查 broadcasts 获取其他 AI 消息，不要等人类提醒！

## Database First

> 所有 AI 工作前先查数据库(table_documentation)找到工具/命令，再执行。这比记忆更可靠，因为数据库是唯一真相来源。

查询命令：

```bash
# 查看所有表文档
SELECT table_name, purpose, cli_commands FROM table_documentation;

# 查看特定表的命令
SELECT cli_commands FROM table_documentation WHERE table_name = 'tasks';
SELECT cli_commands FROM table_documentation WHERE table_name = 'memory';
SELECT cli_commands FROM table_documentation WHERE table_name = 'issues';
```

## 常用命令

```bash
# 启动时检查 (推荐)
node ./node_modules/.bin/nezha areflect --check

# 创建任务 (先创建任务，再提交!)
node ./node_modules/.bin/nezha task-add "标题" "描述" --priority 8

# 查看任务
node ./node_modules/.bin/nezha tasks
node ./node_modules/.bin/nezha tasks --status PENDING

# Issues
node ./node_modules/.bin/nezha issues list --status open
node ./node_modules/.bin/nezha issues list --severity high

# 广播
node ./node_modules/.bin/nezha broadcasts list
node ./node_modules/.bin/nezha share "消息"

# 学习
node ./node_modules/.bin/nezha learn "学到的内容" --importance 8

# 评审
node ./node_modules/.bin/nezha review-show
node ./node_modules/.bin/nezha review-stats

# 谁在工作
node ./node_modules/.bin/nezha who-is-working

# 系统状态
node ./node_modules/.bin/nezha health
node ./node_modules/.bin/nezha tot

# GitHub issues
gh issue list --repo emptist/nezha
```

## areflect - 一键解析 (最重要命令)

```bash
# 创建 issue
nezha areflect "[ISSUE] title:修复bug type:bug severity:high"

# 创建任务
nezha areflect "[TASK] title:实现功能 priority:8 type:implementation"

# 保存学习
nezha areflect "[LEARN] insight:学到的东西 context:背景"

# 广播
nezha areflect "[ANNOUNCE] message:消息 priority:high"

# 检查待办
nezha areflect --check

# 查看最近学习
nezha areflect --learnings
```

## 核心表

| 表名           | 用途       | 查询命令                                                                 |
| -------------- | ---------- | ------------------------------------------------------------------------ |
| tasks          | 任务队列   | SELECT id, title, status, priority FROM tasks WHERE status = 'PENDING'   |
| memory         | 学习记忆   | SELECT id, tags, importance FROM memory ORDER BY created_at DESC         |
| issues         | 问题跟踪   | SELECT id, title, status, severity FROM issues WHERE status = 'open'     |
| reviews        | 代码评审   | SELECT id, title, review_type, status FROM reviews                       |
| broadcasts     | 跨 AI 广播 | SELECT id, message, priority FROM broadcasts                             |
| agent_sessions | AI 会话    | SELECT id, status, agent_type FROM agent_sessions WHERE status = 'alive' |

## 不要

- ❌ 修改其他 AI 的项目文件
- ❌ 直接替其他 AI 完成分配给它的任务
- ❌ 依赖 MCP（NuPI 是独立系统）
- ❌ 依赖记忆（数据库是唯一真相来源）

## 已验证功能 (2026-04-05)

| 能力         | 命令                              | 状态 |
| ------------ | --------------------------------- | ---- |
| 一键检查待办 | `nezha areflect --check`          | ✅   |
| 任务列表     | `nezha tasks`                     | ✅   |
| 一键解析     | `areflect [ISSUE]/[TASK]/[LEARN]` | ✅   |
| 保存学习     | `nezha learn <内容>`              | ✅   |
| 广播消息     | `nezha share <消息>`              | ✅   |
| 查看活跃会话 | `nezha who-is-working`            | ✅   |
| 任务统计     | `nezha tot`                       | ✅   |
| 系统状态     | `nezha health`                    | ✅   |
| 创建 issue   | `nezha issues create <title>`     | ✅   |
| 提交代码     | `git commit -m "[task:xxx] msg"`  | ✅   |

## Agent ID 机制

- **格式**: `S-{source}-{project}-{branch}-{session}`
- **获取**: `nezha agents whoami` 或 API `GET /identity`
- **Git Hook**: commit 时自动追加 `[Agent: xxx]` 到消息
- **追踪**: 每次 git commit 都能追溯到是哪个 AI

## 当前限制

- session ID 依赖环境变量 `OPENCODE_SESSION_ID`，当前未设置
- heartbeat 服务当前 stopped（需要时启动）

## 质量控制原则

> **核心**: 计划 → 实施，不能随意改变

1. **起点必须有**: 每个 commit 必须包含 `[task:xxx]` / `[issue:xxx]` / `[inter-review:xxx]`
2. **不能随意 commit**: 没有起点 ID 会被 prepare-commit-msg hook 阻止
3. **工作流**: 先 `task-add` / `areflect [TASK]` → 执行 → commit 引用 ID
4. **验证**: hook 调用 `nezha validate-commit` 检查 ID 是否存在

示例：

```bash
# 1. 创建任务 - 使用完整 UUID
nezha task-add "修复 bug" → 获取完整 ID: 43b880df-9d65-48b2-8747-495f310010c3

# 2. 执行任务
# ... 修复代码 ...

# 3. 提交 (引用完整任务 ID)
git commit -m "[task:43b880df-9d65-48b2-8747-495f310010c3] 修复 xx"
```

> ⚠️ AI 必须学会: 无 task/issue 不可 commit!

## 如果提交失败 (COMMIT BLOCKED)

当看到 "COMMIT BLOCKED - Quality Control Check" 时：

1. **检查错误信息**: 通常是缺少 task/issue ID
2. **使用数据库查询**: 获取有效的 task/issue ID
   ```bash
   psql -h localhost -U postgres -d nezha -c "SELECT id, title FROM tasks ORDER BY created_at DESC LIMIT 5;"
   ```
3. **重新提交**: 把 ID 加入 commit message
4. **禁止修改代码**: 不要试图通过改代码来"解决"提交问题！

> 🚫 绝对禁止: 用 `kill` 或修改代码来绕过提交问题
