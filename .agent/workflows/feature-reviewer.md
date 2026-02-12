---
description: Review code against coding standards and best practices
---

# Feature Reviewer Workflow

This workflow reviews your code changes against established coding standards, best practices, and project conventions.

## Usage

```bash
# Run this workflow before committing changes
/feature-reviewer
```

## Steps

### 1. Run Linting and Formatting

// turbo

```bash
npm run lint
```

// turbo

```bash
npm run format
```

### 2. Check TypeScript Types

// turbo

```bash
npx tsc --noEmit
```

### 3. Review Code Standards

#### **React/Next.js Standards**

- [ ] Components use proper TypeScript types (no `any`)
- [ ] Props are properly typed with interfaces
- [ ] Hooks are used correctly (dependency arrays, cleanup)
- [ ] Components are properly memoized if needed
- [ ] Server/Client components are correctly designated

#### **Code Quality**

- [ ] No console.logs in production code
- [ ] Error handling is implemented
- [ ] Loading states are handled
- [ ] Edge cases are covered
- [ ] Code is DRY (Don't Repeat Yourself)

#### **Naming Conventions**

- [ ] Components use PascalCase
- [ ] Functions/variables use camelCase
- [ ] Constants use UPPER_SNAKE_CASE
- [ ] Files match component names
- [ ] Meaningful, descriptive names

#### **Performance**

- [ ] No unnecessary re-renders
- [ ] Images are optimized (Next.js Image component)
- [ ] Large lists use virtualization if needed
- [ ] API calls are debounced/throttled where appropriate

#### **Accessibility**

- [ ] Semantic HTML elements used
- [ ] ARIA labels where needed
- [ ] Keyboard navigation works
- [ ] Color contrast is sufficient
- [ ] Alt text for images

#### **Security**

- [ ] No sensitive data in client code
- [ ] Input validation implemented
- [ ] XSS prevention measures
- [ ] API routes are protected

### 4. Check File Organization

- [ ] Files are in correct directories
- [ ] Imports are organized (external → internal → relative)
- [ ] No circular dependencies
- [ ] Barrel exports used appropriately

### 5. Review Comments and Documentation

- [ ] Complex logic has explanatory comments
- [ ] JSDoc comments for public APIs
- [ ] README updated if needed
- [ ] No commented-out code

### 6. Test Coverage

- [ ] Unit tests for utilities/hooks
- [ ] Integration tests for features
- [ ] E2E tests for critical flows
- [ ] All tests pass

### 7. Generate Review Report

Create a review report with:

- List of issues found (categorized by severity)
- Suggestions for improvements
- Compliance score
- Action items

## Severity Levels

- 🔴 **Critical**: Must fix before merge (security, breaking changes)
- 🟡 **Warning**: Should fix (performance, maintainability)
- 🔵 **Info**: Nice to have (style preferences, minor optimizations)

## Output

The workflow should produce:

1. `code-review-report.md` - Detailed review findings
2. List of files that need fixes
3. Compliance checklist with pass/fail status
4. Recommended next steps
