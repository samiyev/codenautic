# M09 — Workers & Notifications

> Источник: `packages/runtime/TODO.md`

> **Задач:** 28 | **Проверка:** 7 процессов, Slack уведомления, метрики, cron

> **Результат milestone:** Готова оркестрация воркеров, уведомлений, аналитики и расписаний.

## Notification Worker v0.0.0 — Базовая структура пакета

> Package setup, configs, barrel export.

> **Результат версии:** Завершена версия «Notification Worker v0.0.0 — Package Foundation» в рамках M09; инкремент готовит продукт к стабильному end-to-end сценарию в своем слое.

| ID | Задача | Статус | Результат | Acceptance Criteria |
|----------|--------------------|--------|-----------|---------------------|
| NOTF-000 | Реализовать базовую структуру пакета | TODO | Не начато | Реализация: Package.json, tsconfig.json, tsconfig.build.json, IoC module, barrel export. Сборка проходит успешно. Готово, если: для NOTF-000 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |

---

## Notification Worker v0.1.0 — Notification Processor

> BullMQ consumers, маршрутизация каналов, Container DI и entrypoint. ~70K tokens.

> **Результат версии:** Завершена версия «Notification Worker v0.1.0 — Notification Processor» в рамках M09; инкремент готовит продукт к стабильному end-to-end сценарию в своем слое.

| ID | Задача | Статус | Результат | Acceptance Criteria |
|----------|--------------------|--------|-----------|---------------------|
| NOTF-001 | Реализовать notificationJobProcessor | TODO | Не начато | Реализация: `NotificationJobProcessor extends BaseJobProcessor<INotifySendData, INotifySendResult>`. Очередь: `notify.send`. Делегирует в `NotificationRouter`. 5 тестов. Готово, если: processor гарантирует at-least-once обработку notify.send, retryable ошибки ретраятся, non-retryable завершаются с корректным failure reason; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| NOTF-002 | Реализовать notificationRouter | TODO | Не начато | Реализация: Маршрутизация по channel с Map<NotificationChannel, INotificationProvider>. Fallback на WEBHOOK. 6 тестов. Готово, если: router выбирает канал детерминированно и учитывает fallback policy, ошибка одного канала не блокирует доставку в альтернативный канал при разрешённой стратегии; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| NOTF-003 | Реализовать reportDeliveryJobProcessor | TODO | Не начато | Реализация: `ReportDeliveryJobProcessor extends BaseJobProcessor<IReportDeliverData, IReportDeliverResult>`. Очередь: `report.deliver`. Делегирует в `IReportDeliveryService`. 6 тестов. Готово, если: для NOTF-003 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| NOTF-004 | Реализовать notificationWorkerContainer | TODO | Не начато | Реализация: IoC module: tokens, registerNotificationWorkerModule(). Router + 2 Processors + JobProcessorRegistry. 9 тестов. Готово, если: для NOTF-004 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| NOTF-005 | Реализовать notificationWorkerEntrypoint | TODO | Не начато | Реализация: `main.ts`, env schema (Zod), health check server. Graceful shutdown. 12 тестов. Готово, если: для NOTF-005 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |

---

## Notification Worker v0.2.0 — Channel Handlers

> Конкретные handlers для каждого канала доставки. ~80K tokens.

> **Результат версии:** Завершена версия «Notification Worker v0.2.0 — Channel Handlers» в рамках M09; инкремент готовит продукт к стабильному end-to-end сценарию в своем слое.

| ID | Задача | Статус | Результат | Acceptance Criteria |
|----------|--------------------|--------|-----------|---------------------|
| NOTF-006 | Реализовать slackHandler | TODO | Не начато | Реализация: Реализует INotificationHandler для Slack. Rate limiting (1 msg/sec) через SlidingWindowLogLimiter. Error mapping SlackApiError. 13 тестов. Готово, если: slack handler соблюдает лимиты отправки и формат сообщений, 429 обрабатывается backoff-ом, а после исчерпания попыток сообщение уходит в DLQ с контекстом; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| NOTF-007 | Реализовать discordHandler | TODO | Не начато | Реализация: Message splitting (>2000 chars). Error mapping DiscordApiError. 12 тестов. Готово, если: для NOTF-007 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| NOTF-008 | Реализовать teamsHandler | TODO | Не начато | Реализация: Error mapping TeamsApiError (429, 401, 403, connector expired). 10 тестов. Готово, если: для NOTF-008 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| NOTF-009 | Реализовать emailHandler | TODO | Не начато | Реализация: Subject enrichment по event type. Unsubscribe link из metadata. Error mapping EmailApiError (550, 535, 421). 12 тестов. Готово, если: для NOTF-009 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| NOTF-010 | Реализовать webhookHandler | TODO | Не начато | Реализация: Retry 3x с exponential backoff (1s, 2s). Retryable: 429, 500, 502, 503, 504. Error mapping WebhookApiError. 19 тестов. Готово, если: webhook handler выполняет только retryable retry (429/5xx), фиксирует attempt history и завершает job предсказуемым статусом success/failure; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |

---

## Analytics Worker v0.0.0 — Базовая структура пакета

> Package setup, configs, barrel export.

> **Результат версии:** Завершена версия «Analytics Worker v0.0.0 — Package Foundation» в рамках M09; инкремент готовит продукт к стабильному end-to-end сценарию в своем слое.

| ID | Задача | Статус | Результат | Acceptance Criteria |
|----------|--------------------|--------|-----------|---------------------|
| ANLYT-000 | Реализовать базовую структуру пакета | TODO | Не начато | Реализация: Package.json, tsconfig.json, tsconfig.build.json, IoC module, barrel export. Сборка проходит успешно. Готово, если: для ANLYT-000 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |

---

## Analytics Worker v0.1.0 — Prediction & Report Jobs

> Фоновые задачи для прогнозов и генерации отчетов. ~40K tokens.

> **Результат версии:** Завершена версия «Analytics Worker v0.1.0 — Prediction & Report Jobs» в рамках M09; инкремент готовит продукт к стабильному end-to-end сценарию в своем слое.

| ID | Задача | Статус | Результат | Acceptance Criteria |
|----------|--------------------|--------|-----------|---------------------|
| ANLYT-001 | Реализовать predictionComputeJob | TODO (P1) | Не начато | Реализация: BullMQ job: run statistical models → compute predictions → store results. Scheduled daily. Готово, если: для ANLYT-001 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| ANLYT-002 | Реализовать predictionExplainJob | TODO (P1) | Не начато | Реализация: BullMQ job: take prediction → call LLM for explanation → store. Rate-limited to LLM quota. Готово, если: для ANLYT-002 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| ANLYT-003 | Реализовать reportGenerationJob | TODO (P1) | Не начато | Реализация: BullMQ job: gather data → render template → generate PDF/PNG → upload to storage. Progress events. Готово, если: для ANLYT-003 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |

---

## Analytics Worker v0.2.0 — Job Consumers

> BullMQ consumers для трёх очередей analytics. ~80K tokens.

> **Результат версии:** Завершена версия «Analytics Worker v0.2.0 — Job Consumers» в рамках M09; инкремент готовит продукт к стабильному end-to-end сценарию в своем слое.

| ID | Задача | Статус | Результат | Acceptance Criteria |
|----------|--------------------|--------|-----------|---------------------|
| ANLYT-004 | Реализовать metricsConsumer | TODO (P0) | Не начато | Реализация: BullMQ consumer для `analytics.metrics` queue. Payload: {reviewId, metrics, timestamp}. Вызывает AnalyticsAggregationUseCase. Batch processing (10 events). Готово, если: metrics consumer валидирует payload schema и обрабатывает события батчами без потери порядка внутри reviewId, при частичной ошибке переобрабатывается только неуспешный batch; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| ANLYT-005 | Реализовать metricsProcessor | TODO (P0) | Не начато | Реализация: Обработка metrics events: store → update health trends → update CodeCity data. Вызывает CorrelateChurnComplexityUseCase. Готово, если: для ANLYT-005 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| ANLYT-006 | Реализовать feedbackConsumer | TODO (P1) | Не начато | Реализация: BullMQ consumer для `analytics.feedback` queue. Payload: {feedbackId, reviewId, issueId, rating, comment}. Вызывает CollectFeedbackUseCase. Готово, если: feedback consumer обрабатывает feedback ровно один раз по feedbackId, дубликаты не влияют на агрегаты качества и обучение моделей; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| ANLYT-007 | Реализовать feedbackProcessor | TODO (P1) | Не начато | Реализация: Обработка feedback: store → DetectFalsePositivesUseCase → LearnTeamPatternsUseCase. Обновляет rule effectiveness. Готово, если: для ANLYT-007 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| ANLYT-008 | Реализовать driftScanConsumer | TODO (P1) | Не начато | Реализация: BullMQ consumer для `analytics.drift` queue. Payload: {repositoryId, triggeredBy}. Вызывает DetectArchitectureDriftUseCase. Готово, если: drift scan consumer безопасно запускает долгие задачи, timeout переводит job в retry/DLQ и не оставляет зависших lock в очереди; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| ANLYT-009 | Реализовать driftScanProcessor | TODO (P1) | Не начато | Реализация: Обработка drift scan: store results → compare with previous → publish notify.send если regression. Готово, если: для ANLYT-009 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |

---

## Analytics Worker v0.4.0 — Container & Entrypoint

> DI wiring и запуск worker process. ~40K tokens.

> **Результат версии:** Завершена версия «Analytics Worker v0.4.0 — Container & Entrypoint» в рамках M09; инкремент готовит продукт к стабильному end-to-end сценарию в своем слое.

| ID | Задача | Статус | Результат | Acceptance Criteria |
|----------|--------------------|--------|-----------|---------------------|
| ANLYT-014 | Реализовать analyticsWorkerContainer | TODO (P0) | Не начато | Реализация: Container DI: all consumers, all processors, IContextProvider, IFeedbackRepository, IDriftScanRepository, ISprintSnapshotRepository, ILearningService, ILogger. Готово, если: для ANLYT-014 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| ANLYT-015 | Реализовать analyticsWorkerEntrypoint | TODO (P0) | Не начато | Реализация: `main.ts`: Container setup → start MetricsConsumer + FeedbackConsumer + DriftScanConsumer. Graceful shutdown. Health check endpoint. Готово, если: для ANLYT-015 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |

---

## Scheduler v0.0.0 — Базовая структура пакета

> Package setup, configs, barrel export.

> **Результат версии:** Завершена версия «Scheduler v0.0.0 — Package Foundation» в рамках M09; инкремент готовит продукт к стабильному end-to-end сценарию в своем слое.

| ID | Задача | Статус | Результат | Acceptance Criteria |
|----------|--------------------|--------|-----------|---------------------|
| SCHD-000 | Реализовать базовую структуру пакета | TODO | Не начато | Реализация: Package.json, tsconfig.json, tsconfig.build.json, IoC module, barrel export. Сборка проходит успешно. Готово, если: для SCHD-000 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |

---

## Scheduler v0.1.0 — Cron Инфраструктура

> Cron scheduler, job publisher, Container DI, entrypoint. ~60K tokens.

> **Результат версии:** Завершена версия «Scheduler v0.1.0 — Cron Infrastructure» в рамках M09; инкремент готовит продукт к стабильному end-to-end сценарию в своем слое.

| ID | Задача | Статус | Результат | Acceptance Criteria |
|----------|--------------------|--------|-----------|---------------------|
| SCHD-001 | Реализовать cronScheduler | TODO | Не начато | Реализация: Cron engine (node-cron). Register jobs by cron expression. Execute with timeout (30s per job). Prevent overlapping executions (lock). Timezone support (UTC default). Готово, если: cron scheduler предотвращает overlapping запуск одного job key, соблюдает timezone/cron выражения и логирует start/end/timeout каждого прогона; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| SCHD-002 | Реализовать задачаPublisher | TODO | Не начато | Реализация: Publish messages в BullMQ queues: `report.deliver`, `analytics.drift`, `scan.repo`. Typed payloads. Error handling: queue unavailable → log + retry. Готово, если: publisher публикует типизированные payload в нужные очереди, при недоступной очереди применяет retry с backoff и не теряет событие при кратковременных сбоях; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| SCHD-003 | Реализовать schedulerContainer | TODO | Не начато | Реализация: Container DI: CronScheduler, ЗадачаPublisher, IOutboxRepository, ILogger. Register all built-in jobs. Готово, если: для SCHD-003 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| SCHD-004 | Реализовать schedulerEntrypoint | TODO | Не начато | Реализация: `main.ts`: Container setup → CronScheduler.start(). Graceful shutdown (wait for running jobs). Health check endpoint. Готово, если: для SCHD-004 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |

---
