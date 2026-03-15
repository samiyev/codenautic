import { type ReactElement, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { Button, Drawer, TextArea, useOverlayState } from "@heroui/react"
import { useDynamicTranslation } from "@/lib/i18n"
import { TYPOGRAPHY } from "@/lib/constants/typography"

type TFactorImpact = "high" | "low" | "medium"

interface IExplainabilityFactor {
    /** Название фактора. */
    readonly label: string
    /** Вклад фактора в сигнал. */
    readonly impact: TFactorImpact
    /** Короткое пояснение фактора. */
    readonly value: string
}

interface IExplainabilityPanelProps {
    /** Заголовок explainability блока. */
    readonly title: string
    /** Короткий label сигнала. */
    readonly signalLabel: string
    /** Значение сигнала. */
    readonly signalValue: string
    /** Порог, применённый к оценке. */
    readonly threshold: string
    /** Confidence оценки. */
    readonly confidence: string
    /** Data window сигнала. */
    readonly dataWindow: string
    /** Ограничения сигнала. */
    readonly limitations: ReadonlyArray<string>
    /** Топ факторы сигнала. */
    readonly factors: ReadonlyArray<IExplainabilityFactor>
}

function formatImpactLabel(impact: TFactorImpact, t: (key: string) => string): string {
    if (impact === "high") {
        return t("common:explainabilityPanel.highImpact")
    }
    if (impact === "medium") {
        return t("common:explainabilityPanel.mediumImpact")
    }
    return t("common:explainabilityPanel.lowImpact")
}

/**
 * Унифицированный explainability drawer для метрик/скорингов.
 *
 * @param props Конфигурация объяснения сигнала.
 * @returns Блок explainability с экспортом snippet.
 */
export function ExplainabilityPanel(props: IExplainabilityPanelProps): ReactElement {
    const { t } = useTranslation(["common"])
    const { td } = useDynamicTranslation(["common"])
    const drawerState = useOverlayState()
    const [snippet, setSnippet] = useState<string>("")
    const exportSnippet = useMemo((): string => {
        const factorSummary = props.factors
            .map((factor): string => `${factor.label}: ${factor.value}`)
            .join(" | ")
        return `${props.signalLabel}=${props.signalValue}; threshold=${props.threshold}; confidence=${props.confidence}; window=${props.dataWindow}; factors=${factorSummary}`
    }, [
        props.confidence,
        props.dataWindow,
        props.factors,
        props.signalLabel,
        props.signalValue,
        props.threshold,
    ])

    return (
        <>
            <section className="rounded-xl border border-border bg-surface p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground">{props.title}</p>
                        <p className="text-xs text-muted">
                            {`${props.signalLabel}: ${props.signalValue} · threshold ${props.threshold} · confidence ${props.confidence}`}
                        </p>
                    </div>
                    <Button
                        size="sm"
                        variant="secondary"
                        onPress={(): void => {
                            drawerState.open()
                        }}
                    >
                        {t("common:explainabilityPanel.whyThisScore")}
                    </Button>
                </div>
            </section>

            <Drawer state={drawerState}>
                <Drawer.Backdrop>
                    <Drawer.Content placement="right">
                        <Drawer.Dialog>
                            <Drawer.Header>
                                <h2 className={TYPOGRAPHY.sectionTitle}>
                                    {t("common:explainabilityPanel.explainability")}
                                </h2>
                            </Drawer.Header>
                            <Drawer.Body>
                                <dl className="grid grid-cols-[130px_1fr] gap-x-2 gap-y-2 text-sm">
                                    <dt className="text-muted">
                                        {t("common:explainabilityPanel.signal")}
                                    </dt>
                                    <dd>{`${props.signalLabel}: ${props.signalValue}`}</dd>
                                    <dt className="text-muted">
                                        {t("common:explainabilityPanel.threshold")}
                                    </dt>
                                    <dd>{props.threshold}</dd>
                                    <dt className="text-muted">
                                        {t("common:explainabilityPanel.confidence")}
                                    </dt>
                                    <dd>{props.confidence}</dd>
                                    <dt className="text-muted">
                                        {t("common:explainabilityPanel.dataWindow")}
                                    </dt>
                                    <dd>{props.dataWindow}</dd>
                                </dl>

                                <section className="space-y-2">
                                    <p className="text-sm font-semibold text-foreground">
                                        {t("common:explainabilityPanel.topFactors")}
                                    </p>
                                    <ul
                                        aria-label={t(
                                            "common:ariaLabel.explainabilityPanel.factors",
                                        )}
                                        className="space-y-2"
                                    >
                                        {props.factors.map(
                                            (factor): ReactElement => (
                                                <li
                                                    className="rounded-lg border border-border bg-surface px-3 py-2"
                                                    key={factor.label}
                                                >
                                                    <p className="text-sm font-semibold text-foreground">
                                                        {factor.label}
                                                    </p>
                                                    <p className="text-xs text-muted">
                                                        {formatImpactLabel(factor.impact, td)}
                                                    </p>
                                                    <p className="text-sm text-muted">
                                                        {factor.value}
                                                    </p>
                                                </li>
                                            ),
                                        )}
                                    </ul>
                                </section>

                                <section className="space-y-2">
                                    <p className="text-sm font-semibold text-foreground">
                                        {t("common:explainabilityPanel.knownLimitations")}
                                    </p>
                                    <ul
                                        aria-label={t(
                                            "common:ariaLabel.explainabilityPanel.limitations",
                                        )}
                                        className="list-disc space-y-1 pl-5 text-sm text-muted"
                                    >
                                        {props.limitations.map(
                                            (limitation): ReactElement => (
                                                <li key={limitation}>{limitation}</li>
                                            ),
                                        )}
                                    </ul>
                                </section>

                                <section className="space-y-2">
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        onPress={(): void => {
                                            setSnippet(exportSnippet)
                                        }}
                                    >
                                        {t("common:explainabilityPanel.exportSnippet")}
                                    </Button>
                                    {snippet.length > 0 ? (
                                        <TextArea
                                            readOnly
                                            aria-label={t(
                                                "common:ariaLabel.explainabilityPanel.exportSnippet",
                                            )}
                                            value={snippet}
                                        />
                                    ) : null}
                                </section>
                            </Drawer.Body>
                        </Drawer.Dialog>
                    </Drawer.Content>
                </Drawer.Backdrop>
            </Drawer>
        </>
    )
}

export type { IExplainabilityFactor, IExplainabilityPanelProps }
