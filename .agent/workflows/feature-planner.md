---
description: Plan a new feature with complexity analysis (always < 1)
---

# Feature Planner Workflow

This workflow helps you plan a new feature with proper complexity analysis, ensuring the implementation stays simple and maintainable.

## Usage

```bash
# Run this workflow when starting a new feature
/feature-planner
```

## Steps

### 1. Understand the Feature Request

- Clearly define what the feature should accomplish
- Identify the user story or requirement
- List the acceptance criteria

### 2. Analyze Current Codebase

- Search for similar existing implementations
- Identify reusable components or patterns
- Check for any related utilities or hooks

### 3. Break Down the Feature

- Divide the feature into small, atomic tasks
- Each task should be independently testable
- Ensure each task has complexity < 1 (simple, straightforward changes)

### 4. Create Implementation Plan

- List all files that need to be created or modified
- For each file, specify:
  - What changes are needed
  - Why the changes are necessary
  - Estimated complexity (must be < 1)
- Identify dependencies between tasks

### 5. Identify Potential Risks

- List any potential breaking changes
- Note any dependencies on external libraries
- Highlight areas that might need extra testing

### 6. Define Success Criteria

- Specify how to verify the feature works
- List manual testing steps
- Identify any automated tests to add

### 7. Document the Plan

- Create a markdown file with the complete plan
- Include code snippets for complex logic
- Add diagrams if helpful (using mermaid)

## Complexity Guidelines

**Complexity < 1 means:**

- ✅ Simple prop additions
- ✅ Basic state management
- ✅ Straightforward UI components
- ✅ Simple API calls
- ✅ Minor refactoring
- ❌ Complex algorithms
- ❌ Major architectural changes
- ❌ Multiple interdependent systems

## Output

The workflow should produce:

1. `feature-plan.md` - Detailed implementation plan
2. Task breakdown with complexity scores
3. List of files to be modified/created
4. Verification steps
