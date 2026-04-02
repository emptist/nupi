# NuPI Developer Guide

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL (nezha database)
- Pi (TUI) installed
- npm link to nezha: `npm link nezha`

### Setup

```bash
# Install dependencies
npm install

# Link nezha
npm link nezha

# Build
npm run build
```

### Development Workflow

1. Make changes in nupi
2. Test with `npm run typecheck`
3. Commit (hook will add agent ID)
4. Push to remote

### Architecture

NuPI = Pi + Nezha (二合一)

- Local LLM execution (Ollama)
- Zero API cost

### Key Files

- `src/services/PiExecutor.ts` - Execute local LLM
- `src/services/PiSDKExecutor.ts` - SDK execution
- `src/services/TraeAutoRecoveryService.ts` - Trae integration

### Pi Extensions

Copy extensions to Pi:

```bash
cp extensions/*.ts ~/.pi/agent/extensions/
cp -r skills/ ~/.pi/agent/skills/
```

### Testing

```bash
npm run test
```

### Building

```bash
npm run build
```

Note: After modifying nezha core, run `npm run build` in nezha to update the linked package.
