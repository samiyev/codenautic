# AI Coding Agents — ASERG Research

> Самая свежая тема ASERG (2024-2026). Прямо пересекается с Stripe Minions и косвенно с CodeNautic.

## Ключевые работы

### 1. Decoding the Configuration of AI Coding Agents: Insights from Claude Code Projects (2026)

- **Авторы:** Helio Victor F. Santos, Vitor Costa, João Eduardo Montandon, Marco Tulio Valente
- **Venue:** 1st International Workshop on Agentic Engineering
- **Суть:** Анализ того, как разработчики конфигурируют Claude Code через CLAUDE.md файлы. Какие правила пишут, какие паттерны возникают.
- **Релевантность для CodeNautic:** Мы сами используем CLAUDE.md (`.soul/`). Stripe Minions тоже читают rule files. Исследование может показать best practices для agent configuration.
- **Релевантность для Minions:** Прямая — Stripe синхронизирует Cursor rules → Claude Code rules. Это исследование изучает именно этот класс конфигураций.

### 2. Using Copilot Agent Mode to Automate Library Migration: A Quantitative Assessment (2026)

- **Авторы:** Aylton Almeida, Laerte Xavier, Marco Tulio Valente
- **Venue:** 1st International Workshop on Agentic Engineering
- **Суть:** Количественная оценка эффективности Copilot Agent Mode для автоматической миграции библиотек. Один из первых академических бенчмарков coding agents.
- **Релевантность для Minions:** Прямая — Stripe упоминает "tricky LLM-assisted migrations" как use case для custom blueprints. Это исследование бенчмаркит именно такие задачи.
- **Релевантность для CodeNautic:** Средняя — если агенты мигрируют библиотеки, CodeNautic должен уметь ревьюить результаты миграций.

### 3. Automatic Library Migration Using Large Language Models: First Results (2024)

- **Авторы:** Aylton Almeida, Laerte Xavier, Marco Tulio Valente
- **Venue:** ESEM 2024
- **Суть:** Ранние результаты использования LLM для автоматической миграции библиотек. Предшественник работы 2026 года.

### 4. On the Quality of AI-Generated Source Code Comments: A Comprehensive Evaluation (2026)

- **Авторы:** Ian Guelman, Arthur Gregorio Leal, Laerte Xavier, Marco Tulio Valente
- **Venue:** 1st International Workshop on AI for Software Quality Evaluation (AI-SQE)
- **Суть:** Оценка качества AI-генерированных комментариев к коду.
- **Релевантность для CodeNautic:** SafeGuard и Expert Panel — мы оцениваем качество AI-выхода. Методология этого исследования может информировать наши фильтры галлюцинаций.

### 5. Detecting Code Smells using ChatGPT: Initial Insights (2024)

- **Авторы:** Luciana Lourdes Silva, Jânio Silva, João Eduardo Montandon, Marcus Andrade, Marco Tulio Valente
- **Venue:** ESEM 2024
- **Суть:** Оценка способности ChatGPT обнаруживать code smells.
- **Релевантность для CodeNautic:** Прямая — наш pipeline (stages AnalyzeChunks + DetectPatterns) делает то же самое. Методология оценки accuracy применима к нашему SafeGuard.

## Выводы для CodeNautic

1. **ASERG активно исследует AI agents** — workshop "Agentic Engineering" 2026 это новое направление
2. **Бенчмарки agent tasks** — миграция библиотек как воспроизводимая задача для оценки агентов
3. **Качество AI-выхода** — методологии оценки AI-generated code/comments напрямую применимы к SafeGuard
4. **Rule files как research area** — конфигурация агентов через CLAUDE.md становится предметом академического исследования
