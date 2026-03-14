# Code Review Tools — ASERG Research

> RAID — refactoring-aware code reviews. Ближайший академический аналог нашего подхода к code review.

## Ключевые работы

| Год | Работа | Venue | Суть |
|-----|--------|-------|------|
| 2021 | **RAID: Tool Support for Refactoring-Aware Code Reviews** — Rodrigo Brito, Marco Tulio Valente | ICPC | Инструмент, который помогает ревьюерам понимать рефакторинги в PR. Отделяет рефакторинг от функциональных изменений. |
| 2020 | **Characteristics of Method Extractions in Java** — Andre Hora, Romain Robbes | ESE | Характеристики Extract Method рефакторингов — самого частого типа. |
| 2022 | **Characterizing High-Quality Test Methods** — Victor Veloso, Andre Hora | MSR | Характеристики качественных тестов — что делает тест хорошим. |
| 2023 | **Snapshot Testing in Practice: Benefits and Drawbacks** — Victor Gazzinelli Cruz et al. | JSS | Анализ snapshot testing: когда полезно, когда вредно. |

### Master Thesis

- **Rodrigo Ferreira de Brito** (2021) — "RAID: Tool Support for Refactoring-aware Code Reviews"

## RAID — детали

Проблема: в большом PR часть изменений — рефакторинг (переименования, перемещения), часть — функциональные изменения. Ревьюер тратит время на понимание рефакторинга, который не меняет поведение.

RAID решение:
1. Определяет рефакторинги в PR (используя RefDiff)
2. Визуально отделяет их от функциональных изменений
3. Ревьюер фокусируется на логике, не на шуме

## Применимость к CodeNautic

1. **RAID подход в pipeline** → Наш AnalyzeChunks stage может разделять рефакторинг и функциональные изменения. Это улучшает quality of suggestions — не предлагать "ненужный" рефакторинг, если он уже был сделан
2. **Refactoring-aware filtering** → SafeGuard FilterDuplicates: если изменение — чистый рефакторинг (RefDiff detected), снижать severity и не генерировать логические замечания
3. **Test quality metrics** → Veloso 2022 — метрики качества тестов. Наш pipeline может оценивать тесты в PR: "тест покрывает новый код?" (stage CheckImplementation)
4. **Snapshot testing** → Cruz 2023 — когда snapshot testing вредит. Наш pipeline может предупреждать о злоупотреблении snapshot tests
