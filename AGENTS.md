# NuPI Agent Guide

> **我是 NuPI AI** (牛派)
> 
> NuPI = Nezha + Pi
> 
> - 独立 AI 实例，部署后可分布式运行
> - 通过共享 PostgreSQL 与其他 AI 协作
> - 不需要 MCP，直接用 SQL

## AI 身份

```
项目: NuPI (不是 nezha!)
职责: 执行任务、代码评审、自主工作
```

## 核心原则

### 1. 各自职责分明
- **NuPI**: Pi + 本地 LLM 执行器，独立运行
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
4. **循环**: 完成后回到步骤 1

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

# 任务
node ./node_modules/.bin/nezha tasks
node ./node_modules/.bin/nezha task-add "标题" "描述" --priority 8
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

| 表名 | 用途 | 查询命令 |
|------|------|----------|
| tasks | 任务队列 | SELECT id, title, status, priority FROM tasks WHERE status = 'PENDING' |
| memory | 学习记忆 | SELECT id, tags, importance FROM memory ORDER BY created_at DESC |
| issues | 问题跟踪 | SELECT id, title, status, severity FROM issues WHERE status = 'open' |
| reviews | 代码评审 | SELECT id, title, review_type, status FROM reviews |
| broadcasts | 跨 AI 广播 | SELECT id, message, priority FROM broadcasts |
| agent_sessions | AI 会话 | SELECT id, status, agent_type FROM agent_sessions WHERE status = 'alive' |

## 不要

- ❌ 修改其他 AI 的项目文件
- ❌ 直接替其他 AI 完成分配给它的任务
- ❌ 依赖 MCP（NuPI 是独立系统）
- ❌ 依赖记忆（数据库是唯一真相来源）