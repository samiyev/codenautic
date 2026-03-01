# M14 — All Providers & Pages

> Источник: `packages/runtime/TODO.md`

> **Задач (runtime):** 5 | **Проверка:** Graph, Documentation, Architecture, Settings, Organizations controllers

> **Результат milestone:** Готово расширение API для полноты пользовательских и интеграционных потоков.

## API v0.7.0 — Core Контроллерs Part 2

> Graph, Documentation, Architecture, Settings, Organizations. ~100K tokens.

> **Результат версии:** Завершена версия «API v0.7.0 — Core Controllers Part 2» в рамках M14; инкремент готовит продукт к стабильному end-to-end сценарию в своем слое.

| ID | Задача | Статус | Результат | Acceptance Criteria |
|----------|--------------------|--------|-----------|---------------------|
| API-CTRL-004 | Реализовать graphController | TODO | Не начато | Реализация: Get graph by repo. Query nodes. Impact analysis. Готово, если: graph controller поддерживает impact/query операции с валидацией входа, исключает N+1 деградации и возвращает частичные результаты с диагностикой при неполных данных; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| API-CTRL-005 | Реализовать documentationController | TODO | Не начато | Реализация: Browse, search. Q&A chat endpoint. Готово, если: для API-CTRL-005 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| API-CTRL-006 | Реализовать architectureController | TODO | Не начато | Реализация: Health score. DDD compliance. Layer violations. Готово, если: для API-CTRL-006 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| API-CTRL-007 | Реализовать settingsController | TODO | Не начато | Реализация: Get/update. Scope: org, team, repo. Validation. Готово, если: settings controller корректно изолирует scope org/team/repo, конфликтные апдейты разрешаются предсказуемо, и unauthorized update блокируется; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| API-CTRL-008 | Реализовать organizationsController | TODO | Не начато | Реализация: CRUD. Members. Teams. BYOK. Billing. Готово, если: organizations controller обеспечивает консистентные CRUD операции для members/teams/BYOK/billing, а критичные изменения логируются в audit trail; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |

---
