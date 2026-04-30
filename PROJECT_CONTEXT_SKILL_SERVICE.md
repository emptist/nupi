# Project Context Architecture: Skill + Service

## 问题

项目上下文功能应该完全用 Skill 系统实现，还是需要额外的服务层？

## 分析

### Skill 系统的能力

```typescript
// Skill 是静态指令
interface Skill {
  name: string;
  instructions: string;  // 静态文本指令
  trigger_phrases: string[];
  // ...
}
```

**优点：**
- ✅ AI 可以动态加载
- ✅ 可以被搜索和匹配
- ✅ 易于更新和维护

**局限：**
- ❌ 不能执行代码
- ❌ 不能动态检测
- ❌ 不能存储数据

### 正确的分层设计

```
┌─────────────────────────────────────┐
│   NuPI (使用上下文 + Skill 指导)     │
└─────────────────┬───────────────────┘
                  │
    ┌─────────────┴─────────────┐
    │                           │
┌───▼────┐              ┌───────▼──────┐
│ Skills │              │   Services   │
│ (指导) │              │  (检测+存储)  │
└────────┘              └──────────────┘
```

## 实施方案

### 1. Nezha 服务层（检测 + 存储）

```typescript
// nezha/src/services/ProjectContextService.ts
export class ProjectContextService {
  // 动态检测项目信息
  async detectProjectContext(cwd: string): Promise<ProjectContext> {
    return {
      techStack: await this.detectTechStack(cwd),
      architecture: await this.detectArchitecture(cwd),
      dependencies: await this.detectDependencies(cwd),
      codeStyle: await this.detectCodeStyle(cwd),
    };
  }
  
  // 存储到数据库
  async saveProjectContext(fingerprint: string, context: ProjectContext): Promise<void> {
    await this.db.query(
      `INSERT INTO project_contexts (fingerprint, context) VALUES ($1, $2)
       ON CONFLICT (fingerprint) DO UPDATE SET context = $2`,
      [fingerprint, JSON.stringify(context)]
    );
  }
  
  // CLI 命令
  // nezha project detect
  // nezha project show
}

// 数据库表
CREATE TABLE project_contexts (
  fingerprint TEXT PRIMARY KEY REFERENCES projects(fingerprint),
  context JSONB NOT NULL,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. Skill 层（指导 + 最佳实践）

#### Skill 1: project-context-awareness

```sql
INSERT INTO skills (name, description, instructions, category) VALUES (
  'project-context-awareness',
  'How to use project context for better assistance',
  '
## Project Context Usage

When working on a project, ALWAYS check project context first:

1. **Check Project Type**
   - Use `nezha project show` to see project info
   - Understand tech stack before making suggestions

2. **Respect Project Conventions**
   - Follow detected code style (indent, quotes, semicolons)
   - Use project-specific test commands
   - Respect build tool preferences

3. **Project-Specific Best Practices**
   - React projects: Use hooks, functional components
   - Python projects: Follow PEP 8, use type hints
   - Node projects: Check package.json scripts

4. **When Context is Missing**
   - Ask user to run `nezha project detect`
   - Suggest creating project-specific skill

## Example Usage

```typescript
// Before suggesting code
const projectContext = await getProjectContext();

if (projectContext.techStack.framework === "React") {
  // Suggest React-specific patterns
}

if (projectContext.codeStyle.indentSize === 2) {
  // Use 2-space indent in suggestions
}
```
  ',
  'best-practices'
);
```

#### Skill 2: react-project

```sql
INSERT INTO skills (name, description, instructions, category, tags) VALUES (
  'react-project',
  'React project specific best practices',
  '
## React Project Guidelines

### Component Structure
- Use functional components with hooks
- One component per file
- Component name matches filename

### State Management
- Use useState for local state
- Use useReducer for complex state
- Consider Context for global state

### Testing
- Use React Testing Library
- Test user interactions, not implementation
- Aim for 80% coverage

### Code Style
- Prefer arrow functions for components
- Use destructuring for props
- Keep components small (< 200 lines)

### Common Commands
- `npm test` - Run tests
- `npm run build` - Production build
- `npm run lint` - Check code style
  ',
  'framework',
  ARRAY['react', 'frontend', 'javascript']
);
```

#### Skill 3: python-project

```sql
INSERT INTO skills (name, description, instructions, category, tags) VALUES (
  'python-project',
  'Python project specific best practices',
  '
## Python Project Guidelines

### Code Style
- Follow PEP 8
- Use type hints
- Max line length: 88 (Black default)

### Project Structure
- Use src/ layout for packages
- Separate tests/ directory
- Use pyproject.toml for configuration

### Testing
- Use pytest
- Aim for 90% coverage
- Use fixtures for test data

### Common Commands
- `pytest` - Run tests
- `black .` - Format code
- `ruff check .` - Lint code
  ',
  'framework',
  ARRAY['python', 'backend']
);
```

### 3. NuPI 层（集成）

```typescript
// nupi/src/extension.ts
export default function nupiExtension(pi: ExtensionAPI) {
  pi.on('session_start', async () => {
    const cwd = process.cwd();
    
    // 1. 检测项目上下文
    const context = await nezha.projectContext.detect(cwd);
    
    // 2. 加载相关 skills
    const skills = await nezha.skill.search(context.techStack.framework);
    
    // 3. 构建系统提示
    const contextPrompt = `
## Project Context

${buildContextPrompt(context)}

## Project-Specific Guidelines

${skills.map(s => s.instructions).join('\n\n')}
`;
    
    // 4. 注入到 Pi
    pi.injectSystemPrompt(contextPrompt);
  });
}
```

## 对比：纯 Skill vs Skill + 服务

| 方案 | 优点 | 缺点 |
|------|------|------|
| **纯 Skill** | 简单、无需代码 | 无法动态检测、无法存储 |
| **Skill + 服务** ✅ | 动态检测、持久化、可扩展 | 需要实现服务层 |

## 实施步骤

### Phase 1: Nezha 服务 (Week 1)
- [ ] 创建 `ProjectContextService`
- [ ] 实现检测逻辑（package.json, pyproject.toml 等）
- [ ] 添加数据库表
- [ ] 实现 CLI 命令

### Phase 2: Skills (Week 1)
- [ ] 创建 `project-context-awareness` skill
- [ ] 创建框架特定 skills (react, python, etc.)
- [ ] 测试 skill 加载

### Phase 3: NuPI 集成 (Week 2)
- [ ] 调用 Nezha 服务
- [ ] 加载相关 skills
- [ ] 构建上下文提示
- [ ] 测试集成

## 结论

**Skill 系统不够，需要 Skill + 服务：**

- **Skill 层**：提供指导、最佳实践、项目特定规范
- **服务层**：提供动态检测、持久化存储、CLI 命令
- **NuPI 层**：集成两者，构建智能上下文

这样既利用了 Skill 系统的灵活性，又提供了必要的动态检测能力。
