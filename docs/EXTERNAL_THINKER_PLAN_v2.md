# External Thinker Mode Implementation Plan v2

> 基于 OpenCode 官方文档和最佳实践的重新设计

## 第一部分：OpenCode 集成分析与方案选择

### 1.1 背景与目标

**功能架构（类比：程序使用系统命令）：**

```
┌─────────────────────────────────────────────────────────────────┐
│                      Piano（程序）                               │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  像使用 ts/js/python 一样使用 NuPI：                        │  │
│  │                                                            │  │
│  │  ```typescript                                             │  │
│  │  // Piano 调用 NuPI，就像调用系统命令                        │  │
│  │  const result = await nupi.execute({                       │  │
│  │    mode: "outsourcing",                                    │  │
│  │    task: "复杂任务..."                                      │  │
│  │  });                                                       │  │
│  │  ```                                                       │  │
│  │                                                            │  │
│  │  或者通过协议/API 交互：                                     │  │
│  │  - HTTP API                                                │  │
│  │  - 函数调用                                                │  │
│  │  - 消息队列                                                │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              │ 协议/API 调用                     │
│                              │ （像调用 ls/cd/python3）          │
│                              ▼                                   │
┌─────────────────────────────────────────────────────────────────┐
│                      NuPI（全局命令）                            │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  类比：ls, cd, python3, node                               │  │
│  │                                                            │  │
│  │  特点：                                                    │  │
│  │  - 全局安装，独立运行                                       │  │
│  │  - 提供 API/协议，供外部调用                                │  │
│  │  - 能力无限，取决于实现                                     │  │
│  │  - 不感知调用者是谁                                         │  │
│  │                                                            │  │
│  │  工作模式：                                                 │  │
│  │  - mode: "independent"  → 自己处理                         │  │
│  │  - mode: "outsourcing"  → 外包给 delegateProvider          │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              │ 封装                               │
│                              ▼                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                      Pi（弱模型）                          │  │
│  │  - 被 NuPI 封装，不感知外部                                │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**关系说明（类比程序使用系统命令）：**

| 类比 | 说明 |
|------|------|
| **NuPI = ls/cd/python3** | 全局安装的系统命令，独立运行 |
| **Piano = 程序** | 可以调用这些命令，完成复杂任务 |
| **关系 = API/协议** | 只要遵守接口，就可以交互 |
| **能力 = 无限** | 取决于 NuPI 提供的 API |

**组件说明：**
- **NuPI**: 像 `ls`, `cd`, `python3` 一样的全局命令，提供 API 供外部调用
- **Piano**: 一个程序，通过 API/协议使用 NuPI，就像使用系统命令一样
- **关系**: 纯粹的协议/API 关系，不感知对方内部实现

**核心功能需求：**

1. **动态参数设置**
   ```typescript
   interface NuPIConfig {
     mode: "independent" | "outsourcing"  // 工作模式
     delegateProvider?: string | Function  // 外包服务（地址或函数）
     autoDelegateThreshold?: number        // 自动外包阈值
     delegatePatterns?: string[]          // 触发外包的模式
   }
   ```

2. **独立工作模式**
   - 所有任务自己处理
   - 不调用外部服务
   - 使用 Pi 的弱模型

3. **外包模式**
   - 检测"费脑子"的任务
   - 将任务发送给配置的 `delegateProvider`
   - 接收结果并展示给 Pi
   - **不关心外包给谁**，只关心接口是否兼容

4. **标准接口（外部服务需要实现）**
   ```typescript
   interface ExternalThinker {
     think(context: string, question: string): Promise<string>
     // 或者异步回调
     onTaskReceived(task: Task): Promise<Result>
   }
   ```

**问题：** NuPI 的模型需要付费，而 OpenCode 提供免费 token 且功能强大。需要设计一个可配置的 NuPI，让它可以根据参数决定自己处理还是外包，外包给谁由配置决定，NuPI 不关心具体实现。

**目标：** 基于 OpenCode 官方文档和实际能力，设计 NuPI 的外包机制，以及 Piano 作为外部思考服务的实现方案。

---

### 1.2 OpenCode 官方集成方式分析

根据 OpenCode 官方文档和源码分析，OpenCode 提供以下集成方式：

#### 方式一：ACP (Agent Client Protocol) - 官方推荐

**官方文档：** `packages/opencode/src/acp/README.md`

**描述：**
> ACP 是一个开放标准，用于代码编辑器与 AI 编码代理之间的通信。使用 JSON-RPC over stdio，采用 ND-JSON 格式。

**官方使用案例：**
- **Zed 编辑器扩展**：`packages/extensions/zed/extension.toml`
  ```toml
  [agent_servers.opencode]
  cmd = "./opencode"
  args = ["acp"]
  ```

**启动命令：**
```bash
opencode acp --cwd /path/to/project
```

**协议特点：**
- JSON-RPC over stdio (ND-JSON 格式)
- 支持的方法：`initialize`, `newSession`, `loadSession`, `prompt`, `listSessions`, `forkSession`, `resumeSession`
- 内置会话生命周期管理
- 自动权限处理
- 支持 MCP 服务器配置

**适用场景：**
- 编辑器/IDE 集成
- 需要完整会话管理的应用
- 需要权限交互的场景

**优点：**
- 官方标准协议
- Zed、JetBrains 等主流编辑器使用
- 内置会话和权限管理
- 长期维护支持

**缺点：**
- 需要实现 ACP 客户端
- 单连接限制
- 协议复杂度较高

---

#### 方式二：HTTP Server - 程序化访问

**官方文档：** `packages/web/src/content/docs/server.mdx`

**描述：**
> "Use the opencode server to interact with opencode programmatically."
> "This architecture lets opencode support multiple clients and allows you to interact with opencode programmatically."

**启动命令：**
```bash
opencode serve --port 4096 --hostname 127.0.0.1
```

**API 特点：**
- OpenAPI 3.1 规范
- RESTful HTTP API
- Basic Auth 认证
- SSE 事件流 (`/global/event`)
- CORS 支持
- mDNS 服务发现

**核心端点：**
```
POST   /session                    # 创建会话
POST   /session/:id/prompt         # 发送提示词
GET    /session/:id/message        # 获取消息
GET    /global/event               # SSE 事件流
GET    /file?path=                 # 文件操作
```

**官方 SDK：**
```typescript
import { createOpencodeClient } from "@opencode-ai/sdk"

const client = createOpencodeClient({
  baseUrl: "http://localhost:4096",
  headers: { Authorization: "Basic xxx" }
})

const session = await client.session.create({ body: {} })
const result = await client.session.prompt({ path: { id }, body: {} })
```

**适用场景：**
- 多客户端连接
- 远程访问
- 构建自定义客户端
- 需要 HTTP 接口的应用

**官方使用案例：**
- VS Code 扩展（通过 `/tui` 端点驱动 TUI）
- IDE 插件
- 社区项目：kimaki (Discord bot), portal (Mobile UI)

**优点：**
- 标准 HTTP，易于调试
- 支持多客户端
- 有官方 TypeScript SDK
- 流式响应支持

**缺点：**
- 需要手动管理会话
- 权限处理需自行实现

---

#### 方式三：CLI 命令 - 简单调用

**官方文档：** `packages/web/src/content/docs/tui.mdx`

**可用命令：**
```bash
opencode run [message]              # 单次执行
opencode session list --format json # 会话列表
opencode export <sessionID>         # 导出会话
opencode attach <url>               # 连接到运行中的服务器
```

**特点：**
- 适合脚本调用
- 支持 `--format json` 输出
- 可以指定 `--model`, `--session`, `--continue`

**适用场景：**
- 简单任务
- 快速原型
- 不需要上下文保持

**优点：**
- 简单易用
- 无需额外依赖

**缺点：**
- 功能有限
- 无会话保持
- 不适合复杂交互

---

#### 方式四：Plugin 系统 - 功能扩展

**官方文档：** `packages/web/src/content/docs/plugins.mdx`

**描述：**
> "Plugins can also add custom tools to opencode"

**特点：**
- 添加自定义工具
- 拦截工具执行 (`tool.execute.before` / `after`)
- 响应事件 (`session.created`, `message.updated` 等)
- 注入环境变量

**适用场景：**
- 扩展 OpenCode 功能
- 自定义工具
- 事件监听

**优点：**
- 深度集成
- 功能强大

**缺点：**
- 需要运行在 OpenCode 内部
- 不适合外部调用

---

### 1.3 方案对比矩阵

| 方案 | 复杂度 | 功能完整度 | 会话保持 | 流式响应 | 权限处理 | 多客户端 | 官方推荐度 |
|------|--------|-----------|----------|----------|----------|----------|-----------|
| **ACP** | ⭐⭐⭐ 高 | ⭐⭐⭐⭐⭐ 高 | ✅ 有 | ✅ 有 | ✅ 自动 | ❌ 不支持 | ⭐⭐⭐⭐⭐ |
| **HTTP Server** | ⭐⭐ 中 | ⭐⭐⭐⭐⭐ 高 | ✅ 有 | ✅ SSE | ⚠️ 需处理 | ✅ 支持 | ⭐⭐⭐⭐ |
| **CLI** | ⭐ 低 | ⭐⭐ 中 | ❌ 无 | ❌ 无 | ❌ 手动 | ❌ 不支持 | ⭐⭐ |
| **Plugin** | ⭐⭐ 中 | ⭐⭐⭐ 中 | ✅ 有 | ✅ 有 | ✅ 有 | ❌ 不支持 | ⭐⭐⭐ |

---

### 1.4 官方场景指引

根据官方文档和生态项目：

| 场景 | 官方推荐方案 | 参考项目 |
|------|-------------|----------|
| **编辑器集成** | ACP | Zed 扩展 (`packages/extensions/zed/`) |
| **IDE 插件** | HTTP Server + TUI | VS Code 扩展 |
| **多客户端/远程** | HTTP Server | portal (Mobile UI), kimaki (Discord bot) |
| **功能扩展** | Plugin | 生态中 30+ 插件 |
| **简单脚本** | CLI | - |

**关键发现：**
- **Zed 官方扩展使用 ACP** → 这是编辑器集成的权威参考
- **VS Code 扩展使用 HTTP Server** → 用于 IDE 插件场景
- **社区项目使用 SDK** → 用于构建独立应用

---

### 1.5 nezha family 需求分析

**Piano 的角色（独立服务）：**
- 作为独立服务运行，知道 NuPI 和 nezha（像使用系统命令一样）
- 通过 NuPI 提供的工具接口接收来自 Pi 的请求
- 委托给 OpenCode 进行深度推理，利用免费 token
- 将结果返回给调用方，填补 NuPI 付费模型的空隙

**NuPI 的核心能力：**

### 1. 任务外包能力（核心功能）

**目标：让 Pi 的 AI 看到外部思考的结果**

**简单流程：**
```
Pi 遇到复杂任务
      ↓
NuPI 检测触发条件（节点）
      ↓
NuPI 发布任务（多种途径）
      ↓
外部服务（Piano/Violin/其他）处理
      ↓
结果返回
      ↓
NuPI 让 Pi 的 AI **看到** 结果（通过 system prompt 或工具结果）
```

**关键：不需要复杂传递，只需要让 Pi 的 AI 看到结果**

**任务发布途径（灵活选择）：**
| 途径 | 适用场景 | 说明 |
|------|----------|------|
| **直接函数调用** | 外部服务作为库导入 | `const result = await thinker.think(context)` |
| **Callback** | 异步处理 | 注册回调函数，处理完调用 |
| **HTTP API** | 服务化部署 | `POST /api/think` |
| **消息队列** | 高并发场景 | Redis/RabbitMQ |
| **nezha** | 与现有系统集成 | 通过 nezha 数据存储 |

**触发节点示例：**
- 用户输入包含 "[delegate]" 标记
- Pi 响应包含 "我需要更多计算资源"
- 工具执行失败且需要复杂修复
- 用户主动调用 `/delegate` 命令
- 自动检测：任务复杂度超过阈值

**结果展示方式（简单直接）：**
1. **System Prompt 注入** - 在 `before_agent_start` 中添加外部结果
2. **工具结果** - 注册工具返回外部结果
3. **消息注入** - 在上下文中添加 assistant 消息

### 2. 标准能力接口

| 能力 | 功能 | 使用方式 |
|------|------|----------|
| **任务系统** | `nezha task-add` | 创建/查询任务 |
| **问题系统** | `nezha issue-add` | 创建/查询问题 |
| **会议系统** | `nezha meeting` | AI 间讨论 |
| **数据存储** | `nezha data-*` | 读写共享数据 |
| **扩展钩子** | `before_agent_start` | 注入系统提示 |
| **工具注册** | `registerTool` | 注册自定义工具 |
| **事件监听** | `on(session_start)` | 监听会话事件 |

**设计原则：**
- NuPI 接受动态配置，决定工作模式
- 外包模式下，**不关心外部服务是谁**（Piano/Violin/其他）
- 只关心外部服务是否实现标准接口
- **核心能力**：在特定节点，将任务外包 → 接受结果 → 让 Pi 看到

**关键需求：**
1. **独立服务** - Piano 是独立进程，不是 Pi 的扩展
2. **CLI/SDK 集成** - Piano 通过 CLI/SDK 与 nezha 交互，像使用 `ls/dir/grep` 一样
3. **程序化调用** - 通过 ACP 与 OpenCode 通信，非交互式
4. **上下文保持** - 需要维护与 OpenCode 的会话状态
5. **结构化输出** - 需要解析返回结果并格式化
6. **错误处理** - 需要处理超时和失败，优雅地降级

---

### 1.6 推荐方案：ACP 模式

**选择理由：**

1. **官方标准** - ACP 是 OpenCode 官方为编辑器集成设计的协议
2. **功能完整** - 内置会话管理、权限处理、MCP 支持
3. **权威验证** - Zed 官方扩展使用 ACP，证明其可靠性
4. **适合场景** - Piano 作为"思考路由器"，类似于编辑器扩展的角色

**架构图（类比：程序调用系统命令）：**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      Piano（程序）                                       │
│  ┌───────────────────────────────────────────────────────────┐         │
│  │  使用 NuPI，就像使用 ls/cd/python3：                       │         │
│  │                                                           │         │
│  │  ```typescript                                            │         │
│  │  // 方式1: 直接调用（函数调用）                             │         │
│  │  import { nupi } from '@nezha/nupi';                      │         │
│  │  const result = await nupi.think(task);                   │         │
│  │                                                           │         │
│  │  // 方式2: HTTP API（像调用 REST 服务）                     │         │
│  │  const result = await fetch('http://nupi/api/think', ...);│         │
│  │                                                           │         │
│  │  // 方式3: CLI（像执行系统命令）                            │         │
│  │  execSync(`nupi think "${task}"`);                        │         │
│  │  ```                                                      │         │
│  └───────────────────────────────────────────────────────────┘         │
│                              │                                          │
│                              │ API/协议/CLI 调用                        │
│                              │ （像调用 ls/cd/python3）                 │
│                              ▼                                          │
┌─────────────────────────────────────────────────────────────────────────┐
│                      NuPI（全局命令，独立运行）                          │
│  ┌───────────────────────────────────────────────────────────┐         │
│  │  类比：ls, cd, python3, node                               │         │
│  │                                                           │         │
│  │  特点：                                                   │         │
│  │  - 全局安装，独立运行                                      │         │
│  │  - 提供 API/CLI，供外部调用                                │         │
│  │  - 能力无限，取决于实现                                    │         │
│  │  - 不感知调用者是谁（Piano/Violin/其他程序）               │         │
│  │                                                           │         │
│  │  工作模式（可配置）：                                      │         │
│  │  - independent: 自己处理                                   │         │
│  │  - outsourcing: 外包给 delegateProvider                   │         │
│  └───────────────────────────────────────────────────────────┘         │
│                              │                                          │
│                              │ 封装 Pi                                   │
│                              ▼                                          │
│  ┌───────────────────────────────────────────────────────────┐         │
│  │                      Pi（弱模型）                          │         │
│  │  - 被 NuPI 封装，不感知外部                               │         │
│  └───────────────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────────────┘
```

**关键关系说明：**
- **NuPI = ls/cd/python3**：全局命令，独立运行，提供 API
- **Piano = 程序**：调用 NuPI，就像调用系统命令
- **关系 = API/协议**：纯粹的接口关系，不感知内部实现

**设计哲学：**
1. **NuPI 像系统命令** - 全局安装，独立运行，能力无限
2. **Piano 像程序** - 使用 NuPI，就像使用 ts/js/python
3. **关系纯粹** - 只要遵守 API，就可以交互
4. **可配置** - NuPI 工作模式可配置（独立/外包）

**Piano 的特殊之处：**
- Piano 是一个**程序**，使用 NuPI 这个"系统命令"
- Piano 整合 OpenCode（免费 token + 强大功能）
- Piano 填补 NuPI 付费模型 vs OpenCode 免费的空隙
- 但 Piano 只是**一个调用者**，不是唯一调用者

**核心 API 设计（基于 Pi 扩展机制）：**

### 1. NuPI 扩展实现（利用 Pi 的关节点）

基于 Pi 的 `before_agent_start` 和 `tool_call` 事件，NuPI 实现任务外包：

```typescript
// nupi/src/extension.ts
import type { ExtensionAPI, BeforeAgentStartEvent, ToolCallEvent } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

export default function nupiExtension(pi: ExtensionAPI) {
  // 关节点1: 用户输入后，Agent 开始前
  // 可以修改 systemPrompt，注入外部思考能力提示
  pi.on("before_agent_start", async (event: BeforeAgentStartEvent) => {
    const config = loadConfig();
    
    if (config.mode === "outsourcing") {
      return {
        systemPrompt: event.systemPrompt + EXTERNAL_THINKER_PROMPT,
      };
    }
    return { systemPrompt: event.systemPrompt };
  });

  // 关节点2: 注册工具，让 Pi 可以调用外部思考
  pi.registerTool({
    name: "nupi_delegate",
    label: "Delegate to External Thinker",
    description: "将复杂任务委托给外部思考服务处理",
    parameters: Type.Object({
      context: Type.String({ description: "当前上下文" }),
      question: Type.String({ description: "需要思考的问题" }),
      priority: Type.Optional(Type.String({ default: "medium" })),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const config = loadConfig();
      
      // 调用外部思考服务
      const result = await callExternalThinker(config, params);
      
      return {
        content: [{ type: "text", text: result.answer }],
        details: { 
          delegated: true, 
          reasoning: result.reasoning,
          source: result.source 
        },
      };
    },
  });

  // 关节点3: 拦截工具调用，自动触发外包（可选）
  pi.on("tool_call", async (event: ToolCallEvent, ctx) => {
    const config = loadConfig();
    
    // 自动检测：如果工具调用表明需要深度思考
    if (shouldAutoDelegate(event, config)) {
      // 可以阻止当前工具，改为调用外部服务
      // return { block: true, reason: "Delegated to external thinker" };
    }
  });
}

// 外部思考服务提示
const EXTERNAL_THINKER_PROMPT = `
## External Thinking Capability

You have access to an external thinking service via the "/delegate" command or "nupi_delegate" tool.

Use it when:
- The task requires deep reasoning or complex analysis
- You need to design a system or architecture
- The problem is beyond your current capabilities

The external thinker will process your request and return a detailed answer.
`.trim();
```

### 2. 外部服务接口（Piano 实现）

外部思考服务需要实现的接口：

```typescript
// 外部思考服务接口
interface ExternalThinker {
  // 主入口：接收思考请求
  think(request: ThinkRequest): Promise<ThinkResponse>;
  
  // 健康检查
  health(): Promise<HealthStatus>;
}

// 思考请求
interface ThinkRequest {
  taskId: string;           // 任务唯一ID
  context: string;          // 完整上下文
  question: string;         // 具体问题
  priority: "low" | "medium" | "high";
  sessionHistory?: Message[]; // 可选：会话历史
}

// 思考响应
interface ThinkResponse {
  taskId: string;
  answer: string;           // 主要答案
  reasoning?: string;       // 思考过程（可选）
  confidence: number;       // 置信度 0-1
  source: string;           // 来源标识（如 "opencode", "openai"）
  tokens?: {                // token 使用情况
    input: number;
    output: number;
  };
}

// 健康状态
interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  version: string;
  capabilities: string[];
}
```

### 3. 数据流转（基于 Pi 事件机制）

```
用户输入复杂问题
      ↓
Pi: before_agent_start 事件
      ↓
NuPI: 注入 systemPrompt（告知有外部思考能力）
      ↓
Pi: Agent 开始处理
      ↓
Pi: 检测到需要深度思考
      ↓
Pi: 调用 nupi_delegate 工具
      ↓
NuPI: 调用外部思考服务
      ↓
Piano: 接收请求，调用 OpenCode
      ↓
OpenCode: 深度推理
      ↓
Piano: 返回结果给 NuPI
      ↓
NuPI: 返回工具结果给 Pi
      ↓
Pi: 继续处理，展示结果给用户
```

### 4. 配置方式（NuPI 动态参数）

```typescript
// NuPI 配置接口
interface NuPIConfig {
  mode: "independent" | "outsourcing";
  
  // 外部思考服务配置
  externalThinker: {
    // 方式1: HTTP API（推荐）
    type: "http";
    endpoint: string;         // 如 "http://localhost:3000"
    apiKey?: string;          // 可选认证
    
    // 方式2: 函数调用（库级别集成）
    // type: "function";
    // handler: (request) => Promise<ThinkResponse>;
    
    // 方式3: CLI 调用
    // type: "cli";
    // command: string;        // 如 "piano think"
  };
  
  // 触发条件
  triggers: {
    autoDelegate: boolean;           // 是否自动检测
    complexityThreshold?: number;    // 复杂度阈值 0-1
    keywords: string[];              // 触发关键词
    patterns: RegExp[];              // 正则匹配模式
  };
  
  // 行为配置
  behavior: {
    timeout: number;                 // 超时时间（秒）
    retryCount: number;              // 重试次数
    fallbackToLocal: boolean;        // 失败时回退到本地模型
  };
}

// 配置加载
function loadConfig(): NuPIConfig {
  // 从 ~/.config/nupi/config.json 或环境变量加载
  const configPath = path.join(os.homedir(), ".config", "nupi", "config.json");
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, "utf-8"));
  }
  return getDefaultConfig();
}
```

**实现要点：**

1. **Piano 作为 ACP Client**
   - 使用 `@agentclientprotocol/sdk`（如果可用）
   - 或自行实现 ACP 协议客户端
   - 通过 stdio 与 OpenCode ACP Server 通信

2. **会话管理**
   - 使用 `newSession` 创建新会话
   - 使用 `prompt` 发送思考请求
   - 可选：`loadSession` 恢复历史会话

3. **权限处理**
   - ACP 内置权限请求机制
   - Piano 需要实现 `Client` 接口处理权限

---

### 1.7 备选方案：HTTP Server + SDK

**适用情况：**
- 如果 ACP 实现复杂度过高
- 如果需要多客户端连接
- 如果需要远程访问

**实现要点：**
- 使用 `@opencode-ai/sdk`
- 管理 session ID
- 处理权限请求（需要额外实现）

---

## 第二部分：Piano 实现方案

### 2.1 Piano 架构

Piano 作为外部思考服务，需要实现 `ExternalThinker` 接口，并整合 OpenCode：

```
┌─────────────────────────────────────────────────────────────────┐
│                      Piano（外部思考服务）                       │
│  ┌─────────────────┐         ACP / HTTP          ┌───────────┐ │
│  │   HTTP Server   │ ←────────────────────────→ │  OpenCode │ │
│  │   (API Layer)   │                            │  (Strong  │ │
│  └────────┬────────┘                            │   Model)  │ │
│           │                                      └───────────┘ │
│           │                                                    │
│  ┌────────▼────────┐                                          │
│  │  Think Service  │  - 接收请求                              │
│  │                 │  - 构建 prompt                           │
│  │                 │  - 调用 OpenCode                         │
│  │                 │  - 解析结果                              │
│  └─────────────────┘                                          │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Piano HTTP API 实现

```typescript
// piano/src/server.ts
import express from "express";
import { createOpenCodeClient } from "./opencode-client";

const app = express();
app.use(express.json());

const openCode = createOpenCodeClient({
  mode: "acp", // 或 "http"
  cwd: process.cwd(),
});

// 健康检查
app.get("/health", async (req, res) => {
  res.json({
    status: "healthy",
    version: "1.0.0",
    capabilities: ["thinking", "reasoning", "design"],
  });
});

// 主思考接口
app.post("/think", async (req, res) => {
  const { taskId, context, question, priority } = req.body;
  
  try {
    // 构建 prompt
    const prompt = buildPrompt(context, question);
    
    // 调用 OpenCode
    const result = await openCode.think(prompt, {
      timeout: priority === "high" ? 60000 : 300000,
    });
    
    res.json({
      taskId,
      answer: result.answer,
      reasoning: result.reasoning,
      confidence: result.confidence,
      source: "opencode",
      tokens: result.tokens,
    });
  } catch (error) {
    res.status(500).json({
      taskId,
      error: error.message,
      confidence: 0,
      source: "error",
    });
  }
});

function buildPrompt(context: string, question: string): string {
  return `
## Context
${context}

## Question
${question}

## Instructions
Please provide a detailed answer with reasoning.
`.trim();
}

app.listen(3000, () => {
  console.log("Piano thinking service listening on port 3000");
});
```

### 2.3 OpenCode 客户端实现

#### 方案 A：ACP 模式（推荐）

```typescript
// piano/src/opencode-acp-client.ts
import { spawn } from "child_process";
import { EventEmitter } from "events";

interface ACPMessage {
  jsonrpc: "2.0";
  id?: number;
  method?: string;
  params?: any;
  result?: any;
  error?: any;
}

export class OpenCodeACPClient {
  private process: ReturnType<typeof spawn>;
  private messageId = 0;
  private pendingRequests = new Map<number, { resolve: Function; reject: Function }>();
  private sessionId: string | null = null;

  constructor(private cwd: string) {
    this.process = spawn("opencode", ["acp", "--cwd", cwd], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.process.stdout?.on("data", (data) => {
      this.handleMessage(data.toString());
    });

    this.process.stderr?.on("data", (data) => {
      console.error("OpenCode stderr:", data.toString());
    });
  }

  private handleMessage(data: string) {
    const lines = data.split("\n").filter((line) => line.trim());
    for (const line of lines) {
      try {
        const msg: ACPMessage = JSON.parse(line);
        if (msg.id !== undefined && this.pendingRequests.has(msg.id)) {
          const { resolve, reject } = this.pendingRequests.get(msg.id)!;
          if (msg.error) {
            reject(new Error(msg.error.message));
          } else {
            resolve(msg.result);
          }
          this.pendingRequests.delete(msg.id);
        }
      } catch (e) {
        console.error("Failed to parse message:", line);
      }
    }
  }

  private async sendRequest(method: string, params: any): Promise<any> {
    const id = ++this.messageId;
    const request: ACPMessage = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.process.stdin?.write(JSON.stringify(request) + "\n");
    });
  }

  async initialize(): Promise<void> {
    await this.sendRequest("initialize", {
      protocolVersion: "2025-03-25",
      capabilities: {},
    });
  }

  async newSession(): Promise<string> {
    const result = await this.sendRequest("newSession", {});
    this.sessionId = result.sessionId;
    return result.sessionId;
  }

  async think(prompt: string, options?: { timeout?: number }): Promise<{
    answer: string;
    reasoning?: string;
    confidence: number;
    tokens?: { input: number; output: number };
  }> {
    if (!this.sessionId) {
      await this.newSession();
    }

    const result = await this.sendRequest("prompt", {
      sessionId: this.sessionId,
      prompt,
    });

    return {
      answer: result.content || result.message?.content || "",
      reasoning: result.reasoning,
      confidence: 0.9, // OpenCode 通常有高置信度
      tokens: result.usage,
    };
  }

  async close(): Promise<void> {
    this.process.kill();
  }
}
```

#### 方案 B：HTTP Server 模式

```typescript
// piano/src/opencode-http-client.ts
export class OpenCodeHTTPClient {
  private baseUrl: string;
  private sessionId: string | null = null;

  constructor(baseUrl: string = "http://localhost:4096") {
    this.baseUrl = baseUrl;
  }

  async think(prompt: string): Promise<{
    answer: string;
    reasoning?: string;
    confidence: number;
    tokens?: { input: number; output: number };
  }> {
    // 创建会话（如果没有）
    if (!this.sessionId) {
      const sessionRes = await fetch(`${this.baseUrl}/api/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Piano Thinking" }),
      });
      const session = await sessionRes.json();
      this.sessionId = session.id;
    }

    // 发送 prompt
    const response = await fetch(
      `${this.baseUrl}/api/sessions/${this.sessionId}/prompt`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      }
    );

    const result = await response.json();

    return {
      answer: result.content || "",
      reasoning: result.thinking,
      confidence: 0.9,
      tokens: result.usage,
    };
  }
}
```

### 2.4 完整数据流

```
用户输入: "设计一个分布式系统"
      ↓
Pi: 弱模型处理
      ↓
Pi: 检测到需要深度思考（通过 systemPrompt 提示）
      ↓
Pi: 调用 nupi_delegate 工具
      ↓
NuPI: 读取配置，确定外部思考服务地址
      ↓
NuPI: HTTP POST /think 到 Piano
      ↓
Piano: 接收请求，构建 prompt
      ↓
Piano: 调用 OpenCode（ACP 或 HTTP）
      ↓
OpenCode: 深度推理（强模型）
      ↓
Piano: 解析结果，返回给 NuPI
      ↓
NuPI: 返回工具结果给 Pi
      ↓
Pi: 展示结果给用户
      ↓
用户: 看到详细的设计方案
```

### 2.5 部署方式

| 方式 | 命令 | 适用场景 |
|------|------|----------|
| **开发** | `piano dev` | 本地开发，热重载 |
| **生产** | `piano start` | 后台服务 |
| **Docker** | `docker run -p 3000:3000 piano` | 容器化部署 |
| **CLI** | `piano think "question"` | 命令行直接调用 |

---

### 实现参考

#### ACP 协议参考

**文件：** `packages/opencode/src/acp/README.md`

**核心接口：**
```typescript
// Agent 接口（OpenCode 实现）
interface ACPAgent {
  initialize(params: InitializeRequest): Promise<InitializeResponse>
  newSession(params: NewSessionRequest): Promise<NewSessionResponse>
  loadSession(params: LoadSessionRequest): Promise<LoadSessionResponse>
  prompt(params: PromptRequest): Promise<PromptResponse>
  // ...
}

// Client 接口（Piano 需要实现）
interface ACPClient {
  readTextFile(params: ReadTextFileRequest): Promise<ReadTextFileResponse>
  writeTextFile(params: WriteTextFileRequest): Promise<WriteTextFileResponse>
  requestPermission(params: PermissionRequest): Promise<PermissionResponse>
}
```

**启动 OpenCode ACP：**
```bash
opencode acp --cwd /path/to/project
```

#### Zed 扩展示例

**文件：** `packages/extensions/zed/extension.toml`

```toml
[agent_servers.opencode]
name = "OpenCode"
cmd = "./opencode"
args = ["acp"]
```

#### SDK 使用示例

**文件：** `packages/web/src/content/docs/sdk.mdx`

```typescript
import { createOpencodeClient } from "@opencode-ai/sdk"

const client = createOpencodeClient({
  baseUrl: "http://localhost:4096"
})

// 创建会话
const session = await client.session.create({
  body: { title: "Thinking Task" }
})

// 发送提示词
const result = await client.session.prompt({
  path: { id: session.data.id },
  body: {
    model: {
      providerID: "anthropic",
      modelID: "claude-3-5-sonnet-20241022"
    },
    parts: [{ type: "text", text: "分析这个问题..." }]
  }
})
```

---

### 1.9 风险与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| ACP SDK 不可用 | 中 | 高 | 自行实现 ACP 协议客户端 |
| OpenCode 版本不兼容 | 低 | 中 | 锁定版本，测试验证 |
| 权限处理复杂 | 中 | 中 | 先实现自动批准，后续优化 |
| 性能问题 | 低 | 中 | 使用流式响应，设置超时 |

---

### 1.10 下一步行动

1. **验证 ACP SDK 可用性**
   - 检查 `@agentclientprotocol/sdk` 是否发布
   - 评估自行实现的可行性

2. **设计 Piano ACP Client**
   - 定义 Piano 与 OpenCode 的交互接口
   - 设计会话管理策略

3. **实现原型**
   - 实现基本的 `initialize` 和 `prompt` 调用
   - 测试端到端流程

---

## 第二部分：待研究的问题（Gap）

> 原文档提到的其他问题将在本部分解决后继续研究

### 已知 Gap：

1. **NuPI Auto-Delegation 模式**
   - 弱模型检测机制
   - 自动触发委托

2. **Task Continuation Pattern**
   - 结果回流到 Pi
   - 与 nezha 的集成

3. **Cost Tracking**
   - 委托成本记录
   - Token 使用量追踪

---

## 附录：参考文档

### 官方文档
- ACP README: `packages/opencode/src/acp/README.md`
- Server Docs: `packages/web/src/content/docs/server.mdx`
- SDK Docs: `packages/web/src/content/docs/sdk.mdx`
- Plugin Docs: `packages/web/src/content/docs/plugins.mdx`

### 官方示例
- Zed 扩展: `packages/extensions/zed/extension.toml`
- 生态项目: `packages/web/src/content/docs/ecosystem.mdx`

### 源码参考
- ACP Agent: `packages/opencode/src/acp/agent.ts`
- ACP Client: `packages/opencode/src/acp/client.ts`
- ACP Types: `packages/opencode/src/acp/types.ts`
- Server Implementation: `packages/opencode/src/server/server.ts`
