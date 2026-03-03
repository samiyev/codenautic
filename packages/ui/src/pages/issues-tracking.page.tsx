import { useMemo, useState, type ChangeEvent, type ReactElement } from "react"

import { Button, Card, CardBody, CardHeader } from "@/components/ui"
import { useVirtualizedList } from "@/lib/hooks/use-virtualized-list"

type TIssueTrackingAction = "acknowledge" | "fix" | "snooze" | "ignore"
type TIssueTrackingSeverity = "critical" | "high" | "medium" | "low"
type TIssueTrackingStatus = "dismissed" | "fixed" | "in_progress" | "open"

interface IIssueTrackingIssue {
    /** Уникальный идентификатор проблемы. */
    readonly id: string
    /** Заголовок / краткое описание проблемы. */
    readonly title: string
    /** Репозиторий с проблемой. */
    readonly repository: string
    /** Путь к файлу, где обнаружена проблема. */
    readonly filePath: string
    /** Уровень критичности. */
    readonly severity: TIssueTrackingSeverity
    /** Статус решения. */
    readonly status: TIssueTrackingStatus
    /** Короткий комментарий о типе сигнала. */
    readonly message: string
    /** Отвечающий коллега. */
    readonly owner: string
    /** Время обнаружения. */
    readonly detectedAt: string
}

interface IIssueTrackingPageProps {
    /** Набор issues для отображения (для тестов и интеграции с API). */
    readonly issues?: ReadonlyArray<IIssueTrackingIssue>
    /** Сallback выполнения inline действия. */
    readonly onAction?: (issueId: string, action: TIssueTrackingAction) => void
}

const ISSUE_STATUS_OPTIONS = ["open", "in_progress", "fixed", "dismissed"] as const
const ISSUE_SEVERITY_OPTIONS = ["critical", "high", "medium", "low"] as const

const ISSUE_ACTIONS_BY_STATUS: Record<
    TIssueTrackingStatus,
    ReadonlyArray<TIssueTrackingAction>
> = {
    dismissed: ["acknowledge"],
    fixed: ["acknowledge"],
    in_progress: ["acknowledge", "snooze", "fix"],
    open: ["acknowledge", "snooze", "fix", "ignore"],
}

const ISSUE_ACTION_LABELS: Record<TIssueTrackingAction, string> = {
    acknowledge: "Acknowledge",
    fix: "Mark fixed",
    ignore: "Ignore",
    snooze: "Snooze",
}

const ISSUE_SEVERITY_LABELS: Record<TIssueTrackingSeverity, string> = {
    critical: "Critical",
    high: "High",
    low: "Low",
    medium: "Medium",
}

const ISSUE_STATUS_LABELS: Record<TIssueTrackingStatus, string> = {
    dismissed: "Dismissed",
    fixed: "Fixed",
    in_progress: "In progress",
    open: "Open",
}

const ISSUE_STATUS_STYLES: Record<TIssueTrackingStatus, string> = {
    dismissed: "bg-slate-100 text-slate-700",
    fixed: "bg-emerald-100 text-emerald-700",
    in_progress: "bg-blue-100 text-blue-700",
    open: "bg-rose-100 text-rose-700",
}

const ISSUE_SEVERITY_STYLES: Record<TIssueTrackingSeverity, string> = {
    critical: "bg-rose-100 text-rose-700 border border-rose-200",
    high: "bg-amber-100 text-amber-700 border border-amber-200",
    low: "bg-sky-100 text-sky-700 border border-sky-200",
    medium: "bg-violet-100 text-violet-700 border border-violet-200",
}

const DEFAULT_ISSUES: ReadonlyArray<IIssueTrackingIssue> = [
    {
        detectedAt: "2026-01-12T07:11:00Z",
        filePath: "src/api/repository.ts",
        id: "ISS-101",
        message: "Unhandled error path near data parser",
        owner: "Alice",
        repository: "platform-team/api-gateway",
        severity: "critical",
        status: "open",
        title: "Possible unguarded parse fallback",
    },
    {
        detectedAt: "2026-01-14T13:32:00Z",
        filePath: "src/components/chat-panel.tsx",
        id: "ISS-102",
        message: "Potential DOM injection in dynamic markdown renderer",
        owner: "Bob",
        repository: "frontend-team/ui-dashboard",
        severity: "high",
        status: "in_progress",
        title: "Dynamic markdown requires re-check",
    },
    {
        detectedAt: "2026-01-17T09:21:00Z",
        filePath: "src/workers/scan.ts",
        id: "ISS-103",
        message: "High churn + low review ratio in queue handler",
        owner: "Cara",
        repository: "backend-core/payment-worker",
        severity: "medium",
        status: "fixed",
        title: "Scan queue stability issue",
    },
    {
        detectedAt: "2026-01-18T16:58:00Z",
        filePath: "src/pages/reviews.tsx",
        id: "ISS-104",
        message: "Unstable key usage in virtualized list",
        owner: "Dan",
        repository: "frontend-team/ui-dashboard",
        severity: "low",
        status: "dismissed",
        title: "Virtualization key fallback",
    },
]

const EXTRA_ISSUES: ReadonlyArray<IIssueTrackingIssue> = Array.from(Array(26)).map(
    (_entry, index): IIssueTrackingIssue => {
        const id = `ISS-${String(index + 105)}`
        const repoOptions: ReadonlyArray<string> = [
            "platform-team/api-gateway",
            "frontend-team/ui-dashboard",
            "backend-core/payment-worker",
        ]
        const severityOptions: ReadonlyArray<TIssueTrackingSeverity> = [
            "critical",
            "high",
            "medium",
            "low",
        ]
        const statusOptions: ReadonlyArray<TIssueTrackingStatus> = [
            "open",
            "in_progress",
            "fixed",
            "dismissed",
        ]
        const selectedRepo = repoOptions[index % repoOptions.length]
        const selectedSeverity = severityOptions[index % severityOptions.length]
        const selectedStatus = statusOptions[index % statusOptions.length]

        return {
            detectedAt: `2026-01-${String(19 + index).padStart(2, "0")}T11:00:00Z`,
            filePath: `src/services/module-${String(index)}.ts`,
            id,
            message: `Auto-discovered pattern in module ${String(index)}`,
            owner: `Owner ${String(index % 6)}`,
            repository: selectedRepo,
            severity: selectedSeverity,
            status: selectedStatus,
            title: `Generated issue ${String(index)}`,
        }
    },
)

const ALL_ISSUES: ReadonlyArray<IIssueTrackingIssue> = [...DEFAULT_ISSUES, ...EXTRA_ISSUES]

interface IIssueTrackingFilters {
    /** Поиск по тексту/файлу/репозиторию. */
    readonly search: string
    /** Фильтр по статусу. */
    readonly status: "all" | TIssueTrackingStatus
    /** Фильтр по критичности. */
    readonly severity: "all" | TIssueTrackingSeverity
}

function normalize(value: string): string {
    return value.trim().toLowerCase()
}

function filterIssues(
    issues: ReadonlyArray<IIssueTrackingIssue>,
    filters: IIssueTrackingFilters,
): ReadonlyArray<IIssueTrackingIssue> {
    const query = normalize(filters.search)
    return issues.filter((entry): boolean => {
        const isStatusMatch =
            filters.status === "all" || entry.status === filters.status
        const isSeverityMatch =
            filters.severity === "all" || entry.severity === filters.severity
        const isSearchMatch =
            query.length === 0 ||
            normalize(entry.id).includes(query) ||
            normalize(entry.title).includes(query) ||
            normalize(entry.repository).includes(query) ||
            normalize(entry.filePath).includes(query)

        return isStatusMatch && isSeverityMatch && isSearchMatch
    })
}

type IIssueTrackingFilterField = keyof IIssueTrackingFilters

function formatIssueDate(raw: string): string {
    const date = new Date(raw)
    if (Number.isNaN(date.getTime())) {
        return "—"
    }

    return date.toLocaleString([], {
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        month: "2-digit",
        year: "2-digit",
    })
}

/**
 * Страница issues tracking с фильтрами и virtual-scrolling списком.
 *
 * @param props Набор issues и колбеки для действий.
 * @returns Страница.
 */
export function IssuesTrackingPage(props: IIssueTrackingPageProps = {}): ReactElement {
    const sourceIssues = props.issues ?? ALL_ISSUES
    const [filters, setFilters] = useState<IIssueTrackingFilters>({
        search: "",
        severity: "all",
        status: "all",
    })

    const filteredIssues = useMemo(
        () => filterIssues(sourceIssues, filters),
        [sourceIssues, filters],
    )

    const virtualizer = useVirtualizedList({
        count: filteredIssues.length,
        estimateSize: (): number => 96,
        overscan: 6,
    })

    const handleFilterChange = (name: IIssueTrackingFilterField, value: string): void => {
        if (name === "severity") {
            setFilters((previousValue): IIssueTrackingFilters => {
                if (value === "all") {
                    return {
                        ...previousValue,
                        severity: "all",
                    }
                }

                if (
                    value === "critical" ||
                    value === "high" ||
                    value === "low" ||
                    value === "medium"
                ) {
                    return {
                        ...previousValue,
                        severity: value,
                    }
                }

                return previousValue
            })
            return
        }

        if (name === "status") {
            setFilters((previousValue): IIssueTrackingFilters => {
                if (value === "all") {
                    return {
                        ...previousValue,
                        status: "all",
                    }
                }

                if (
                    value === "open" ||
                    value === "in_progress" ||
                    value === "fixed" ||
                    value === "dismissed"
                ) {
                    return {
                        ...previousValue,
                        status: value,
                    }
                }

                return previousValue
            })
            return
        }

        if (name === "search") {
            setFilters((previousValue): IIssueTrackingFilters => ({
                ...previousValue,
                search: value,
            }))
        }
    }

    const handleSearchChange = (event: ChangeEvent<HTMLInputElement>): void => {
        handleFilterChange("search", event.currentTarget.value)
    }

    const handleSelectChange = (event: ChangeEvent<HTMLSelectElement>): void => {
        const name = event.currentTarget.name
        const value = event.currentTarget.value

        if (name === "severity" || name === "status") {
            handleFilterChange(name, value)
        }
    }

    const handleAction = (issue: IIssueTrackingIssue, action: TIssueTrackingAction): void => {
        props.onAction?.(issue.id, action)
    }

    return (
        <section className="space-y-4">
            <h1 className="text-2xl font-semibold text-slate-900">Issues tracking</h1>
            <Card>
                <CardHeader>
                    <p className="text-sm font-semibold text-slate-900">Issues tracking</p>
                </CardHeader>
                <CardBody className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-4">
                        <input
                            aria-label="Search issues"
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            placeholder="Search by id, title, repo or file"
                            value={filters.search}
                            onChange={handleSearchChange}
                        />
                        <select
                            aria-label="Filter by status"
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            name="status"
                            value={filters.status}
                            onChange={handleSelectChange}
                        >
                            <option value="all">All statuses</option>
                            {ISSUE_STATUS_OPTIONS.map((status): ReactElement => (
                                <option key={status} value={status}>
                                    {ISSUE_STATUS_LABELS[status]}
                                </option>
                            ))}
                        </select>
                        <select
                            aria-label="Filter by severity"
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            name="severity"
                            value={filters.severity}
                            onChange={handleSelectChange}
                        >
                            <option value="all">All severities</option>
                            {ISSUE_SEVERITY_OPTIONS.map((severity): ReactElement => (
                                <option key={severity} value={severity}>
                                    {ISSUE_SEVERITY_LABELS[severity]}
                                </option>
                            ))}
                        </select>
                        <p className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                            {String(filteredIssues.length)} of {String(sourceIssues.length)} issues
                        </p>
                    </div>
                </CardBody>
            </Card>

            <Card>
                <CardBody className="space-y-2">
                    <h2 className="text-sm font-semibold text-slate-900">Issue list</h2>
                    {filteredIssues.length === 0 ? (
                        <p className="rounded-lg border border-slate-200 p-3 text-sm text-slate-600">
                            No issues found for selected filters.
                        </p>
                    ) : (
                        <div
                            aria-label="Issue list"
                            role="list"
                            className="relative h-96 overflow-auto border border-slate-200 rounded-md"
                            ref={virtualizer.parentRef}
                        >
                            <div style={{ height: `${virtualizer.totalSize}px` }} className="relative">
                                {virtualizer.virtualItems.map((virtualItem): ReactElement => {
                                    const issue = filteredIssues.at(virtualItem.index)
                                    if (issue === undefined) {
                                        return <></>
                                    }

                                    return (
                                        <article
                                            aria-label={`Issue ${issue.id}`}
                                            key={issue.id}
                                            role="listitem"
                                            style={virtualizer.getItemStyle(virtualItem)}
                                            className="border-b border-slate-100 px-3 py-2"
                                        >
                                            <p className="text-sm font-semibold text-slate-900">
                                                {issue.id} — {issue.title}
                                            </p>
                                            <p className="text-xs text-slate-600">{issue.message}</p>
                                            <p className="text-xs text-slate-600">
                                                {issue.repository} · {issue.filePath} · owner: {issue.owner} ·{" "}
                                                {formatIssueDate(issue.detectedAt)}
                                            </p>
                                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                                <span
                                                    className={`rounded-full px-2 py-0.5 text-xs ${ISSUE_STATUS_STYLES[issue.status]}`}
                                                >
                                                    {ISSUE_STATUS_LABELS[issue.status]}
                                                </span>
                                                <span
                                                    className={`rounded-full border px-2 py-0.5 text-xs ${ISSUE_SEVERITY_STYLES[issue.severity]}`}
                                                >
                                                    {ISSUE_SEVERITY_LABELS[issue.severity]}
                                                </span>
                                                {ISSUE_ACTIONS_BY_STATUS[issue.status].map((action): ReactElement => (
                                                    <Button
                                                        aria-label={`${action} issue ${issue.id}`}
                                                        key={`${issue.id}-${action}`}
                                                        size="sm"
                                                        variant="light"
                                                        onPress={(): void => {
                                                            handleAction(issue, action)
                                                        }}
                                                    >
                                                        {ISSUE_ACTION_LABELS[action]}
                                                    </Button>
                                                ))}
                                            </div>
                                        </article>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </CardBody>
            </Card>
        </section>
    )
}
