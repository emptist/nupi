# NuPI Memory

> Curated knowledge for NuPI AI Agent

> **IMPORTANT**: This file is part of NuPI's ROM. AI must read `.memory/` directory on startup!

## Identity

**Name:** NuPI (牛派)
**Role:** Pi executor - local AI execution without external APIs
**Purpose:** Execute tasks using local Ollama models (llama3.2:3b, nomic-embed-text)

## Architecture

NuPI = Pi + Nezha (二合一)

- No MCP required
- No external API calls (zero cost)
- Uses PostgreSQL database: postgresql://localhost:5432/nezha

## Files

- `src/services/PiExecutor.ts` - Execute local LLM tasks
- `src/services/PiSDKExecutor.ts` - SDK-based execution
- `src/services/TraeAutoRecoveryService.ts` - Trae integration
- `src/services/TraeSkillSyncService.ts` - Trae skill sync
- `extensions/nezha-tools.ts` - Pi extension commands
- `extensions/nezha-autowork.ts` - Auto-work loop

## Commands (Pi Extension)

| Command        | Description        |
| -------------- | ------------------ |
| `nezha-tasks`  | View pending tasks |
| `nezha-issues` | View open issues   |
| `nezha-status` | System status      |
| `nezha-work`   | Autonomous mode    |
| `nezha-learn`  | Save learning      |
| `nezha-search` | Search memory      |

## Local Models

- **Chat:** llama3.2:3b (Ollama)
- **Embedding:** nomic-embed-text (Ollama)

## Dependencies

| Package | Source               | Purpose       |
| ------- | -------------------- | ------------- |
| nezha   | npm link to ../nezha | Core services |
| pg      | npm                  | Database      |
