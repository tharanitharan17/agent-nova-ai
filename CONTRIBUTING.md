# Contributing to GoalPilot AI

Thank you for your interest in contributing to GoalPilot AI! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Reporting Bugs](#reporting-bugs)
- [Feature Requests](#feature-requests)

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn package manager
- Git
- Ollama (for local model testing) or Gemini API key

### Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/yourusername/goalpilot-ai.git
   cd goalpilot-ai
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Configure environment:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. Start development server:
   ```bash
   npm run dev
   ```

## Development Workflow

### Branch Strategy

- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/*` - Feature branches
- `bugfix/*` - Bug fix branches
- `hotfix/*` - Critical production fixes

### Creating a Feature Branch

```bash
git checkout develop
git pull origin develop
git checkout -b feature/your-feature-name
```

### Making Changes

1. Make your changes following the coding standards
2. Write tests for new functionality
3. Ensure all tests pass
4. Commit your changes with descriptive messages

### Commit Message Format

Follow conventional commits:

```
type(scope): subject

body

footer
```

Types:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting, etc.)
- `refactor` - Code refactoring
- `test` - Adding or updating tests
- `chore` - Maintenance tasks

Example:
```
feat(agent): add new reflection mechanism

Implement enhanced reflection agent that analyzes task completion
patterns and provides adaptive feedback.

Closes #123
```

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Enable strict mode in tsconfig.json
- Avoid `any` types - use proper typing
- Use interfaces for object shapes
- Use type aliases for union types

### Code Style

- Use 2 spaces for indentation
- Use single quotes for strings
- Use semicolons
- Max line length: 100 characters
- Use meaningful variable and function names

### File Organization

- Keep files focused on a single responsibility
- Use barrel files (index.ts) for exports
- Group related files in directories
- Use descriptive file names

### Comments

- Document complex logic with comments
- Use JSDoc for function documentation
- Keep comments concise and relevant
- Avoid obvious comments

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

### Writing Tests

- Write unit tests for all new functions
- Write integration tests for API endpoints
- Test edge cases and error conditions
- Aim for >80% code coverage

### Test Structure

```typescript
describe('FeatureName', () => {
  describe('functionName', () => {
    it('should do something', () => {
      // Arrange
      const input = {};

      // Act
      const result = functionName(input);

      // Assert
      expect(result).toEqual(expected);
    });
  });
});
```

## Submitting Changes

### Pull Request Process

1. Update your branch:
   ```bash
   git fetch upstream
   git rebase upstream/develop
   ```

2. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

3. Create a pull request on GitHub

### Pull Request Checklist

- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings
- [ ] Tests added and passing
- [ ] All tests passing locally
- [ ] Commit messages follow conventions

### Review Process

- Maintainers will review your PR
- Address feedback in a timely manner
- Keep PRs focused and small
- Be responsive to review comments

## Reporting Bugs

### Before Reporting

- Check existing issues
- Search for similar problems
- Verify it's not a configuration issue

### Bug Report Template

Use the provided bug report template in `.github/ISSUE_TEMPLATE/bug_report.md`

Include:
- Clear description of the bug
- Steps to reproduce
- Expected vs actual behavior
- Environment details
- Relevant logs

## Feature Requests

### Before Requesting

- Check existing feature requests
- Consider if it fits project goals
- Think about implementation complexity

### Feature Request Template

Use the provided feature request template in `.github/ISSUE_TEMPLATE/feature_request.md`

Include:
- Clear description of the feature
- Problem it solves
- Proposed solution
- Alternatives considered

## Questions?

Feel free to:
- Open an issue for questions
- Start a discussion in GitHub Discussions
- Contact maintainers directly

Thank you for contributing to GoalPilot AI! 🚀
