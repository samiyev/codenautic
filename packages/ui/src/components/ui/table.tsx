import {
    type ComponentPropsWithoutRef,
    type ReactNode,
    forwardRef,
} from "react"

import {cn} from "@/lib/utils"

export interface TableProps extends ComponentPropsWithoutRef<"table"> {
    children: ReactNode
}

export interface TableHeadProps extends ComponentPropsWithoutRef<"th"> {
    children: ReactNode
}

export interface TableCellProps extends ComponentPropsWithoutRef<"td"> {
    children: ReactNode
}

/**
 * Базовая таблица.
 */
export const Table = forwardRef<HTMLTableElement, TableProps>(
    ({className, children, ...properties}, ref) => {
        return (
            <div className="w-full overflow-x-auto rounded-lg border border-[var(--border)]">
                <table
                    ref={ref}
                    className={cn("w-full border-collapse text-left text-sm", className)}
                    {...properties}
                >
                    {children}
                </table>
            </div>
        )
    },
)

Table.displayName = "Table"

/**
 * Шапка таблицы.
 */
export const TableHead = forwardRef<HTMLTableSectionElement, ComponentPropsWithoutRef<"thead">>(
    ({className, ...properties}, ref) => {
        return (
            <thead
                ref={ref}
                className={cn("border-b border-[var(--border)] bg-[var(--surface-muted)]", className)}
                {...properties}
            />
        )
    },
)

TableHead.displayName = "TableHead"

/**
 * Тело таблицы.
 */
export const TableBody = forwardRef<HTMLTableSectionElement, ComponentPropsWithoutRef<"tbody">>(
    ({className, ...properties}, ref) => {
        return <tbody ref={ref} className={cn("[&_tr:nth-child(even)]:bg-[var(--surface)]", className)} {...properties} />
    },
)

TableBody.displayName = "TableBody"

/**
 * Строка таблицы.
 */
export const TableRow = forwardRef<HTMLTableRowElement, ComponentPropsWithoutRef<"tr">>(
    ({className, ...properties}, ref) => {
        return (
            <tr
                ref={ref}
                className={cn("border-b border-[var(--border)] last:border-0", className)}
                {...properties}
            />
        )
    },
)

TableRow.displayName = "TableRow"

/**
 * Заголовочная ячейка.
 */
export const TableHeader = forwardRef<HTMLTableCellElement, TableHeadProps>(
    ({className, children, ...properties}, ref) => {
        return (
            <th
                ref={ref}
                scope="col"
                className={cn("px-3 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600", className)}
                {...properties}
            >
                {children}
            </th>
        )
    },
)

TableHeader.displayName = "TableHeader"

/**
 * Ячейка таблицы.
 */
export const TableCell = forwardRef<HTMLTableCellElement, TableCellProps>(
    ({className, children, ...properties}, ref) => {
        return (
            <td
                ref={ref}
                className={cn("px-3 py-3 text-sm text-[var(--foreground)]", className)}
                {...properties}
            >
                {children}
            </td>
        )
    },
)

TableCell.displayName = "TableCell"
