# Truck Factor & Code Authorship — ASERG Research

> ASERG разработал основные алгоритмы для вычисления Truck Factor. Прямо релевантно для нашего Bus Factor и Knowledge Map.
>
> **Источники:** [ASERG Publications](https://aserg.labsoft.dcc.ufmg.br/publications/) ·
> [Truck Factor tool — GitHub](https://github.com/aserg-ufmg/Truck-Factor) ·
> [Guilherme Avelino — Google Scholar](https://scholar.google.com.br/citations?user=0B-4xFAAAAAJ)

## Ключевые работы

### Truck Factor (= Bus Factor)

| Год | Работа | Venue | Суть |
|-----|--------|-------|------|
| 2016 | **A Novel Approach for Estimating Truck Factors** — Guilherme Avelino et al. | ICPC | Новый алгоритм оценки Truck Factor на основе DOA (Degree of Authorship). |
| 2017 | **A Comparison of Three Algorithms for Computing Truck Factors** — Mivian Ferreira et al. | ICPC | Сравнение трёх алгоритмов: DOA-based, Greedy, Coverage-based. |
| 2019 | **Algorithms for Estimating Truck Factors: A Comparative Study** — Mivian Ferreira et al. | SQJ | Расширенное сравнение в Software Quality Journal. |

### Code Authorship & File Experts

| Год | Работа | Venue | Суть |
|-----|--------|-------|------|
| 2019 | **Measuring and analyzing code authorship in 1+118 open source projects** — Guilherme Avelino et al. | SCP | Масштабное исследование распределения авторства кода. |
| 2019 | **Who Can Maintain this Code?** — Guilherme Avelino et al. | IEEE Software | Оценка repository-mining техник для идентификации maintainers. |
| 2022 | **Identifying Source Code File Experts** — Otávio Cury et al. | ESEM | Алгоритмы идентификации экспертов по файлам. |
| 2019 | **Identifying Experts in Software Libraries and Frameworks among GitHub Users** — João Montandon et al. | MSR | Идентификация экспертов по библиотекам. |
| 2021 | **Mining the Technical Roles of GitHub Users** — João Montandon et al. | IST | Классификация ролей разработчиков по их активности. |

### Turnover & Project Abandonment

| Год | Работа | Venue | Суть |
|-----|--------|-------|------|
| 2019 | **On the Abandonment and Survival of Open Source Projects** — Guilherme Avelino et al. | ESEM | Факторы выживания и abandonment проектов. |
| 2020 | **Turnover in Open-Source Projects: The Case of Core Developers** — Fabio Ferreira et al. | SBES | Влияние ухода core developers на проект. |
| 2020 | **Is this GitHub Project Maintained?** — Jailton Coelho et al. | IST | Автоматическое определение unmaintained проектов. |

### PhD Theses

- **Guilherme Avelino** (2018) — "Identifying Key Developers in Software Projects using Code Authorship Metrics"
- **João Eduardo Montandon** (2021) — "Mining the Technical Skills of Open Source Developers"
- **Mivian Ferreira** (2017) — "Concentration of Knowledge In Software Projects: An Empirical Assessment"

## Применимость к CodeNautic

1. **DOA алгоритм** → Прямая основа для нашего Bus Factor calculation. Avelino 2016 — reference implementation
2. **File Experts** → Наш Suggested Reviewers: Cury 2022 показывает как определять эксперта по файлу
3. **Authorship metrics** → Knowledge Map: распределение знаний по команде из git blame + commit history
4. **Turnover analysis** → Predictive Analytics: предсказание риска при уходе ключевого разработчика
5. **Три алгоритма** → Ferreira 2017/2019 — мы можем имплементировать лучший из трёх или ensemble
