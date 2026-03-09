import type { ReactElement } from "react"

import { Alert, Button } from "@/components/ui"

import type { IOnboardingWizardState } from "../use-onboarding-wizard-state"
import {
    mapBulkStatusLabel,
    mapBulkStatusClasses,
    mapBulkProgressClasses,
    isBulkScanTerminal,
} from "../onboarding-templates"

/**
 * Параметры компонента мониторинга bulk-задач.
 */
export interface IBulkScanJobsMonitorProps {
    /** Состояние визарда. */
    readonly state: IOnboardingWizardState
}

/**
 * Таблица задач массового сканирования с управлением (пауза, возобновление, отмена).
 *
 * @param props Конфигурация.
 * @returns Компонент мониторинга bulk-задач или null.
 */
export function BulkScanJobsMonitor({ state }: IBulkScanJobsMonitorProps): ReactElement | null {
    if (state.isSingleMode || state.isStarted === false) {
        return null
    }

    if (state.activeStep !== 2) {
        return null
    }

    return (
        <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">Прогресс массового сканирования</p>
                <div className="flex gap-2">
                    <Button
                        isDisabled={state.isBulkPaused}
                        onPress={(): void => {
                            state.handlePauseAll()
                        }}
                        size="sm"
                        type="button"
                        variant="light"
                    >
                        Пауза
                    </Button>
                    <Button
                        isDisabled={state.isBulkPaused === false}
                        onPress={(): void => {
                            state.handleResumeAll()
                        }}
                        size="sm"
                        type="button"
                        variant="light"
                    >
                        Возобновить
                    </Button>
                    <Button
                        color="danger"
                        onPress={(): void => {
                            state.handleCancelAll()
                        }}
                        size="sm"
                        type="button"
                        variant="ghost"
                    >
                        Отменить все
                    </Button>
                </div>
            </div>

            <div className="grid gap-2 rounded-lg border border-border p-2 text-sm">
                <p>
                    В работе: {state.bulkSummary.running}, Очередь:{" "}
                    {state.bulkSummary.queued}, Пауза: {state.bulkSummary.paused}, Ошибки:{" "}
                    {state.bulkSummary.error}, Готово: {state.bulkSummary.completed}, Отменено:{" "}
                    {state.bulkSummary.cancelled}
                </p>

                {state.bulkJobs.map(
                    (job): ReactElement => (
                        <article
                            className={`rounded-md border p-3 ${mapBulkStatusClasses(job.status)}`}
                            key={job.id}
                        >
                            <div className="flex items-center justify-between">
                                <p className="font-semibold">{job.repositoryUrl}</p>
                                <span
                                    className={`rounded-full border px-2 py-1 text-xs ${mapBulkStatusClasses(job.status)}`}
                                >
                                    {mapBulkStatusLabel(job.status)}
                                </span>
                            </div>
                            <div className="mt-2 h-2 rounded-full bg-surface-muted">
                                <div
                                    aria-label={`scan progress bar ${job.repositoryUrl}`}
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                    aria-valuenow={job.progress}
                                    className={`h-2 rounded-full transition-[width] duration-300 ${mapBulkProgressClasses(job.status)}`}
                                    role="progressbar"
                                    style={{
                                        width: `${job.progress}%`,
                                    }}
                                />
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Прогресс: {job.progress}%
                            </p>

                            {job.errorMessage === undefined ? null : (
                                <Alert color="danger" className="mt-2">
                                    {job.errorMessage}
                                </Alert>
                            )}
                            {job.errorDetails === undefined ||
                            job.errorDetails.length === 0 ? null : (
                                <details className="mt-2">
                                    <summary className="cursor-pointer text-xs font-semibold">
                                        Подробнее об ошибке
                                    </summary>
                                    <ul className="mt-1 list-disc pl-5 text-xs">
                                        {job.errorDetails.map(
                                            (detail, index): ReactElement => (
                                                <li
                                                    key={`${job.id}-detail-${String(index)}`}
                                                >
                                                    {detail}
                                                </li>
                                            ),
                                        )}
                                    </ul>
                                </details>
                            )}

                            <div className="mt-2 flex gap-2">
                                {job.status === "error" ? (
                                    <Button
                                        color="danger"
                                        onPress={(): void => {
                                            state.handleRetryJob(job.id)
                                        }}
                                        size="sm"
                                        type="button"
                                        variant="ghost"
                                    >
                                        Retry
                                    </Button>
                                ) : null}
                                {isBulkScanTerminal(job.status) ||
                                job.status === "paused" ? null : (
                                    <Button
                                        color="danger"
                                        onPress={(): void => {
                                            state.handleCancelJob(job.id)
                                        }}
                                        size="sm"
                                        type="button"
                                        variant="ghost"
                                    >
                                        Отменить
                                    </Button>
                                )}
                            </div>
                        </article>
                    ),
                )}
            </div>
        </section>
    )
}
