import { type ReactElement, useMemo, useRef, useState } from "react"
import { Link } from "@tanstack/react-router"
import { useVirtualizer } from "@tanstack/react-virtual"

import { useDebounce } from "@/lib/hooks/use-debounce"
import { InfiniteScrollContainer } from "@/components/infrastructure/infinite-scroll-container"
import { ReviewsFilters } from "./reviews-filters"
import { type IReviewRow } from "./reviews-table"
import { ReviewStatusBadge } from "./review-status-badge"
import { type TReviewStatus } from "./review-status-badge"

/**
 * Параметры списка CCR.
 */
export interface IReviewsContentProps {
    /** Исходный список CCR. */
    readonly rows: ReadonlyArray<IReviewRow>
    /** Есть ли ещё страницы. */
    readonly hasMore: boolean
    /** Идёт ли фоновая подгрузка. */
    readonly isLoadingMore: boolean
    /** Callback для подгрузки следующего чанка. */
    readonly onLoadMore: () => Promise<void> | void
}

/**
 * Секция управления CCR в стиле mission control.
 */
export function ReviewsContent(props: IReviewsContentProps): ReactElement {
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState<string>("all")
    const [assigneeFilter, setAssigneeFilter] = useState<string>("all")
    const listRef = useRef<HTMLDivElement | null>(null)
    const debouncedSearch = useDebounce(search, 220)

    const statusOptions = useMemo((): string[] => {
        const statuses = new Set<string>()
        for (const row of props.rows) {
            statuses.add(row.status)
        }
        return Array.from(statuses).sort()
    }, [props.rows])

    const assigneeOptions = useMemo((): string[] => {
        const assignees = new Set<string>()
        for (const row of props.rows) {
            assignees.add(row.assignee)
        }
        return Array.from(assignees).sort()
    }, [props.rows])

    const filteredRows = useMemo((): readonly IReviewRow[] => {
        return props.rows.filter((row): boolean => {
            const searchNormalized = debouncedSearch.trim().toLowerCase()
            const statusMatches = statusFilter === "all" || row.status === statusFilter
            const assigneeMatches = assigneeFilter === "all" || row.assignee === assigneeFilter
            const textMatches =
                searchNormalized.length === 0 ||
                row.id.toLowerCase().includes(searchNormalized) ||
                row.title.toLowerCase().includes(searchNormalized) ||
                row.repository.toLowerCase().includes(searchNormalized)
            return statusMatches && assigneeMatches && textMatches
        })
    }, [assigneeFilter, debouncedSearch, props.rows, statusFilter])

    const hasActiveFilter =
        statusFilter !== "all" || assigneeFilter !== "all" || debouncedSearch.trim().length > 0
    const rowVirtualizer = useVirtualizer({
        count: filteredRows.length,
        getScrollElement: (): HTMLDivElement | null => listRef.current,
        estimateSize: (): number => 84,
        overscan: 8,
    })
    const virtualRows = rowVirtualizer.getVirtualItems()

    return (
        <section className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-900">CCR Management</h2>
            <ReviewsFilters
                assignee={assigneeFilter}
                assigneeOptions={assigneeOptions}
                search={search}
                status={statusFilter}
                statusOptions={statusOptions}
                onAssigneeChange={setAssigneeFilter}
                onReset={(): void => {
                    setSearch("")
                    setStatusFilter("all")
                    setAssigneeFilter("all")
                }}
                onSearchChange={setSearch}
                onStatusChange={setStatusFilter}
            />
            {hasActiveFilter ? (
                <p className="text-sm text-slate-600">
                    Showing {filteredRows.length} from {props.rows.length} CCR entries.
                </p>
            ) : null}
            <InfiniteScrollContainer
                hasMore={props.hasMore}
                isLoading={props.isLoadingMore}
                loadingText="Подгружаем дополнительные CCR..."
                onLoadMore={props.onLoadMore}
                rootRef={listRef}
            >
                <div
                    ref={listRef}
                    className="max-h-[560px] overflow-auto rounded-lg border border-slate-200 bg-white"
                >
                    <div
                        className="relative"
                        style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
                    >
                        {virtualRows.map((virtualRow): ReactElement | null => {
                            const row = filteredRows[virtualRow.index]
                            if (row === undefined) {
                                return null
                            }

                            return (
                                <article
                                    className="absolute left-0 top-0 w-full border-b border-slate-100 px-4 py-3"
                                    key={row.id}
                                    style={{
                                        height: `${virtualRow.size}px`,
                                        transform: `translateY(${virtualRow.start}px)`,
                                    }}
                                >
                                    <div className="grid gap-2 md:grid-cols-[120px_1.8fr_1fr_1fr_80px_110px_110px] md:items-center">
                                        <Link
                                            className="text-sm font-semibold text-slate-900 underline underline-offset-4"
                                            to={`/reviews/${row.id}`}
                                        >
                                            {row.id}
                                        </Link>
                                        <p className="text-sm text-slate-800">{row.title}</p>
                                        <p className="text-sm text-slate-700">{row.repository}</p>
                                        <p className="text-sm text-slate-700">{row.assignee}</p>
                                        <p className="text-sm text-slate-700">{row.comments}</p>
                                        <p className="text-sm text-slate-700">{row.updatedAt}</p>
                                        <ReviewStatusBadge status={row.status} />
                                    </div>
                                </article>
                            )
                        })}
                    </div>
                </div>
            </InfiniteScrollContainer>
        </section>
    )
}

/**
 * Тип статуса для удобства сборки фильтров.
 */
export type { TReviewStatus }
export type { IReviewRow } from "./reviews-table"
