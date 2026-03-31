# NuPI

NuPI 是 Nezha 的 Pi 扩展模块，提供与 Pi AI 系统的集成能力。

## 依赖关系

```
nupi → nezha (核心库)
     → @mariozechner/pi-coding-agent
```

## 安装

```bash
npm install
```

## 构建

```bash
npm run build
```

## 开发

```bash
npm run dev
```

## 功能

- PiSDKExecutor: Pi SDK 执行器
- PiExecutor: Pi 执行器封装
- System Prompt Skill 创建脚本

## 架构

NuPI 仅依赖 Nezha 核心库，不直接依赖 OpenCode 或其他外部 AI 系统。
