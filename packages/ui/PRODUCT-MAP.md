# CodeNautic UI — Product Map

> Что продукт даёт пользователю. Карта всех возможностей с привязкой к конкретным файлам.
>
> Все пути относительны от `packages/ui/src/`.

---

## 1. AI Code Review (ядро продукта)

Автоматический анализ Code Change Requests через 20-stage pipeline с SafeGuard фильтрацией AI-галлюцинаций.

### CCR Management — список всех ревью

> `pages/ccr-management.page.tsx` — `CcrManagementPage`

- Таблица CCR с колонками: ID, Title, Repository, Assignee, Comments, Updated, Status
- Поиск по title/id/repo/assignee
- Фильтры: status, team, repository
- Сохраняемые пресеты фильтров (localStorage) — save/load/update/delete
- Infinite scroll для подгрузки данных

| Компонент | Файл |
|---|---|
| ReviewsContent | `components/reviews/reviews-content.tsx` |
| ReviewsTable | `components/reviews/reviews-table.tsx` |
| ReviewsFilters | `components/reviews/reviews-filters.tsx` |
| ReviewStatusBadge | `components/reviews/review-status-badge.tsx` |

### CCR Review Detail — полный анализ одного CCR

> `pages/ccr-review-detail/ccr-review-detail.page.tsx` — `CcrReviewDetailPage`

Декомпозированная страница-оркестратор: state hook + 4 секции.

Что видит пользователь:

- **Side-by-side diff** с подсветкой изменений, счётчиком added/removed строк
- **AI-комментарии** — вложенные треды с фидбеком (false_positive / duplicate / irrelevant)
- **SafeGuard pipeline trace** — 3 этапа фильтрации: Deduplication → Hallucination → SeverityThreshold
- **Risk indicator** — уровень / score / причины
- **Chat с AI** прямо в контексте CCR (streaming token-by-token)
- **Impact analysis** на затронутые файлы
- **CodeCity treemap** для визуализации импакта
- **File neighborhood** — зависимости, последние изменения файла
- **Review history heatmap**
- **SSE stream viewer** для real-time данных

| Компонент | Файл |
|---|---|
| HeaderSection | `pages/ccr-review-detail/sections/header-section.tsx` |
| SidebarFilesSection | `pages/ccr-review-detail/sections/sidebar-files-section.tsx` |
| DiffSection | `pages/ccr-review-detail/sections/diff-section.tsx` |
| SidebarRightSection | `pages/ccr-review-detail/sections/sidebar-right-section.tsx` |
| useCcrReviewState | `pages/ccr-review-detail/hooks/use-ccr-review-state.ts` |
| CodeDiffViewer | `components/reviews/code-diff-viewer.tsx` |
| ReviewCommentThread | `components/reviews/review-comment-thread.tsx` |
| ChatPanel | `components/chat/chat-panel.tsx` |
| ChatInput | `components/chat/chat-input.tsx` |
| ChatMessageBubble | `components/chat/chat-message-bubble.tsx` |
| ChatStreamingResponse | `components/chat/chat-streaming-response.tsx` |
| ChatThreadList | `components/chat/chat-thread-list.tsx` |
| ChatContextIndicator | `components/chat/chat-context-indicator.tsx` |
| CodeCityTreemap | `components/codecity/codecity-treemap.tsx` |
| ImpactAnalysisPanel | `components/predictions/impact-analysis-panel.tsx` |
| SseStreamViewer | `components/streaming/sse-stream-viewer.tsx` |

Вспомогательные файлы:
- `pages/ccr-review-detail/ccr-review-detail.types.ts`
- `pages/ccr-review-detail/ccr-review-detail.constants.ts`
- `pages/ccr-review-detail/ccr-review-detail.utils.ts`
- `pages/ccr-data.ts` — mock данные CCR

---

## 2. Issues Tracking

> `pages/issues-tracking.page.tsx` — `IssuesTrackingPage`

Таблица обнаруженных проблем по всем репозиториям:

- Колонки: ID, Title, Repository, File Path, Severity, Status, Owner, Detected
- Severity уровни: critical / high / medium / low
- Status: open / in_progress / fixed / dismissed
- Inline-действия по каждой issue: acknowledge, snooze, fix, ignore
- Поиск по id/title/repo/file
- Фильтры: status, severity
- Infinite scroll

---

## 3. My Work — Triage Hub

> `pages/my-work.page.tsx` — `MyWorkPage`

Персональная очередь задач с SLA-приоритизацией:

- **5 категорий:** assigned_ccr, critical_issue, inbox_notification, pending_approval, stuck_job
- **SLA-статус:** healthy (зелёный) / warning (жёлтый) / breach (красный)
- **Escalation по ролям:** viewer → developer → lead → admin
- **Scope переключение:** мои / команды / репозитория (Alt+1/2/3)
- **Действия:** start work, mark done, escalate (role-gated), snooze, assign to me
- **Audit trail** — история изменений каждого элемента

---

## 4. Dashboard Mission Control

> `pages/dashboard-mission-control.page.tsx` — `DashboardMissionControlPage`

Центральный командный центр с полной картиной состояния проекта:

### Метрики и виджеты

| Виджет | Файл | Что показывает |
|---|---|---|
| Hero Metric | `components/dashboard/dashboard-hero-metric.tsx` | SVG radial gauge (270°) — ключевой KPI |
| KPI Cards | `components/dashboard/metric-card.tsx` | Open CCRs, reviewed, suggestions, active jobs |
| Metrics Grid | `components/dashboard/metrics-grid.tsx` | Staggered grid из MetricCards |
| Flow Metrics | `components/dashboard/flow-metrics-widget.tsx` | Throughput/capacity — ComposedChart |
| Team Activity | `components/dashboard/team-activity-widget.tsx` | CCRs merged per developer — BarChart |
| Token Usage | `components/dashboard/token-usage-dashboard-widget.tsx` | Donut + AreaChart |
| Architecture Health | `components/dashboard/architecture-health-widget.tsx` | DDD compliance — RadarChart |
| Status Distribution | `components/dashboard/status-distribution-chart.tsx` | PieChart |
| Activity Timeline | `components/dashboard/activity-timeline.tsx` | Хронология событий |
| Activity Timeline Item | `components/dashboard/activity-timeline-item.tsx` | Элемент хронологии |
| Work Queue | `components/dashboard/dashboard-content.tsx` | Severity-aware карточки |
| Critical Signals | `components/dashboard/dashboard-critical-signals.tsx` | Ops degradation, freshness |

### Управление

| Элемент | Файл |
|---|---|
| Scope Filters | `components/dashboard/dashboard-scope-filters.tsx` |
| Scope Filter Utils | `components/dashboard/scope-filter-utils.ts` |
| Date Range | `components/dashboard/dashboard-date-range-filter.tsx` |
| Dashboard Zones | `components/dashboard/dashboard-zone.tsx` |
| Layout Presets | `components/dashboard/dashboard-layouts.ts` |

Данные: `pages/dashboard-mock-data.ts`

---

## 5. CodeCity — визуализация кодовой базы

> `pages/code-city-dashboard/code-city-dashboard.page.tsx` — `CodeCityDashboardPage`

Самая визуально-богатая часть продукта. 10 секций:

### Секции

| Секция | Файл |
|---|---|
| Tour | `pages/code-city-dashboard/sections/tour-section.tsx` |
| Controls | `pages/code-city-dashboard/sections/controls-section.tsx` |
| Overview | `pages/code-city-dashboard/sections/overview-section.tsx` |
| Visualization | `pages/code-city-dashboard/sections/visualization-section.tsx` |
| Refactoring | `pages/code-city-dashboard/sections/refactoring-section.tsx` |
| Prediction | `pages/code-city-dashboard/sections/prediction-section.tsx` |
| Comparison | `pages/code-city-dashboard/sections/comparison-section.tsx` |
| Gamification | `pages/code-city-dashboard/sections/gamification-section.tsx` |
| Ownership | `pages/code-city-dashboard/sections/ownership-section.tsx` |
| Analysis | `pages/code-city-dashboard/sections/analysis-section.tsx` |

### Визуализации (`components/codecity/`)

| Компонент | Файл | Тип |
|---|---|---|
| CodeCity3DScene | `components/codecity/codecity-3d-scene.tsx` | Three.js 3D город-метафора |
| CodeCityTreemap | `components/codecity/codecity-treemap.tsx` | 2D treemap альтернатива |
| 3D Scene Renderer | `components/codecity/codecity-3d-scene-renderer.tsx` | Barrel re-export |
| 3D Layout Worker | `components/codecity/codecity-3d-layout.worker.ts` | Web Worker для layout |

Утилиты:
- `components/codecity/codecity-treemap.utils.ts`
- `components/codecity/codecity-treemap.constants.ts`
- `components/codecity/codecity-3d/` — scene types, constants, layout, render budget, arc builders, visual resolvers, rendering utils

### Оверлеи (`components/codecity/overlays/`)

| Оверлей | Файл | Что показывает |
|---|---|---|
| Ownership | `components/codecity/overlays/city-ownership-overlay.tsx` | Кто владеет кодом |
| Impact | `components/codecity/overlays/city-impact-overlay.tsx` | Зоны воздействия |
| Prediction | `components/codecity/overlays/city-prediction-overlay.tsx` | Проблемные зоны |
| Bus Factor | `components/codecity/overlays/city-bus-factor-overlay.tsx` | Риск bus factor |
| Refactoring | `components/codecity/overlays/city-refactoring-overlay.tsx` | Кандидаты на рефакторинг |
| Causal Selector | `components/codecity/overlays/causal-overlay-selector.tsx` | Выбор overlay слоя |

### Дополнительные компоненты CodeCity

| Компонент | Файл |
|---|---|
| HotAreaHighlights | `components/codecity/hot-area-highlights.tsx` |
| HealthTrendChart | `components/codecity/health-trend-chart.tsx` |
| ChurnComplexityScatter | `components/codecity/churn-complexity-scatter.tsx` |
| DistrictTrendIndicators | `components/codecity/district-trend-indicators.tsx` |
| RootCauseChainViewer | `components/codecity/root-cause-chain-viewer.tsx` |
| ExploreModeSidebar | `components/codecity/explore-mode-sidebar.tsx` |
| ProjectOverviewPanel | `components/codecity/project-overview-panel.tsx` |
| GuidedTourOverlay | `components/codecity/guided-tour-overlay.tsx` |
| TourCustomizer | `components/codecity/tour-customizer.tsx` |
| OnboardingProgressTracker | `components/codecity/onboarding-progress-tracker.tsx` |
| AlertConfigDialog | `components/codecity/alert-config-dialog.tsx` |

### Builders (data builders для секций)

- `pages/code-city-dashboard/builders/sprint-gamification-builders.ts`
- `pages/code-city-dashboard/builders/ownership-knowledge-builders.ts`
- `pages/code-city-dashboard/builders/impact-builders.ts`
- `pages/code-city-dashboard/builders/prediction-builders.ts`
- `pages/code-city-dashboard/builders/root-cause-builders.ts`
- `pages/code-city-dashboard/builders/explore-onboarding-builders.ts`

State и типы:
- `pages/code-city-dashboard/use-code-city-dashboard-state.ts`
- `pages/code-city-dashboard/code-city-dashboard-types.ts`
- `pages/code-city-dashboard/code-city-dashboard-utils.ts`
- `pages/code-city-dashboard/code-city-dashboard-mock-data.ts`

---

## 6. Predictions & Analysis (`components/predictions/`)

| Компонент | Файл | Что даёт |
|---|---|---|
| PredictionDashboard | `components/predictions/prediction-dashboard.tsx` | Обзор предсказаний |
| PredictionAccuracyWidget | `components/predictions/prediction-accuracy-widget.tsx` | Точность модели |
| PredictionExplainPanel | `components/predictions/prediction-explain-panel.tsx` | Объяснение факторов |
| PredictionComparisonView | `components/predictions/prediction-comparison-view.tsx` | Сравнение моделей |
| TrendForecastChart | `components/predictions/trend-forecast-chart.tsx` | Прогноз тренда |
| TrendTimelineWidget | `components/predictions/trend-timeline-widget.tsx` | Timeline трендов |
| ChangeRiskGauge | `components/predictions/change-risk-gauge.tsx` | Gauge риска |
| ImpactAnalysisPanel | `components/predictions/impact-analysis-panel.tsx` | Детали impact analysis |
| ImpactGraphView | `components/predictions/impact-graph-view.tsx` | Граф распространения |
| WhatIfPanel | `components/predictions/what-if-panel.tsx` | «Что будет если...» сценарии |
| SimulationPanel | `components/predictions/simulation-panel.tsx` | Запуск симуляции |

---

## 7. Refactoring (`components/refactoring/`)

| Компонент | Файл | Что даёт |
|---|---|---|
| RefactoringDashboard | `components/refactoring/refactoring-dashboard.tsx` | Кандидаты на рефакторинг |
| RefactoringTimeline | `components/refactoring/refactoring-timeline.tsx` | История рефакторингов |
| RefactoringExportDialog | `components/refactoring/refactoring-export-dialog.tsx` | Экспорт плана |
| ROICalculatorWidget | `components/refactoring/roi-calculator-widget.tsx` | Расчёт ROI |

---

## 8. Team Analytics (`components/team-analytics/`)

| Компонент | Файл | Что даёт |
|---|---|---|
| TeamLeaderboard | `components/team-analytics/team-leaderboard.tsx` | Лидерборд разработчиков |
| AchievementsPanel | `components/team-analytics/achievements-panel.tsx` | Achievement badges |
| SprintSummaryCard | `components/team-analytics/sprint-summary-card.tsx` | Summary спринта |
| SprintComparisonView | `components/team-analytics/sprint-comparison-view.tsx` | Сравнение спринтов |
| KnowledgeSiloPanel | `components/team-analytics/knowledge-silo-panel.tsx` | Knowledge silos |
| KnowledgeMapExportWidget | `components/team-analytics/knowledge-map-export-widget.tsx` | Экспорт knowledge map |
| KnowledgeMapExport | `components/team-analytics/knowledge-map-export.ts` | Утилиты экспорта |
| ContributorCollaborationGraph | `components/team-analytics/contributor-collaboration-graph.tsx` | Кто с кем работает |
| OwnershipTransitionWidget | `components/team-analytics/ownership-transition-widget.tsx` | Переходы ownership |
| BusFactorTrendChart | `components/team-analytics/bus-factor-trend-chart.tsx` | Тренд bus factor |

---

## 9. Dependency Graphs (`components/dependency-graphs/`)

| Граф | Файл | Что показывает |
|---|---|---|
| Package Dependencies | `components/dependency-graphs/package-dependency-graph.tsx` | Зависимости пакетов |
| File Dependencies | `components/dependency-graphs/file-dependency-graph.tsx` | Зависимости файлов |
| Function/Class Calls | `components/dependency-graphs/function-class-call-graph.tsx` | Граф вызовов |
| Graph Renderer | `components/dependency-graphs/xyflow-graph.tsx` | Базовый React Flow рендерер |
| Graph Renderer Core | `components/dependency-graphs/xyflow-graph-renderer.tsx` | Рендеринг с layout |
| Graph Layout | `components/dependency-graphs/xyflow-graph-layout.ts` | Алгоритмы layout |
| Graph Export | `components/dependency-graphs/graph-export.ts` | Экспорт графа |

Утилиты:
- `components/dependency-graphs/package-dependency-graph.constants.ts`
- `components/dependency-graphs/package-dependency-graph.utils.ts`

---

## 10. Repository Management

### Repositories List

> `pages/repositories-list.page.tsx` — `RepositoriesListPage`

- Таблица подключённых репозиториев: name, owner, branch, last scan, status, issue count
- Status: ready / scanning / error
- Summary карточки, поиск, фильтр, сортировка
- Retry scan, inline error recovery

### Repository Overview

> `pages/repository-overview/repository-overview.page.tsx` — `RepositoryOverviewPage`

- Health score, architecture summary, tech stack
- Все 4 графа: file dependency, function/class call, package dependency, CodeCity treemap
- Metrics grid, rescan schedule

Вспомогательные файлы:
- `pages/repository-overview/repository-overview-types.ts`
- `pages/repository-overview/repository-overview-utils.ts`
- `pages/repository-overview/repository-overview-mock-data.ts`

### Scan Progress

> `pages/scan-progress.page.tsx` — `ScanProgressPage`

- Progress bar (%), 5 фаз pipeline, ETA, stage logs
- SSE EventSource для real-time обновлений
- Действия: retry, cancel, open repository

### Scan Error Recovery

> `pages/scan-error-recovery.page.tsx` — `ScanErrorRecoveryPage`

3-шаговый recovery flow после ошибок scan pipeline.

---

## 11. Отчёты

### Report Generator

> `pages/report-generator.page.tsx` — `ReportGeneratorPage`

| Компонент | Файл |
|---|---|
| ReportTemplateEditor | `components/reports/report-template-editor.tsx` |
| ReportScheduleDialog | `components/reports/report-schedule-dialog.tsx` |

### Report List

> `pages/report-list.page.tsx` — `ReportListPage`

### Report Viewer

> `pages/report-viewer.page.tsx` — `ReportViewerPage`

| Компонент | Файл |
|---|---|
| AiSummaryWidget | `components/reports/ai-summary-widget.tsx` |

---

## 12. Chat / AI Agent

| Компонент | Файл | Роль |
|---|---|---|
| ChatPanel | `components/chat/chat-panel.tsx` | Sliding aside панель |
| ChatInput | `components/chat/chat-input.tsx` | Ввод с file context |
| ChatMessageBubble | `components/chat/chat-message-bubble.tsx` | Markdown rendering |
| ChatStreamingResponse | `components/chat/chat-streaming-response.tsx` | Token-by-token streaming |
| ChatThreadList | `components/chat/chat-thread-list.tsx` | Список тредов |
| ChatContextIndicator | `components/chat/chat-context-indicator.tsx` | Контекст (repo + CCR) |

---

## 13. Onboarding

### Onboarding Wizard

> `pages/onboarding-wizard/onboarding-wizard.page.tsx` — `OnboardingWizardPage`

| Шаг | Файл |
|---|---|
| Provider Selection | `pages/onboarding-wizard/steps/provider-selection-step.tsx` |
| Repository Selection | `pages/onboarding-wizard/steps/repository-selection-step.tsx` |
| Scan Configuration | `pages/onboarding-wizard/steps/scan-configuration-step.tsx` |
| Bulk Scan Monitor | `pages/onboarding-wizard/steps/bulk-scan-jobs-monitor.tsx` |
| Steps Navigator | `pages/onboarding-wizard/steps/wizard-steps-navigator.tsx` |

Вспомогательные файлы:
- `pages/onboarding-wizard/onboarding-wizard-types.ts`
- `pages/onboarding-wizard/onboarding-wizard-schema.ts`
- `pages/onboarding-wizard/use-onboarding-wizard-state.ts`
- `pages/onboarding-wizard/onboarding-templates.ts`
- `pages/onboarding-wizard/bulk-repository-parser.ts`

### Activation Checklist

> `components/onboarding/activation-checklist.tsx` — `ActivationChecklist`

8 шагов до first value. Role-aware, прогресс %, persist.

---

## 14. Settings (9 консолидированных страниц + overview)

### Settings Hub

> `pages/settings.page.tsx` — `SettingsPage`

Grid из карточек-навигации по 4 группам настроек.

### Консолидированные страницы (HeroUI Tabs)

| # | Страница | Файл | Табы |
|---|---|---|---|
| 1 | **General** | `pages/settings-general.page.tsx` | Appearance, Notifications |
| 2 | **Code Review** | `pages/settings-code-review.page.tsx` | Settings, Rules Library |
| 3 | **Contract Validation** | `pages/settings-contract-validation/` | 6 секций |
| 4 | **Providers** | `pages/settings-providers.page.tsx` | LLM, Git, Keys (BYOK) |
| 5 | **Integrations** | `pages/settings-integrations.page.tsx` | Services, Webhooks |
| 6 | **Security** | `pages/settings-security.page.tsx` | Privacy, SSO, Audit Logs |
| 7 | **Operations** | `pages/settings-operations.page.tsx` | Health, Concurrency, Jobs |
| 8 | **Billing & Usage** | `pages/settings-billing.page.tsx` | Billing, Token Usage |
| 9 | **Organization** | `pages/settings-organization.page.tsx` | Profile, Team |

### Standalone settings компоненты (`components/settings/`)

| Компонент | Файл |
|---|---|
| CodeReviewForm | `components/settings/code-review-form.tsx` |
| IgnorePatternEditor | `components/settings/ignore-pattern-editor.tsx` |
| RuleEditor | `components/settings/rule-editor.tsx` |
| RuleEditorMarkdownPreview | `components/settings/rule-editor-markdown-preview.tsx` |
| SuggestionLimitConfig | `components/settings/suggestion-limit-config.tsx` |
| ReviewCadenceSelector | `components/settings/review-cadence-selector.tsx` |
| MCPToolList | `components/settings/mcp-tool-list.tsx` |
| PromptOverrideEditor | `components/settings/prompt-override-editor.tsx` |
| DryRunResultViewer | `components/settings/dry-run-result-viewer.tsx` |
| CCRSummaryPreview | `components/settings/ccr-summary-preview.tsx` |
| ConfigurationEditor | `components/settings/configuration-editor.tsx` |
| LlmProviderForm | `components/settings/llm-provider-form.tsx` |
| GitProvidersList | `components/settings/git-providers-list.tsx` |
| GitProviderCard | `components/settings/git-provider-card.tsx` |
| TestConnectionButton | `components/settings/test-connection-button.tsx` |
| ContextSourceCard | `components/settings/context-source-card.tsx` |
| ContextPreview | `components/settings/context-preview.tsx` |
| SettingsFormSchemas | `components/settings/settings-form-schemas.ts` |

### Contract Validation (подсистема)

| Секция | Файл |
|---|---|
| Contract | `pages/settings-contract-validation/sections/contract-section.tsx` |
| Blueprint | `pages/settings-contract-validation/sections/blueprint-section.tsx` |
| Drift Violations | `pages/settings-contract-validation/sections/drift-violations-section.tsx` |
| Drift Trend | `pages/settings-contract-validation/sections/drift-trend-section.tsx` |
| Drift Alerts | `pages/settings-contract-validation/sections/drift-alerts-section.tsx` |
| Guardrails | `pages/settings-contract-validation/sections/guardrails-section.tsx` |

Утилиты: types, validator, blueprint-parser, drift-analysis-utils, state hook, mock-data.

### Навигация settings

> `lib/navigation/settings-nav-items.tsx` — 4 группы, 9 items

| Группа | Items |
|---|---|
| Configuration | General, Code Review, Contract Validation |
| Providers | Providers, Integrations |
| Security | Security, Operations |
| Organization | Billing, Organization |

### Redirect'ы (обратная совместимость)

16 старых маршрутов (`/settings-appearance`, `/settings-llm-providers`, etc.) перенаправляют на консолидированные страницы.

---

## 15. Adoption Analytics

> `pages/settings-adoption-analytics.page.tsx` — `SettingsAdoptionAnalyticsPage`

Промоутирован из Settings в основную навигацию (группа Intelligence):

- Value realization KPIs: active users, median time to first value
- Adoption funnel (5 этапов): connect → add repo → first scan → first insights → first CCR reviewed
- Conversion + drop-off rates, workflow health per stage

---

## 16. Layout & Navigation

| Компонент | Файл | Роль |
|---|---|---|
| DashboardLayout | `components/layout/dashboard-layout.tsx` | Root layout: sidebar + content |
| Sidebar | `components/layout/sidebar.tsx` | Collapsible навигация |
| SidebarNav | `components/layout/sidebar-nav.tsx` | 4 группы + utility items |
| SidebarActions | `components/layout/sidebar-actions.tsx` | Search, notifications, theme |
| SidebarFooter | `components/layout/sidebar-footer.tsx` | Avatar, org switcher |
| ContentToolbar | `components/layout/content-toolbar.tsx` | Breadcrumbs, mobile menu |
| Header | `components/layout/header.tsx` | Legacy header |
| PageShell | `components/layout/page-shell.tsx` | Page wrapper |
| SettingsLayout | `components/layout/settings-layout.tsx` | 2-column settings layout |
| CommandPalette | `components/layout/command-palette.tsx` | Cmd+K глобальный поиск |
| MobileSidebar | `components/layout/mobile-sidebar.tsx` | Drawer для мобильной |
| BrandMark | `components/layout/brand-mark.tsx` | Лого |
| UserMenu | `components/layout/user-menu.tsx` | Avatar dropdown |
| ThemeModeToggle | `components/layout/theme-mode-toggle.tsx` | Dark/System/Light |
| ThemeToggle | `components/layout/theme-toggle.tsx` | Full theme switcher |
| NotificationAlerts | `components/layout/notification-alerts.tsx` | Alert stack |
| ShortcutsHelpModal | `components/layout/shortcuts-help-modal.tsx` | Modal шорткатов |
| SessionRecoveryModal | `components/layout/session-recovery-modal.tsx` | Re-auth при 401/419 |

Sidebar навигация:
```
My Work             /my-work
Dashboard           /

Reviews
  CCR Management    /reviews
  Issues            /issues

Repositories        /repositories

Intelligence
  CodeCity          /dashboard/code-city
  Reports           /reports
  Adoption Analytics /adoption-analytics

──────────
Settings            /settings
Help                /help-diagnostics
```

---

## 17. Infrastructure Components

| Компонент | Файл | Роль |
|---|---|---|
| SystemStateCard | `components/infrastructure/system-state-card.tsx` | Empty/error/loading states |
| DataFreshnessPanel | `components/infrastructure/data-freshness-panel.tsx` | Freshness + provenance |
| ExplainabilityPanel | `components/infrastructure/explainability-panel.tsx` | Signal explainability |

---

## 18. System Pages

| Страница | Файл | Роль |
|---|---|---|
| System Health | `pages/system-health.page.tsx` | Health check + feature flags |
| Help & Diagnostics | `pages/help-diagnostics.page.tsx` | Knowledge base + diagnostics |
| Session Recovery | `pages/session-recovery.page.tsx` | Re-auth flow |
| Scan Error Recovery | `pages/scan-error-recovery.page.tsx` | Scan failure recovery |

---

## 19. API Layer

### Endpoints

| Endpoint | Файл |
|---|---|
| Auth | `lib/api/endpoints/auth.endpoint.ts` |
| Code Review | `lib/api/endpoints/code-review.endpoint.ts` |
| CCR Summary | `lib/api/endpoints/ccr-summary.endpoint.ts` |
| CCR Workspace | `lib/api/endpoints/ccr-workspace.endpoint.ts` |
| Custom Rules | `lib/api/endpoints/custom-rules.endpoint.ts` |
| Dry Run | `lib/api/endpoints/dry-run.endpoint.ts` |
| External Context | `lib/api/endpoints/external-context.endpoint.ts` |
| Feature Flags | `lib/api/endpoints/feature-flags.endpoint.ts` |
| Git Providers | `lib/api/endpoints/git-providers.endpoint.ts` |
| Permissions | `lib/api/endpoints/permissions.endpoint.ts` |
| Repo Config | `lib/api/endpoints/repo-config.endpoint.ts` |
| System | `lib/api/endpoints/system.endpoint.ts` |

### Query Hooks (`lib/hooks/queries/`)

| Hook | Файл |
|---|---|
| useCodeReview | `lib/hooks/queries/use-code-review.ts` |
| useCcrSummary | `lib/hooks/queries/use-ccr-summary.ts` |
| useCcrWorkspace | `lib/hooks/queries/use-ccr-workspace.ts` |
| useDryRun | `lib/hooks/queries/use-dry-run.ts` |
| useExternalContext | `lib/hooks/queries/use-external-context.ts` |
| useFeatureFlagsQuery | `lib/hooks/queries/use-feature-flags-query.ts` |
| useGitProviders | `lib/hooks/queries/use-git-providers.ts` |
| usePermissionsQuery | `lib/hooks/queries/use-permissions-query.ts` |
| useReviewCadence | `lib/hooks/queries/use-review-cadence.ts` |
| useCustomRules | `lib/hooks/queries/use-custom-rules.ts` |
| useHealthQuery | `lib/hooks/queries/use-health-query.ts` |
| useRepoConfig | `lib/hooks/queries/use-repo-config.ts` |

### Custom Hooks

| Hook | Файл | Роль |
|---|---|---|
| useSSE | `lib/hooks/use-sse.ts` | SSE streaming + reconnection |
| usePolicyDrift | `lib/hooks/use-policy-drift.ts` | Policy drift detection |
| useOrganizationSwitcher | `lib/hooks/use-organization-switcher.ts` | Org switching |
| useProviderDegradation | `lib/hooks/use-provider-degradation.ts` | Provider health |
| useMultiTabSync | `lib/hooks/use-multi-tab-sync.ts` | Cross-tab sync |
| useDashboardShortcuts | `lib/hooks/use-dashboard-shortcuts.ts` | Keyboard shortcuts |
| useSessionRecovery | `lib/hooks/use-session-recovery.ts` | Session recovery |

### Infrastructure (`lib/`)

| Модуль | Файл | Роль |
|---|---|---|
| HTTP Client | `lib/api/http-client.ts` | Base HTTP client |
| API Config | `lib/api/config.ts` | API configuration |
| API Types | `lib/api/types.ts` | Shared API types |
| Query Client | `lib/query/query-client.ts` | TanStack Query setup |
| Query Keys | `lib/query/query-keys.ts` | Query key factory |
| Analytics SDK | `lib/analytics/analytics-sdk.ts` | Event tracking |
| Analytics Types | `lib/analytics/analytics-types.ts` | Analytics types |
| Analytics Context | `lib/analytics/analytics-context.tsx` | React context |
| Sentry | `lib/monitoring/sentry.ts` | Error monitoring |
| Web Vitals | `lib/monitoring/web-vitals.ts` | Performance metrics |
| Session Recovery | `lib/session/session-recovery.ts` | Session restore |
| Multi-tab Sync | `lib/sync/multi-tab-consistency.ts` | BroadcastChannel sync |
| Shortcut Registry | `lib/keyboard/shortcut-registry.ts` | Keyboard shortcuts |
| Schema Validation | `lib/validation/schema-validation.ts` | Zod validation |
| Toast | `lib/notifications/toast.ts` | Toast notifications |
| i18n | `lib/i18n/i18n.ts` | Internationalization |
| i18n Resources | `lib/i18n/i18n-resources.ts` | Translation resources |
| i18n Types | `lib/i18n/i18n-types.ts` | i18n types |
| useLocale | `lib/i18n/use-locale.ts` | Locale hook |
| useDynamicTranslation | `lib/i18n/use-dynamic-translation.ts` | Dynamic translation |
| Security Headers | `lib/security/security-headers.ts` | CSP/security headers |
| cn() utility | `lib/utils.ts` | CSS class merge |
| Generated Types | `lib/api/generated/index.ts` | OpenAPI types |

### Auth (`lib/auth/`)

| Модуль | Файл |
|---|---|
| AuthShell | `lib/auth/auth-shell.tsx` |
| AuthBoundary | `lib/auth/auth-boundary.tsx` |
| AuthAccess | `lib/auth/auth-access.tsx` |
| AuthLoginPanel | `lib/auth/auth-login-panel.tsx` |
| AuthSession | `lib/auth/auth-session.ts` |
| AuthHandlers | `lib/auth/auth-handlers.ts` |
| AuthRoleResolver | `lib/auth/auth-role-resolver.ts` |
| AuthStatus | `lib/auth/auth-status.ts` |
| AuthUrl | `lib/auth/auth-url.ts` |
| AuthLabels | `lib/auth/auth-labels.ts` |
| AuthTypes | `lib/auth/types.ts` |
| useAuthBoundaryState | `lib/auth/use-auth-boundary-state.ts` |

### Constants (`lib/constants/`)

| Файл | Роль |
|---|---|
| `lib/constants/animation.ts` | Анимационные токены |
| `lib/constants/chart-constants.ts` | Общие константы графиков |
| `lib/constants/chart-recharts-defaults.ts` | Дефолты Recharts |
| `lib/constants/codecity-colors.ts` | Палитра CodeCity |
| `lib/constants/graph-colors.ts` | Цвета dependency графов |
| `lib/constants/spacing.ts` | Spacing токены |
| `lib/constants/typography.ts` | Типографические токены |

### Прочие модули

| Область | Файл | Роль |
|---|---|---|
| Access | `lib/access/access-types.ts` | Типы ролей |
| Feature Flags | `lib/feature-flags/feature-flags.ts` | Feature flags |
| Deep Links | `lib/navigation/deep-link-guard.ts` | Валидация deep links |
| Route Guards | `lib/navigation/route-guard-map.ts` | Route → permission |
| Settings Nav | `lib/navigation/settings-nav-items.tsx` | Settings navigation |
| Permissions | `lib/permissions/permissions.ts` | Permission checks |
| Policy Drift | `lib/permissions/policy-drift.ts` | Policy drift |
| UI Policy | `lib/permissions/ui-policy.ts` | UI enforcement |
| Degradation | `lib/providers/degradation-mode.ts` | Provider degradation |
| Theme | `lib/theme/use-theme.ts` | Theme management |
| CCR Types | `lib/types/ccr-types.ts` | Shared CCR types |
| Safe JSON | `lib/utils/safe-json.ts` | Safe JSON parse |
| Safe Storage | `lib/utils/safe-storage.ts` | Safe localStorage |

---

## 20. Routing

> `routes/` — TanStack Router file-based routing (46 файлов)

| Route | Файл |
|---|---|
| Root Layout | `routes/__root.tsx` |
| Dashboard (index) | `routes/index.tsx` |
| CodeCity | `routes/dashboard.code-city.tsx` |
| Reviews List | `routes/reviews.index.tsx` |
| Reviews Layout | `routes/reviews.tsx` |
| Review Detail | `routes/reviews.$reviewId.tsx` |
| Repositories | `routes/repositories.tsx` |
| Repository Detail | `routes/repositories.$repositoryId.tsx` |
| Issues | `routes/issues.tsx` |
| My Work | `routes/my-work.tsx` |
| Reports | `routes/reports.tsx` |
| Report Generator | `routes/reports.generate.tsx` |
| Report Viewer | `routes/reports.viewer.tsx` |
| Onboarding | `routes/onboarding.tsx` |
| Adoption Analytics | `routes/adoption-analytics.tsx` |
| Settings Hub | `routes/settings.tsx` |
| Login | `routes/login.tsx` |
| System Health | `routes/system-health.tsx` |
| Help & Diagnostics | `routes/help-diagnostics.tsx` |
| Scan Progress | `routes/scan-progress.tsx` |
| Scan Error Recovery | `routes/scan-error-recovery.tsx` |
| Session Recovery | `routes/session-recovery.tsx` |
| 5 consolidated settings | `routes/settings-{general,providers,security,operations,code-review}.tsx` |
| Contract Validation | `routes/settings-contract-validation.tsx` |
| Integrations | `routes/settings-integrations.tsx` |
| Billing | `routes/settings-billing.tsx` |
| Organization | `routes/settings-organization.tsx` |
| 16 redirect routes | `routes/settings-{appearance,notifications,...}.tsx` |

---

## 21. App Shell & Entry Point

| Файл | Роль |
|---|---|
| `main.tsx` | Entry point: Sentry, i18n, Web Vitals, ReactDOM |
| `vite-env.d.ts` | Vite type declarations |
| `app/globals.css` | Глобальные CSS (Tailwind) |
| `app/app.tsx` | Root: QueryClient + Theme + Router + Analytics + Toast |
| `app/router.ts` | TanStack Router instance |
| `app/error-fallback.tsx` | Error boundary fallback |
| `app/route-suspense-fallback.tsx` | Suspense fallback |

---

## 22. Иконки

> `components/icons/app-icons.ts` — централизованный реестр Lucide-иконок (49 иконок)

---

## 23. Dev Mocks (MSW)

| Файл | Роль |
|---|---|
| `mocks/handlers.ts` | MSW request handlers |
| `mocks/browser.ts` | MSW browser worker |

---

## Сводка: что продукт даёт пользователю

| Возможность | Ключевые страницы |
|---|---|
| AI Code Review (20-stage pipeline + SafeGuard) | CCR Management, CCR Detail |
| Визуализация кода (3D CodeCity + 4 графа + 6 оверлеев) | CodeCity Dashboard, Repository Overview |
| Предсказание проблем (Prediction + What-If + Simulation) | CodeCity (prediction section) |
| Командная аналитика (Leaderboard + Bus Factor + Knowledge) | CodeCity (ownership/gamification) |
| Triage Hub (SLA-aware с escalation) | My Work |
| Отчёты (Generate + Schedule + AI Summary) | Reports (3 страницы) |
| AI Agent (Contextual chat + streaming) | Chat (в CCR Detail) |
| Multi-provider (4 Git + 5 LLM + 4 Context + 5 Notification) | Settings Providers, Integrations |
| Enterprise Controls (SSO + RBAC + Audit + BYOK + Privacy) | Settings Security, Organization |
| Onboarding (Wizard + Activation Checklist) | Onboarding, Dashboard |
| Infrastructure (Health + Diagnostics + Session Recovery) | System (4 страницы) |
| Adoption Analytics (Funnel + KPIs + Health) | Adoption Analytics |

**Итого: ~390 файлов (.ts/.tsx), 25 основных страниц, 9 settings (consolidated), 12 API endpoints, 12 query hooks, 7 custom hooks.**

**Компоненты по домену:**
- `codecity/` — 24 файла
- `dependency-graphs/` — 9 файлов
- `predictions/` — 11 файлов
- `refactoring/` — 4 файла
- `team-analytics/` — 10 файлов
- `dashboard/` — 15 файлов
- `layout/` — 21 файл
- `settings/` — 18 файлов
- `chat/` — 7 файлов
- `reviews/` — 7 файлов
