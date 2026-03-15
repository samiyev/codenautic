import type { IRepository } from "@/lib/api/endpoints/repository.endpoint"

import type { RepositoriesCollection } from "../collections/repositories-collection"

/**
 * Seed-репозиторий: codenautic-api.
 */
const REPO_API: IRepository = {
    id: "repo-1",
    name: "codenautic-api",
    owner: "codenautic",
    defaultBranch: "main",
    lastScanAt: "2026-03-14T10:40:00Z",
    status: "ready",
    issueCount: 12,
    healthScore: 82,
}

/**
 * Seed-репозиторий: codenautic-ui.
 */
const REPO_UI: IRepository = {
    id: "repo-2",
    name: "codenautic-ui",
    owner: "codenautic",
    defaultBranch: "main",
    lastScanAt: "2026-03-14T14:20:00Z",
    status: "ready",
    issueCount: 5,
    healthScore: 91,
}

/**
 * Seed-репозиторий: codenautic-docs.
 */
const REPO_DOCS: IRepository = {
    id: "repo-3",
    name: "codenautic-docs",
    owner: "codenautic",
    defaultBranch: "main",
    lastScanAt: "2026-03-15T08:00:00Z",
    status: "scanning",
    issueCount: 18,
    healthScore: 67,
}

/**
 * Начальный набор репозиториев.
 */
const SEED_REPOSITORIES: ReadonlyArray<IRepository> = [REPO_API, REPO_UI, REPO_DOCS]

/**
 * Seed overview для codenautic-api.
 */
const OVERVIEW_REPO_1 = {
    repositoryId: "repo-1",
    overview: {
        repository: REPO_API,
        architectureSummary: [
            {
                area: "API gateway",
                risk: "low" as const,
                summary:
                    "Входящий слой разделяет traffic и выполняет базовую auth-схему " +
                    "через OIDC без регрессионных точек.",
            },
            {
                area: "Workers",
                risk: "high" as const,
                summary:
                    "Найдены циклические зависимости между job-координатором и queue adapter; " +
                    "требует выделить контракт.",
            },
            {
                area: "Data layer",
                risk: "low" as const,
                summary: "Слой хранения стабилен, покрытие миграций выше 80%.",
            },
        ],
        keyMetrics: [
            {
                id: "critical-issues",
                label: "Critical issues",
                value: "3",
                caption: "Последняя проверка показала 3 critical item",
                trendDirection: "up" as const,
                trendLabel: "-1",
            },
            {
                id: "architecture-debt",
                label: "Architecture debt score",
                value: "18",
                caption: "Изменения в architecture debt",
                trendDirection: "up" as const,
                trendLabel: "+6%",
            },
            {
                id: "typed-files",
                label: "Type-covered files",
                value: "1120",
                caption: "Риск-файлов по линтингу и тайпингу",
                trendDirection: "neutral" as const,
                trendLabel: "Stable",
            },
            {
                id: "notification-latency",
                label: "Median latency",
                value: "0.9s",
                caption: "Текущий уровень уведомлений",
                trendDirection: "down" as const,
                trendLabel: "-12%",
            },
        ],
        techStack: [
            { name: "Bun", version: "1.2", note: "Runtime: серверная обвязка API" },
            { name: "NestJS", version: "11", note: "HTTP API и DI-контейнер" },
            { name: "MongoDB", version: "8", note: "Persistent storage" },
        ],
        healthScore: 82,
    },
}

/**
 * Seed overview для codenautic-ui.
 */
const OVERVIEW_REPO_2 = {
    repositoryId: "repo-2",
    overview: {
        repository: REPO_UI,
        architectureSummary: [
            {
                area: "Frontend shell",
                risk: "low" as const,
                summary:
                    "Модульный подход сохранен, критические цепочки " +
                    "в UI не перегружены.",
            },
            {
                area: "State management",
                risk: "low" as const,
                summary:
                    "Server state через React Query, нет глобальных store " +
                    "с mutation-проблемами.",
            },
            {
                area: "Build",
                risk: "low" as const,
                summary:
                    "CI pipeline детерминированен, flaky tests отсутствуют " +
                    "в последних 7 днях.",
            },
        ],
        keyMetrics: [
            {
                id: "component-count",
                label: "Components",
                value: "64",
                caption: "Количество React-компонентов",
                trendDirection: "up" as const,
                trendLabel: "+4",
            },
            {
                id: "test-coverage",
                label: "Test coverage",
                value: "94%",
                caption: "Покрытие тестами",
                trendDirection: "up" as const,
                trendLabel: "+2%",
            },
            {
                id: "bundle-size",
                label: "Bundle size",
                value: "312 KB",
                caption: "Размер production bundle",
                trendDirection: "down" as const,
                trendLabel: "-8%",
            },
            {
                id: "accessibility",
                label: "A11y score",
                value: "97",
                caption: "Accessibility compliance",
                trendDirection: "neutral" as const,
                trendLabel: "Stable",
            },
        ],
        techStack: [
            { name: "Vite", version: "7", note: "Сборка и dev-сервер" },
            { name: "React", version: "19", note: "UI framework" },
            { name: "TanStack Router", version: "1", note: "Маршрутизация" },
        ],
        healthScore: 91,
    },
}

/**
 * Seed overview для codenautic-docs.
 */
const OVERVIEW_REPO_3 = {
    repositoryId: "repo-3",
    overview: {
        repository: REPO_DOCS,
        architectureSummary: [
            {
                area: "Content structure",
                risk: "high" as const,
                summary:
                    "Обнаружены дублирующиеся секции между API docs и guide; " +
                    "требуется консолидация.",
            },
            {
                area: "Build pipeline",
                risk: "low" as const,
                summary: "Сборка через VitePress стабильна, время билда под 30с.",
            },
        ],
        keyMetrics: [
            {
                id: "page-count",
                label: "Pages",
                value: "142",
                caption: "Количество страниц документации",
                trendDirection: "up" as const,
                trendLabel: "+12",
            },
            {
                id: "broken-links",
                label: "Broken links",
                value: "7",
                caption: "Недействительные ссылки",
                trendDirection: "up" as const,
                trendLabel: "+3",
            },
            {
                id: "last-update",
                label: "Last content update",
                value: "2d ago",
                caption: "Время с последнего обновления",
                trendDirection: "neutral" as const,
                trendLabel: "Active",
            },
        ],
        techStack: [
            { name: "VitePress", version: "1.6", note: "Static site generator" },
            { name: "Markdown", version: "—", note: "Формат контента" },
        ],
        healthScore: 67,
    },
}

/**
 * Заполняет repositories-коллекцию начальным набором данных.
 *
 * Загружает 3 репозитория с overview-профилями.
 *
 * @param repositories - Коллекция репозиториев для заполнения.
 */
export function seedRepositories(repositories: RepositoriesCollection): void {
    repositories.seed({
        repositories: SEED_REPOSITORIES,
        overviews: [OVERVIEW_REPO_1, OVERVIEW_REPO_2, OVERVIEW_REPO_3],
    })
}
