# Defect Prediction — ASERG Research

> Predictive Analytics — планируемая возможность CodeNautic. ASERG исследует предсказание дефектов и performance regression.
>
> **Источники:** [ASERG Publications](https://aserg.labsoft.dcc.ufmg.br/publications/) ·
> [ASERG Theses](https://aserg.labsoft.dcc.ufmg.br/theses/)

## Ключевые работы

| Год | Работа | Venue | Суть |
|-----|--------|-------|------|
| 2013 | **Predicting Software Defects with Causality Tests** — Cesar Couto (PhD thesis) | UFMG | Предсказание дефектов с использованием тестов причинности (Granger causality). Метрики кода как предикторы. |
| 2016 | **Learning from Source Code History to Identify Performance Failures** — Juan Pablo Sandoval Alcocer et al. | ICPE | Использование истории кода для идентификации performance failures. |
| 2020 | **Prioritizing versions for performance regression testing** — Juan Pablo Sandoval Alcocer et al. | SCP | Приоритизация версий для тестирования performance regression. |
| 2016 | **Predicting the Popularity of GitHub Repositories** — Hudson Borges et al. | PROMISE | Предсказание популярности репозиториев (метрики предсказания). |
| 2018 | **Assessing the Threat of Untracked Changes in Software Evolution** — Andre Hora et al. | ICSE | "Неотслеживаемые" изменения (вне VCS) как угроза эволюции ПО. |

## Применимость к CodeNautic

1. **Granger causality для дефектов** → Couto 2013 использует причинно-следственный анализ для предсказания. Наш Causal Analysis модуль может использовать этот подход
2. **Метрики как предикторы** → Churn, complexity, authorship concentration — эти метрики из ASERG исследований входят в наш Predictive Analytics
3. **Performance regression** → Sandoval 2016/2020 — предсказание performance проблем из истории кода. Может информировать наш ScoreRisk stage
4. **Untracked changes** → Hora 2018 (ICSE) — изменения вне VCS (конфиги, env, CI) как источник проблем. Наш pipeline должен учитывать не только diff, но и контекст
