import type { ReactElement } from "react"

/**
 * Метрика в sprint summary card.
 */
export interface ISprintSummaryMetric {
    /** Уникальный id метрики. */
    readonly id: string
    /** Лейбл метрики. */
    readonly label: string
    /** Значение метрики для карточки. */
    readonly value: string
    /** Delta в процентах. */
    readonly deltaPercent: number
    /** Файл-фокус для navigation. */
    readonly focusFileId?: string
    /** Цепочка файлов для navigation. */
    readonly focusFileIds: ReadonlyArray<string>
}

/**
 * Модель summary card.
 */
export interface ISprintSummaryCardModel {
    /** Подпись текущего спринта. */
    readonly sprintLabel: string
    /** Количество достижений за спринт. */
    readonly achievementsCount: number
    /** Сводный improvement score. */
    readonly overallImprovementScore: number
    /** Ключевые sprint метрики. */
    readonly metrics: ReadonlyArray<ISprintSummaryMetric>
}

/**
 * Пропсы sprint summary card.
 */
export interface ISprintSummaryCardProps {
    /** Данные summary. */
    readonly model: ISprintSummaryCardModel
    /** Активная метрика. */
    readonly activeMetricId?: string
    /** Callback выбора метрики. */
    readonly onSelectMetric?: (metric: ISprintSummaryMetric) => void
}

function resolveDeltaClassName(deltaPercent: number): string {
    if (deltaPercent > 0) {
        return "text-emerald-700"
    }
    if (deltaPercent < 0) {
        return "text-rose-700"
    }
    return "text-slate-600"
}

function resolveMetricRowClassName(isActive: boolean): string {
    const baseClassName = isActive
        ? "border-cyan-400 bg-cyan-50"
        : "border-slate-200 bg-slate-50 hover:border-slate-300"
    return `w-full rounded-lg border p-2 text-left transition ${baseClassName}`
}

function formatDeltaPrefix(deltaPercent: number): string {
    return deltaPercent > 0 ? "+" : ""
}

/**
 * Sprint summary card: ключевые метрики, achievements count и overall improvement score.
 *
 * @param props Модель summary и callback выбора метрики.
 * @returns React-компонент summary card.
 */
export function SprintSummaryCard(props: ISprintSummaryCardProps): ReactElement {
    return (
        <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">Sprint summary card</p>
            <p className="mt-1 text-xs text-slate-500">{props.model.sprintLabel}</p>

            <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded border border-slate-200 bg-slate-50 p-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                        Achievements
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                        {String(props.model.achievementsCount)}
                    </p>
                </div>
                <div className="rounded border border-slate-200 bg-slate-50 p-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                        Overall score
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                        {String(props.model.overallImprovementScore)}
                    </p>
                </div>
            </div>

            <ul aria-label="Sprint summary metrics" className="mt-3 space-y-2">
                {props.model.metrics.map((metric): ReactElement => {
                    const isActive = props.activeMetricId === metric.id
                    return (
                        <li key={metric.id}>
                            <button
                                aria-label={`Inspect sprint summary metric ${metric.label}`}
                                className={resolveMetricRowClassName(isActive)}
                                onClick={(): void => {
                                    props.onSelectMetric?.(metric)
                                }}
                                type="button"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">
                                            {metric.label}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-600">{metric.value}</p>
                                    </div>
                                    <span
                                        className={`text-xs font-semibold ${resolveDeltaClassName(metric.deltaPercent)}`}
                                    >
                                        {formatDeltaPrefix(metric.deltaPercent)}
                                        {String(metric.deltaPercent)}%
                                    </span>
                                </div>
                            </button>
                        </li>
                    )
                })}
            </ul>
        </section>
    )
}
