## Description

<!-- What does this PR do? Why is this change needed? -->

## Related Issue

<!-- Link to the issue this PR addresses: Fixes #123 -->

## Package(s) Affected

<!-- Which package(s) does this PR modify? -->

**apps:**

- [ ] `api`
- [ ] `webhooks`
- [ ] `review-worker`
- [ ] `scan-worker`
- [ ] `agent-worker`
- [ ] `notification-worker`
- [ ] `analytics-worker`
- [ ] `scheduler`
- [ ] `web`
- [ ] `mcp`

**libs:**

- [ ] `core`
- [ ] `ast`
- [ ] `messaging`
- [ ] `worker-infra`

**providers:**

- [ ] `git-providers`
- [ ] `llm-providers`
- [ ] `context-providers`
- [ ] `notifications`

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactoring (no functional changes)
- [ ] Documentation
- [ ] Tests
- [ ] CI/CD

## Checklist

- [ ] Tests pass: `cd packages/<pkg> && bun test`
- [ ] Linter clean: `cd packages/<pkg> && bun run lint`
- [ ] Formatter clean: `cd packages/<pkg> && bun run format:check`
- [ ] Type check passes: `cd packages/<pkg> && bun run typecheck`
- [ ] No dead code or unused imports
- [ ] Coverage maintained (95% lines / 94% functions)
- [ ] Follows [architecture rules](../CONTRIBUTING.md#architecture-overview) (dependency direction, layer separation)
- [ ] Commit messages follow [Conventional Commits](../CONTRIBUTING.md#commit-messages)
