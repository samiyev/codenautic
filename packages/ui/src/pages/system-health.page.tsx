import type {ReactElement} from "react"

import {useHealthQuery} from "@/lib/hooks/queries"

/**
 * Первый системный экран foundation-этапа: статус runtime/api.
 *
 * @returns Визуальное состояние health-check запроса.
 */
export function SystemHealthPage(): ReactElement {
    const healthQuery = useHealthQuery()

    const isPending = healthQuery.isPending
    if (isPending === true) {
        return (
            <section
                aria-busy="true"
                className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center p-8"
            >
                <h1 className="text-3xl font-semibold tracking-tight">CodeNautic Runtime</h1>
                <p className="mt-4 text-base text-slate-600">Проверяем доступность API...</p>
            </section>
        )
    }

    if (healthQuery.error !== null && healthQuery.error !== undefined) {
        return (
            <section className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center p-8">
                <h1 className="text-3xl font-semibold tracking-tight">CodeNautic Runtime</h1>
                <p aria-live="assertive" className="mt-4 text-base text-rose-700" role="alert">
                    Не удалось получить статус API
                </p>
                <button
                    className="mt-6 rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
                    onClick={(): void => {
                        void healthQuery.refetch()
                    }}
                    type="button"
                >
                    Повторить проверку
                </button>
            </section>
        )
    }

    const healthData = healthQuery.data

    return (
        <section className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center p-8">
            <h1 className="text-3xl font-semibold tracking-tight">CodeNautic Runtime</h1>
            <p className="mt-3 text-sm uppercase tracking-[0.2em] text-slate-500">Состояние API</p>
            <p className="mt-2 text-4xl font-bold text-emerald-700">{healthData.status}</p>
            <p className="mt-4 text-sm text-slate-600">
                Service: <span className="font-medium text-slate-900">{healthData.service}</span>
            </p>
            <p className="mt-1 text-sm text-slate-600">
                Timestamp: <span className="font-medium text-slate-900">{healthData.timestamp}</span>
            </p>
        </section>
    )
}
