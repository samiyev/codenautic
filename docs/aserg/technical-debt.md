# Technical Debt — ASERG Research

> ASERG — одна из ведущих групп по исследованию Self-Admitted Technical Debt (SATD).

## Ключевые работы

| Год | Работа | Venue | Суть |
|-----|--------|-------|------|
| 2020 | **Beyond the Code: Mining Self-Admitted Technical Debt in Issue Tracker Systems** — Laerte Xavier et al. | MSR | SATD не только в коде (TODO), но и в issue trackers (Jira, GitHub Issues). |
| 2022 | **Comments or Issues: Where to Document Technical Debt?** — Laerte Xavier et al. | IEEE Software | Сравнение: где лучше документировать TD — в комментариях или issue trackers. |
| 2022 | **On the Documentation of Self-Admitted Technical Debt in Issues** — Laerte Xavier et al. | ESE | Глубокий анализ SATD в issues: типы, жизненный цикл, разрешение. |
| 2024 | **Agile Technical Debt Management using the LTD Framework** — Laerte Xavier et al. | ACM SIGSOFT SEN | Практический фреймворк управления TD в agile-командах. |

## PhD Thesis

- **José Laerte Pires Xavier Júnior** (2022) — "Documenting and Managing Self-Admitted Technical Debt Using Issues"

## Применимость к CodeNautic

1. **SATD Mining в issues** → Наш FetchExternalContext stage собирает данные из Jira/Linear. Методология Xavier позволяет автоматически находить TD в тикетах и обогащать контекст ревью
2. **TD в комментариях** → Pipeline stage AnalyzeChunks может детектировать SATD-комментарии (`// TODO`, `// HACK`, `// FIXME`) и классифицировать их по типам из каталога Xavier
3. **LTD Framework** → Может информировать наш Refactoring Planning — приоритизация TD по ROI
4. **Жизненный цикл TD** → Данные для Predictive Analytics: как долго живёт TD, когда он становится критичным
