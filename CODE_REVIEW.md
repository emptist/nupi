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
| Build | ⚠️ Not tested (vitest missing) |

---

## Issues Found

### 🔴 Critical

| # | Issue | Location |
|---|-------|----------|
| 1 | `vitest` not in devDependencies - `npm run test` fails | package.json |
| 2 | `dist/` directory not in .gitignore - built files may be committed | .gitignore |

### 🟡 Medium

| # | Issue | Location |
|---|-------|----------|
| 1 | `extensions/trae/skill.ts` only contains auto-fix comments, no actual code | extensions/trae/skill.ts |
| 2 | `src/index.ts` - `createNuPI()` is TODO only, returns empty object | src/index.ts:30 |
| 3 | Default DB credentials hardcoded in `nezha-autowork.ts` | extensions/nezha-autowork.ts:41 |

### 🟢 Low / Cleanup

| # | Issue | Location |
|---|-------|----------|
| 1 | `.nezha/` directory not in .gitignore (already untracked) | .gitignore |

---

## Quick Fixes

```bash
# 1. Add vitest dependency
npm install -D vitest

# 2. Update .gitignore
cat >> .gitignore << 'EOF'
dist/
.nezha/
EOF

# 3. Build the project
npm run build

# 4. Run tests
npm run test
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
- Complete `extensions/trae/skill.ts`
- Externalize hardcoded credentials to env vars

---

## Dependencies

| Package | Version | Type |
|---------|---------|------|
| nezha | ^0.1.0 | dependency |
| pg | ^8.11.0 | dependency |
| @mariozechner/pi-coding-agent | >=0.63.0 | peerDependency |
| vitest | missing | devDependency |

---

## File Structure

```
nupi/
├── src/
│   ├── index.ts                    # Main entry (TODO: implement createNuPI)
│   ├── nezha-blind-loop.ts         # Periodic task checker
│   └── services/
│       ├── PiExecutor.ts           # CLI-based executor
│       ├── PiSDKExecutor.ts        # SDK-based executor
│       ├── TraeSkillSyncService.ts # Sync skills to Trae
│       └── TraeAutoRecoveryService.ts # Auto-recovery for failed tasks
├── extensions/
│   ├── nezha-tools.ts              # Pi commands: nupi-tasks, nupi-learn, etc.
│   ├── nezha-autowork.ts           # Continuous work loop
│   └── trae/
│       └── skill.ts                # EMPTY - needs implementation
├── skills/
│   └── nupi-abc.md                 # AI knowledge base
├── docs/
├── package.json
└── tsconfig.json
```

---

## Recommendations

1. **Immediate**: Add vitest to devDependencies and update .gitignore
2. **Short-term**: Implement `createNuPI()` core functionality
3. **Medium-term**: Complete `trae/skill.ts` or remove the directory
4. **Long-term**: Consider environment variable validation on startup
