# M12 — AST, Scan, Onboarding

> Источник: `packages/runtime/TODO.md`

> **Задач (runtime):** 15 | **Проверка:** Scan worker + scanning API

> **Результат milestone:** Готов runtime-контур onboarding и scan процессов.

## Scan Worker v0.0.0 — Базовая структура пакета

> Package setup, configs, barrel export.

> **Результат версии:** Завершена версия «Scan Worker v0.0.0 — Package Foundation» в рамках M12; инкремент готовит продукт к стабильному end-to-end сценарию в своем слое.

| ID | Задача | Статус | Результат | Acceptance Criteria |
|----------|--------------------|--------|-----------|---------------------|
| SCAN-000 | Реализовать базовую структуру пакета | TODO | Не начато | Реализация: Package.json, tsconfig.json, tsconfig.build.json, IoC module, barrel export. Сборка проходит успешно. Готово, если: для SCAN-000 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |

---

## Scan Worker v0.1.0 — Repository Scanning Jobs

> Background jobs for repository scanning. ~50K tokens.

> **Результат версии:** Завершена версия «Scan Worker v0.1.0 — Repository Scanning Jobs» в рамках M12; инкремент готовит продукт к стабильному end-to-end сценарию в своем слое.

| ID | Задача | Статус | Результат | Acceptance Criteria |
|----------|--------------------|--------|-----------|---------------------|
| SCAN-001 | Реализовать repositoryScanJob | TODO (P1) | Не начато | Реализация: BullMQ job: clone repo → run full scan → build graph → compute metrics. Retry on failure. Готово, если: full scan job детерминированно проходит clone->parse->graph->metrics pipeline, сетевые/IO ошибки классифицируются как retryable/non-retryable, итоговый статус всегда финализируется; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| SCAN-002 | Реализовать incrementalScanJob | TODO (P1) | Не начато | Реализация: BullMQ job: diff since last scan → parse changed files → update graph. Faster than full scan. Готово, если: incremental scan корректно ограничивает обработку только изменёнными файлами и подтверждает ускорение относительно full scan на контрольном сценарии; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| SCAN-003 | Реализовать scanProgressTracker | TODO (P1) | Не начато | Реализация: Track scan progress in Redis. Emit events via IEventBus. Support SSE streaming to API. Готово, если: progress tracker публикует монотонный прогресс и terminal state в SSE без пропусков, при рестарте worker состояние восстанавливается из durable storage; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| SCAN-004 | Реализовать scheduledRescanProcessor | TODO (P2) | Не начато | Реализация: Process cron-scheduled rescans. Read schedule from DB. Create ScanJob. Handle timezone. Готово, если: для SCAN-004 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |

---

## Scan Worker v0.2.0 — Job Consumers & DI

> BullMQ consumers, Container DI wiring, entrypoint. ~70K tokens.

> **Результат версии:** Завершена версия «Scan Worker v0.2.0 — Job Consumers & DI» в рамках M12; инкремент готовит продукт к стабильному end-to-end сценарию в своем слое.

| ID | Задача | Статус | Результат | Acceptance Criteria |
|----------|--------------------|--------|-----------|---------------------|
| SCAN-005 | Реализовать repositoryScanConsumer | TODO | Не начато | Реализация: BullMQ consumer для `scan.repo` queue. Payload: {repositoryId, ref, triggeredBy}. Вызывает ScanRepositoryUseCase → BuildFullGraphUseCase → IndexRepositoryUseCase. Готово, если: consumer валидирует payload schema и обрабатывает scan.repo с idempotency по repositoryId+ref, повторные задания не создают конфликтующих параллельных сканов; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| SCAN-006 | Реализовать incrementalScanConsumer | TODO | Не начато | Реализация: BullMQ consumer для `scan.update` queue. Payload: IIncrementalScanData. Делегирует в ReindexRepositoryUseCase. 11 тестов, 100% coverage. DI + JobProcessorRegistry wiring. Готово, если: для SCAN-006 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| SCAN-007 | Реализовать scanWorkerContainer | TODO | Не начато | Реализация: Container DI: IGitProvider, IRepositoryScanner, IGraphRepository, IVectorRepository, IEmbeddingGenerationService, IScanProgressRepository, ILogger. Готово, если: для SCAN-007 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| SCAN-008 | Реализовать scanWorkerEntrypoint | TODO | Не начато | Реализация: `main.ts`: Container setup → start both consumers. Graceful shutdown. Health check endpoint. Temp directory cleanup on shutdown. Готово, если: для SCAN-008 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |

---

## API v0.17.0 — Repository Scanning API

> HTTP endpoints для сканирования репозиториев без CCR. ~60K tokens.

> **Результат версии:** Завершена версия «API v0.17.0 — Repository Scanning API» в рамках M12; инкремент готовит продукт к стабильному end-to-end сценарию в своем слое.

| ID | Задача | Статус | Результат | Acceptance Criteria |
|----------|--------------------|--------|-----------|---------------------|
| API-SCAN-001 | Реализовать scanController | TODO (P1) | Не начато | Реализация: POST /api/repos/:repoId/scan. Triggers full repository scan. Возвращает job ID. Auth + Ограничение частоты запросов. Готово, если: для API-SCAN-001 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| API-SCAN-002 | Реализовать scanStatusEndpoint | TODO (P1) | Не начато | Реализация: GET /api/repos/:repoId/scan/:jobId. Возвращает scan progress (%). SSE for real-time updates. Готово, если: для API-SCAN-002 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| API-SCAN-003 | Реализовать repositoryOnboardEndpoint | TODO (P1) | Не начато | Реализация: POST /api/repos/onboard. Clone URL + credentials → trigger scan pipeline. Validates URL format. Готово, если: для API-SCAN-003 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| API-SCAN-004 | Реализовать repositoryMetricsEndpoint | TODO (P1) | Не начато | Реализация: GET /api/repos/:repoId/metrics. Возвращает aggregated repository metrics from last scan. Cache with TTL. Готово, если: для API-SCAN-004 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| API-SCAN-005 | Реализовать rescanScheduleEndpoint | TODO (P2) | Не начато | Реализация: PUT /api/repos/:repoId/scan/schedule. Set cron schedule for periodic rescans. CRUD for schedules. Готово, если: для API-SCAN-005 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| API-SCAN-006 | Реализовать scanWebhookTriggerEndpoint | TODO (P2) | Не начато | Реализация: POST /api/repos/:repoId/scan/trigger. Webhook-compatible trigger (push events). HMAC verification. Готово, если: для API-SCAN-006 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |

---
