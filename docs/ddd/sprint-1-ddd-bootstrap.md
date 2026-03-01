# Sprint-1 DDD Bootstrap

> Дата: 2026-03-02
> Цель: перевести DDD из уровня документации в минимально исполняемый контур (core -> adapters -> runtime).
> Формат: задачи готовы для переноса в `packages/*/TODO.md`.

---

## Scope спринта

- 2 ключевых Aggregate в `core` (Review, Rule) с инвариантами
- Domain Events + минимальный Event Catalog
- Порты/фабрики/репозитории для end-to-end use case
- ACL contract tests для 3 приоритетных интеграций
- Outbox/Inbox минимальный идемпотентный контур
- Архитектурные guardrails в CI

---

## Задачи (15)

| ID | Пакет | Задача | Статус | Результат | Acceptance Criteria |
|---|---|---|---|---|---|
| DDD-S1-001 | core | Реализовать `review` aggregate (минимальное ядро) | TODO | Не начато | Реализация: AggregateRoot с инвариантами статуса, severity budget, lifecycle методов (`start`, `complete`, `fail`). Готово, если: инварианты не обходятся через публичный API, есть unit-тесты happy/negative/edge, API aggregate не тянет внешние типы; DoD: `cd packages/core && bun run lint && bun run typecheck && bun test`. |
| DDD-S1-002 | core | Реализовать `rule` aggregate + rule status policy | TODO | Не начато | Реализация: AggregateRoot для custom rules (активация/деактивация/архивация) + policy проверки переходов. Готово, если: запрещённые переходы дают доменную ошибку, policy покрыта тестами, use cases не содержат rule-логики напрямую; DoD: `cd packages/core && bun run lint && bun run typecheck && bun test`. |
| DDD-S1-003 | core | Реализовать фабрики `ReviewFactory` и `RuleFactory` (`create/reconstitute`) | TODO | Не начато | Реализация: `IEntityFactory<T>` для обоих aggregate, создание только через фабрики. Готово, если: `create` валидирует вход, `reconstitute` безопасно восстанавливает состояние, unit-тесты покрывают оба режима; DoD: `cd packages/core && bun run lint && bun run typecheck && bun test`. |
| DDD-S1-004 | core | Реализовать domain events `ReviewStarted`, `ReviewCompleted`, `RuleActivated` | TODO | Не начато | Реализация: immutable events (past tense) + публикация из aggregate root. Готово, если: события эмитятся ровно в нужных transition points, payload стабилен и типизирован, тесты проверяют событие на каждую ветку; DoD: `cd packages/core && bun run lint && bun run typecheck && bun test`. |
| DDD-S1-005 | core | Реализовать ports: `IReviewRepository`, `IRuleRepository`, `IDomainEventBus` | TODO | Не начато | Реализация: outbound ports с минимальным набором операций (`save`, `findById`, domain-specific queries). Готово, если: порты не зависят от infra-типов, контракты покрыты type + unit тестами, токены DI добавлены; DoD: `cd packages/core && bun run lint && bun run typecheck && bun test`. |
| DDD-S1-006 | core | Реализовать use case `CompleteReviewUseCase` (орchestrator only) | TODO | Не начато | Реализация: load aggregate -> apply domain behavior -> persist -> publish events. Готово, если: бизнес-ветвления делегированы aggregate/policy, error flow через `Result<T, E>`, интеграционные тесты use case зелёные; DoD: `cd packages/core && bun run lint && bun run typecheck && bun test`. |
| DDD-S1-007 | core | Реализовать `docs/ddd/domain-events-catalog.md` как source of truth | TODO | Не начато | Реализация: каталог событий (name, producer, consumers, version, idempotency key). Готово, если: каждый event из core присутствует в каталоге, есть правило версионирования payload, документ связан с roadmap; DoD: `cd packages/core && bun run lint && bun run typecheck && bun test`. |
| DDD-S1-008 | adapters | Реализовать ACL adapter contract tests для Git (external -> domain DTO) | TODO | Не начато | Реализация: контрактные тесты на mapping, error normalization, retry/idempotency expectations. Готово, если: внешние SDK-типы не просачиваются в core DTO, тесты покрывают happy/429/5xx/partial data, regression suite стабильна; DoD: `cd packages/adapters && bun run lint && bun run typecheck && bun test`. |
| DDD-S1-009 | adapters | Реализовать ACL adapter contract tests для LLM | TODO | Не начато | Реализация: проверки request/response normalization, token/cost fields, fallback behavior. Готово, если: единый доменный формат ответа соблюдается для минимум 2 провайдеров, edge-cases покрыты тестами; DoD: `cd packages/adapters && bun run lint && bun run typecheck && bun test`. |
| DDD-S1-010 | adapters | Реализовать ACL adapter contract tests для Context provider (Jira/Linear one-of) | TODO | Не начато | Реализация: валидация маппинга issue fields/sprint/status в доменные DTO. Готово, если: обязательные поля нормализованы, невалидные внешние данные не ломают доменную модель, контрактные тесты зелёные; DoD: `cd packages/adapters && bun run lint && bun run typecheck && bun test`. |
| DDD-S1-011 | adapters | Реализовать `OutboxWriter` + `InboxDeduplicator` adapters (минимум) | TODO | Не начато | Реализация: запись outbox-сообщений и проверка idempotency по message key. Готово, если: duplicate processing предотвращается, retry не ломает консистентность, unit/integration тесты подтверждают поведение; DoD: `cd packages/adapters && bun run lint && bun run typecheck && bun test`. |
| DDD-S1-012 | runtime | Реализовать wiring `CompleteReviewUseCase` в `review-worker` composition root | TODO | Не начато | Реализация: DI registration портов/репозиториев/шины событий без `new` в use case. Готово, если: worker поднимается и выполняет happy-path сценарий с тестовым payload, wiring покрыт integration тестом; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| DDD-S1-013 | runtime | Реализовать runtime consumer для outbox relay (минимальный контур) | TODO | Не начато | Реализация: publish событий из outbox в messaging topic + mark sent/fail. Готово, если: есть retry policy, failure-path переводит запись в fail state, тестируется идемпотентный повтор; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| DDD-S1-014 | core+adapters | Реализовать архитектурные guardrails (dependency direction checks) | TODO | Не начато | Реализация: автоматическая проверка запрещённых импортов (`domain` -> `application/infrastructure`, `application` -> `infrastructure`). Готово, если: нарушение направления ломает CI, есть 2-3 negative fixture tests; DoD: `cd packages/core && bun run lint && bun run typecheck && bun test && cd ../adapters && bun run lint && bun run typecheck && bun test`. |
| DDD-S1-015 | docs | Реализовать `docs/ddd/context-map.md` + `docs/ddd/ubiquitous-language.md` v1 | TODO | Не начато | Реализация: context map (upstream/downstream, ACL boundaries), словарь доменных терминов с owner и change policy. Готово, если: термины и границы используются в core/adapters TODO как reference, изменения языка проходят через ADR/process; DoD: `cd packages/core && bun run lint && bun run typecheck && bun test`. |

---

## Definition of Done для Sprint-1

- Минимум 2 aggregate реализованы и покрыты тестами
- Минимум 3 domain events используются в runtime-потоке
- Минимум 3 ACL contract suites зелёные
- Outbox/Inbox минимальный цикл работает идемпотентно
- CI блокирует нарушение dependency direction
- Context Map + Ubiquitous Language зафиксированы как source of truth

---

## Рекомендуемый порядок выполнения

1. DDD-S1-001..006 (core домен и use case)
2. DDD-S1-012..013 (runtime wiring + relay)
3. DDD-S1-008..011 (ACL и messaging adapters)
4. DDD-S1-014..015 (guardrails + стратегические артефакты)

