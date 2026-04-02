# NuPI Code Review

**Date**: 2026-04-02  
**Project**: NuPI = Nezha united with PI (Standalone with npm link to nezha)

---

## Project Overview

**NuPI** = Nezha united with PI - Standalone AI collaboration system with npm link to `nezha`.

Architecture: Pi (TUI frontend) + Nezha (backend services/PostgreSQL) = 二合一

---

## Status

| Check | Status |
|-------|--------|
| npm link to nezha | ✅ Linked correctly |
| TypeScript typecheck | ✅ Passes |
| Build | ✅ Works |
| vitest installed | ✅ Added |
| .gitignore updated | ✅ Fixed |

---

## Issues Found & Fixed

### ✅ Fixed

| # | Issue | Location | Status |
|---|-------|----------|--------|
| 1 | `vitest` not in devDependencies | package.json | ✅ Fixed |
| 2 | `dist/` not in .gitignore | .gitignore | ✅ Fixed |
| 3 | `.nezha/` not in .gitignore | .gitignore | ✅ Fixed |
| 4 | `.tmp/` not in .gitignore | .gitignore | ✅ Fixed |
| 5 | `extensions/trae/skill.ts` empty | extensions/trae/skill.ts | ✅ Fixed |
| 6 | Command naming inconsistency (nezha-* vs nupi-*) | extensions/ | ✅ Fixed |
| 7 | Outdated path `~/gits/hub/nezha/nupi` | docs/DEVELOPER.md | ✅ Fixed |
| 8 | Duplicate docs/README.md | docs/ | ✅ Fixed |
| 9 | Pi extension files in `~/.pi/agent/extensions/` outdated | ~/.pi/agent/ | ✅ Fixed |

### 🔴 Still Open

| # | Issue | Location | Severity |
|---|-------|----------|----------|
| 1 | CLI binaries missing shebang `#!` | nezha src/cli/index.ts | Critical |

### 🟡 Medium Priority

| # | Issue | Location |
|---|-------|----------|
| 1 | `src/index.ts` - `createNuPI()` is TODO only | src/index.ts |
| 2 | API keys exposed in `~/.pi/agent/models.json` | ~/.pi/agent/models.json |

---

## Documentation Cleanup Completed

| File | Change |
|------|--------|
| `.memory/MEMORY.md` | Updated with clear AI identity, unified command names |
| `AGENTS.NuPI.md` | Added collaboration guidelines, cross-AI communication |
| `README.md` | Fixed command names (nupi-*), updated paths |
| `docs/DEVELOPER.md` | Fixed outdated path |
| `extensions/nezha-*.ts` | Renamed to `nupi-*.ts` |
| `docs/README.md` | Deleted (duplicate) |

---

## Pi Extension Files (Two Locations)

Extensions are in **two locations** - must sync both:

| Location | Purpose |
|----------|---------|
| `/Users/jk/gits/hub/tools_ai/nupi/extensions/` | Source code (git tracked) |
| `~/.pi/agent/extensions/` | Runtime (deployed) |

### Files in `~/.pi/agent/extensions/`:

```
nupi-tools.ts       # ✅ Fixed function name
nupi-autowork.ts    # ✅ Fixed function name
AGENTS.md           # ✅ Updated
README.md           # ✅ Updated
```

---

## Code Quality

### ✅ Strengths
- Clean separation: `services/`, `extensions/`, `skills/`
- Two execution paths: CLI (`PiExecutor`) and SDK (`PiSDKExecutor`)
- Extensions use direct pg queries - no MCP dependency
- Good TypeScript typing with interfaces

### ⚠️ Improvements Needed
- Implement `createNuPI()` in `src/index.ts`
- Complete `extensions/trae/skill.ts` or remove the directory
- Add tests for core services

---

## Dependencies

| Package | Version | Type |
|---------|---------|------|
| nezha | ^0.1.0 | dependency |
| pg | ^8.11.0 | dependency |
| @mariozechner/pi-coding-agent | >=0.63.0 | peerDependency |
| vitest | ✅ installed | devDependency |

---

## File Structure (Current)

```
nupi/
├── src/
│   ├── index.ts                    # Main entry (TODO: implement createNuPI)
│   ├── nezha-blind-loop.ts         # Periodic task checker
│   └── services/
│       ├── PiExecutor.ts           # CLI-based executor
│       ├── PiSDKExecutor.ts       # SDK-based executor
│       ├── TraeSkillSyncService.ts # Sync skills to Trae
│       └── TraeAutoRecoveryService.ts # Auto-recovery for failed tasks
├── extensions/
│   ├── nupi-tools.ts              # ✅ Renamed from nezha-tools.ts
│   ├── nupi-autowork.ts          # ✅ Renamed from nezha-autowork.ts
│   └── trae/
│       └── skill.ts               # ✅ Fixed (placeholder)
├── skills/
│   └── nupi-abc.md               # AI knowledge base
├── .memory/
│   └── MEMORY.md                 # AI identity and knowledge
├── docs/
│   └── DEVELOPER.md              # ✅ Fixed path
├── package.json
└── tsconfig.json
```

---

## Recommendations

1. **Immediate**: Fix CLI shebang in nezha (create issue for nezha AI)
2. **Short-term**: Implement `createNuPI()` core functionality
3. **Medium-term**: Complete or remove `trae/skill.ts`
4. **Long-term**: Consider deployment automation for Pi extensions

---

## AI Collaboration

NuPI communicates with other AIs via shared PostgreSQL:

```bash
# Check broadcasts
node ./node_modules/.bin/nezha broadcasts list

# Share updates
node ./node_modules/.bin/nezha share "message"

# Create issues/tasks
node ./node_modules/.bin/nezha areflect "[ISSUE] title: ..."

# Check tasks
node ./node_modules/.bin/nezha tasks --status PENDING
```
