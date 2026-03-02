# Domain Events Catalog (Core)

> Source of truth для domain events пакета `@codenautic/core`.
>
> Связь с roadmap:
> - `M00` — DDD Bootstrap (минимальный исполняемый event contour)
> - `M03` — 20-stage pipeline и SafeGuard event-driven orchestration
> - `M11` — Agent Worker & Chat (event consumers в runtime)

## Версионирование payload

1. Версия события задаётся полем `version` в metadata события.
2. Изменение существующего поля payload (тип, семантика, обязательность) = новый `version`.
3. Добавление необязательного поля payload допускается в той же версии только при backward-compatible чтении.
4. Удаление поля payload запрещено без миграционного окна и нового `version`.
5. Переименование `eventName` запрещено; для нового имени создаётся новое событие.

## Правило idempotency key

`idempotencyKey = ${eventName}:${aggregateId}:${occurredAt.toISOString()}`

- `eventName` — имя события в past tense
- `aggregateId` — идентификатор aggregate root
- `occurredAt` — timestamp события в UTC

## Каталог событий

| Event Name | Producer | Primary Consumers | Version | Idempotency Key Template | Payload Contract |
|---|---|---|---|---|---|
| `ReviewStarted` | `Review.start()` | `runtime/review-worker`, `runtime/analytics-worker` | `v1` | `ReviewStarted:{aggregateId}:{occurredAt}` | `{ reviewId: string, status: ReviewStatus }` |
| `ReviewCompleted` | `Review.complete()` | `runtime/review-worker`, `runtime/notification-worker`, `runtime/analytics-worker` | `v1` | `ReviewCompleted:{aggregateId}:{occurredAt}` | `{ reviewId: string, status: ReviewStatus, consumedSeverity: { high: number, medium: number, low: number }, budget: { high: number, medium: number, low: number } }` |
| `RuleActivated` | `Rule.activate()` | `runtime/review-worker`, `runtime/analytics-worker` | `v1` | `RuleActivated:{aggregateId}:{occurredAt}` | `{ ruleId: string, ruleName: string }` |

## Изменение каталога

1. Любое изменение в `@codenautic/core/src/domain/events/*` должно сопровождаться обновлением этого каталога.
2. Изменение без обновления каталога считается нарушением DDD contract.
3. Для breaking changes требуется ADR с описанием migration strategy для consumers.
