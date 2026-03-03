import type { IChatPanelContext } from "@/components/chat/chat-panel"
import { type TReviewStatus } from "@/components/reviews/review-status-badge"

/** Уровень важности CCR. */
export type TCcrSeverity = "low" | "medium" | "high"

/** Модель строки CCR для UI-экранов review. */
export interface ICcrRowData {
    /** Идентификатор CCR. */
    readonly id: string
    /** Заголовок/тема. */
    readonly title: string
    /** Репозиторий. */
    readonly repository: string
    /** Владелец. */
    readonly assignee: string
    /** Статус. */
    readonly status: TReviewStatus
    /** Количество комментариев. */
    readonly comments: number
    /** Обновление. */
    readonly updatedAt: string
    /** Команда. */
    readonly team: string
    /** Уровень критичности. */
    readonly severity: TCcrSeverity
    /** Прикреплённые файлы. */
    readonly attachedFiles: ReadonlyArray<string>
}

/**
 * Mock CCR-данные для UI-экранов review.
 */
export const MOCK_CCR_ROWS: ReadonlyArray<ICcrRowData> = [
    {
        assignee: "Ari",
        comments: 12,
        id: "ccr-9001",
        repository: "repo-core",
        severity: "high",
        status: "new",
        team: "runtime",
        title: "Refactor auth middleware",
        updatedAt: "2026-03-01 10:12",
        attachedFiles: ["src/auth/index.ts", "src/auth/middleware.ts"],
    },
    {
        assignee: "Nika",
        comments: 3,
        id: "ccr-9002",
        repository: "repo-ui",
        severity: "medium",
        status: "queued",
        team: "frontend",
        title: "Add retry policy for scanner",
        updatedAt: "2026-03-01 09:40",
        attachedFiles: ["src/scanner/index.ts", "src/scanner/retry.ts"],
    },
    {
        assignee: "Ari",
        comments: 9,
        id: "ccr-9003",
        repository: "repo-mobile",
        severity: "low",
        status: "in_progress",
        team: "mobile",
        title: "Fix memory leaks in stream parser",
        updatedAt: "2026-02-28 19:18",
        attachedFiles: ["src/stream/reader.ts", "src/stream/lexer.ts"],
    },
    {
        assignee: "Sari",
        comments: 4,
        id: "ccr-9004",
        repository: "repo-core",
        severity: "medium",
        status: "approved",
        team: "runtime",
        title: "Tune telemetry export window",
        updatedAt: "2026-02-28 16:10",
        attachedFiles: ["src/telemetry/exporter.ts", "src/telemetry/runner.ts"],
    },
    {
        assignee: "Nika",
        comments: 13,
        id: "ccr-9005",
        repository: "repo-ui",
        severity: "high",
        status: "rejected",
        team: "frontend",
        title: "Large bundle regression",
        updatedAt: "2026-02-28 12:43",
        attachedFiles: ["packages/ui/bundle.config.ts", "packages/ui/webpack.config.ts"],
    },
    {
        assignee: "Oleg",
        comments: 2,
        id: "ccr-9006",
        repository: "repo-api",
        severity: "low",
        status: "in_progress",
        team: "backend",
        title: "Endpoint contract drift",
        updatedAt: "2026-02-27 14:20",
        attachedFiles: ["src/api/contracts/user.ts", "src/api/contracts/review.ts"],
    },
    {
        assignee: "Mila",
        comments: 1,
        id: "ccr-9007",
        repository: "repo-api",
        severity: "high",
        status: "new",
        team: "backend",
        title: "Critical auth edge-case",
        updatedAt: "2026-02-27 11:01",
        attachedFiles: ["src/auth/token.ts", "src/auth/middleware.ts", "src/auth/refresh.ts"],
    },
    {
        assignee: "Ari",
        comments: 5,
        id: "ccr-9008",
        repository: "repo-data",
        severity: "medium",
        status: "queued",
        team: "data",
        title: "Optimize graph traversal path",
        updatedAt: "2026-02-26 17:30",
        attachedFiles: ["src/data/graph.ts", "src/data/shortest-path.ts"],
    },
    {
        assignee: "Nika",
        comments: 6,
        id: "ccr-9009",
        repository: "repo-core",
        severity: "low",
        status: "new",
        team: "runtime",
        title: "Clean up deprecated API docs",
        updatedAt: "2026-02-26 10:12",
        attachedFiles: ["docs/api/legacy.md", "docs/api/overview.md"],
    },
    {
        assignee: "Mila",
        comments: 2,
        id: "ccr-9010",
        repository: "repo-data",
        severity: "medium",
        status: "approved",
        team: "data",
        title: "Rework data contract validation",
        updatedAt: "2026-02-25 09:45",
        attachedFiles: ["src/data/validation.ts", "src/data/schema.ts"],
    },
]

/**
 * Найти CCR по идентификатору.
 *
 * @param id Идентификатор CCR.
 * @returns CCR-строка или undefined.
 */
export function getCcrById(id: string): ICcrRowData | undefined {
    return MOCK_CCR_ROWS.find((ccr): boolean => ccr.id === id)
}

/**
 * Преобразовать CCR в контекст для chat-panel.
 *
 * @param ccr Данные CCR.
 * @returns Контекст чата.
 */
export function ccrToContextItem(ccr: ICcrRowData): IChatPanelContext {
    return {
        attachedFiles: ccr.attachedFiles,
        ccrNumber: ccr.id.replace("ccr-", ""),
        id: ccr.id,
        repoName: ccr.repository,
    }
}
