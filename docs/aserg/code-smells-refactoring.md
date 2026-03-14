# Code Smells & Refactoring — ASERG Research

> Одно из ядровых направлений ASERG. Прямо релевантно для CodeNautic pipeline (DetectPatterns, GenerateSuggestions).
>
> **Источники:** [ASERG Publications](https://aserg.labsoft.dcc.ufmg.br/publications/) ·
> [RefDiff — GitHub](https://github.com/aserg-ufmg/RefDiff) ·
> [RefDiff 2.0 — GitHub](https://github.com/aserg-ufmg/RefDiff) ·
> [Danilo Silva — Google Scholar](https://scholar.google.com.br/citations?user=5JeHSCgAAAAJ)

## Ключевые работы

### Refactoring Detection

| Год | Работа | Venue | Суть |
|-----|--------|-------|------|
| 2017 | **RefDiff: Detecting Refactorings in Version Histories** — Danilo Silva, Marco Tulio Valente | MSR | Алгоритм детекции рефакторингов между коммитами. Multi-language. |
| 2020 | **RefDiff 2.0: A Multi-language Refactoring Detection Tool** — Danilo Silva et al. | IEEE TSE | Расширение на Java, JavaScript, C. Reference implementation. |
| 2020 | **RefDiff4Go: Detecting Refactorings in Go** — Rodrigo Brito, Marco Tulio Valente | SBCARS | Go-расширение RefDiff. |

### Refactoring Graphs

| Год | Работа | Venue | Суть |
|-----|--------|-------|------|
| 2020 | **Refactoring Graphs: Assessing Refactoring over Time** — Aline Brito et al. | SANER | Граф рефакторингов: как классы/методы эволюционируют через цепочки рефакторингов. |
| 2021 | **Characterizing Refactoring Graphs in Java and JavaScript** — Aline Brito et al. | ESE | Эмпирическое исследование рефакторинг-графов в 10 проектах. |
| 2024 | **Towards a Catalog of Composite Refactorings** — Aline Brito et al. | JSEP | Каталог составных рефакторингов (цепочек). |

### Code Smells

| Год | Работа | Venue | Суть |
|-----|--------|-------|------|
| 2023 | **Detecting Code Smells in React-based Web Apps** — Fabio Ferreira, Marco Tulio Valente | IST | Каталог code smells специфичных для React. |
| 2023 | **Understanding Code Smells in Elixir** — Lucas Vegi, Marco Tulio Valente | ESE | Code smells в функциональном языке. |
| 2024 | **Detecting Code Smells using ChatGPT** — Luciana Silva et al. | ESEM | LLM для детекции code smells. |
| 2024 | **Refactoring React-based Web Apps** — Fabio Ferreira et al. | JSS | Каталог рефакторингов для React. |

### Why We Refactor

| Год | Работа | Venue | Суть |
|-----|--------|-------|------|
| 2016 | **Why We Refactor? Confessions of GitHub Contributors** — Danilo Silva et al. | FSE | **ACM SIGSOFT Distinguished Paper + Distinguished Artifact Award**. Мотивации рефакторинга из 2000+ коммитов. |

## Применимость к CodeNautic

1. **RefDiff алгоритм** → Наш pipeline stage DetectPatterns может использовать подход RefDiff для обнаружения рефакторингов в diff
2. **Refactoring Graphs** → Отслеживание эволюции кода через цепочки рефакторингов — данные для Causal Analysis
3. **React code smells** → Наш UI на React — каталог Ferreira применим для self-review нашего кода
4. **LLM для code smells** → Методология оценки из ESEM 2024 применима для калибровки нашего SafeGuard
5. **Why we refactor** → Информирует логику GenerateSuggestions — предлагать рефакторинг с правильной мотивацией
