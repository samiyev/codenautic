import { type ReactElement, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { Alert, Button, TextArea } from "@heroui/react"
import { FormLayout } from "@/components/forms/form-layout"
import { FormSection } from "@/components/forms/form-section"
import { showToastError, showToastInfo, showToastSuccess } from "@/lib/notifications/toast"

type TSensitiveType = "api_key" | "email" | "secret" | "token"

interface ISensitiveHit {
    /** Категория чувствительного фрагмента. */
    readonly type: TSensitiveType
    /** Обнаруженный raw фрагмент. */
    readonly value: string
}

const DETECTION_PATTERNS: ReadonlyArray<{
    readonly type: TSensitiveType
    readonly pattern: RegExp
}> = [
    {
        pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
        type: "email",
    },
    {
        pattern: /\b(?:api[_-]?key|x-api-key)\s*[:=]\s*[A-Za-z0-9._-]{8,}\b/gi,
        type: "api_key",
    },
    {
        pattern: /\b(?:token|bearer)\s*[:=]?\s*[A-Za-z0-9._-]{10,256}\b/gi,
        type: "token",
    },
    {
        pattern: /\b(?:secret|password)\s*[:=]\s*[^\s,;]{6,256}\b/gi,
        type: "secret",
    },
]

function detectSensitiveFragments(text: string): ReadonlyArray<ISensitiveHit> {
    const hits: Array<ISensitiveHit> = []

    DETECTION_PATTERNS.forEach((matcher): void => {
        const matches = text.match(matcher.pattern)
        if (matches === null) {
            return
        }

        matches.forEach((match): void => {
            hits.push({
                type: matcher.type,
                value: match,
            })
        })
    })

    return hits
}

function buildRedactedText(text: string, hits: ReadonlyArray<ISensitiveHit>): string {
    return hits.reduce((current, hit): string => {
        const normalizedType = hit.type.toUpperCase()
        return current.replaceAll(hit.value, `[REDACTED_${normalizedType}]`)
    }, text)
}

/**
 * Экран privacy-safe export/redaction.
 *
 * @returns Проверка/редакция чувствительных данных перед export/share.
 */
export function SettingsPrivacyRedactionPage(): ReactElement {
    const { t } = useTranslation(["settings"])
    const [sourceText, setSourceText] = useState(
        "token=abc123456789\nowner=security@acme.dev\nnote=share review summary only",
    )
    const [redactedText, setRedactedText] = useState("")
    const [redactedSourceText, setRedactedSourceText] = useState("")
    const [lastExportState, setLastExportState] = useState<string>(
        t("settings:privacyRedaction.noExportYet"),
    )

    const sensitiveHits = useMemo((): ReadonlyArray<ISensitiveHit> => {
        return detectSensitiveFragments(sourceText)
    }, [sourceText])

    const hasSensitiveData = sensitiveHits.length > 0

    const handleApplyRedaction = (): void => {
        if (hasSensitiveData !== true) {
            setRedactedText(sourceText)
            setRedactedSourceText(sourceText)
            showToastInfo(t("settings:privacyRedaction.toast.noSensitiveFragments"))
            return
        }

        const nextRedacted = buildRedactedText(sourceText, sensitiveHits)
        setRedactedText(nextRedacted)
        setRedactedSourceText(sourceText)
        showToastSuccess(t("settings:privacyRedaction.toast.sensitiveFragmentsRedacted"))
    }

    const handleExport = (): void => {
        if (
            hasSensitiveData === true &&
            (redactedText.length === 0 || redactedSourceText !== sourceText)
        ) {
            setLastExportState(t("settings:privacyRedaction.exportBlocked"))
            showToastError(t("settings:privacyRedaction.toast.exportBlocked"))
            return
        }

        const exportedPayload = hasSensitiveData === true ? redactedText : sourceText
        setLastExportState(
            t("settings:privacyRedaction.safeExportConfirmed", { chars: exportedPayload.length }),
        )
        showToastSuccess(t("settings:privacyRedaction.toast.safeExportConfirmed"))
    }

    return (
        <FormLayout
            title={t("settings:privacyRedaction.pageTitle")}
            description={t("settings:privacyRedaction.pageSubtitle")}
        >
            {hasSensitiveData ? (
                <Alert status="danger">
                    <Alert.Title>
                        {t("settings:privacyRedaction.sensitiveFragmentsDetectedTitle")}
                    </Alert.Title>
                    <Alert.Description>
                        {t("settings:privacyRedaction.sensitiveFragmentsDetectedDescription")}
                    </Alert.Description>
                </Alert>
            ) : (
                <Alert status="success">
                    <Alert.Title>
                        {t("settings:privacyRedaction.noSensitiveFragmentsTitle")}
                    </Alert.Title>
                    <Alert.Description>
                        {t("settings:privacyRedaction.noSensitiveFragmentsDescription")}
                    </Alert.Description>
                </Alert>
            )}

            <FormSection heading={t("settings:privacyRedaction.sourceContent")}>
                <TextArea
                    aria-label={t("settings:ariaLabel.privacyRedaction.sourceText")}
                    className="min-h-[150px]"
                    value={sourceText}
                    onChange={(e): void => {
                        setSourceText(e.target.value)
                    }}
                />
                <div className="flex flex-wrap gap-2">
                    <Button variant="primary" onPress={handleApplyRedaction}>
                        {t("settings:privacyRedaction.applyRedactionSuggestions")}
                    </Button>
                    <Button variant="secondary" onPress={handleExport}>
                        {t("settings:privacyRedaction.confirmSafeExport")}
                    </Button>
                </div>
            </FormSection>

            <FormSection heading={t("settings:privacyRedaction.detectionSummary")}>
                {hasSensitiveData ? (
                    <ul
                        aria-label={t("settings:ariaLabel.privacyRedaction.sensitiveHitsList")}
                        className="space-y-2"
                    >
                        {sensitiveHits.map(
                            (hit, index): ReactElement => (
                                <li
                                    className="rounded-lg border border-border bg-surface p-3 text-sm"
                                    key={`${hit.type}-${String(index)}`}
                                >
                                    <p className="font-semibold text-foreground">{hit.type}</p>
                                    <p className="text-muted">{hit.value}</p>
                                </li>
                            ),
                        )}
                    </ul>
                ) : (
                    <p className="text-sm text-muted">
                        {t("settings:privacyRedaction.noHitsMessage")}
                    </p>
                )}
            </FormSection>

            <FormSection heading={t("settings:privacyRedaction.redactedPreview")}>
                <TextArea
                    aria-label={t("settings:ariaLabel.privacyRedaction.redactedPreview")}
                    readOnly
                    className="min-h-[150px]"
                    value={redactedText}
                />
                <Alert status="accent">
                    <Alert.Title>{t("settings:privacyRedaction.exportState")}</Alert.Title>
                    <Alert.Description>{lastExportState}</Alert.Description>
                </Alert>
            </FormSection>
        </FormLayout>
    )
}
