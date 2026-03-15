/**
 * Секция файлового дерева и CodeCity mini-map для CCR review.
 *
 * Отображает список файлов диффа с возможностью выбора активного файла
 * и интерактивную мини-карту CodeCity для визуализации контекста review.
 */

import type { ReactElement } from "react"
import { useTranslation } from "react-i18next"
import { Button, Card, CardContent, CardHeader } from "@heroui/react"

import { CodeCityTreemap } from "@/components/codecity/codecity-treemap"
import { TYPOGRAPHY } from "@/lib/constants/typography"

import type { ICcrReviewState } from "../hooks/use-ccr-review-state"

/**
 * Свойства компонента секции файлового дерева.
 */
interface ISidebarFilesSectionProps {
    /**
     * Состояние страницы CCR review.
     */
    readonly state: ICcrReviewState
}

/**
 * Секция файлового дерева и мини-карты CodeCity.
 *
 * Содержит список diff-файлов с подсветкой активного файла
 * и сворачиваемую мини-карту CodeCity с отображением impact-зон и контекста review.
 *
 * @param props - Свойства компонента.
 * @returns Элемент секции файлового дерева.
 */
export function SidebarFilesSection(props: ISidebarFilesSectionProps): ReactElement {
    const { state } = props
    const { t } = useTranslation(["reviews"])

    return (
        <>
            <Card>
                <CardHeader>
                    <p className={TYPOGRAPHY.cardTitle}>{t("reviews:detail.filesTree")}</p>
                </CardHeader>
                <CardContent className="space-y-2">
                    {state.ccrDiffFiles.length === 0 ? (
                        <p className="text-sm text-muted">
                            {t("reviews:detail.noDiffFiles")}
                        </p>
                    ) : (
                        state.ccrDiffFiles.map((file): ReactElement => {
                            const isActive = file.filePath === state.activeFilePath
                            return (
                                <button
                                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                                        isActive
                                            ? "border-accent/30 bg-accent/10 text-accent-foreground"
                                            : "border-border bg-surface text-foreground"
                                    }`}
                                    key={file.filePath}
                                    onClick={(): void => {
                                        state.setActiveFilePath(file.filePath)
                                    }}
                                    type="button"
                                >
                                    {file.filePath}
                                </button>
                            )
                        })
                    )}
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <div className="flex w-full flex-wrap items-center justify-between gap-2">
                        <p className={TYPOGRAPHY.cardTitle}>
                            {t("reviews:detail.reviewContextSidebar")}
                        </p>
                        <Button
                            aria-expanded={state.isReviewContextMiniMapExpanded}
                            aria-label={
                                state.isReviewContextMiniMapExpanded
                                    ? t("reviews:detail.collapseReviewContextMiniMap")
                                    : t("reviews:detail.expandReviewContextMiniMap")
                            }
                            size="sm"
                            type="button"
                            variant="secondary"
                            onPress={(): void => {
                                state.setReviewContextMiniMapExpanded(
                                    state.isReviewContextMiniMapExpanded === false,
                                )
                            }}
                        >
                            {state.isReviewContextMiniMapExpanded
                                ? t("reviews:detail.collapse")
                                : t("reviews:detail.expand")}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    <p className={TYPOGRAPHY.captionMuted}>
                        {t("reviews:detail.codeCityMiniMapHint")}
                    </p>
                    <CodeCityTreemap
                        files={state.reviewContextTreemapFiles}
                        height={state.isReviewContextMiniMapExpanded ? "320px" : "180px"}
                        highlightedFileId={state.reviewContextHighlightedFileId}
                        impactedFiles={state.reviewContextImpactedFiles}
                        onFileSelect={state.handleReviewContextMiniMapSelect}
                        title={
                            state.isReviewContextMiniMapExpanded
                                ? t("reviews:detail.codeCityMapExpanded")
                                : t("reviews:detail.codeCityMiniMap")
                        }
                    />
                    <p
                        aria-label={t("reviews:ariaLabel.detail.reviewContextMapStatus")}
                        className={TYPOGRAPHY.captionMuted}
                    >
                        {state.isReviewContextMiniMapExpanded
                            ? t("reviews:detail.expandedMapActive")
                            : t("reviews:detail.miniMapActive")}
                    </p>
                </CardContent>
            </Card>
        </>
    )
}
