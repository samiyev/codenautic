# M11 — Agent Worker & Chat

> Источник: `packages/runtime/TODO.md`

> **Задач (runtime):** 25 | **Проверка:** @mention → AI ответ, inbox/outbox pattern

> **Результат milestone:** Готов runtime-контур agent/chat/mentions сценариев.

## Webhooks v0.5.0 — Inbox Pattern Интеграция

> Message deduplication for webhooks. ~60K tokens.

> **Результат версии:** Завершена версия «Webhooks v0.5.0 — Inbox Pattern Integration» в рамках M11; инкремент готовит продукт к стабильному end-to-end сценарию в своем слое.

| ID | Задача | Статус | Результат | Acceptance Criteria |
|----------|--------------------|--------|-----------|---------------------|
| WH-INBOX-001 | Реализовать inboxMessageWriter | TODO | Не начато | Реализация: Write incoming webhooks to inbox. Atomic write + dedup check. MongoDB-backed. Готово, если: inbox write выполняется атомарно с дедупликацией по event key, повторный webhook не создаёт вторую запись и не ломает трассировку статуса; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| WH-INBOX-002 | Реализовать inboxDeduplicationCheck | TODO | Не начато | Реализация: Stateless duplicate detection by processed state. Replaces CacheIdempotencyChecker. Готово, если: dedup check стабилен при конкурентных запросах и исключает race-condition двойной обработки одного и того же webhook event; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| WH-INBOX-003 | Реализовать inboxMessageAcknowledge | TODO | Не начато | Реализация: Mark inbox message as processed after enqueue. Exactly-once guarantee. Готово, если: acknowledge помечает message processed только после успешного enqueue, при ошибке enqueue запись остаётся reprocessable без потери данных; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |

---

## Webhooks v0.6.0 — Outbox Интеграция

> Queue webhooks for processing. ~60K tokens.

> **Результат версии:** Завершена версия «Webhooks v0.6.0 — Outbox Integration» в рамках M11; инкремент готовит продукт к стабильному end-to-end сценарию в своем слое.

| ID | Задача | Статус | Результат | Acceptance Criteria |
|----------|--------------------|--------|-----------|---------------------|
| WH-OUTBOX-001 | Реализовать webhookJobEnqueuer | TODO | Не начато | Реализация: Enqueue webhook jobs via outbox. Готово, если: job enqueuer публикует события через outbox с гарантией доставки, transient broker errors уходят в retry без потери бизнес-события; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| WH-OUTBOX-002 | Реализовать outboxTransactionWrapper | TODO | Не начато | Реализация: Wrap webhook + outbox in transaction. Готово, если: transaction wrapper обеспечивает atomicity webhook state + outbox write, rollback корректно откатывает обе части при любой внутренней ошибке; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| WH-OUTBOX-003 | Реализовать webhookRetryHandler | TODO | Не начато | Реализация: Handle failed webhook retries. Готово, если: retry handler использует bounded backoff и DLQ policy, после предела попыток выставляет terminal failure с полной диагностикой причин; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |

---

## Webhooks v0.7.0 — Interactive Mentions

> @codenautic command handling in PR comments. ~100K tokens.

> **Результат версии:** Завершена версия «Webhooks v0.7.0 — Interactive Mentions» в рамках M11; инкремент готовит продукт к стабильному end-to-end сценарию в своем слое.

| ID | Задача | Статус | Результат | Acceptance Criteria |
|----------|--------------------|--------|-----------|---------------------|
| WH-MENTION-001 | Реализовать mentionDetector | TODO | Не начато | Реализация: Detect mentions via regex `@codenautic` (опционально с `review`) и проверкой на конец команды. Non-review mentions too. Готово, если: для WH-MENTION-001 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| WH-MENTION-002 | Реализовать commandParser | TODO | Не начато | Реализация: Парсинг: review, explain, fix, summary, help, config, chat. Извлечение аргументов. Готово, если: для WH-MENTION-002 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| WH-MENTION-003 | Реализовать commandRouter | TODO | Не начато | Реализация: Маршрутизация по типу команды. Priority: HIGH for mentions. Готово, если: для WH-MENTION-003 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| WH-MENTION-004 | Реализовать mentionResponseHandler | TODO | Не начато | Реализация: Post "Processing." immediately. Final response as reply. Готово, если: для WH-MENTION-004 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| WH-MENTION-005 | Реализовать mcpMentionHandler | TODO | Не начато | Реализация: Parse @mcp<tool>. Invoke MCP tool. Include result in context. Готово, если: для WH-MENTION-005 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| WH-MENTION-006 | Реализовать mentionRateLimiter | TODO | Не начато | Реализация: 2 review triggers per hour per user. Cooldown message. Готово, если: для WH-MENTION-006 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |

---

## Agent Worker v0.0.0 — Базовая структура пакета

> Package setup, configs, barrel export.

> **Результат версии:** Завершена версия «Agent Worker v0.0.0 — Package Foundation» в рамках M11; инкремент готовит продукт к стабильному end-to-end сценарию в своем слое.

| ID | Задача | Статус | Результат | Acceptance Criteria |
|----------|--------------------|--------|-----------|---------------------|
| AGNT-000 | Реализовать базовую структуру пакета | TODO | Не начато | Реализация: Package.json, tsconfig.json, tsconfig.build.json, IoC module, barrel export. Сборка проходит успешно. Готово, если: для AGNT-000 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |

---

## Agent Worker v0.1.0 — Чат Инфраструктура

> BullMQ consumer, thread persistence, Container DI wiring. ~80K tokens.

> **Результат версии:** Завершена версия «Agent Worker v0.1.0 — Chat Infrastructure» в рамках M11; инкремент готовит продукт к стабильному end-to-end сценарию в своем слое.

| ID | Задача | Статус | Результат | Acceptance Criteria |
|----------|--------------------|--------|-----------|---------------------|
| AGNT-001 | Реализовать чатЗадачаConsumer | TODO | Не начато | Реализация: BullMQ consumer для `agent.conversation` queue. Десериализация payload: threadId, message, userId, repositoryId. Retry 3x, DLQ on failure. Готово, если: для AGNT-001 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| AGNT-002 | Реализовать chatJobProcessor | TODO | Не начато | Реализация: Вызывает `ChatUseCase` из core. Маппинг job payload → `IChatInput`. Результат → response event. Error handling: DomainError → structured error response. Готово, если: для AGNT-002 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| AGNT-003 | Реализовать mongoConversationThreadAdapter | TODO | Не начато | Реализация: Реализует `IConversationThreadRepository`. Mongoose schema: threads collection. CRUD + findByChannelId + findActiveByParticipant. Индексы. Готово, если: для AGNT-003 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| AGNT-004 | Реализовать agentWorkerContainer | TODO | Не начато | Реализация: Container DI wiring. Tokens: ChatUseCase, IConversationThreadRepository, ILLMProvider, IVectorRepository, ILogger. Регистрация всех зависимостей. Готово, если: для AGNT-004 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| AGNT-005 | Реализовать agentWorkerEntrypoint | TODO | Не начато | Реализация: `main.ts`: Container setup → ЧатЗадачаConsumer.start(). Graceful shutdown. Health check endpoint. Готово, если: для AGNT-005 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |

---

## Agent Worker v0.2.0 — CCR Summary Agent

> Автоматическая генерация CCR summary по запросу. ~60K tokens.

> **Результат версии:** Завершена версия «Agent Worker v0.2.0 — CCR Summary Agent» в рамках M11; инкремент готовит продукт к стабильному end-to-end сценарию в своем слое.

| ID | Задача | Статус | Результат | Acceptance Criteria |
|----------|--------------------|--------|-----------|---------------------|
| AGNT-006 | Реализовать CCRSummaryJobConsumer | TODO | Не начато | Реализация: BullMQ consumer для `agent.summary` queue. Payload: codeChangeRequestId, repositoryId, requestedBy. Готово, если: для AGNT-006 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| AGNT-007 | Реализовать CCRSummaryProcessor | TODO | Не начато | Реализация: Fetch diff через `IGitProvider` → собрать context (файлы, blame, history) → `ILLMProvider.chat()` с summary prompt → результат. Готово, если: для AGNT-007 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| AGNT-008 | Реализовать CCRSummaryWriter | TODO | Не начато | Реализация: Пост summary как comment в CCR через `IGitProvider.createComment()`. Update initial comment если уже есть. Готово, если: для AGNT-008 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| AGNT-009 | Реализовать CCRSummaryPromptBuilder | TODO | Не начато | Реализация: Построение prompt для summary: diff + file context + CCR description + recent commits. Max token budget. Truncation strategy для больших CCR. Готово, если: для AGNT-009 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |

---
