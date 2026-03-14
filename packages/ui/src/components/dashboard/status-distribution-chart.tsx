import type { ReactElement } from "react"
import { useTranslation } from "react-i18next"
import { Cell, Pie, PieChart, Tooltip } from "recharts"

import { Chip } from "@heroui/react"
import { RechartsChartWrapper } from "@/components/charts/recharts-chart-wrapper"
import { ChartContainer } from "@/components/charts/chart-container"

/**
 * Строка для Recharts.
 */
export interface IStatusDistributionPoint {
    /** Имя статуса. */
    readonly status: string
    /** Количество элементов. */
    readonly count: number
    /** Цвет сегмента. */
    readonly color: string
}

/**
 * Параметры pie chart.
 */
export interface IStatusDistributionChartProps {
    /** Данные для распределения. */
    readonly data: ReadonlyArray<IStatusDistributionPoint>
    /** Заголовок секции. */
    readonly title?: string
    /** Состояние загрузки данных. */
    readonly isLoading?: boolean
    /** Текст для fallback-состояния. */
    readonly loadingText?: string
}

/**
 * Карточка распределения статусов CCR.
 *
 * @param props Данные статусов и заголовок.
 * @returns Recharts pie диаграмма.
 */
export function StatusDistributionChart(props: IStatusDistributionChartProps): ReactElement {
    const { t } = useTranslation(["dashboard"])
    const title = props.title ?? "CCR status distribution"

    return (
        <RechartsChartWrapper
            data={props.data}
            isLoading={props.isLoading === true}
            loadingText={props.loadingText}
            title={title}
            scalePolicy={{
                aggregator: "sum",
                hardThreshold: 2000,
                maxPoints: 500,
                aggregatorKeys: ["count"],
            }}
        >
            {({ displayData }): ReactElement => (
                <>
                    <ChartContainer height="xl">
                        <PieChart>
                            <Pie
                                data={displayData}
                                dataKey="count"
                                nameKey="status"
                                outerRadius={80}
                                paddingAngle={2}
                            >
                                {displayData.map(
                                    (point): ReactElement => (
                                        <Cell key={point.status} fill={point.color} />
                                    ),
                                )}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ChartContainer>
                    <div
                        className="mt-2 flex flex-wrap gap-2"
                        aria-label={t("dashboard:ariaLabel.statusDistribution.statusLegend")}
                    >
                        {displayData.map(
                            (point): ReactElement => (
                                <Chip
                                    key={point.status}
                                    style={{ backgroundColor: `${point.color}20` }}
                                    className="border border-current/20"
                                >
                                    {point.status}: {point.count}
                                </Chip>
                            ),
                        )}
                    </div>
                </>
            )}
        </RechartsChartWrapper>
    )
}
