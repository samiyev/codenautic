import { type ReactElement } from "react"

const CCR_SUMMARY_DETAIL_LABELS = {
    CONCISE: "Concise",
    STANDARD: "Standard",
    DEEP: "Deep",
} as const

export interface ICCRSummaryPreviewSettings {
    readonly detailLevel: keyof typeof CCR_SUMMARY_DETAIL_LABELS
    readonly enabled: boolean
    readonly includeRiskOverview: boolean
    readonly includeTimeline: boolean
    readonly maxSuggestions: number
}

interface ICCRSummaryPreviewProps {
    readonly settings: ICCRSummaryPreviewSettings
}

/**
 * Превью итоговой структуры CCR summary с учетом текущей конфигурации.
 *
 * @param props - настройки генерации summary.
 * @returns Карточка предпросмотра с включенными секциями и лимитами.
 */
export function CCRSummaryPreview(props: ICCRSummaryPreviewProps): ReactElement {
    if (props.settings.enabled !== true) {
        return (
            <article
                className="space-y-2 rounded-md border border-dashed border-slate-300 bg-slate-50 p-3"
                data-testid="ccr-summary-preview"
            >
                <h3 className="text-sm font-semibold text-slate-900">CCR summary preview</h3>
                <p className="text-xs text-slate-600">Summary generation is disabled.</p>
            </article>
        )
    }

    const sections = [
        props.settings.includeRiskOverview === true ? "Risk overview" : undefined,
        props.settings.includeTimeline === true ? "Timeline highlights" : undefined,
        "Top actionable suggestions",
    ].filter((item): item is string => item !== undefined)

    return (
        <article
            className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3"
            data-testid="ccr-summary-preview"
        >
            <h3 className="text-sm font-semibold text-slate-900">CCR summary preview</h3>
            <p className="text-xs text-slate-600" data-testid="ccr-summary-preview-detail-level">
                {`Detail level: ${CCR_SUMMARY_DETAIL_LABELS[props.settings.detailLevel]}`}
            </p>
            <p className="text-xs text-slate-600" data-testid="ccr-summary-preview-max-suggestions">
                {`Max suggestions: ${props.settings.maxSuggestions}`}
            </p>
            <ul className="list-disc space-y-1 pl-5 text-xs text-slate-700">
                {sections.map(
                    (section): ReactElement => (
                        <li key={section}>{section}</li>
                    ),
                )}
            </ul>
        </article>
    )
}
