# M18 — KAG

> Источник: `packages/adapters/TODO.md`

> **Задач (adapters):** 11 | **Проверка:** Knowledge Graph, extraction pipeline, reasoning

> **Результат milestone:** Готов KAG adapter-контур: extraction, graph writing, reasoning, hybrid retrieval.

## AST v0.19.0 — KAG: Knowledge Graph Writer

> Единый writer для семантических узлов/рёбер Knowledge Graph. Prerequisite: Фаза 1 (Launch) завершена, core KAG-типы

> **Результат версии:** Завершена версия «AST v0.19.0 — KAG: Knowledge Graph Writer» в рамках M18; инкремент готовит продукт к стабильному end-to-end сценарию в своем слое.
> готовы.

| ID | Задача | Статус | Результат | Acceptance Criteria |
|----------|--------------------|--------|-----------|---------------------|
| AST-KAG-001 | Реализовать knowledge Graph Writer | TODO | Не начато | Реализация: Единый writer для семантических узлов/рёбер. Upsert logic. Batch operations. Реализует порт из core. Готово, если: knowledge graph writer выполняет идемпотентные батч-upsert операций nodes/edges и сохраняет причинность связей при частичных сбоях; DoD: `cd packages/adapters && bun run lint && bun run typecheck && bun test`. |

---

## AST v0.20.0 — KAG: Knowledge Extraction Pipeline

> Code + History + Context → Knowledge. Extractors для паттернов, конвенций, решений, концептов.

> **Результат версии:** Завершена версия «AST v0.20.0 — KAG: Knowledge Extraction Pipeline» в рамках M18; инкремент готовит продукт к стабильному end-to-end сценарию в своем слое.

| ID | Задача | Статус | Результат | Acceptance Criteria |
|----------|--------------------|--------|-----------|---------------------|
| AST-KAG-002 | Реализовать pattern Extractor | TODO | Не начато | Реализация: LLM + AST analysis → паттерны (Strategy, Фабрика, Репозиторий, Observer). Конкретные instances в коде. Готово, если: pattern extractor выдаёт воспроизводимые паттерны с confidence score и не добавляет дубликаты при повторной обработке одного репозитория; DoD: `cd packages/adapters && bun run lint && bun run typecheck && bun test`. |
| AST-KAG-003 | Реализовать convention Miner | TODO | Не начато | Реализация: Анализ повторяющихся паттернов → конвенции команды. LLM-based. "Все entities через фабрики", "Result<T,E>". Готово, если: convention miner формирует конвенции только при достижении порога подтверждений и поддерживает обновление confidence на новом feedback; DoD: `cd packages/adapters && bun run lint && bun run typecheck && bun test`. |
| AST-KAG-004 | Реализовать decision Extractor | TODO | Не начато | Реализация: PR descriptions + commit messages + review comments → architectural decisions (ADR nodes). LLM-based. Готово, если: для AST-KAG-004 adapter сохраняет стабильный external -> domain контракт, корректно обрабатывает retry/backoff/error/idempotency сценарии, а интеграционные контрактные тесты фиксируют поведение на happy/failure-path; DoD: `cd packages/adapters && bun run lint && bun run typecheck && bun test`. |
| AST-KAG-005 | Реализовать concept Linker | TODO | Не начато | Реализация: Domain entities + JSDoc + naming → бизнес-концепты. Связь с Jira/Linear тикетами через context-providers. Готово, если: для AST-KAG-005 adapter сохраняет стабильный external -> domain контракт, корректно обрабатывает retry/backoff/error/idempotency сценарии, а интеграционные контрактные тесты фиксируют поведение на happy/failure-path; DoD: `cd packages/adapters && bun run lint && bun run typecheck && bun test`. |

---

## AST v0.21.0 — KAG: Pattern & Convention Miner

> LLM-based распознавание паттернов и конвенций.

> **Результат версии:** Завершена версия «AST v0.21.0 — KAG: Pattern & Convention Miner» в рамках M18; инкремент готовит продукт к стабильному end-to-end сценарию в своем слое.

| ID | Задача | Статус | Результат | Acceptance Criteria |
|----------|--------------------|--------|-----------|---------------------|
| AST-KAG-006 | Реализовать anti-pattern Detector | TODO | Не начато | Реализация: Обнаружение нарушений конвенций. Создание VIOLATES рёбер. Сравнение с established conventions. Готово, если: anti-pattern detector создаёт VIOLATES связи только для верифицируемых нарушений, снижая false-positive на контрольном датасете; DoD: `cd packages/adapters && bun run lint && bun run typecheck && bun test`. |
| AST-KAG-007 | Реализовать pattern Instance Mapper | TODO | Не начато | Реализация: Маппинг конкретных классов/файлов → узлы pattern. USES_PATTERN рёбра. Batch analysis для всего репо. Готово, если: для AST-KAG-007 adapter сохраняет стабильный external -> domain контракт, корректно обрабатывает retry/backoff/error/idempotency сценарии, а интеграционные контрактные тесты фиксируют поведение на happy/failure-path; DoD: `cd packages/adapters && bun run lint && bun run typecheck && bun test`. |

---

## AST v0.22.0 — KAG: Graph Reasoning Engine

> Логический вывод по Knowledge Graph: multi-hop inference и explanation chains.

> **Результат версии:** Завершена версия «AST v0.22.0 — KAG: Graph Reasoning Engine» в рамках M18; инкремент готовит продукт к стабильному end-to-end сценарию в своем слое.

| ID | Задача | Статус | Результат | Acceptance Criteria |
|----------|--------------------|--------|-----------|---------------------|
| AST-KAG-008 | Реализовать multi-hop Inference | TODO | Не начато | Реализация: Traversal по семантическим рёбрам: A → USES_PATTERN → B → VIOLATES → C. Глубина до 5 хопов. Цепочки объяснений. Готово, если: для AST-KAG-008 adapter сохраняет стабильный external -> domain контракт, корректно обрабатывает retry/backoff/error/idempotency сценарии, а интеграционные контрактные тесты фиксируют поведение на happy/failure-path; DoD: `cd packages/adapters && bun run lint && bun run typecheck && bun test`. |
| AST-KAG-009 | Реализовать explanation Chain Builder | TODO | Не начато | Реализация: Построение reasoning chain: "X сломается потому что Y зависит от Z, а Z нарушает конвенцию W". LLM + граф. Готово, если: для AST-KAG-009 adapter сохраняет стабильный external -> domain контракт, корректно обрабатывает retry/backoff/error/idempotency сценарии, а интеграционные контрактные тесты фиксируют поведение на happy/failure-path; DoD: `cd packages/adapters && bun run lint && bun run typecheck && bun test`. |

---

## AST v0.23.0 — KAG: Hybrid Retrieval

> Объединение Vector Search и Graph Expansion. Re-ranking результатов.

> **Результат версии:** Завершена версия «AST v0.23.0 — KAG: Hybrid Retrieval» в рамках M18; инкремент готовит продукт к стабильному end-to-end сценарию в своем слое.

| ID | Задача | Статус | Результат | Acceptance Criteria |
|----------|--------------------|--------|-----------|---------------------|
| AST-KAG-010 | Реализовать graph Expansion Strategy | TODO | Не начато | Реализация: Из vector results → expand через граф: IMPORTS, USES_PATTERN, RELATES_TO, OWNED_BY. Configurable depth. Готово, если: для AST-KAG-010 adapter сохраняет стабильный external -> domain контракт, корректно обрабатывает retry/backoff/error/idempotency сценарии, а интеграционные контрактные тесты фиксируют поведение на happy/failure-path; DoD: `cd packages/adapters && bun run lint && bun run typecheck && bun test`. |
| AST-KAG-011 | Реализовать LLM Re-ranking | TODO | Не начато | Реализация: Re-rank expanded results по relevance к query. LLM-based scoring. Top-K selection. Готово, если: для AST-KAG-011 adapter сохраняет стабильный external -> domain контракт, корректно обрабатывает retry/backoff/error/idempotency сценарии, а интеграционные контрактные тесты фиксируют поведение на happy/failure-path; DoD: `cd packages/adapters && bun run lint && bun run typecheck && bun test`. |

---

## Version Summary

| Домен | Version | Group | Tasks |
|-------|---------|-------|-------|
| Git | v0.0.0 | Package Foundation | 1 |
| LLM | v0.0.0 | Package Foundation | 1 |
| Context | v0.0.0 | Package Foundation | 1 |
| Notifications | v0.0.0 | Package Foundation | 1 |
| AST | v0.0.0 | Package Foundation | 1 |
| Messaging | v0.0.0 | Package Foundation | 1 |
| Worker | v0.0.0 | Package Foundation | 1 |
| Database | v0.1.0 | Package Foundation & Core Adapters | 6 |
| Messaging | v0.1.0 | Outbox Pattern | 2 |
| Messaging | v0.2.0 | Inbox Pattern | 2 |
| Worker | v0.1.0 | Core Components | 4 |
| Worker | v0.2.0 | Infrastructure | 4 |
| Git | v0.1.0 | Git Provider Foundation | 2 |
| LLM | v0.1.0 | LLM Provider Foundation | 2 |
| Notifications | v0.1.0 | Slack Provider | 2 |
| Context | v0.1.0 | Core Context Providers | 3 |
| AST | v0.1.0 | Parser Foundation | 3 |
| AST | v0.2.0 | TypeScript & JavaScript Parsers | 2 |
| AST | v0.3.0 | Graph Building | 4 |
| Git | v0.5.0 | Repository Scanning Support | 10 |
| AST | v0.4.0 | Storage & Query | 4 |
| Git | v0.2.0 | GitLab Provider | 1 |
| Git | v0.3.0 | Azure DevOps + Bitbucket | 2 |
| Git | v0.4.0 | Shared Infrastructure | 3 |
| LLM | v0.2.0 | Anthropic + Google | 2 |
| LLM | v0.3.0 | Shared Infrastructure | 3 |
| LLM | v0.4.0 | Groq + OpenRouter | 2 |
| Notifications | v0.2.0 | Webhook Handler | 1 |
| Notifications | v0.3.0 | Discord + Teams | 2 |
| Context | v0.2.0 | Project Management Providers | 2 |
| AST | v0.5.0 | Advanced Graph Features | 2 |
| AST | v0.6.0 | Python & Go Parsers | 3 |
| AST | v0.7.0 | Additional Language Parsers | 5 |
| AST | v0.8.0 | Advanced Analysis | 4 |
| AST | v0.9.0 | Cross-File Analysis Core | 5 |
| AST | v0.10.0 | Cross-File Analysis Extended | 7 |
| AST | v0.11.0 | Worker Infrastructure | 6 |
| AST | v0.12.0 | Import Resolution | 6 |
| AST | v0.13.0 | Function Analysis | 4 |
| AST | v0.14.0 | Multi-Repo AST Service | 8 |
| AST | v0.15.0 | File Metrics for CodeCity | 5 |
| AST | v0.16.0 | Full Repository Scan Mode | 5 |
| AST | v0.17.0 | Ownership & Churn Metrics | 3 |
| AST | v0.18.0 | Blueprint Structural Validation | 4 |
| Git | v0.5.1 | Batch Review & Comment Tracking | 5 |
| Git | v0.6.0 | Ownership & Knowledge Provider | 3 |
| LLM | v0.5.0 | Cerebras + Novita | 2 |
| LLM | v0.6.0 | LangChain Integration | 5 |
| LLM | v0.7.0 | Observability | 2 |
| LLM | v0.8.0 | Prediction & Explanation Prompts | 4 |
| Context | v0.3.0 | Monitoring + Observability Providers | 3 |
| Context | v0.4.0 | Additional Providers + OpenAPI | 6 |
| Notifications | v0.4.0 | Report Delivery | 3 |
| Worker | v0.3.0 | Job Management | 4 |
| Worker | v0.4.0 | Advanced Patterns | 3 |
| Worker | v0.5.0 | Outbox/Inbox Integration | 4 |
| Messaging | v0.3.0 | Scan & Causal Event Topics | 2 |
| Database | v0.2.0 | Comment Tracking | 1 |
| AST | v0.19.0 | KAG: Knowledge Graph Writer | 1 |
| AST | v0.20.0 | KAG: Knowledge Extraction Pipeline | 4 |
| AST | v0.21.0 | KAG: Pattern & Convention Miner | 2 |
| AST | v0.22.0 | KAG: Graph Reasoning Engine | 2 |
| AST | v0.23.0 | KAG: Hybrid Retrieval | 2 |
| **Итого** | **63 версий** | | **200** |
