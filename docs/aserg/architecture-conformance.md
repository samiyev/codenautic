# Architecture Conformance & Drift — ASERG Research

> Architecture Drift Detection — одна из ключевых планируемых возможностей CodeNautic.

## Ключевые работы

| Год | Работа | Venue | Суть |
|-----|--------|-------|------|
| 2016 | **Mining Architectural Violations from Version History** — Cristiano Maffort et al. | ESE | Майнинг архитектурных нарушений из истории коммитов. Violations, которые появляются и исчезают. |
| 2016 | **Architecture Conformance Checking in Dynamically Typed Languages** — Sergio Miranda et al. | JOT | Проверка соответствия архитектуре в динамически типизированных языках (JavaScript, Ruby). |
| 2017 | **DCL 2.0: Modular and Reusable Specification of Architectural Constraints** — Henrique Rocha et al. | JBCS | Язык DCL для спецификации архитектурных ограничений. Модульный, переиспользуемый. |
| 2015 | **A Recommendation System for Repairing Violations Detected by Static Architecture Conformance Checking** — Ricardo Terra et al. | SPE | Система рекомендаций по исправлению архитектурных нарушений. |

### PhD Theses

- **Cristiano Maffort** (2014) — "Mining Architectural Violations from Version History"
- **Ricardo Terra** (2013) — "A Recommendation System for Repairing Software Architecture Erosion"

## DCL (Dependency Constraint Language)

ASERG разработал DCL — язык для описания архитектурных ограничений:

```
module View: "com.app.view.**"
module Model: "com.app.model.**"

View cannot-depend Model
Model cannot-depend View
```

DCL 2.0 добавил модульность и переиспользование правил.

## Применимость к CodeNautic

1. **Mining violations from history** → Наш Architecture Drift Detection: анализ commit history для обнаружения постепенного отклонения от архитектуры
2. **DCL как blueprint format** → Наш Blueprint (эталонная архитектура) мог бы использовать DSL, подобный DCL, для описания ограничений
3. **Dynamic languages** → Miranda 2016 решает проблему conformance checking для JavaScript/Ruby — релевантно для наших пользователей
4. **Recommendation system** → Terra 2015 предлагает автоматические рекомендации по исправлению нарушений — это наш GenerateSuggestions для архитектурных проблем
5. **Drift Score** → Количество violations из Maffort 2016 может быть основой для нашего Drift Score
