# Inner AI Test Detection Logic is Incomplete

## Problem

The Inner AI test detection logic in InterReviewService.ts is incomplete and produces false negatives.

## Current Behavior

**File:** `src/services/InterReviewService.ts:485-491`

```typescript
if (!context.includes('test') && !context.includes('Test')) {
  suggestions.push({
    type: 'suggestion',
    severity: 'medium',
    message: 'No tests detected - consider adding test coverage',
  });
}
```

This logic only checks if the **content** contains the string "test" or "Test", but does NOT:
1. Check file names (e.g., `*.test.ts`, `*.spec.ts`)
2. Check if test files are staged
3. Verify test quality or coverage

## Reproduction Steps

1. Create a new test file: `src/inner-ai-sync.test.ts`
2. Add comprehensive tests (10 tests, all passing)
3. Stage the file: `git add src/inner-ai-sync.test.ts`
4. Run: `nezha inner review`
5. **Result:** Still reports "No tests detected" with score 70/100

## Expected Behavior

Inner AI should:
1. Check for test files by name pattern (`*.test.ts`, `*.spec.ts`)
2. Check if staged changes include test files
3. Provide accurate test coverage feedback
4. Not report false negatives when tests are present

## Impact

- Developers may ignore test suggestions when tests actually exist
- Review scores are inaccurate
- Reduces trust in the Inner AI review system

## Suggested Fix

```typescript
// Check for test files by name pattern
const testFilePatterns = [/\.test\.(ts|js|tsx|jsx)$/, /\.spec\.(ts|js|tsx|jsx)$/];
const hasTestFiles = stagedFiles.some(file => 
  testFilePatterns.some(pattern => pattern.test(file))
);

// Check for test content
const hasTestContent = context.includes('test') || 
                       context.includes('Test') || 
                       context.includes('describe(') || 
                       context.includes('it(');

if (!hasTestFiles && !hasTestContent) {
  suggestions.push({
    type: 'suggestion',
    severity: 'medium',
    message: 'No tests detected - consider adding test coverage',
  });
}
```

## Priority

**High** - This affects the accuracy of all Inner AI reviews and developer workflow.

## Related Files

- `/Users/jk/gits/hub/tools_ai/nezha/src/services/InterReviewService.ts`
- `/Users/jk/gits/hub/tools_ai/nupi/src/inner-ai-sync.test.ts` (test file that was not detected)
