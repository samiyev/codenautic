# Product Coverage Matrix

> Цель: проверить, что закрытие задач в `packages/*/TODO.md` + `packages/*/todo/*.md` действительно приводит к результату из `PRODUCT.md`.
> Дата аудита: 2026-03-01.

---

## Итог аудита

- **Структурное покрытие capability из `PRODUCT.md`: 31/31 (100%)**
- **Практическая уверенность в получении полноценного продукта:** **~90%**
- **Вывод:** backlog по объёму и составу достаточный, но нужен дополнительный слой product-hardening (измеримые
  go/no-go гейты), иначе можно закрыть задачи формально и недобрать продуктовый эффект.
- **Важно:** 31/31 = покрытие capability задачами в backlog, а не процент фактически реализованных задач.

---

## Покрытие ключевых возможностей

| Capability из PRODUCT | Покрытие задачами | Milestones |
|---|---|---|
| 20-stage pipeline + SafeGuard | Да | M02, M03, M08 |
| Expert Panel + Continuous Learning | Да | M05, M11 |
| Custom Rules + Rule inheritance | Да | M04, M11 |
| AST + Code Graph + CodeCity (2D/3D) | Да | M12, M13, M17 |
| Conversation Agent + Mention Commands | Да | M11, M17 |
| Repository Onboarding | Да | M12 |
| Causal/Impact/Refactoring/Knowledge Map | Да | M15, M17 |
| Predictive Analytics + Architecture Drift | Да | M15, M17 |
| Executive Reports + Review Context | Да | M15, M17 |
| Multi-tenancy + RBAC + AES-256 + Audit | Да | M04, M10, M17 |
| Интеграции Git/LLM/Context/Notifications | Да | M07, M09, M14, M16 |
| KAG (Knowledge Graph + Hybrid Retrieval + Reasoning) | Да | M18 |

---

## Критичные пробелы до 100% уверенности

Это не пробелы функциональности, а пробелы **product acceptance**:

1. Нет единого обязательного **Go/No-Go набора KPI** по milestone (качество, latency, cost, reliability).
2. Нет фиксированного **SLO/SLA-гейта** для ключевых пользовательских цепочек.
3. Нет единого **качества AI-гейта** (precision/false-positive budget) как release blocker.
4. Нет формализованной **операционной приемки** (backup/restore drill, incident readiness, rollback drill) как gate.

---

## Что добавить (минимум)

Перед закрытием milestones M17/M18 зафиксировать 4 обязательных gate-блока:

1. **Quality Gate:** false-positive rate, acceptance rate, regression budget.
2. **Performance Gate:** p95 для review/chat/scan, queue depth budget.
3. **Reliability Gate:** восстановление из backup, retry/DLQ SLO, incident drill.
4. **Business Gate:** activation/retention/usefulness KPI по ключевым сценариям.

После добавления этих гейтов закрытие всех задач даёт практически полную гарантию соответствия `PRODUCT.md`.
