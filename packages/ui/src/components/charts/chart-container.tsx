import { type ReactNode, type ReactElement } from "react"
import { ResponsiveContainer } from "recharts"

import { CHART_HEIGHT } from "@/lib/constants/chart-constants"

/**
 * Свойства контейнера для Recharts графиков.
 */
export interface IChartContainerProps {
    /** Предустановленная высота контейнера. */
    readonly height?: keyof typeof CHART_HEIGHT
    /** Recharts chart component (PieChart, BarChart, LineChart и т.д.). */
    readonly children: ReactNode
    /** Accessibility label для контейнера. */
    readonly "aria-label"?: string
}

/**
 * Унифицированная обёртка для Recharts графиков.
 * Устраняет дублирование div + ResponsiveContainer в 8 файлах (28 occurrences).
 *
 * @param props Конфигурация контейнера.
 * @returns Контейнер с ResponsiveContainer.
 */
export function ChartContainer(props: IChartContainerProps): ReactElement {
    const { children, height = "lg", "aria-label": ariaLabel } = props
    const heightClass = CHART_HEIGHT[height]

    return (
        <div aria-label={ariaLabel} className={`${heightClass} w-full`}>
            <ResponsiveContainer height="100%" minHeight={1} minWidth={1} width="100%">
                {children}
            </ResponsiveContainer>
        </div>
    )
}
