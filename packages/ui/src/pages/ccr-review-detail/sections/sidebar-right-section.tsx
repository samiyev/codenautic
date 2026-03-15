/**
 * Секция правой боковой панели CCR review.
 *
 * Отображает индикатор риска, статус решения review, SafeGuard decision trace,
 * feedback learning loop, conversation threads и ChatPanel.
 */

import type { ReactElement } from "react"
import { useTranslation } from "react-i18next"
import { Alert, Button, Card, CardContent, CardHeader, Chip } from "@heroui/react"

import { ChatPanel } from "@/components/chat/chat-panel"
import { ChatThreadList } from "@/components/chat/chat-thread-list"
import { useDynamicTranslation } from "@/lib/i18n"
import { TYPOGRAPHY } from "@/lib/constants/typography"

import { mapReviewRiskChipColor } from "../ccr-review-detail.utils"
import { formatFeedbackTimestamp } from "../ccr-review-detail.utils"
import { SAFEGUARD_FILTER_SEQUENCE } from "../ccr-review-detail.constants"
import type { ICcrReviewState } from "../hooks/use-ccr-review-state"

/**
 * Свойства компонента правой боковой секции.
 */
interface ISidebarRightSectionProps {
    /**
     * Состояние страницы CCR review.
     */
    readonly state: ICcrReviewState
    /**
     * Идентификатор CCR.
     */
    readonly ccrId: string
}

/**
 * Правая боковая секция CCR review.
 *
 * Содержит индикатор риска review с оценкой и причинами, статус текущего решения,
 * SafeGuard decision trace с детализацией pipeline-фильтров, панель reviewer feedback
 * с learning loop, список conversation threads и встроенный ChatPanel.
 *
 * @param props - Свойства компонента.
 * @returns Элемент правой боковой секции.
 */
export function SidebarRightSection(props: ISidebarRightSectionProps): ReactElement {
    const { state, ccrId } = props
    const { t } = useTranslation(["reviews"])
    const { td } = useDynamicTranslation(["reviews"])

    return (
        <>
            <Card>
                <CardHeader>
                    <p className={TYPOGRAPHY.cardTitle}>
                        {t("reviews:detail.reviewRiskIndicator")}
                    </p>
                </CardHeader>
                <CardContent className="space-y-2">
                    <div className="flex items-center gap-2">
                        <Chip
                            aria-label={`Review risk level ${state.reviewRiskIndicator.level}`}
                            color={mapReviewRiskChipColor(state.reviewRiskIndicator.level)}
                            size="sm"
                            variant="soft"
                        >
                            {state.reviewRiskIndicator.level.toUpperCase()}
                        </Chip>
                        <p className="text-xs text-foreground">
                            {t("reviews:detail.riskScore")}{" "}
                            {String(state.reviewRiskIndicator.score)}
                        </p>
                    </div>
                    <ul
                        aria-label={t("reviews:ariaLabel.detail.reviewRiskDriversList")}
                        className="space-y-1 text-xs text-foreground"
                    >
                        {state.reviewRiskIndicator.reasons.map(
                            (reason): ReactElement => (
                                <li key={`risk-reason-${reason}`}>{reason}</li>
                            ),
                        )}
                    </ul>
                </CardContent>
            </Card>
            <Alert
                status={
                    state.decisionBadge.color === "primary"
                        ? "accent"
                        : state.decisionBadge.color
                }
            >
                {t("reviews:detail.reviewStatusMessage")}{" "}
                <strong>{state.translatedDecisionLabels[state.reviewDecision]}</strong>.{" "}
                {t("reviews:detail.reviewStatusHint")}
            </Alert>
            <Card>
                <CardHeader>
                    <p className={TYPOGRAPHY.cardTitle}>
                        {t("reviews:detail.safeGuardDecisionTrace")}
                    </p>
                </CardHeader>
                <CardContent className="space-y-3">
                    <p className={TYPOGRAPHY.body}>
                        {t("reviews:detail.appliedFilters")}{" "}
                        {SAFEGUARD_FILTER_SEQUENCE.map((filter): string => {
                            return state.translatedFilterLabels[filter]
                        }).join(", ")}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                        <Chip size="sm" variant="soft">
                            {t("reviews:detail.visible")} {state.visibleTraceCount}
                        </Chip>
                        <Chip size="sm" variant="soft">
                            {t("reviews:detail.filteredOut")} {state.filteredOutTraceCount}
                        </Chip>
                    </div>
                    <ul
                        aria-label={t("reviews:ariaLabel.detail.safeGuardTraceList")}
                        className="space-y-2"
                    >
                        {state.safeGuardTraceItems.map((traceItem): ReactElement => {
                            const isActive =
                                state.activeSafeGuardTraceItem?.id === traceItem.id
                            return (
                                <li key={traceItem.id}>
                                    <button
                                        aria-label={`Open trace for ${traceItem.id}`}
                                        className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition ${
                                            isActive
                                                ? "border-accent/30 bg-accent/10 text-accent-foreground"
                                                : "border-border bg-surface text-foreground hover:bg-surface"
                                        }`}
                                        type="button"
                                        onClick={(): void => {
                                            state.setActiveSafeGuardTraceId(traceItem.id)
                                        }}
                                    >
                                        <p className="font-semibold">{traceItem.id}</p>
                                        <p className="truncate">{traceItem.remark}</p>
                                        <p className="mt-1 text-[11px] text-muted">
                                            {traceItem.filePath}
                                        </p>
                                    </button>
                                </li>
                            )
                        })}
                    </ul>
                    {state.activeSafeGuardTraceItem === undefined ? null : (
                        <div className="rounded-lg border border-border bg-surface p-3">
                            <p className={TYPOGRAPHY.cardTitle}>
                                {state.activeSafeGuardTraceItem.id}:{" "}
                                {state.activeSafeGuardTraceItem.remark}
                            </p>
                            <p className={`mt-1 ${TYPOGRAPHY.captionMuted}`}>
                                {t("reviews:detail.decisionLabel")}{" "}
                                {state.activeSafeGuardTraceItem.finalDecision === "shown"
                                    ? t("reviews:detail.decisionShown")
                                    : t("reviews:detail.decisionFilteredOut")}
                            </p>
                            {state.activeSafeGuardTraceItem.hiddenReason ===
                            undefined ? null : (
                                <p className={`mt-1 ${TYPOGRAPHY.captionMuted}`}>
                                    {t("reviews:detail.hiddenReason")}{" "}
                                    {state.activeSafeGuardTraceItem.hiddenReason}
                                </p>
                            )}
                            <ul
                                aria-label={t(
                                    "reviews:ariaLabel.detail.safeGuardPipelineDetails",
                                )}
                                className="mt-2 space-y-2 text-xs text-foreground"
                            >
                                {state.activeSafeGuardTraceItem.steps.map(
                                    (step): ReactElement => (
                                        <li
                                            className="rounded-md border border-border bg-surface p-2"
                                            key={`${state.activeSafeGuardTraceItem?.id ?? "trace"}-${step.filterId}`}
                                        >
                                            <p className="font-semibold">
                                                {state.translatedFilterLabels[step.filterId]}{" "}
                                                —{" "}
                                                {
                                                    state.translatedSafeGuardStepLabels[
                                                        step.status
                                                    ]
                                                }
                                            </p>
                                            <p>{step.reason}</p>
                                        </li>
                                    ),
                                )}
                            </ul>
                        </div>
                    )}
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <p className={TYPOGRAPHY.cardTitle}>
                        {t("reviews:detail.reviewerFeedbackLearningLoop")}
                    </p>
                </CardHeader>
                <CardContent className="space-y-3">
                    <p className="text-sm text-foreground">
                        {t("reviews:detail.feedbackHint")}
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {(["false_positive", "irrelevant", "duplicate"] as const).map(
                            (reason): ReactElement => {
                                const isSelected =
                                    state.selectedFeedbackReason === reason
                                return (
                                    <Button
                                        key={reason}
                                        aria-label={td(
                                            "reviews:detail.quickActionAriaLabel",
                                            {
                                                reason: state
                                                    .translatedFeedbackReasonLabels[reason],
                                            },
                                        )}
                                        size="sm"
                                        type="button"
                                        variant={isSelected ? "primary" : "secondary"}
                                        onPress={(): void => {
                                            state.setSelectedFeedbackReason(reason)
                                        }}
                                    >
                                        {state.translatedFeedbackReasonLabels[reason]}
                                    </Button>
                                )
                            },
                        )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            aria-label={t("reviews:detail.acceptFeedback")}
                            variant="tertiary"
                            size="sm"
                            type="button"
                            onPress={(): void => {
                                state.handleSubmitReviewerFeedback("accepted")
                            }}
                        >
                            {t("reviews:detail.acceptFeedback")}
                        </Button>
                        <Button
                            aria-label={t("reviews:detail.rejectFeedback")}
                            variant="danger"
                            size="sm"
                            type="button"
                            onPress={(): void => {
                                state.handleSubmitReviewerFeedback("rejected")
                            }}
                        >
                            {t("reviews:detail.rejectFeedback")}
                        </Button>
                    </div>
                    {state.latestActiveTraceFeedback === undefined ? (
                        <Alert status="warning">
                            <Alert.Title>
                                {t("reviews:detail.noFeedbackYetTitle")}
                            </Alert.Title>
                            <Alert.Description>
                                {t("reviews:detail.noFeedbackYetHint")}
                            </Alert.Description>
                        </Alert>
                    ) : (
                        <div className="rounded-lg border border-border bg-surface p-3 text-xs text-foreground">
                            <p>
                                {t("reviews:detail.feedbackStatusLabel")}{" "}
                                <strong>{state.latestActiveTraceFeedback.status}</strong>
                            </p>
                            <p>
                                {t("reviews:detail.latestReasonLabel")}{" "}
                                <strong>
                                    {
                                        state.translatedFeedbackReasonLabels[
                                            state.latestActiveTraceFeedback.reason
                                        ]
                                    }
                                </strong>
                            </p>
                            {state.latestActiveTraceFeedback.status === "rejected" ? (
                                <p>
                                    {t("reviews:detail.rejectionReasonLabel")}{" "}
                                    {state.latestActiveTraceFeedback.details}
                                </p>
                            ) : (
                                <p>
                                    {t("reviews:detail.appliedOutcomeLabel")}{" "}
                                    {state.latestActiveTraceFeedback.details}
                                </p>
                            )}
                            {state.latestActiveTraceFeedback.linkedTraceId ===
                            undefined ? null : (
                                <p>
                                    {t("reviews:detail.linkedTo", {
                                        traceId:
                                            state.latestActiveTraceFeedback.linkedTraceId,
                                    })}
                                </p>
                            )}
                        </div>
                    )}
                    <ul
                        aria-label={t("reviews:ariaLabel.detail.feedbackHistoryList")}
                        className="space-y-2"
                    >
                        {state.activeTraceFeedbackHistory.map(
                            (feedbackRecord): ReactElement => (
                                <li
                                    className="rounded-md border border-border bg-surface p-2 text-xs text-foreground"
                                    key={feedbackRecord.id}
                                >
                                    <p className="font-semibold">
                                        {feedbackRecord.id} · {feedbackRecord.status}
                                    </p>
                                    <p>
                                        {t("reviews:detail.feedbackReasonLabel")}{" "}
                                        {
                                            state.translatedFeedbackReasonLabels[
                                                feedbackRecord.reason
                                            ]
                                        }
                                    </p>
                                    <p>
                                        {t("reviews:detail.feedbackTimeLabel")}{" "}
                                        {formatFeedbackTimestamp(feedbackRecord.createdAt)}
                                    </p>
                                    <p>{feedbackRecord.details}</p>
                                </li>
                            ),
                        )}
                    </ul>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <p className={TYPOGRAPHY.cardTitle}>
                        {t("reviews:detail.conversationThreads")}
                    </p>
                </CardHeader>
                <CardContent className="p-0">
                    <ChatThreadList
                        activeThreadId={state.activeThreadId}
                        onArchiveThread={state.handleArchiveThread}
                        onCloseThread={state.handleCloseThread}
                        onNewThread={state.handleNewThread}
                        onSelectThread={state.setActiveThreadId}
                        threads={state.threads}
                    />
                </CardContent>
            </Card>
            <ChatPanel
                activeContextId={state.contextItem.id}
                className="!static !inset-auto !z-auto !w-full !max-w-none !translate-x-0 !transform-none !border !border-border !shadow-none"
                contextItems={[state.contextItem]}
                emptyStateText={t("reviews:detail.chatEmptyState", { ccrId })}
                inputAriaLabel={t("reviews:detail.chatInputAriaLabel")}
                isOpen
                maxMessageLength={2500}
                messageListAriaLabel={td("reviews:detail.chatMessagesAriaLabel", {
                    ccrId,
                })}
                messages={state.activeMessages}
                onSendMessage={state.handleSendMessage}
                panelAriaLabel={t("reviews:detail.chatPanelAriaLabel", { ccrId })}
                placeholder={t("reviews:detail.chatPlaceholder", { ccrId })}
                quickActions={state.quickActions}
                title={`${t("reviews:detail.chatTitle")} · ${ccrId}`}
            />
        </>
    )
}
