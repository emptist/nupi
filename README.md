# NuPI (牛派)

**NuPI** = Nezha united with PI

**独立系统**，完全不依赖 OpenCode。

---

## 如何在项目中使用 NuPI

### 前提条件

1. PostgreSQL 数据库 (`nezha` 数据库存在)
2. Pi (TUI 前端) 已安装
3. 或者使用本地 npm link 模式（开发时）

### 方式 1：作为 Pi 扩展（推荐）

```bash
# 1. 复制扩展到 Pi
cp nupi/extensions/*.ts ~/.pi/agent/extensions/

# 2. 复制 skill 到 Pi
cp -r nupi/skills/ ~/.pi/agent/skills/

# 3. 重启 Pi
pi .
```

扩展会自动注册以下命令：

| 命令           | 说明         |
| -------------- | ------------ |
| `nupi-tasks`  | 查看待办任务 |
| `nupi-issues` | 查看开放问题 |
| `nupi-status` | 系统状态     |
| `nupi-work`   | 自主工作模式 |
| `nupi-learn`  | 保存学习     |
| `nupi-search` | 搜索记忆     |

### 方式 2：本地开发模式（现在就能用）

```bash
# 1. 链接本地 nezha（如果还没链接）
cd ~/gits/hub/your-project
npm link nezha

# 2. 链接 NuPI
npm link @nezha/nupi
```

### 方式 3：独立 npm 包（待发布）

```bash
npm install @nezha/nupi
```

### 使用示例

```typescript
import { PiExecutor } from "@nezha/nupi";

// 执行 Pi 任务
const executor = new PiExecutor({
  model: "llama3.2:3b",
});

const result = await executor.execute(`
你是 Nezha AI 助手。
任务：修复登录 bug
描述：用户无法使用社交账号登录
`);

console.log(result.message);
console.log(result.success);
```

### 环境变量

```bash
# 数据库
NEZHA_DB_NAME=nezha
NEZHA_DB_HOST=localhost
NEZHA_DB_PORT=5432

# Pi 模型（可选）
PI_MODEL=llama3.2:3b
```

---

## Workspace

NuPI 是 Nezha monorepo 的子系统：

```json
{
  "name": "@nezha/nupi",
  "dependencies": { "nezha": "^0.1.0" }
}
```

### 未来：独立 npm 包

搬出 monorepo 后：

```bash
npm install @nezha/nupi
```

---

## 架构

```
NuPI = Pi (TUI前端) + Nezha (后端服务)
```

- **Pi**: 交互界面，工具执行
- **Nezha**: 数据库，任务/记忆/学习

## 启动方式

### 方式 1：nupi 命令（推荐）

```bash
nupi              # 启动 NuPI 模式 (本地 LLM)
```

### 直接 Pi 扩展

```bash
pi ~/.pi/agent/extensions/nupi-tools.ts
```

## 目录结构

```
nupi/
├── src/           # NuPI 核心代码 (未来 npm 包)
├── extensions/    # Pi 扩展
│   ├── nupi-tools.ts      # 数据库/CLI 工具
│   └── nupi-autowork.ts   # 永续工作循环
└── skills/        # Pi Skills
    └── nupi-abc/
        └── SKILL.md   # AI 必读文档
```

## AI 协作系统

### GitHub 同步服务

高优先级 issues 自动同步到 GitHub (emptist/nezha#11)：
- 使用 `[ISSUE] severity:high` 触发同步
- 解决 450+ pending issues 噪声问题
- 人类可见，易于参与

### 双渠道 Issue 系统

| 渠道 | 用途 |
|------|------|
| nezha DB | 任务追踪、AI 协作 |
| GitHub | 讨论、@mentions、人类可见 |

### AI 间协作命令

```bash
nezha share <message>     # 广播到所有 AI
nezha tasks --tag nupi    # 查看 NuPI 任务
nezha issues --status open # 查看开放问题
nezha learn <insight>     # 保存学习
```

## 本地 LLM

- **Model**: llama3.2:3b (Ollama)
- **Embedding**: nomic-embed-text (Ollama)

零 API 成本，24/7 运行。
