# NuPI Project Context Enhancement Proposal

## Problem

NuPI lacks deep understanding of the projects it works on, limiting its ability to provide context-aware assistance.

## Current Limitations

### 1. Basic Project Type Detection
```typescript
// Current: Only detects language
detectProjectType(cwd) => "node" | "python" | "swift" | "rust" | "go" | "unknown"
```

### 2. Minimal Project Registration
```typescript
// Current: Only basic metadata
{
  fingerprint, name, type, gitRemote, path
}
```

### 3. No Architecture Awareness
- No understanding of project structure
- No knowledge of module relationships
- No awareness of design patterns used

## Proposed Enhancements

### 1. Enhanced Project Detection

```typescript
interface ProjectContext {
  // Basic Info (existing)
  fingerprint: string;
  name: string;
  type: string;
  gitRemote: string | null;
  path: string;
  
  // NEW: Detailed Tech Stack
  techStack: {
    language: string;
    runtime: string;           // Node.js version, Python version, etc.
    framework?: string;        // React, Vue, Django, FastAPI, etc.
    buildTool?: string;        // Webpack, Vite, Poetry, Cargo, etc.
    testFramework?: string;    // Jest, Vitest, Pytest, etc.
    linter?: string;           // ESLint, Ruff, SwiftLint, etc.
    formatter?: string;        // Prettier, Black, swift-format, etc.
  };
  
  // NEW: Architecture Info
  architecture: {
    pattern: string;           // Monorepo, Microservices, MVC, etc.
    structure: string[];       // Directory structure overview
    entryPoints: string[];     // Main entry files
    configFiles: string[];     // Configuration files
  };
  
  // NEW: Dependencies
  dependencies: {
    production: string[];      // Production dependencies
    development: string[];     // Dev dependencies
    external: string[];        // External services (databases, APIs)
  };
  
  // NEW: Development Workflow
  workflow: {
    testCommand?: string;      // How to run tests
    buildCommand?: string;     // How to build
    lintCommand?: string;      // How to lint
    commitConvention?: string; // Commit message format
  };
  
  // NEW: Code Style
  codeStyle: {
    indentStyle: 'spaces' | 'tabs';
    indentSize: number;
    quoteStyle: 'single' | 'double';
    semicolons: boolean;
    namingConvention: string;  // camelCase, snake_case, etc.
  };
}
```

### 2. Intelligent Context Gathering

```typescript
// Auto-detect from package.json
function detectNodeProject(cwd: string): ProjectContext {
  const pkg = JSON.parse(fs.readFileSync('package.json'));
  
  return {
    techStack: {
      framework: detectFramework(pkg.dependencies),  // React, Vue, etc.
      testFramework: detectTestFramework(pkg.devDependencies),  // Jest, Vitest
      buildTool: detectBuildTool(pkg.devDependencies),  // Webpack, Vite
    },
    workflow: {
      testCommand: pkg.scripts?.test,
      buildCommand: pkg.scripts?.build,
      lintCommand: pkg.scripts?.lint,
    },
    dependencies: {
      production: Object.keys(pkg.dependencies || {}),
      development: Object.keys(pkg.devDependencies || {}),
    },
  };
}

// Auto-detect from config files
function detectCodeStyle(cwd: string): CodeStyle {
  if (fs.existsSync('.prettierrc')) {
    return parsePrettierConfig('.prettierrc');
  }
  if (fs.existsSync('.eslintrc')) {
    return parseESLintConfig('.eslintrc');
  }
  // ...
}
```

### 3. Project Learning System

```typescript
// Learn from project history
interface ProjectLearning {
  commonPatterns: string[];     // Frequently used patterns
  typicalTasks: string[];       // Common task types
  errorPatterns: string[];      // Common errors encountered
  bestPractices: string[];      // Project-specific best practices
}

// Store in database
async function updateProjectLearning(
  fingerprint: string, 
  learning: ProjectLearning
): Promise<void> {
  await execSafe(
    `INSERT INTO project_learnings (fingerprint, patterns, tasks, errors, practices)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (fingerprint) DO UPDATE SET
       patterns = EXCLUDED.patterns,
       tasks = EXCLUDED.tasks,
       errors = EXCLUDED.errors,
       practices = EXCLUDED.practices`,
    [fingerprint, learning.commonPatterns, learning.typicalTasks, 
     learning.errorPatterns, learning.bestPractices]
  );
}
```

### 4. Context Injection into System Prompt

```typescript
// Inject project context into AI system prompt
function buildProjectContextPrompt(context: ProjectContext): string {
  return `
## Project Context

**Project**: ${context.name} (${context.type})
**Architecture**: ${context.architecture.pattern}

### Tech Stack
- Language: ${context.techStack.language}
- Framework: ${context.techStack.framework || 'N/A'}
- Test Framework: ${context.techStack.testFramework || 'N/A'}

### Code Style
- Indent: ${context.codeStyle.indentStyle} (${context.codeStyle.indentSize})
- Quotes: ${context.codeStyle.quoteStyle}
- Semicolons: ${context.codeStyle.semicolons}

### Workflow
- Test: \`${context.workflow.testCommand || 'npm test'}\`
- Build: \`${context.workflow.buildCommand || 'npm run build'}\`
- Lint: \`${context.workflow.lintCommand || 'npm run lint'}\`

### Dependencies
- Production: ${context.dependencies.production.slice(0, 5).join(', ')}${context.dependencies.production.length > 5 ? '...' : ''}
- Dev: ${context.dependencies.development.slice(0, 5).join(', ')}${context.dependencies.development.length > 5 ? '...' : ''}

### Project-Specific Best Practices
${context.learnings?.bestPractices.map(p => `- ${p}`).join('\n') || 'No specific practices recorded yet'}
`;
}
```

## Implementation Plan

### Phase 1: Enhanced Detection (Week 1)
- [ ] Implement detailed tech stack detection
- [ ] Add architecture pattern recognition
- [ ] Parse configuration files (package.json, pyproject.toml, etc.)

### Phase 2: Database Schema (Week 1)
- [ ] Create `project_contexts` table
- [ ] Create `project_learnings` table
- [ ] Add migration scripts

### Phase 3: Context Injection (Week 2)
- [ ] Build context prompt builder
- [ ] Integrate with system prompt
- [ ] Test with different project types

### Phase 4: Learning System (Week 3)
- [ ] Implement pattern recognition
- [ ] Add task tracking
- [ ] Create feedback loop

## Benefits

1. **Better Code Suggestions** - AI understands project conventions
2. **Context-Aware Testing** - Knows how to run tests
3. **Consistent Style** - Follows project code style
4. **Faster Onboarding** - New developers get project context
5. **Reduced Errors** - Learns from past mistakes

## Database Schema

```sql
CREATE TABLE project_contexts (
  fingerprint TEXT PRIMARY KEY REFERENCES projects(fingerprint),
  tech_stack JSONB NOT NULL DEFAULT '{}',
  architecture JSONB NOT NULL DEFAULT '{}',
  dependencies JSONB NOT NULL DEFAULT '{}',
  workflow JSONB NOT NULL DEFAULT '{}',
  code_style JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE project_learnings (
  fingerprint TEXT PRIMARY KEY REFERENCES projects(fingerprint),
  common_patterns TEXT[] DEFAULT '{}',
  typical_tasks TEXT[] DEFAULT '{}',
  error_patterns TEXT[] DEFAULT '{}',
  best_practices TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Priority

**High** - This is fundamental to NuPI's ability to provide intelligent assistance.
