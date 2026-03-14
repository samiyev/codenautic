# CodeCity & Software Visualization — ASERG Research

> GoCity — реализация CodeCity концепции от ASERG. Напрямую релевантно для нашего CodeCity модуля.

## Ключевые работы

| Год | Работа | Venue | Суть |
|-----|--------|-------|------|
| 2019 | **GoCity: Code City for Go** — Rodrigo Brito, Aline Brito, Gleison Brito, Marco Tulio Valente | SANER Tool Track | 3D-визуализация Go-проектов как города. Файлы = здания, пакеты = районы. |
| 2015 | **OrionPlanning: Improving Modularization and Checking Consistency on Software Architecture** — Gustavo Santos et al. | VISSOFT | Инструмент визуализации архитектуры для планирования модуляризации. |

## GoCity — детали

- **GitHub:** [rodrigo-brito/gocity](https://github.com/rodrigo-brito/gocity)
- **Метрики:** LOC → площадь, количество методов → высота
- **Цвет:** количество авторов (authorship diversity)
- **Интерактивность:** hover, zoom, click на здание → детали файла

## Сравнение GoCity vs CodeNautic CodeCity

| Аспект | GoCity (ASERG) | CodeNautic CodeCity |
|--------|----------------|---------------------|
| Языки | Только Go | Multi-language (tree-sitter) |
| Метрики здания | LOC, methods | Complexity, coverage, churn |
| Цвет | Authorship diversity | Health score (green → red) |
| Overlays | Нет | Temporal Coupling, Bug Propagation, Health Degradation |
| 2D режим | Нет | Treemap (доступен всем) |
| 3D режим | Three.js | React Three Fiber |
| Sprint tracking | Нет | Sprint snapshots, district trends |
| Интеграция | Standalone | Встроен в platform (API, dashboard) |

## Применимость к CodeNautic

1. **GoCity как reference implementation** → Архитектура визуализации, маппинг метрик на геометрию
2. **Расширение за пределы GoCity** → Наши overlay-слои (temporal coupling, bug propagation) — это то, чего GoCity не имеет. Это наш дифференциатор
3. **Authorship как цвет** → GoCity использует diversity авторства для цвета. Мы используем health score, но authorship overlay — хорошая идея для нашего Knowledge Map overlay
4. **Академическая валидация** → GoCity опубликован на SANER. Наш подход можно позиционировать как эволюцию GoCity
