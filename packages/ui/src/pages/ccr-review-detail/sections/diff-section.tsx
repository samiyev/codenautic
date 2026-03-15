/**
 * Секция diff-просмотра CCR review.
 *
 * Отображает CodeDiffViewer, CodeCity impact view с тепловой картой истории review,
 * панель impact analysis, панель файлового окружения (neighborhood),
 * SSE-viewer для live-стриминга и ReviewCommentThread.
 */

import type { ReactElement } from "react"
import { useTranslation } from "react-i18next"
import { Alert, Button, Card, CardContent, CardHeader } from "@heroui/react"

import { CodeCityTreemap } from "@/components/codecity/codecity-treemap"
import { ImpactAnalysisPanel } from "@/components/predictions/impact-analysis-panel"
import { CodeDiffViewer } from "@/components/reviews/code-diff-viewer"
import { ReviewCommentThread } from "@/components/reviews/review-comment-thread"
import { SseStreamViewer } from "@/components/streaming/sse-stream-viewer"
import { NATIVE_FORM } from "@/lib/constants/spacing"
import { TYPOGRAPHY } from "@/lib/constants/typography"

import type { ICcrReviewState } from "../hooks/use-ccr-review-state"

/**
 * Свойства компонента секции diff-просмотра.
 */
interface IDiffSectionProps {
    /**
     * Состояние страницы CCR review.
     */
    readonly state: ICcrReviewState
    /**
     * URL источника SSE-стриминга (опционально).
     */
    readonly streamSourceUrl?: string
    /**
     * Идентификатор CCR.
     */
    readonly ccrId: string
}

/**
 * Секция diff-просмотра CCR review.
 *
 * Центральная колонка страницы, содержащая diff-viewer для просмотра изменений,
 * CodeCity impact view с тепловой картой и контролами истории review,
 * панель impact analysis с blast radius, панель файлового окружения,
 * SSE-viewer для live-стриминга и треды review-комментариев.
 *
 * @param props - Свойства компонента.
 * @returns Элемент секции diff-просмотра.
 */
export function DiffSection(props: IDiffSectionProps): ReactElement {
    const { state, streamSourceUrl, ccrId } = props
    const { t } = useTranslation(["reviews"])

    return (
        <div className="min-w-0 space-y-4">
            <CodeDiffViewer files={state.visibleDiffFiles} />
            <Card>
                <CardHeader>
                    <p className={TYPOGRAPHY.cardTitle}>
                        {t("reviews:detail.ccrImpactCityView")}
                    </p>
                </CardHeader>
                <CardContent className="space-y-3">
                    <p className={TYPOGRAPHY.captionMuted}>
                        {t("reviews:detail.ccrImpactCityViewHint")}
                    </p>
                    <CodeCityTreemap
                        fileColorById={state.reviewHistoryColorByFileId}
                        files={state.reviewContextTreemapFiles}
                        height="420px"
                        highlightedFileId={state.reviewContextHighlightedFileId}
                        impactedFiles={state.reviewContextImpactedFiles}
                        onFileSelect={state.handleReviewContextMiniMapSelect}
                        title={t("reviews:detail.ccrImpactCodeCityView")}
                    />
                    <div className="flex flex-wrap items-end gap-2">
                        <Button
                            aria-label={
                                state.isReviewHistoryHeatmapEnabled
                                    ? t("reviews:detail.hideReviewHistoryHeatmap")
                                    : t("reviews:detail.showReviewHistoryHeatmap")
                            }
                            size="sm"
                            type="button"
                            variant="secondary"
                            onPress={(): void => {
                                state.setReviewHistoryHeatmapEnabled(
                                    state.isReviewHistoryHeatmapEnabled === false,
                                )
                            }}
                        >
                            {state.isReviewHistoryHeatmapEnabled
                                ? t("reviews:detail.hideReviewHistoryHeatmap")
                                : t("reviews:detail.showReviewHistoryHeatmap")}
                        </Button>
                        <label
                            className="text-xs text-foreground"
                            htmlFor="review-history-window"
                        >
                            {t("reviews:detail.reviewHistoryWindow")}
                        </label>
                        <select
                            aria-label={t("reviews:detail.reviewHistoryWindow")}
                            className={NATIVE_FORM.select}
                            id="review-history-window"
                            value={state.selectedReviewHistoryWindow}
                            onChange={(event): void => {
                                const nextWindow = event.currentTarget.value
                                if (
                                    nextWindow === "7d" ||
                                    nextWindow === "30d" ||
                                    nextWindow === "90d"
                                ) {
                                    state.setSelectedReviewHistoryWindow(nextWindow)
                                }
                            }}
                        >
                            <option value="7d">7d</option>
                            <option value="30d">30d</option>
                            <option value="90d">90d</option>
                        </select>
                    </div>
                    <Alert status={state.isReviewHistoryHeatmapEnabled ? "success" : "accent"}>
                        <Alert.Title>
                            {t("reviews:detail.reviewHistoryHeatmapTitle")}
                        </Alert.Title>
                        <Alert.Description>
                            {state.isReviewHistoryHeatmapEnabled
                                ? t("reviews:detail.heatmapEnabled", {
                                      window: state.selectedReviewHistoryWindow,
                                  })
                                : t("reviews:detail.heatmapDisabled")}
                        </Alert.Description>
                    </Alert>
                    <ul
                        aria-label={t("reviews:ariaLabel.detail.reviewHistoryHeatmapList")}
                        className="space-y-1"
                    >
                        {state.hottestReviewHistoryEntries.map(
                            (entry): ReactElement => (
                                <li
                                    className="rounded border border-border bg-surface px-2 py-1 text-xs text-foreground"
                                    key={`review-history-${entry.filePath}`}
                                >
                                    <span className="font-semibold">{entry.filePath}</span>{" "}
                                    · reviews{" "}
                                    {String(
                                        entry.reviewsByWindow[
                                            state.selectedReviewHistoryWindow
                                        ],
                                    )}
                                    {entry.filePath === state.activeFilePath
                                        ? ` ${t("reviews:detail.focused")}`
                                        : ""}
                                </li>
                            ),
                        )}
                    </ul>
                    <ImpactAnalysisPanel
                        onApplyImpact={state.handleApplyImpactFocus}
                        seeds={state.reviewImpactSeeds}
                    />
                    <Alert status="accent">
                        <Alert.Title>{t("reviews:detail.blastRadiusStatus")}</Alert.Title>
                        <Alert.Description>
                            {state.impactFocusStatus.length === 0
                                ? t("reviews:detail.noBlastRadiusFocus")
                                : state.impactFocusStatus}
                        </Alert.Description>
                    </Alert>
                    <div className="rounded-lg border border-border bg-surface p-3">
                        <p className={TYPOGRAPHY.cardTitle}>
                            {t("reviews:detail.fileNeighborhoodPanel")}
                        </p>
                        <p className={TYPOGRAPHY.captionMuted}>
                            {t("reviews:detail.focusedFile")}{" "}
                            {state.activeFilePath ?? t("reviews:detail.noneSelected")}
                        </p>
                        {state.activeNeighborhoodFiles.length === 0 ? (
                            <p className={`mt-2 ${TYPOGRAPHY.captionMuted}`}>
                                {t("reviews:detail.noNeighboringFiles")}
                            </p>
                        ) : (
                            <ul
                                aria-label={t(
                                    "reviews:ariaLabel.detail.activeFileNeighborhoodList",
                                )}
                                className="mt-2 space-y-1"
                            >
                                {state.activeNeighborhoodFiles.map(
                                    (filePath): ReactElement => (
                                        <li key={filePath}>
                                            <button
                                                aria-label={`Open neighborhood file ${filePath}`}
                                                className="w-full rounded border border-border bg-surface px-2 py-1 text-left text-xs text-foreground hover:bg-surface-secondary"
                                                type="button"
                                                onClick={(): void => {
                                                    state.setActiveFilePath(filePath)
                                                }}
                                            >
                                                {filePath}
                                            </button>
                                        </li>
                                    ),
                                )}
                            </ul>
                        )}
                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                            <div className="rounded border border-border bg-surface p-2">
                                <p className="text-xs font-semibold text-foreground">
                                    {t("reviews:detail.dependencies")}
                                </p>
                                <ul
                                    aria-label={t(
                                        "reviews:ariaLabel.detail.neighborhoodDependencyList",
                                    )}
                                    className="mt-1 space-y-1 text-xs text-foreground"
                                >
                                    {(state.activeNeighborhoodDetails?.dependencies.length ??
                                        0) === 0 ? (
                                        <li>{t("reviews:detail.none")}</li>
                                    ) : (
                                        state.activeNeighborhoodDetails?.dependencies.map(
                                            (dependencyPath): ReactElement => (
                                                <li key={`dependency-${dependencyPath}`}>
                                                    {dependencyPath}
                                                </li>
                                            ),
                                        )
                                    )}
                                </ul>
                            </div>
                            <div className="rounded border border-border bg-surface p-2">
                                <p className="text-xs font-semibold text-foreground">
                                    {t("reviews:detail.recentChanges")}
                                </p>
                                <ul
                                    aria-label={t(
                                        "reviews:ariaLabel.detail.neighborhoodRecentChangesList",
                                    )}
                                    className="mt-1 space-y-1 text-xs text-foreground"
                                >
                                    {(state.activeNeighborhoodDetails?.recentChanges.length ??
                                        0) === 0 ? (
                                        <li>{t("reviews:detail.none")}</li>
                                    ) : (
                                        state.activeNeighborhoodDetails?.recentChanges.map(
                                            (changeRecord): ReactElement => (
                                                <li key={`recent-change-${changeRecord}`}>
                                                    {changeRecord}
                                                </li>
                                            ),
                                        )
                                    )}
                                </ul>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
            {streamSourceUrl === undefined ? null : (
                <SseStreamViewer
                    autoStart={false}
                    eventSourceUrl={streamSourceUrl}
                    title={`${t("reviews:detail.liveReviewStreamTitle")} · ${ccrId}`}
                    maxReconnectAttempts={2}
                />
            )}
            <ReviewCommentThread threads={state.ccrReviewThreads} />
        </div>
    )
}
