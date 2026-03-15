import type { ReactElement } from "react"
import { useTranslation } from "react-i18next"
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"

import { Card, CardContent, CardHeader, Chip, Skeleton } from "@heroui/react"
import { TYPOGRAPHY } from "@/lib/constants/typography"

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
        <Card>
            <CardHeader>
                <h3 className={TYPOGRAPHY.subsectionTitle}>{title}</h3>
            </CardHeader>
            <CardContent>
                {props.isLoading === true ? (
                    <Skeleton className="h-72 w-full rounded-lg" />
                ) : (
                    <>
                        <div className="h-72 w-full"><ResponsiveContainer height="100%" minHeight={1} minWidth={1} width="100%">
                            <PieChart>
                                <Pie
                                    data={props.data as IStatusDistributionPoint[]}
                                    dataKey="count"
                                    nameKey="status"
                                    outerRadius={80}
                                    paddingAngle={2}
                                >
                                    {props.data.map(
                                        (point): ReactElement => (
                                            <Cell key={point.status} fill={point.color} />
                                        ),
                                    )}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer></div>
                        <div
                            className="mt-2 flex flex-wrap gap-2"
                            aria-label={t(
                                "dashboard:ariaLabel.statusDistribution.statusLegend",
                            )}
                        >
                            {props.data.map(
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
            </CardContent>
        </Card>
    )
}
