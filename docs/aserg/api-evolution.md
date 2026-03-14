# API Evolution & Breaking Changes — ASERG Research

> ASERG — лидер в исследовании API breaking changes. Релевантно для нашего pipeline (detection) и для agent-produced code.
>
> **Источники:** [ASERG Publications](https://aserg.labsoft.dcc.ufmg.br/publications/) ·
> [APIDiff — GitHub](https://github.com/aserg-ufmg/apidiff) ·
> [apiwave — GitHub](https://github.com/andrehora/apiwave) ·
> [Aline Brito — Google Scholar](https://scholar.google.com.br/citations?user=DS7MpP8AAAAJ)

## Ключевые работы

### API Breaking Changes

| Год | Работа | Venue | Суть |
|-----|--------|-------|------|
| 2017 | **Historical and Impact Analysis of API Breaking Changes** — Laerte Xavier et al. | SANER | Исторический анализ и оценка влияния breaking changes. |
| 2018 | **APIDiff: Detecting API Breaking Changes** — Aline Brito et al. | SANER Tool | Инструмент автоматического обнаружения breaking changes между версиями API. |
| 2018 | **Why and How Java Developers Break APIs** — Aline Brito et al. | SANER | Мотивации и паттерны breaking changes. |
| 2020 | **You Broke My Code: Understanding the Motivations for Breaking Changes in APIs** — Aline Brito et al. | ESE | Расширенное исследование мотиваций (journal version). |
| 2025 | **Unboxing Default Argument Breaking Changes in 1+2 Data Science Libraries** — João Montandon et al. | JSS | Неочевидные breaking changes через дефолтные аргументы. |

### API Deprecation

| Год | Работа | Venue | Суть |
|-----|--------|-------|------|
| 2016 | **Do Developers Deprecate APIs with Replacement Messages?** — Gleison Brito et al. | SANER | Исследование: сопровождают ли разработчики deprecation сообщениями о замене. |
| 2018 | **On the Use of Replacement Messages in API Deprecation** — Gleison Brito et al. | JSS | Journal version с расширенным анализом. |
| 2021 | **JavaScript API Deprecation Landscape** — Romulo Nascimento et al. | IEEE Software | Обзор deprecation практик в JavaScript экосистеме. |

### Library Migration

| Год | Работа | Venue | Суть |
|-----|--------|-------|------|
| 2024 | **Automatic Library Migration Using Large Language Models** — Aylton Almeida et al. | ESEM | LLM для автоматической миграции библиотек. |
| 2026 | **Using Copilot Agent Mode to Automate Library Migration** — Aylton Almeida et al. | Agentic Engineering | Copilot Agent Mode для миграций. |
| 2026 | **MiG.4: A Curated Dataset of Library Migrations in Java and Python** — Matheus Barbosa et al. | FORGE | Датасет миграций — бенчмарк для оценки инструментов. |

## Применимость к CodeNautic

1. **APIDiff алгоритм** → Наш pipeline может использовать подход APIDiff для обнаружения breaking changes в diff (stage AnalyzeChunks)
2. **Мотивации breaking changes** → Brito 2020 классифицирует причины BC — это информирует severity scoring в нашем ScoreRisk stage
3. **Default argument BC** → Montandon 2025 — неочевидные breaking changes через дефолтные аргументы. Наш pipeline должен ловить такие тонкие проблемы
4. **Deprecation messages** → Наш GenerateSuggestions: если обнаружен deprecated API, предлагать replacement с конкретным сообщением (best practice из Brito 2016)
5. **MiG.4 dataset** → Бенчмарк для оценки нашего pipeline на задачах миграции
