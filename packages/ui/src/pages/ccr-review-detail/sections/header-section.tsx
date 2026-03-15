/**
 * Секция заголовка страницы детального просмотра CCR review.
 *
 * Отображает метаданные CCR (название, идентификатор, репозиторий, команду, статус),
 * саммари code review, кнопки решения review (Approve/RequestChanges/SaveAsInProgress),
 * ссылку завершения review и информацию об assignee, комментариях, обновлениях и файлах.
 */

import type { ReactElement } from "react"
import { useTranslation } from "react-i18next"
import { Alert, Button, Card, CardContent, CardHeader } from "@heroui/react"
import { Link } from "@tanstack/react-router"

import { LINK_CLASSES, TYPOGRAPHY } from "@/lib/constants/typography"
import type { ICcrRowData } from "@/lib/types/ccr-types"

import type { ICcrReviewState } from "../hooks/use-ccr-review-state"

/**
 * Свойства компонента секции заголовка CCR review.
 */
interface IHeaderSectionProps {
    /**
     * Состояние страницы CCR review.
     */
    readonly state: ICcrReviewState
    /**
     * Данные CCR, для которой отображается заголовок.
     */
    readonly ccr: ICcrRowData
}

/**
 * Секция заголовка CCR review.
 *
 * Содержит метаданные CCR, саммари code review, кнопки управления решением,
 * ссылку завершения review, предупреждение о ролевых ограничениях,
 * и сводную информацию об assignee, комментариях, дате обновления и прикреплённых файлах.
 *
 * @param props - Свойства компонента.
 * @returns Элемент секции заголовка.
 */
export function HeaderSection(props: IHeaderSectionProps): ReactElement {
    const { state, ccr } = props
    const { t } = useTranslation(["reviews"])

    return (
        <Card>
            <CardHeader>
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-sm text-muted">{t("reviews:detail.ccrReview")}</p>
                        <h1 className={TYPOGRAPHY.pageTitle}>{ccr.title}</h1>
                        <p className={TYPOGRAPHY.body}>
                            {ccr.id} · {ccr.repository} · {ccr.team} · {ccr.status}
                        </p>
                        {state.codeReview.codeReviewQuery.data?.summary === undefined ? null : (
                            <p className={`mt-1 ${TYPOGRAPHY.captionMuted}`}>
                                {state.codeReview.codeReviewQuery.data.summary}
                            </p>
                        )}
                        {state.codeReview.codeReviewQuery.error === null ||
                        state.codeReview.codeReviewQuery.error === undefined ? null : (
                            <p className="mt-1 text-xs text-warning">
                                {t("reviews:detail.liveReviewUnavailable")}
                            </p>
                        )}
                        <p className="mt-2 text-xs uppercase tracking-[0.08em] text-muted">
                            {t("reviews:detail.reviewDecisionLabel")}{" "}
                            {state.translatedDecisionLabels[state.reviewDecision]}
                        </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        {state.reviewDecisionPolicy.visibility === "hidden" ? null : (
                            <>
                                <Button
                                    variant={
                                        state.reviewDecision === "approved" ? "tertiary" : "ghost"
                                    }
                                    isDisabled={
                                        state.reviewDecisionPolicy.visibility === "disabled"
                                    }
                                    onPress={(): void => {
                                        state.handleReviewDecisionChange("approved")
                                    }}
                                    size="sm"
                                    type="button"
                                >
                                    {t("reviews:detail.approveReview")}
                                </Button>
                                <Button
                                    variant={
                                        state.reviewDecision === "rejected" ? "danger" : "ghost"
                                    }
                                    isDisabled={
                                        state.reviewDecisionPolicy.visibility === "disabled"
                                    }
                                    onPress={(): void => {
                                        state.handleReviewDecisionChange("rejected")
                                    }}
                                    size="sm"
                                    type="button"
                                >
                                    {t("reviews:detail.requestChanges")}
                                </Button>
                                <Button
                                    variant={
                                        state.reviewDecision === "pending" ? "primary" : "ghost"
                                    }
                                    isDisabled={
                                        state.reviewDecisionPolicy.visibility === "disabled"
                                    }
                                    onPress={(): void => {
                                        state.handleReviewDecisionChange("pending")
                                    }}
                                    size="sm"
                                    type="button"
                                >
                                    {t("reviews:detail.saveAsInProgress")}
                                </Button>
                            </>
                        )}
                        {state.reviewFinishPolicy.visibility ===
                        "hidden" ? null : state.reviewFinishPolicy.visibility === "disabled" ? (
                            <p className="text-sm text-muted">
                                {t("reviews:detail.finishReviewUnavailable")}{" "}
                                {state.reviewFinishPolicy.reason ??
                                    t("reviews:detail.insufficientRolePermissions")}
                            </p>
                        ) : (
                            <Link className={`${LINK_CLASSES} text-sm`} to="/reviews">
                                {t("reviews:detail.finishReview")}
                            </Link>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-2">
                {state.reviewDecisionPolicy.reason === undefined ||
                state.reviewDecisionPolicy.visibility === "enabled" ? null : (
                    <Alert status="warning">
                        <Alert.Title>{t("reviews:detail.roleBasedRestriction")}</Alert.Title>
                        <Alert.Description>
                            {state.reviewDecisionPolicy.reason}
                        </Alert.Description>
                    </Alert>
                )}
                <p className={TYPOGRAPHY.body}>
                    <strong>{t("reviews:detail.assignee")}</strong> {ccr.assignee}
                </p>
                <p className={TYPOGRAPHY.body}>
                    <strong>{t("reviews:detail.comments")}</strong> {ccr.comments}
                </p>
                <p className={TYPOGRAPHY.body}>
                    <strong>{t("reviews:detail.updated")}</strong> {ccr.updatedAt}
                </p>
                <p className={TYPOGRAPHY.body}>
                    <strong>{t("reviews:detail.attachedFiles")}</strong>{" "}
                    {ccr.attachedFiles.length === 0
                        ? t("reviews:detail.noAttachedFiles")
                        : ccr.attachedFiles.join(", ")}
                </p>
            </CardContent>
        </Card>
    )
}
