import {
    type KeyboardEvent,
    type ReactElement,
    type UIEvent,
    useMemo,
    useRef,
    useState,
} from "react"
import { useTranslation } from "react-i18next"

import {
    type ColumnDef,
    type ColumnOrderState,
    type ColumnPinningState,
    type ColumnSizingState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getSortedRowModel,
    type RowSelectionState,
    type VisibilityState,
    useReactTable,
} from "@tanstack/react-table"
import { useVirtualizer } from "@tanstack/react-virtual"

import { Button, Chip } from "@/components/ui"
import { ColumnCard } from "./enterprise-data-table-column-card"

type TDensity = "comfortable" | "compact"

interface IEnterpriseDataTableColumn<TRow> {
    /** Уникальный идентификатор колонки. */
    readonly id: string
    /** Заголовок колонки. */
    readonly header: string
    /** Доступ к ячейке как plain value для фильтрации/экспорта. */
    readonly accessor: (row: TRow) => string | number
    /** Кастомный рендер ячейки. */
    readonly cell?: (row: TRow) => ReactElement | string | number
    /** Ширина колонки. */
    readonly size?: number
    /** Можно ли скрыть колонку. */
    readonly isHideable?: boolean
    /** Участвует ли колонка в global search. */
    readonly enableGlobalFilter?: boolean
    /** Начальный pin колонки. */
    readonly pin?: "left" | "right"
}

interface IEnterpriseDataTableProps<TRow> {
    /** Идентификатор таблицы для сохранения view state. */
    readonly id: string
    /** Данные таблицы. */
    readonly rows: ReadonlyArray<TRow>
    /** Конфигурация колонок. */
    readonly columns: ReadonlyArray<IEnterpriseDataTableColumn<TRow>>
    /** Функция получения row id. */
    readonly getRowId: (row: TRow) => string
    /** ARIA label таблицы. */
    readonly ariaLabel: string
    /** Текст empty state. */
    readonly emptyMessage: string
    /** Конфигурация виртуализации body таблицы. */
    readonly virtualization?: IEnterpriseDataTableVirtualizationOptions<TRow>
    /** Настройки sticky header для virtual table. */
    readonly stickyHeader?: IEnterpriseDataTableStickyHeaderOptions
}

interface IEnterpriseDataTableVirtualizationOptions<TRow> {
    /** Оценка высоты строки для разных density режимов. */
    readonly estimateRowHeight?: {
        readonly comfortable: number
        readonly compact: number
    }
    /** Overscan для virtualizer. */
    readonly overscan?: number
    /** Максимальная высота scroll контейнера body. */
    readonly maxBodyHeight?: number
    /** Динамический estimator высоты строки. */
    readonly rowHeightEstimator?: (row: TRow, density: TDensity) => number
}

interface IEnterpriseDataTableStickyHeaderOptions {
    /** Включен ли sticky header. */
    readonly enabled?: boolean
    /** Верхний offset sticky header в пикселях. */
    readonly topOffset?: number
    /** Показывать ли тень при скролле body. */
    readonly withShadow?: boolean
}

interface IEnterpriseTableSavedView {
    /** Visibility колонок. */
    readonly columnVisibility: VisibilityState
    /** Порядок колонок. */
    readonly columnOrder: ColumnOrderState
    /** Density режима таблицы. */
    readonly density: TDensity
    /** Значение global filter. */
    readonly globalFilter: string
    /** Закрепление колонок. */
    readonly columnPinning: ColumnPinningState
    /** Ширины колонок. */
    readonly columnSizing: ColumnSizingState
}

interface IRenderedRowOffset {
    readonly index: number
    readonly key: number | string
    readonly start: number
}

function getStorageKey(tableId: string): string {
    return `ui.enterprise-table.${tableId}`
}

/**
 * Парсит ColumnPinningState из сохранённых данных.
 *
 * @param value Сырые данные из localStorage.
 * @returns Валидный ColumnPinningState или пустой default.
 */
function parseSavedColumnPinning(value: unknown): ColumnPinningState {
    if (typeof value !== "object" || value === null) {
        return { left: [], right: [] }
    }
    const record = value as Record<string, unknown>
    return {
        left: Array.isArray(record["left"]) ? (record["left"] as string[]) : [],
        right: Array.isArray(record["right"]) ? (record["right"] as string[]) : [],
    }
}

/**
 * Парсит ColumnSizingState из сохранённых данных.
 *
 * @param value Сырые данные из localStorage.
 * @returns Валидный ColumnSizingState или пустой default.
 */
function parseSavedColumnSizing(value: unknown): ColumnSizingState {
    if (typeof value !== "object" || value === null) {
        return {}
    }
    return value as ColumnSizingState
}

/**
 * Читает сохранённое состояние таблицы из localStorage.
 *
 * @param tableId Идентификатор таблицы.
 * @returns Восстановленный view state.
 */
function readSavedView(tableId: string): IEnterpriseTableSavedView {
    const emptyView: IEnterpriseTableSavedView = {
        columnOrder: [],
        columnPinning: { left: [], right: [] },
        columnSizing: {},
        columnVisibility: {},
        density: "comfortable",
        globalFilter: "",
    }

    if (typeof window === "undefined") {
        return emptyView
    }

    const raw = window.localStorage.getItem(getStorageKey(tableId))
    if (raw === null) {
        return emptyView
    }

    try {
        const parsed = JSON.parse(raw) as Partial<IEnterpriseTableSavedView>
        const density = parsed.density === "compact" ? "compact" : "comfortable"

        return {
            columnOrder: Array.isArray(parsed.columnOrder) ? parsed.columnOrder : [],
            columnPinning: parseSavedColumnPinning(parsed.columnPinning),
            columnSizing: parseSavedColumnSizing(parsed.columnSizing),
            columnVisibility:
                typeof parsed.columnVisibility === "object" && parsed.columnVisibility !== null
                    ? parsed.columnVisibility
                    : {},
            density,
            globalFilter: typeof parsed.globalFilter === "string" ? parsed.globalFilter : "",
        }
    } catch {
        return emptyView
    }
}

function writeSavedView(tableId: string, view: IEnterpriseTableSavedView): void {
    if (typeof window === "undefined") {
        return
    }
    window.localStorage.setItem(getStorageKey(tableId), JSON.stringify(view))
}

function downloadFile(fileName: string, payload: string, contentType: string): void {
    if (typeof window === "undefined" || typeof document === "undefined") {
        return
    }

    const blob = new Blob([payload], { type: contentType })
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = objectUrl
    anchor.download = fileName
    anchor.style.display = "none"
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(objectUrl)
}

function csvEscape(value: string): string {
    return `"${value.replace(/"/g, '""')}"`
}

function buildCsvPayload<TRow>(
    rows: ReadonlyArray<TRow>,
    columns: ReadonlyArray<IEnterpriseDataTableColumn<TRow>>,
): string {
    const header = columns.map((column): string => csvEscape(column.header)).join(",")
    const records = rows.map((row): string => {
        return columns.map((column): string => csvEscape(String(column.accessor(row)))).join(",")
    })

    return `${header}\n${records.join("\n")}`
}

/**
 * Проверяет, содержит ли saved pinning реальные данные.
 *
 * @param pinning Сохранённый ColumnPinningState.
 * @returns true если есть хотя бы одна закреплённая колонка.
 */
function hasSavedPinning(pinning: ColumnPinningState): boolean {
    const leftCount = Array.isArray(pinning.left) ? pinning.left.length : 0
    const rightCount = Array.isArray(pinning.right) ? pinning.right.length : 0
    return leftCount > 0 || rightCount > 0
}

/**
 * Проверяет, содержит ли saved sizing реальные данные.
 *
 * @param sizing Сохранённый ColumnSizingState.
 * @returns true если есть хотя бы одна ширина.
 */
function hasSavedSizing(sizing: ColumnSizingState): boolean {
    return Object.keys(sizing).length > 0
}

function createColumnDefs<TRow>(
    columns: ReadonlyArray<IEnterpriseDataTableColumn<TRow>>,
): ReadonlyArray<ColumnDef<TRow>> {
    return columns.map(
        (column): ColumnDef<TRow> => ({
            accessorFn: (row): string | number => column.accessor(row),
            cell: (context): ReactElement | string | number => {
                if (column.cell !== undefined) {
                    return column.cell(context.row.original)
                }
                return column.accessor(context.row.original)
            },
            enableGlobalFilter: column.enableGlobalFilter !== false,
            enableHiding: column.isHideable !== false,
            header: column.header,
            id: column.id,
            size: column.size ?? 180,
        }),
    )
}

/**
 * Enterprise table kit для list-страниц: row selection, density, column controls, export.
 *
 * @param props Данные и конфигурация таблицы.
 * @returns Унифицированный виртуализированный table layout.
 */
export function EnterpriseDataTable<TRow>(props: IEnterpriseDataTableProps<TRow>): ReactElement {
    const { t } = useTranslation(["common"])
    const initialView = useMemo((): IEnterpriseTableSavedView => {
        return readSavedView(props.id)
    }, [props.id])
    const initialColumnOrder = useMemo(
        (): ColumnOrderState => props.columns.map((column): string => column.id),
        [props.columns],
    )
    const initialColumnPinning = useMemo((): ColumnPinningState => {
        return {
            left: props.columns
                .filter((column): boolean => column.pin === "left")
                .map((column): string => column.id),
            right: props.columns
                .filter((column): boolean => column.pin === "right")
                .map((column): string => column.id),
        }
    }, [props.columns])
    const initialColumnSizing = useMemo((): ColumnSizingState => {
        const sizing: ColumnSizingState = {}
        props.columns.forEach((column): void => {
            if (column.size !== undefined) {
                sizing[column.id] = column.size
            }
        })
        return sizing
    }, [props.columns])

    const [globalFilter, setGlobalFilter] = useState<string>(initialView.globalFilter)
    const [density, setDensity] = useState<TDensity>(initialView.density)
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
        initialView.columnVisibility,
    )
    const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(
        initialView.columnOrder.length > 0 ? initialView.columnOrder : initialColumnOrder,
    )
    const [columnPinning, setColumnPinning] = useState<ColumnPinningState>(
        hasSavedPinning(initialView.columnPinning) ? initialView.columnPinning : initialColumnPinning,
    )
    const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(
        hasSavedSizing(initialView.columnSizing) ? initialView.columnSizing : initialColumnSizing,
    )
    const [focusedRowIndex, setFocusedRowIndex] = useState<number>(0)
    const [isBodyScrolled, setIsBodyScrolled] = useState<boolean>(false)
    const [isColumnControlsOpen, setIsColumnControlsOpen] = useState<boolean>(false)

    const data = useMemo((): Array<TRow> => [...props.rows], [props.rows])
    const columnDefs = useMemo((): ReadonlyArray<ColumnDef<TRow>> => {
        return createColumnDefs(props.columns)
    }, [props.columns])

    const table = useReactTable({
        columnResizeMode: "onChange",
        columns: columnDefs as ColumnDef<TRow, unknown>[],
        data,
        enableColumnResizing: true,
        enableRowSelection: true,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getRowId: (row): string => props.getRowId(row),
        getSortedRowModel: getSortedRowModel(),
        globalFilterFn: (row, columnId, filterValue): boolean => {
            const value = row.getValue(columnId)
            return String(value).toLowerCase().includes(String(filterValue).toLowerCase())
        },
        onColumnOrderChange: setColumnOrder,
        onColumnPinningChange: setColumnPinning,
        onColumnSizingChange: setColumnSizing,
        onColumnVisibilityChange: setColumnVisibility,
        onGlobalFilterChange: setGlobalFilter,
        onRowSelectionChange: setRowSelection,
        state: {
            columnOrder,
            columnPinning,
            columnSizing,
            columnVisibility,
            globalFilter,
            rowSelection,
        },
    })

    const rowModel = table.getRowModel().rows
    const visibleColumns = table.getVisibleLeafColumns()
    const gridTemplateColumns = `48px ${visibleColumns
        .map((column): string => `${String(Math.max(column.getSize(), 120))}px`)
        .join(" ")}`
    const totalTableWidth =
        48 +
        visibleColumns.reduce((accumulator, column): number => {
            return accumulator + Math.max(column.getSize(), 120)
        }, 0)

    const parentRef = useRef<HTMLDivElement | null>(null)
    const defaultComfortableRowHeight = 56
    const defaultCompactRowHeight = 42
    const rowHeight =
        density === "compact"
            ? (props.virtualization?.estimateRowHeight?.compact ?? defaultCompactRowHeight)
            : (props.virtualization?.estimateRowHeight?.comfortable ?? defaultComfortableRowHeight)
    const maxBodyHeight = props.virtualization?.maxBodyHeight ?? 520
    const overscan = props.virtualization?.overscan ?? 8
    const rowHeightEstimator = props.virtualization?.rowHeightEstimator
    const resolveEstimatedRowHeight = (index: number): number => {
        const row = rowModel[index]?.original
        if (row === undefined || rowHeightEstimator === undefined) {
            return rowHeight
        }

        const estimatedHeight = rowHeightEstimator(row, density)
        if (Number.isFinite(estimatedHeight) === false || estimatedHeight < 28) {
            return rowHeight
        }

        return estimatedHeight
    }
    const rowVirtualizer = useVirtualizer({
        count: rowModel.length,
        estimateSize: (index): number => resolveEstimatedRowHeight(index),
        getScrollElement: (): HTMLDivElement | null => parentRef.current,
        overscan,
    })
    const fallbackRowHeight = rowModel.length > 0 ? resolveEstimatedRowHeight(0) : rowHeight
    const virtualItems = rowVirtualizer.getVirtualItems()
    const fallbackRenderedRowCount = Math.min(
        rowModel.length,
        Math.max(1, Math.ceil(maxBodyHeight / fallbackRowHeight) + overscan),
    )
    const renderedRowOffsets: ReadonlyArray<IRenderedRowOffset> =
        virtualItems.length > 0
            ? virtualItems.map(
                  (item): IRenderedRowOffset => ({
                      index: item.index,
                      key: String(item.key),
                      start: item.start,
                  }),
              )
            : Array.from(
                  { length: fallbackRenderedRowCount },
                  (_unusedValue, index): IRenderedRowOffset => ({
                      index,
                      key: `fallback-row-${props.id}-${String(index)}`,
                      start: index * fallbackRowHeight,
                  }),
              )
    const totalRowsHeight =
        virtualItems.length > 0
            ? rowVirtualizer.getTotalSize()
            : rowModel.length * fallbackRowHeight

    const selectedRows = table.getSelectedRowModel().rows
    const isStickyHeaderEnabled = props.stickyHeader?.enabled !== false
    const stickyHeaderTopOffset = props.stickyHeader?.topOffset ?? 0
    const isStickyShadowEnabled = props.stickyHeader?.withShadow !== false

    const handleSaveView = (): void => {
        writeSavedView(props.id, {
            columnOrder,
            columnPinning,
            columnSizing,
            columnVisibility,
            density,
            globalFilter,
        })
    }

    const handleResetView = (): void => {
        setGlobalFilter("")
        setDensity("comfortable")
        setColumnVisibility({})
        setColumnOrder(initialColumnOrder)
        setColumnPinning(initialColumnPinning)
        setColumnSizing(initialColumnSizing)
        setRowSelection({})
    }

    const handleExportCsv = (): void => {
        const filteredRows = table.getFilteredRowModel().rows.map((row): TRow => row.original)
        const payload = buildCsvPayload(filteredRows, props.columns)
        downloadFile(`${props.id}.csv`, payload, "text/csv;charset=utf-8;")
    }

    const handleExportJson = (): void => {
        const filteredRows = table.getFilteredRowModel().rows.map((row): TRow => row.original)
        const payload = JSON.stringify(filteredRows, null, 2)
        downloadFile(`${props.id}.json`, payload, "application/json;charset=utf-8;")
    }

    const handleRowKeyDown = (event: KeyboardEvent<HTMLDivElement>, rowIndex: number): void => {
        if (event.key === "ArrowDown") {
            const nextIndex = Math.min(rowIndex + 1, rowModel.length - 1)
            setFocusedRowIndex(nextIndex)
            event.preventDefault()
            return
        }

        if (event.key === "ArrowUp") {
            const nextIndex = Math.max(rowIndex - 1, 0)
            setFocusedRowIndex(nextIndex)
            event.preventDefault()
        }
    }

    const handleColumnWidthCommit = (columnId: string, width: number): void => {
        table.setColumnSizing(
            (previous): ColumnSizingState => ({
                ...previous,
                [columnId]: width,
            }),
        )
    }

    const handleBodyScroll = (event: UIEvent<HTMLDivElement>): void => {
        const shouldShowShadow = event.currentTarget.scrollTop > 0
        if (shouldShowShadow === isBodyScrolled) {
            return
        }
        setIsBodyScrolled(shouldShowShadow)
    }

    return (
        <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
                <input
                    aria-label={`${props.ariaLabel} search`}
                    className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                    placeholder={t("common:dataTable.searchRows")}
                    value={globalFilter}
                    onChange={(event): void => {
                        setGlobalFilter(event.currentTarget.value)
                    }}
                />
                <Button
                    size="sm"
                    variant={density === "compact" ? "solid" : "flat"}
                    onPress={(): void => {
                        setDensity("compact")
                    }}
                >
                    {t("common:dataTable.compact")}
                </Button>
                <Button
                    size="sm"
                    variant={density === "comfortable" ? "solid" : "flat"}
                    onPress={(): void => {
                        setDensity("comfortable")
                    }}
                >
                    {t("common:dataTable.comfortable")}
                </Button>
                <Button size="sm" variant="flat" onPress={handleExportCsv}>
                    {t("common:dataTable.exportCsv")}
                </Button>
                <Button size="sm" variant="flat" onPress={handleExportJson}>
                    {t("common:dataTable.exportJson")}
                </Button>
                <Button size="sm" variant="flat" onPress={handleSaveView}>
                    {t("common:dataTable.saveView")}
                </Button>
                <Button size="sm" variant="flat" onPress={handleResetView}>
                    {t("common:dataTable.resetView")}
                </Button>
                <Button
                    aria-label={t("common:dataTable.columnSettings")}
                    size="sm"
                    variant={isColumnControlsOpen ? "solid" : "flat"}
                    onPress={(): void => {
                        setIsColumnControlsOpen((previous): boolean => !previous)
                    }}
                >
                    {t("common:dataTable.columnSettings")}
                </Button>
            </div>

            {isColumnControlsOpen ? <div className="flex flex-wrap gap-2">
                {columnOrder.map((columnId, index): ReactElement | null => {
                    const column = table.getColumn(columnId)
                    if (column === undefined) {
                        return null
                    }
                    const pinnedRaw = column.getIsPinned()
                    const pinnedSide: "left" | "right" | false =
                        pinnedRaw === "left" || pinnedRaw === "right" ? pinnedRaw : false

                    return (
                        <ColumnCard
                            canHide={column.getCanHide()}
                            columnId={columnId}
                            currentWidth={Math.round(column.getSize())}
                            header={String(column.columnDef.header)}
                            index={index}
                            isVisible={column.getIsVisible()}
                            key={columnId}
                            onMoveLeft={(): void => {
                                if (index === 0) {
                                    return
                                }
                                const next = [...columnOrder]
                                const target = next[index - 1]
                                if (target === undefined) {
                                    return
                                }
                                next[index - 1] = columnId
                                next[index] = target
                                setColumnOrder(next)
                            }}
                            onMoveRight={(): void => {
                                if (index >= columnOrder.length - 1) {
                                    return
                                }
                                const next = [...columnOrder]
                                const target = next[index + 1]
                                if (target === undefined) {
                                    return
                                }
                                next[index + 1] = columnId
                                next[index] = target
                                setColumnOrder(next)
                            }}
                            onPinChange={(pin): void => {
                                column.pin(pin)
                            }}
                            onToggleVisibility={(): void => {
                                column.toggleVisibility()
                            }}
                            onWidthChange={(width): void => {
                                handleColumnWidthCommit(columnId, width)
                            }}
                            onWidthChangeEnd={(width): void => {
                                handleColumnWidthCommit(columnId, width)
                            }}
                            pinnedSide={pinnedSide}
                            totalColumns={columnOrder.length}
                        />
                    )
                })}
            </div> : null}

            {selectedRows.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
                    <Chip color="primary" size="sm" variant="flat">
                        {t("common:dataTable.selected", { count: selectedRows.length })}
                    </Chip>
                    <Button
                        size="sm"
                        variant="flat"
                        onPress={(): void => {
                            setRowSelection({})
                        }}
                    >
                        {t("common:dataTable.clearSelection")}
                    </Button>
                </div>
            ) : null}

            <div
                aria-label={props.ariaLabel}
                className="overflow-auto rounded-lg border border-border"
                data-row-height-estimator={rowHeightEstimator === undefined ? "default" : "custom"}
                data-virtualized="true"
                role="table"
                aria-rowcount={rowModel.length}
                style={{ maxWidth: "100%" }}
            >
                <div
                    className={`${isStickyHeaderEnabled ? "sticky" : ""} top-0 z-10 border-b border-border bg-surface ${isStickyShadowEnabled && isBodyScrolled ? "shadow-sm" : ""}`}
                    data-sticky-header={isStickyHeaderEnabled ? "true" : "false"}
                    data-sticky-shadow={isBodyScrolled ? "true" : "false"}
                    role="rowgroup"
                    style={isStickyHeaderEnabled ? { minWidth: `${String(totalTableWidth)}px`, top: stickyHeaderTopOffset } : { minWidth: `${String(totalTableWidth)}px` }}
                >
                    <div
                        className="grid items-center gap-2 px-2 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-text-secondary"
                        role="row"
                        style={{ gridTemplateColumns }}
                    >
                        <div role="columnheader">
                            <input
                                aria-label={`${props.ariaLabel} select all`}
                                checked={table.getIsAllRowsSelected()}
                                type="checkbox"
                                onChange={table.getToggleAllRowsSelectedHandler()}
                            />
                        </div>
                        {visibleColumns.map((column): ReactElement => {
                            return (
                                <button
                                    className="text-left"
                                    key={column.id}
                                    role="columnheader"
                                    type="button"
                                    onClick={column.getToggleSortingHandler()}
                                >
                                    {String(column.columnDef.header)}
                                    {column.getIsSorted() === "asc" ? " ↑" : null}
                                    {column.getIsSorted() === "desc" ? " ↓" : null}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {rowModel.length === 0 ? (
                    <p className="px-3 py-6 text-sm text-text-secondary">{props.emptyMessage}</p>
                ) : (
                    <div
                        ref={parentRef}
                        className="overflow-auto"
                        data-rendered-row-count={renderedRowOffsets.length}
                        role="rowgroup"
                        style={{ maxHeight: `${String(maxBodyHeight)}px`, minWidth: `${String(totalTableWidth)}px` }}
                        onScroll={handleBodyScroll}
                    >
                        <div
                            className="relative"
                            style={{ height: `${String(totalRowsHeight)}px` }}
                        >
                            {renderedRowOffsets.map((rowOffset): ReactElement | null => {
                                const row = rowModel[rowOffset.index]
                                if (row === undefined) {
                                    return null
                                }

                                const isFocused = focusedRowIndex === rowOffset.index
                                const rowPadding =
                                    density === "compact" ? "py-1 text-xs" : "py-2 text-sm"

                                return (
                                    <div
                                        aria-selected={row.getIsSelected()}
                                        className={`absolute left-0 top-0 grid items-center gap-2 border-b border-border bg-surface px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40 ${rowPadding}`}
                                        key={rowOffset.key}
                                        role="row"
                                        style={{
                                            gridTemplateColumns,
                                            transform: `translateY(${String(rowOffset.start)}px)`,
                                            width: `${String(totalTableWidth)}px`,
                                        }}
                                        tabIndex={isFocused ? 0 : -1}
                                        onFocus={(): void => {
                                            setFocusedRowIndex(rowOffset.index)
                                        }}
                                        onKeyDown={(event): void => {
                                            handleRowKeyDown(event, rowOffset.index)
                                        }}
                                    >
                                        <div role="cell">
                                            <input
                                                aria-label={`Select ${row.id}`}
                                                checked={row.getIsSelected()}
                                                type="checkbox"
                                                onChange={row.getToggleSelectedHandler()}
                                            />
                                        </div>
                                        {row.getVisibleCells().map(
                                            (cell): ReactElement => (
                                                <div key={cell.id} role="cell">
                                                    {flexRender(
                                                        cell.column.columnDef.cell,
                                                        cell.getContext(),
                                                    )}
                                                </div>
                                            ),
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>
        </section>
    )
}

export type { IEnterpriseDataTableColumn, IEnterpriseDataTableProps }
