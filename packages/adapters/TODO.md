# @codenautic/adapters — TODO

> Adapters: Git, LLM, Context, Notifications, AST, Messaging, Worker Infra, Database
>
> **Задач:** 200 | **Доменов:** 8

---

## Правила

1. **TDD** — тесты -> код -> рефакторинг
2. **Полная реализация** — без заглушек и срезания углов
3. **Нулевой мертвый код** — удаляй неиспользуемое
4. **JSDoc only** — только `/** */`
5. **Одна версия за раз** — заверши текущую до начала следующей
6. **Каждая задача** включает тесты, реализацию, экспорт из index.ts

---

## Соответствие ROADMAP.md

- Источник приоритезации: `ROADMAP.md` -> таблица milestones
- Покрываемые milestones: `M06`, `M07`, `M09`, `M12`, `M13`, `M14`, `M16`, `M18`
- Порядок milestone-секций в этом файле повторяет порядок из roadmap

---

## Трассировка с PRODUCT.md

- Пакет: `adapters`
- Цель: задачи пакета напрямую собирают заявленные продуктовые возможности CodeNautic из `PRODUCT.md`.
- Ключевые capability направления:
- Интеграции Git/LLM/Context/Notifications провайдеров.
- AST-анализ и инфраструктура графа кода.
- Messaging (Outbox/Inbox) и worker infrastructure.
- Database adapters для реализации core-портов.
- KAG adapters: extraction, graph writing, hybrid retrieval.

---

## Milestones

| Milestone | Файл |
|---|---|
| M00 — DDD Bootstrap (вне ROADMAP) | [todo/m00-ddd-bootstrap-adapters.md](todo/m00-ddd-bootstrap-adapters.md) |
| M06 — Adapters Foundation | [todo/m06-adapters-foundation.md](todo/m06-adapters-foundation.md) |
| M07 — First Providers | [todo/m07-first-providers.md](todo/m07-first-providers.md) |
| M09 — Notifications & Context | [todo/m09-notifications-context.md](todo/m09-notifications-context.md) |
| M12 — AST, Scan, Onboarding | [todo/m12-ast-scan-onboarding.md](todo/m12-ast-scan-onboarding.md) |
| M13 — CodeCity & Review UI | [todo/m13-codecity-review-ui.md](todo/m13-codecity-review-ui.md) |
| M14 — All Providers & Pages | [todo/m14-all-providers-pages.md](todo/m14-all-providers-pages.md) |
| M16 — Full Adapters | [todo/m16-full-adapters.md](todo/m16-full-adapters.md) |
| M18 — KAG | [todo/m18-kag.md](todo/m18-kag.md) |

## Notes

- Детальные версии и задачи находятся в milestone-файлах в каталоге `todo/`.
- Этот индекс оставлен как входная точка для навигации по roadmap и планированию.
- `M00` — bootstrap-слой для запуска исполняемого DDD-контура; он не заменяет milestone из `ROADMAP.md`.
