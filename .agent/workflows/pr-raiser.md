---
description: Create PR with only relevant changed files (no redundant files)
---

# PR Raiser Workflow

This workflow helps you create a clean pull request by staging only the files that are relevant to your feature, excluding redundant or unrelated changes.

## Usage

```bash
# Run this workflow when ready to create a PR
/pr-raiser
```

## Steps

### 1. Check Current Git Status

// turbo

```bash
git status
```

### 2. Review All Changed Files

- Examine the list of modified files
- Identify which files are relevant to the current feature
- Flag any files that contain unrelated changes

### 3. Identify Redundant Files

Common files to exclude:

- [ ] `package-lock.json` or `yarn.lock` (unless dependency changes are intentional)
- [ ] `.env` or `.env.local` files
- [ ] `node_modules/` (should be in .gitignore)
- [ ] Build artifacts (`dist/`, `.next/`, `build/`)
- [ ] IDE config files (`.vscode/`, `.idea/`)
- [ ] Log files
- [ ] `__pycache__/` or `.pyc` files
- [ ] Temporary test files
- [ ] Debug files

### 4. Create Feature Branch (if not already on one)

```bash
# Check current branch
git branch --show-current

# If on main/master, create feature branch
git checkout -b feature/your-feature-name
```

### 5. Stage Only Relevant Files

**Option A: Stage files individually**

```bash
# Stage specific files
git add path/to/file1.tsx
git add path/to/file2.ts
git add path/to/file3.css
```

**Option B: Stage all, then unstage redundant files**

```bash
# Stage all changes
git add .

# Unstage redundant files
git reset HEAD path/to/redundant-file
git reset HEAD package-lock.json
```

### 6. Review Staged Changes

// turbo

```bash
git diff --staged
```

Verify:

- [ ] All staged files are relevant to the feature
- [ ] No sensitive data (API keys, passwords, tokens)
- [ ] No debugging code (console.logs, debugger statements)
- [ ] No commented-out code blocks
- [ ] Consistent formatting

### 7. Commit Changes

```bash
git commit -m "feat: [feature description]

- Detailed change 1
- Detailed change 2
- Detailed change 3

Closes #[issue-number]"
```

**Commit Message Format:**

- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code refactoring
- `style:` - Formatting changes
- `docs:` - Documentation updates
- `test:` - Test additions/changes
- `chore:` - Maintenance tasks

### 8. Push to Remote

```bash
git push origin feature/your-feature-name
```

### 9. Create Pull Request

// turbo

```bash
gh pr create --title "Feature: [Feature Name]" --body "## Description
[Describe the feature]

## Changes Made
- Change 1
- Change 2

## Testing
- [ ] Manual testing completed
- [ ] All tests pass
- [ ] Code review completed

## Screenshots (if applicable)
[Add screenshots]

Closes #[issue-number]"
```

### 10. Verify PR Contents

- [ ] Only relevant files are included
- [ ] PR description is clear and complete
- [ ] Linked to related issues
- [ ] Reviewers assigned (if applicable)
- [ ] Labels added (if applicable)

## Smart File Selection Tips

### Files to ALWAYS include:

- Source code files directly related to the feature
- New test files
- Updated documentation
- Migration files (if database changes)
- Configuration changes (if intentional)

### Files to CAREFULLY review:

- `package.json` - Only if you added/updated dependencies
- Config files - Only if configuration changed
- Shared utilities - Ensure changes don't break other features

### Files to EXCLUDE:

- Personal IDE settings
- Local environment files
- Temporary/backup files
- Unrelated bug fixes (create separate PR)

## Output

The workflow should produce:

1. Clean git commit with only relevant files
2. Pull request with clear description
3. List of files included in the PR
4. Verification checklist
