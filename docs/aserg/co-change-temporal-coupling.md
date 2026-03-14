# Co-Change & Temporal Coupling — ASERG Research

> Temporal coupling (файлы, которые часто меняются вместе) — одна из core метрик для нашего Causal Analysis.

## Ключевые работы

| Год | Работа | Venue | Суть |
|-----|--------|-------|------|
| 2015 | **Co-change Clusters: Extraction and Application on Assessing Software Modularity** — Luciana Silva et al. | TAOSD | Алгоритм извлечения co-change кластеров и их применение для оценки модульности. |
| 2015 | **Developers' Perception of Co-Change Patterns** — Luciana Silva et al. | ICSME | Как разработчики воспринимают паттерны co-change. |
| 2019 | **Co-Change Patterns: A Large Scale Empirical Study** — Luciana Silva et al. | JSS | Масштабное исследование паттернов co-change в 133 проектах. |

### PhD Thesis

- **Luciana Silva** (2015) — "Co-change Clustering"

## Паттерны Co-Change (из Silva 2019)

Исследование выявило типы co-change паттернов:
- **Structural co-change** — файлы меняются вместе из-за прямых зависимостей
- **Logical co-change** — файлы меняются вместе без прямых зависимостей (cross-cutting concerns)
- **Temporary co-change** — случайные совпадения (шум)

## Применимость к CodeNautic

1. **Co-change clusters** → Прямой вход для нашего Temporal Coupling overlay в CodeCity
2. **Модульность** → Co-change кластеры, пересекающие границы модулей, сигнализируют о нарушении модульности → Architecture Drift
3. **Фильтрация шума** → Различение structural, logical и temporary co-change — важно для качества наших предсказаний
4. **Восприятие разработчиков** → Silva 2015 (ICSME) показывает, какие паттерны разработчики считают полезными — информирует наш UX
5. **Impact Analysis** → Если файл A часто меняется с файлом B, изменение A → риск в B. Это наш Blast Radius.
