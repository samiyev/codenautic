# M18 — KAG

> Источник: `packages/runtime/TODO.md`

> **Задач (runtime):** 12 | **Проверка:** KAG-powered review, conversation, analytics

> **Результат milestone:** Готов KAG runtime: knowledge-augmented review, chat и analytics workflows.

## Review Worker v0.6.0 — KAG: KAG-Augmented Review Prompts

> Интеграция Knowledge Graph в review pipeline prompts. Prerequisite: Фаза 1 (Launch) завершена, KAG Hybrid Retrieval готов.

> **Результат версии:** Завершена версия «Review Worker v0.6.0 — KAG: KAG-Augmented Review Prompts» в рамках M18; инкремент готовит продукт к стабильному end-to-end сценарию в своем слое.

| ID | Задача | Статус | Результат | Acceptance Criteria |
|----------|--------------------|--------|-----------|---------------------|
| REVW-016 | Реализовать kAG-Augmented Review Prompts | TODO | Не начато | Реализация: Интеграция Hybrid Retrieval в review-worker prompts. Knowledge subgraph + similar code + reasoning chain. Готово, если: review prompts обогащаются knowledge subgraph и retrieval-фактами без превышения token budget, fallback на обычный prompt срабатывает при недоступности KAG; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |

---

## Scan Worker v0.4.0 — KAG: Documentation Generation

> KG-powered генерация документации. Prerequisite: Фаза 1 (Launch) завершена, KAG Hybrid Retrieval готов.

> **Результат версии:** Завершена версия «Scan Worker v0.4.0 — KAG: Documentation Generation» в рамках M18; инкремент готовит продукт к стабильному end-to-end сценарию в своем слое.

| ID | Задача | Статус | Результат | Acceptance Criteria |
|----------|--------------------|--------|-----------|---------------------|
| SCAN-013 | Реализовать docGenerationJobConsumer | TODO | Не начато | Реализация: Задача consumer для doc generation. **UseCase и порт перенесены в core (CORE-389–391).** Здесь: consumer + job processing. Готово, если: для SCAN-013 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| SCAN-014 | Реализовать doc Template Engine | TODO | Не начато | Реализация: Шаблоны: README модуля, ADR, API docs, Onboarding Guide, Changelog, Модуль Map, Conventions Doc. 7 типов. Готово, если: для SCAN-014 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| SCAN-015 | Реализовать doc Diff & PR Creator | TODO | Не начато | Реализация: Diff с текущей документацией → создание PR с обновлениями. Через IGitProvider. Scheduled или manual trigger. Готово, если: для SCAN-015 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |

---

## Agent Worker v0.5.0 — KAG: KAG-Powered Conversation

> Чат с Knowledge Graph: hybrid retrieval, knowledge subgraph injection, reasoning chains. Prerequisite: Фаза 1 (Launch) завершена, KAG Hybrid Retrieval готов.

> **Результат версии:** Завершена версия «Agent Worker v0.5.0 — KAG: KAG-Powered Conversation» в рамках M18; инкремент готовит продукт к стабильному end-to-end сценарию в своем слое.

| ID | Задача | Статус | Результат | Acceptance Criteria |
|----------|--------------------|--------|-----------|---------------------|
| AGNT-022 | Реализовать buildKAGContext() | TODO | Не начато | Реализация: Замена buildRAGContext() в ChatUseCase. Hybrid Retrieval вместо голого vector search. Fix _repositoryId. Готово, если: buildKAGContext формирует контекст из hybrid retrieval с валидным repositoryId и деградирует в безопасный режим (без KAG) при ошибке источников; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| AGNT-023 | Реализовать knowledge Subgraph Injector | TODO | Не начато | Реализация: System prompt обогащается knowledge subgraph: паттерны, конвенции, решения для scope запроса. Готово, если: для AGNT-023 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| AGNT-024 | Реализовать reasoning Chain in Responses | TODO | Не начато | Реализация: Ответы содержат reasoning chain: не только "вот код", но "вот почему код устроен так". Structured explanation. Готово, если: для AGNT-024 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| AGNT-025 | Реализовать kAG-Augmented Agent Prompts | TODO | Не начато | Реализация: Интеграция Hybrid Retrieval в agent-worker prompts. Context = knowledge facts + vector chunks + graph expansion. Готово, если: для AGNT-025 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |

---

## Analytics Worker v0.5.0 — KAG: Temporal Knowledge

> Эволюция кода во времени → Knowledge Graph. Prerequisite: Фаза 1 (Launch) завершена.

> **Результат версии:** Завершена версия «Analytics Worker v0.5.0 — KAG: Temporal Knowledge» в рамках M18; инкремент готовит продукт к стабильному end-to-end сценарию в своем слое.

| ID | Задача | Статус | Результат | Acceptance Criteria |
|----------|--------------------|--------|-----------|---------------------|
| ANLYT-016 | Реализовать evolution Timeline Builder | TODO | Не начато | Реализация: Git log → evolution узлы + EVOLVED_FROM рёбра. Per-file/module history. Trend calculation. Готово, если: для ANLYT-016 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| ANLYT-017 | Реализовать drift → Knowledge Integrator | TODO | Не начато | Реализация: Drift Detection results → обновление evolution узлов в Knowledge Graph. Bridge analytics → KAG. Готово, если: для ANLYT-017 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |

---

## Analytics Worker v0.6.0 — KAG: Feedback → Knowledge Loop

> Фидбек обновляет Knowledge Graph: rule confidence, convention learning.

> **Результат версии:** Завершена версия «Analytics Worker v0.6.0 — KAG: Feedback → Knowledge Loop» в рамках M18; инкремент готовит продукт к стабильному end-to-end сценарию в своем слое.

| ID | Задача | Статус | Результат | Acceptance Criteria |
|----------|--------------------|--------|-----------|---------------------|
| ANLYT-018 | Реализовать feedback → KG Update Pipeline | TODO | Не начато | Реализация: False positive feedback → обновить confidence правила → создать/обновить issue_pattern node → update Qdrant. Готово, если: feedback loop обновляет confidence и issue_pattern консистентно в KG и векторном индексе, повторная обработка одного feedback-события идемпотентна; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |
| ANLYT-019 | Реализовать convention Learning | TODO | Не начато | Реализация: Accumulated feedback → новые convention nodes. "Не репортить X в контексте Y". Auto-discovery конвенций. Готово, если: для ANLYT-019 процесс проходит e2e/integration happy-path и failure-path, DI wiring и queue contracts подтверждены тестами, а retry/timeout/DLQ переходы завершаются наблюдаемым terminal статусом и логируются; DoD: `cd packages/runtime && bun run lint && bun run typecheck && bun test`. |

---

## Version Summary

| Процесс | Version | Group | Tasks |
|---------|---------|-------|-------|
| API | v0.1.0 | Foundation | 4 |
| API | v0.2.0 | Database Infrastructure & Admin Module | 10 |
| Webhooks | v0.0.0 | Package Foundation | 1 |
| Webhooks | v0.1.0 | Core Components | 3 |
| Webhooks | v0.2.0 | Security | 5 |
| Webhooks | v0.3.0 | Infrastructure | 3 |
| Webhooks | v0.4.0 | Platform Handlers | 4 |
| Review Worker | v0.0.0 | Package Foundation | 1 |
| Review Worker | v0.1.0 | Code Review Processor | 1 |
| Review Worker | v0.2.0 | Task Processing | 4 |
| Review Worker | v0.3.0 | BullMQ Consumer & DI | 4 |
| Review Worker | v0.4.0 | Result Publishing | 3 |
| Review Worker | v0.4.0.1 | End-to-End Pipeline Wiring | 3 |
| Notification Worker | v0.0.0 | Package Foundation | 1 |
| Notification Worker | v0.1.0 | Notification Processor | 5 |
| Notification Worker | v0.2.0 | Channel Handlers | 5 |
| Analytics Worker | v0.0.0 | Package Foundation | 1 |
| Analytics Worker | v0.1.0 | Prediction & Report Jobs | 3 |
| Analytics Worker | v0.2.0 | Job Consumers | 6 |
| Analytics Worker | v0.4.0 | Container & Entrypoint | 2 |
| Scheduler | v0.0.0 | Package Foundation | 1 |
| Scheduler | v0.1.0 | Cron Infrastructure | 4 |
| API | v0.3.0 | Middleware | 3 |
| API | v0.4.0 | Security | 4 |
| API | v0.5.0 | Observability | 4 |
| API | v0.6.0 | Core Controllers Part 1 | 4 |
| Webhooks | v0.5.0 | Inbox Pattern Integration | 3 |
| Webhooks | v0.6.0 | Outbox Integration | 3 |
| Webhooks | v0.7.0 | Interactive Mentions | 6 |
| Agent Worker | v0.0.0 | Package Foundation | 1 |
| Agent Worker | v0.1.0 | Chat Infrastructure | 5 |
| Agent Worker | v0.2.0 | CCR Summary Agent | 4 |
| Scan Worker | v0.0.0 | Package Foundation | 1 |
| Scan Worker | v0.1.0 | Repository Scanning Jobs | 4 |
| Scan Worker | v0.2.0 | Job Consumers & DI | 4 |
| API | v0.17.0 | Repository Scanning API | 6 |
| API | v0.16.0 | CodeCity API | 6 |
| API | v0.7.0 | Core Controllers Part 2 | 5 |
| API | v0.8.0 | Advanced Queue Features | 4 |
| API | v0.9.0 | MCP Server Module | 5 |
| API | v0.10.0 | External Context Module | 4 |
| API | v0.11.0 | Repository Config Module | 4 |
| API | v0.12.0 | Review Modes & Additional Controllers | 6 |
| API | v0.13.0 | Task Management | 5 |
| API | v0.14.0 | Additional Observability | 4 |
| API | v0.15.0 | Conversation & Issues API | 2 |
| API | v0.18.0 | Causal Analysis API | 6 |
| API | v0.19.0 | Onboarding & Tour API | 3 |
| API | v0.20.0 | Refactoring Planning API | 3 |
| API | v0.21.0 | Knowledge Map & Bus Factor API | 4 |
| API | v0.21.1 | Review Comment History API | 2 |
| API | v0.22.0 | Impact Planning & Prediction API | 5 |
| API | v0.24.0 | Sprint Gamification API | 4 |
| API | v0.25.0 | Architecture Drift API | 5 |
| API | v0.26.0 | Executive Reports API | 6 |
| API | v0.27.0 | Review Context API | 3 |
| API | v0.28.0 | Feedback & Queue Publishing API | 3 |
| API | v0.29.0 | OPS: Deployment & Infrastructure | 8 |
| API | v0.30.0 | OPS: Testing & Security | 2 |
| Webhooks | v0.8.0 | Push-triggered Reindex | 4 |
| Webhooks | v0.9.0 | OPS: E2E Integration Test | 1 |
| Review Worker | v0.4.1 | Comment Batching & Re-Review Wiring | 3 |
| Review Worker | v0.5.0 | SafeGuard & Expert Panel | 3 |
| Scan Worker | v0.3.0 | Embedding & Vector Indexing | 4 |
| Scan Worker | v0.5.0 | OPS: E2E Integration Test | 1 |
| Agent Worker | v0.3.0 | Streaming & Model Selection | 5 |
| Agent Worker | v0.4.0 | Mention Command Handlers | 7 |
| Notification Worker | v0.3.0 | Templates & Audit | 3 |
| Analytics Worker | v0.3.0 | Use Case Orchestration | 4 |
| Scheduler | v0.2.0 | Built-in Jobs | 5 |
| Scheduler | v0.3.0 | Config & Monitoring | 2 |
| MCP | v0.0.0 | Package Foundation | 1 |
| MCP | v0.1.0 | MCP Server | 3 |
| Review Worker | v0.6.0 | KAG: KAG-Augmented Review Prompts | 1 |
| Scan Worker | v0.4.0 | KAG: Documentation Generation | 3 |
| Agent Worker | v0.5.0 | KAG: KAG-Powered Conversation | 4 |
| Analytics Worker | v0.5.0 | KAG: Temporal Knowledge | 2 |
| Analytics Worker | v0.6.0 | KAG: Feedback → Knowledge Loop | 2 |
| **Итого** | **78 версий** | | **283** |
