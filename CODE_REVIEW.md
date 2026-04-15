# NuPI Code Review

**Date**: 2026-04-15
**Project**: NuPI = Nezha united with PI (Standalone local AI executor)

---

## Status Summary

| Check | Status |
|-------|--------|
| TypeScript compiles | ✅ Passes |
| vitest configured | ✅ Yes |
| Tests exist | ❌ No test files |
| package-lock.json in sync | ❌ Contains stale MCP references |
| Dead code | ⚠️ ExternalDelegate.js orphaned |

---

## What's Working Well

1. **Clean Architecture** - Good separation between `NuPIClient` (data), `extension.ts` (registerTool pattern), and `tools.ts` (defineTool pattern)
2. **Type Safety** - Using TypeBox for runtime validation with `Type.Object({})`
3. **Singleton Pattern** - `getNuPIClient()` properly implements lazy singleton
4. **Error Handling** - Consistent error format in tools with `content` + `details` structure
5. **ESM Modules** - Properly using `.js` extensions in imports for ESM compliance

---

## 🔴 Critical Issues

### 1. Orphaned `pi` config in package.json

```json
"pi": {
  "extensions": [
    "./extensions/nupi-tools.ts",
    "./extensions/nupi-autowork.ts"
  ]
}
```

These extension files don't exist. The actual extension is at `./src/services/extension.js` after build.

**Action**: Remove `pi` config from package.json or update paths.

---

### 2. Stale `package-lock.json`

Contains MCP references that were removed from `package.json`.

**Action**: Run `rm package-lock.json && npm install`

---

### 3. Dead Code: `ExternalDelegate.js`

File `/Users/jk/gits/hub/tools_ai/nupi/src/services/ExternalDelegate.js` exists but is never imported anywhere.

**Action**: Either delete it or import/use it.

---

## 🟡 Medium Priority Issues

### 4. No Tests

Vitest is configured but no test files exist (`*.test.ts` or `*.spec.ts`).

**Action**: Add tests for:
- `NuPIClient` CRUD operations
- Helper functions (`isLocalTask`, `isRetryableError`)

---

### 5. Unused Parameter

```typescript
async getIssues(_options?: { status?: string; limit?: number }): Promise<{ rows: any[] }> {
  return { rows: [] };  // _options is never used
}
```

**Action**: Remove unused parameter or implement the function.

---

### 6. Missing Error Logging

Database errors in `NuPIClient` are silently caught. The `logger` is imported from `nezha` but never used.

**Action**: Add logging in catch blocks:
```typescript
catch (e) {
  logger.error("Failed to get tasks", e);
  // ...
}
```

---

### 7. Inconsistent Tool Parameter Naming

- `extension.ts` uses `params` object
- `tools.ts` uses `_toolCallId` + `params`

**Action**: Standardize on one pattern.

---

## 🟢 Minor/Low Priority

### 8. Duplicate Tool Definitions

`nezha_status`, `nezha_get_tasks`, `nezha_create_task` are defined in **both** `extension.ts` and `tools.ts`.

**Action**: Pick one pattern and remove the duplicate.

---

### 9. `declaration: false` vs `types` export mismatch

`package.json` has:
```json
"types": "dist/index.d.ts"
```

But `tsconfig.json` has:
```json
"declaration": false
```

This means no `.d.ts` files are generated, so the `types` export points to nothing.

**Action**: Either set `declaration: true` in tsconfig.json or remove the `types` export from package.json.

---

### 10. Repository URL mismatch

```json
"repository": {
  "url": "git+https://github.com/emptist/nezha.git",
  "directory": "nupi"
}
```

Suggests repo is `nezha` but package name is `@nezha/nupi`.

**Action**: Verify repository is correct.

---

## Recommended Actions (Priority Order)

| Priority | Action | Status |
|----------|--------|--------|
| 🔴 High | Remove or fix `pi.extensions` in package.json | |
| 🔴 High | Regenerate package-lock.json (`rm package-lock.json && npm install`) | |
| 🔴 High | Delete `ExternalDelegate.js` (dead code) | |
| 🟡 Med | Add unit tests | |
| 🟡 Med | Enable `declaration: true` in tsconfig.json | |
| 🟡 Med | Remove duplicate tool definitions (pick one pattern) | |
| 🟡 Med | Add logging to NuPIClient catch blocks | |
| 🟢 Low | Remove unused `getIssues` parameter | |
| 🟢 Low | Verify repository URL | ✅ Fixed |

---

## File Summary

| File | Lines | Purpose |
|------|-------|---------|
| src/index.ts | 59 | Main entry, exports, helper functions |
| src/services/NuPIClient.ts | 124 | Database operations via nezha |
| src/services/extension.ts | ~100+ | Pi extension (registerTool pattern) |
| src/services/tools.ts | 102 | Pi tools array (defineTool pattern) |
| src/services/ExternalDelegate.js | ~100+ | Compiled JS, never imported - DELETE |

---

## Previous Review (2026-04-02) Issues Status

| # | Issue | Status |
|---|-------|--------|
| 1 | `vitest` not in devDependencies | ✅ Fixed |
| 2 | `dist/` not in .gitignore | ✅ Fixed |
| 3 | `.nezha/` not in .gitignore | ✅ Fixed |
| 4 | `.tmp/` not in .gitignore | ✅ Fixed |
| 5 | Extensions path outdated | ✅ Fixed (now using dist/) |
| 6 | Duplicate docs/README.md | ✅ Fixed |
| 7 | CLI binaries missing shebang | ✅ Fixed |
