import type {ReactElement} from "react"
import {useTranslation} from "react-i18next"

import {useHealthQuery} from "@/lib/hooks/queries"
import {formatLocalizedDateTime, getCurrentLocale} from "@/lib/i18n/i18n"

/**
 * Первый системный экран foundation-этапа: статус runtime/api.
 *
 * @returns Визуальное состояние health-check запроса.
 */
export function SystemHealthPage(): ReactElement {
    const {t, i18n} = useTranslation(["common", "system"])
    const locale = getCurrentLocale(i18n)
    const healthQuery = useHealthQuery()

    const isPending = healthQuery.isPending
    if (isPending === true) {
        return (
            <section
                aria-busy="true"
                className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center p-8"
            >
                <h1 className="text-3xl font-semibold tracking-tight">{t("common:appTitle")}</h1>
                <p className="mt-4 text-base text-slate-600">{t("common:loading")}</p>
            </section>
        )
    }

    if (healthQuery.error !== null && healthQuery.error !== undefined) {
        return (
            <section className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center p-8">
                <h1 className="text-3xl font-semibold tracking-tight">{t("common:appTitle")}</h1>
                <p aria-live="assertive" className="mt-4 text-base text-rose-700" role="alert">
                    {t("system:unavailable")}
                </p>
                <button
                    className="mt-6 rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
                    onClick={(): void => {
                        void healthQuery.refetch()
                    }}
                    type="button"
                >
                    {t("common:retry")}
                </button>
            </section>
        )
    }

    const healthData = healthQuery.data

    const localizedTimestamp = formatLocalizedDateTime(healthData.timestamp, locale)

    return (
        <section className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center p-8">
            <h1 className="text-3xl font-semibold tracking-tight">{t("common:appTitle")}</h1>
            <p className="mt-3 text-sm uppercase tracking-[0.2em] text-slate-500">
                {t("system:healthStatus")}
            </p>
            <p className="mt-2 text-4xl font-bold text-emerald-700">{healthData.status}</p>
            <p className="mt-4 text-sm text-slate-600">
                {t("system:service")}: <span className="font-medium text-slate-900">{healthData.service}</span>
            </p>
            <p className="mt-1 text-sm text-slate-600">
                {t("system:timestamp")}:{" "}
                <span className="font-medium text-slate-900">{localizedTimestamp}</span>
            </p>
        </section>
    )
}
