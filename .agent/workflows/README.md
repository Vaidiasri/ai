# Agent Workflow System

A CLI-based agent workflow system to streamline your development process with intelligent automation and best practices.

## 🚀 Available Workflows

### 1. `/feature-planner` - Feature Planning with Complexity Control

Plan new features with proper complexity analysis, ensuring all implementations stay simple and maintainable (complexity < 1).

**When to use:**

- Starting a new feature
- Need to break down complex requirements
- Want to ensure simple, maintainable code

**What it does:**

- Analyzes feature requirements
- Breaks down into atomic tasks
- Ensures each task has complexity < 1
- Creates detailed implementation plan
- Identifies risks and dependencies

**Output:**

- `feature-plan.md` with complete breakdown
- Task list with complexity scores
- File modification list
- Verification steps

---

### 2. `/feature-reviewer` - Code Standards Review

Review your code against established coding standards, best practices, and project conventions.

**When to use:**

- Before committing changes
- After completing a feature
- During code review process

**What it does:**

- Runs automated linting and formatting
- Checks TypeScript types
- Reviews code quality standards
- Validates accessibility
- Checks security best practices
- Generates compliance report

**Output:**

- `code-review-report.md` with findings
- Categorized issues (Critical/Warning/Info)
- Compliance checklist
- Action items

---

### 3. `/pr-raiser` - Smart Pull Request Creation

Create clean pull requests by staging only relevant files, excluding redundant or unrelated changes.

**When to use:**

- Ready to create a pull request
- Need to clean up staged files
- Want to ensure clean git history

**What it does:**

- Analyzes changed files
- Identifies redundant files to exclude
- Stages only relevant changes
- Creates well-formatted commits
- Generates PR with proper description

**Output:**

- Clean git commit
- Pull request with clear description
- File inclusion verification
- PR checklist

---

### 4. `/ai-enhancer` - AI-Powered Feature Enhancement

Use AI to analyze and enhance features with intelligent suggestions for improvements and optimizations.

**When to use:**

- Want to improve existing features
- Need performance optimization ideas
- Looking for UX enhancements
- Want to identify security issues

**What it does:**

- Analyzes code for improvements
- Suggests performance optimizations
- Recommends UX enhancements
- Identifies security vulnerabilities
- Generates enhancement plan
- Prioritizes improvements

**Output:**

- `enhancement-report.md` with analysis
- `enhancement-plan.md` with priorities
- Performance metrics
- Implementation suggestions

---

## 📋 Workflow Usage

### Basic Usage

Simply type the workflow command in your conversation:

```
/feature-planner
/feature-reviewer
/pr-raiser
/ai-enhancer
```

### Workflow Sequence (Recommended)

For a complete feature development cycle:

```
1. /feature-planner    → Plan the feature
2. [Implement code]    → Write your code
3. /ai-enhancer        → Enhance and optimize
4. /feature-reviewer   → Review code quality
5. /pr-raiser          → Create pull request
```

---

## 🎯 Complexity Guidelines

### Complexity < 1 (Feature Planner Standard)

**✅ Simple (Complexity < 1):**

- Adding a new prop to a component
- Creating a basic UI component
- Simple state management with useState
- Straightforward API call
- Minor CSS/styling changes
- Adding a utility function

**❌ Complex (Complexity ≥ 1):**

- Complex algorithms or business logic
- Major architectural changes
- Multiple interdependent systems
- Advanced state management patterns
- Complex data transformations

---

## 🔧 Configuration

### Auto-run Commands (Turbo Mode)

Some workflows have `// turbo` annotations that allow safe commands to auto-run:

- Linting commands
- Formatting commands
- Git status checks
- TypeScript type checking

### Customization

You can customize workflows by editing the files in `.agent/workflows/`:

```
.agent/
└── workflows/
    ├── feature-planner.md
    ├── feature-reviewer.md
    ├── pr-raiser.md
    └── ai-enhancer.md
```

---

## 📊 Workflow Outputs

All workflows generate structured outputs in markdown format:

| Workflow         | Output Files                                   |
| ---------------- | ---------------------------------------------- |
| Feature Planner  | `feature-plan.md`                              |
| Feature Reviewer | `code-review-report.md`                        |
| PR Raiser        | Git commit + PR                                |
| AI Enhancer      | `enhancement-report.md`, `enhancement-plan.md` |

---

## 💡 Best Practices

### 1. Start with Planning

Always use `/feature-planner` before starting implementation to ensure clarity and simplicity.

### 2. Review Before Committing

Run `/feature-reviewer` before creating a PR to catch issues early.

### 3. Clean PRs

Use `/pr-raiser` to ensure only relevant files are included in your pull requests.

### 4. Continuous Improvement

Periodically run `/ai-enhancer` on existing features to identify optimization opportunities.

### 5. Maintain Low Complexity

Keep all changes simple (complexity < 1) for better maintainability and fewer bugs.

---

## 🚦 Severity Levels

### Code Review Severity

- 🔴 **Critical**: Must fix before merge (security, breaking changes)
- 🟡 **Warning**: Should fix (performance, maintainability)
- 🔵 **Info**: Nice to have (style preferences, optimizations)

### Enhancement Priority

- 🔴 **High**: Critical improvements (security, major bugs)
- 🟡 **Medium**: Important enhancements (UX, maintainability)
- 🟢 **Low**: Nice-to-have improvements (polish, minor optimizations)

---

## 📚 Additional Resources

### Commit Message Format

```
<type>: <description>

<detailed changes>

Closes #<issue-number>
```

**Types:**

- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code refactoring
- `style:` - Formatting changes
- `docs:` - Documentation updates
- `test:` - Test additions/changes
- `chore:` - Maintenance tasks

### File Organization

- Keep components in `src/components/`
- Keep utilities in `src/lib/` or `src/utils/`
- Keep types in `src/types/`
- Keep hooks in `src/hooks/`

---

## 🤝 Contributing

To add a new workflow:

1. Create a new `.md` file in `.agent/workflows/`
2. Add YAML frontmatter with description
3. Document the workflow steps
4. Add usage examples
5. Update this README

---

## 📝 Example Workflow Run

```bash
# 1. Plan a new feature
/feature-planner
> "I want to add a user profile page"

# 2. [Implement the feature]

# 3. Enhance with AI suggestions
/ai-enhancer
> Analyzes code and suggests improvements

# 4. Review code quality
/feature-reviewer
> Checks standards and generates report

# 5. Create pull request
/pr-raiser
> Stages relevant files and creates PR
```

---

## 🎉 Benefits

- ✅ **Consistent Quality**: Automated checks ensure code standards
- ✅ **Faster Development**: Streamlined workflows save time
- ✅ **Better Planning**: Complexity control prevents over-engineering
- ✅ **Clean Git History**: Smart file staging keeps PRs focused
- ✅ **Continuous Improvement**: AI-powered enhancement suggestions
- ✅ **Best Practices**: Built-in guidance for common tasks

---

**Happy Coding! 🚀**
