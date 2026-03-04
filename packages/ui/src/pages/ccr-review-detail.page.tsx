import { useMemo, useRef, useState, type ReactElement } from "react"
import { Link } from "@tanstack/react-router"

import { ChatPanel, type IChatPanelContext, type IChatPanelMessage } from "@/components/chat/chat-panel"
import { ChatThreadList, type IChatThread } from "@/components/chat/chat-thread-list"
import { ReviewCommentThread } from "@/components/reviews/review-comment-thread"
import { CodeDiffViewer } from "@/components/reviews/code-diff-viewer"
import { Alert, Button, Card, CardBody, CardHeader, Chip } from "@/components/ui"
import { SseStreamViewer } from "@/components/streaming/sse-stream-viewer"
import { getUiActionPolicy, useUiRole } from "@/lib/permissions/ui-policy"
import {
    ccrToContextItem,
    getCcrDiffById,
    getCcrReviewThreadsById,
    type ICcrDiffFile,
    type IReviewCommentThread,
    type ICcrRowData,
} from "@/pages/ccr-data"

type TReviewDecision = "approved" | "pending" | "rejected"
type TThreadMessagesMap = Readonly<Record<string, ReadonlyArray<IChatPanelMessage>>>
type TSafeGuardFilterId = "dedup" | "hallucination" | "severity"
type TSafeGuardStepStatus = "applied" | "filtered_out" | "passed"
type TReviewerFeedbackReason = "duplicate" | "false_positive" | "irrelevant"
type TReviewerFeedbackStatus = "accepted" | "rejected"

interface ISafeGuardTraceStep {
    /** Идентификатор фильтра SafeGuard. */
    readonly filterId: TSafeGuardFilterId
    /** Результат прохождения фильтра. */
    readonly status: TSafeGuardStepStatus
    /** Объяснение принятого решения. */
    readonly reason: string
}

interface ISafeGuardTraceItem {
    /** Идентификатор trace-записи. */
    readonly id: string
    /** Итоговый статус замечания после SafeGuard pipeline. */
    readonly finalDecision: "hidden" | "shown"
    /** Файл, к которому относится замечание. */
    readonly filePath: string
    /** Причина скрытия замечания, если применимо. */
    readonly hiddenReason?: string
    /** Краткое содержание замечания. */
    readonly remark: string
    /** Шаги pipeline по фильтрам. */
    readonly steps: ReadonlyArray<ISafeGuardTraceStep>
}

interface IReviewerFeedbackRecord {
    /** Время отправки feedback. */
    readonly createdAt: string
    /** Детализированный outcome или причина отказа. */
    readonly details: string
    /** Идентификатор feedback события. */
    readonly id: string
    /** Связанный remark id, если feedback смержен как duplicate. */
    readonly linkedTraceId?: string
    /** Причина из quick action. */
    readonly reason: TReviewerFeedbackReason
    /** Статус применения feedback. */
    readonly status: TReviewerFeedbackStatus
    /** Trace item, к которому относится feedback. */
    readonly traceId: string
}

const SAFEGUARD_FILTER_SEQUENCE: ReadonlyArray<TSafeGuardFilterId> = [
    "dedup",
    "hallucination",
    "severity",
]

const SAFEGUARD_FILTER_LABELS: Readonly<Record<TSafeGuardFilterId, string>> = {
    dedup: "dedup",
    hallucination: "hallucination",
    severity: "severity",
}

const FEEDBACK_REASON_LABELS: Readonly<Record<TReviewerFeedbackReason, string>> = {
    duplicate: "duplicate",
    false_positive: "false positive",
    irrelevant: "irrelevant",
}

const FEEDBACK_REJECTION_REASONS: Readonly<Record<TReviewerFeedbackReason, string>> = {
    duplicate: "No canonical finding was eligible for merge in the current safety window.",
    false_positive: "Evidence bundle confirms the finding and blocks false-positive dismissal.",
    irrelevant: "Rule is mandatory for the active policy and cannot be ignored.",
}

/** Свойства страницы диффа CCR. */
export interface ICcrReviewDetailPageProps {
    /** Данные CCR, для которой рендерится review context. */
    readonly ccr: ICcrRowData
    /** SSE источник для дополнительного стриминга по CCR. */
    readonly streamSourceUrl?: string
}

function buildExplainMessage(ccr: ICcrRowData): string {
    const fileHint =
        ccr.attachedFiles.length > 0
            ? `Focus on ${ccr.attachedFiles[0]}`
            : "Focus on touched files"

    return `Please explain the current diff for ${ccr.id} in ${ccr.repository}. ${fileHint}.`
}

function buildSummaryMessage(ccr: ICcrRowData): string {
    return `Please summarize the key changes and risks in ${ccr.id}: ${ccr.title}.`
}

function buildAttachedFilesText(files: ReadonlyArray<string>): string {
    if (files.length === 0) {
        return "No attached files"
    }

    return files.join(", ")
}

function mapReviewDecisionBadge(reviewDecision: TReviewDecision): {
    readonly color: "danger" | "primary" | "success"
    readonly label: string
} {
    if (reviewDecision === "approved") {
        return {
            color: "success",
            label: "Approved",
        }
    }

    if (reviewDecision === "rejected") {
        return {
            color: "danger",
            label: "Request changes",
        }
    }

    return {
        color: "primary",
        label: "In progress",
    }
}

function getSafeGuardStepStatusLabel(status: TSafeGuardStepStatus): string {
    if (status === "applied") {
        return "applied"
    }
    if (status === "filtered_out") {
        return "filtered out"
    }
    return "passed"
}

function formatFeedbackTimestamp(rawTimestamp: string): string {
    const date = new Date(rawTimestamp)
    if (Number.isNaN(date.getTime())) {
        return "—"
    }

    return date.toLocaleString([], {
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        month: "2-digit",
    })
}

function buildSafeGuardTraceItems(ccr: ICcrRowData): ReadonlyArray<ISafeGuardTraceItem> {
    const primaryFile = ccr.attachedFiles[0] ?? "unknown-file.ts"
    const secondaryFile = ccr.attachedFiles[1] ?? primaryFile

    return [
        {
            finalDecision: "shown",
            filePath: primaryFile,
            id: "SG-001",
            remark: "Missing tenant context validation for review deep-link.",
            steps: [
                {
                    filterId: "dedup",
                    reason: "Unique fingerprint not seen in this CCR.",
                    status: "passed",
                },
                {
                    filterId: "hallucination",
                    reason: "Matched with changed lines and file ownership metadata.",
                    status: "passed",
                },
                {
                    filterId: "severity",
                    reason: "Severity = high, above policy threshold (medium).",
                    status: "applied",
                },
            ],
        },
        {
            finalDecision: "hidden",
            filePath: primaryFile,
            hiddenReason: "Filtered by dedup: same finding already present in SG-001.",
            id: "SG-002",
            remark: "Potential tenant mismatch in deep-link fallback branch.",
            steps: [
                {
                    filterId: "dedup",
                    reason: "Duplicate fingerprint matched SG-001, keeping canonical remark.",
                    status: "filtered_out",
                },
                {
                    filterId: "hallucination",
                    reason: "Skipped because item was removed by earlier dedup stage.",
                    status: "filtered_out",
                },
                {
                    filterId: "severity",
                    reason: "Skipped because item was removed by earlier dedup stage.",
                    status: "filtered_out",
                },
            ],
        },
        {
            finalDecision: "hidden",
            filePath: secondaryFile,
            hiddenReason: "Filtered by severity: low confidence minor style suggestion.",
            id: "SG-003",
            remark: "Rename helper to align with naming convention.",
            steps: [
                {
                    filterId: "dedup",
                    reason: "No duplicates found for this semantic signal.",
                    status: "passed",
                },
                {
                    filterId: "hallucination",
                    reason: "Context evidence exists in diff, signal accepted as valid.",
                    status: "passed",
                },
                {
                    filterId: "severity",
                    reason: "Severity below configured threshold (low < medium).",
                    status: "filtered_out",
                },
            ],
        },
    ]
}

/** Страница страницы отдельного CCR review с авто-подставленным контекстом чата. */
export function CcrReviewDetailPage(props: ICcrReviewDetailPageProps): ReactElement {
    const { ccr } = props
    const activeUiRole = useUiRole()
    const [reviewDecision, setReviewDecision] = useState<TReviewDecision>("pending")
    const [activeFilePath, setActiveFilePath] = useState<string | undefined>(ccr.attachedFiles[0])
    const [threads, setThreads] = useState<ReadonlyArray<IChatThread>>([
        {
            ccr: ccr.id.replace("ccr-", ""),
            id: `${ccr.id}-thread-main`,
            repo: ccr.repository,
            title: `${ccr.id} main review`,
        },
    ])
    const [activeThreadId, setActiveThreadId] = useState<string>(`${ccr.id}-thread-main`)
    const [messagesByThread, setMessagesByThread] = useState<TThreadMessagesMap>({})
    const [selectedFeedbackReason, setSelectedFeedbackReason] =
        useState<TReviewerFeedbackReason>("false_positive")
    const [feedbackHistory, setFeedbackHistory] = useState<ReadonlyArray<IReviewerFeedbackRecord>>([
        {
            createdAt: "2026-03-03T10:42:00Z",
            details: "Feedback accepted and scheduled for continuous-learning update.",
            id: "FDBK-001",
            reason: "duplicate",
            status: "accepted",
            traceId: "SG-002",
            linkedTraceId: "SG-001",
        },
        {
            createdAt: "2026-03-03T09:18:00Z",
            details: "Rule is mandatory for the active policy and cannot be ignored.",
            id: "FDBK-002",
            reason: "irrelevant",
            status: "rejected",
            traceId: "SG-001",
        },
    ])
    const nextMessageId = useRef(0)
    const nextThreadId = useRef(1)
    const nextFeedbackId = useRef(3)
    const contextItem = useMemo((): IChatPanelContext => {
        return ccrToContextItem(ccr)
    }, [ccr])
    const ccrDiffFiles = useMemo((): ReadonlyArray<ICcrDiffFile> => {
        return getCcrDiffById(ccr.id)
    }, [ccr.id])
    const ccrReviewThreads = useMemo((): ReadonlyArray<IReviewCommentThread> => {
        return getCcrReviewThreadsById(ccr.id)
    }, [ccr.id])
    const safeGuardTraceItems = useMemo((): ReadonlyArray<ISafeGuardTraceItem> => {
        return buildSafeGuardTraceItems(ccr)
    }, [ccr])
    const [activeSafeGuardTraceId, setActiveSafeGuardTraceId] = useState<string>("")
    const visibleDiffFiles = useMemo((): ReadonlyArray<ICcrDiffFile> => {
        if (activeFilePath === undefined) {
            return ccrDiffFiles
        }

        const focusedFiles = ccrDiffFiles.filter((file): boolean => file.filePath === activeFilePath)
        if (focusedFiles.length === 0) {
            return ccrDiffFiles
        }

        return focusedFiles
    }, [activeFilePath, ccrDiffFiles])
    const activeMessages = activeThreadId.length === 0 ? [] : (messagesByThread[activeThreadId] ?? [])
    const decisionBadge = mapReviewDecisionBadge(reviewDecision)
    const activeSafeGuardTraceItem = useMemo((): ISafeGuardTraceItem | undefined => {
        const selectedTrace = safeGuardTraceItems.find((item): boolean => {
            return item.id === activeSafeGuardTraceId
        })
        return selectedTrace ?? safeGuardTraceItems[0]
    }, [activeSafeGuardTraceId, safeGuardTraceItems])
    const filteredOutTraceCount = useMemo((): number => {
        return safeGuardTraceItems.filter((item): boolean => item.finalDecision === "hidden").length
    }, [safeGuardTraceItems])
    const visibleTraceCount = safeGuardTraceItems.length - filteredOutTraceCount
    const reviewDecisionPolicy = useMemo(() => {
        return getUiActionPolicy(activeUiRole, "review.decision")
    }, [activeUiRole])
    const reviewFinishPolicy = useMemo(() => {
        return getUiActionPolicy(activeUiRole, "review.finish")
    }, [activeUiRole])
    const activeTraceFeedbackHistory = useMemo((): ReadonlyArray<IReviewerFeedbackRecord> => {
        if (activeSafeGuardTraceItem === undefined) {
            return []
        }

        return feedbackHistory.filter((feedbackRecord): boolean => {
            return (
                feedbackRecord.traceId === activeSafeGuardTraceItem.id
                || feedbackRecord.linkedTraceId === activeSafeGuardTraceItem.id
            )
        })
    }, [activeSafeGuardTraceItem, feedbackHistory])
    const latestActiveTraceFeedback = activeTraceFeedbackHistory[0]

    const quickActions = useMemo(
        (): ReadonlyArray<{
            readonly id: string
            readonly label: string
            readonly message: string
        }> => [
            {
                id: "explain-this-file",
                label: "explain this file",
                message: buildExplainMessage(ccr),
            },
            {
                id: "summarize-changes",
                label: "summarize changes",
                message: buildSummaryMessage(ccr),
            },
        ],
        [ccr],
    )

    const handleSendMessage = (message: string): void => {
        const normalizedMessage = message.trim()
        if (normalizedMessage.length === 0 || activeThreadId.length === 0) {
            return
        }

        nextMessageId.current += 1
        setMessagesByThread((previousValue): TThreadMessagesMap => {
            const currentThreadMessages = previousValue[activeThreadId] ?? []
            const nextMessage: IChatPanelMessage = {
                content: normalizedMessage,
                createdAt: new Date().toISOString(),
                id: `ccr-message-${String(nextMessageId.current)}`,
                role: "user",
                sender: "You",
            }

            return {
                ...previousValue,
                [activeThreadId]: [...currentThreadMessages, nextMessage],
            }
        })
    }

    const handleNewThread = (): void => {
        nextThreadId.current += 1
        const nextThreadIdValue = `${ccr.id}-thread-${String(nextThreadId.current)}`
        const nextThread: IChatThread = {
            ccr: ccr.id.replace("ccr-", ""),
            id: nextThreadIdValue,
            repo: ccr.repository,
            title: `Follow-up ${String(nextThreadId.current)}`,
        }

        setThreads((previous): ReadonlyArray<IChatThread> => [...previous, nextThread])
        setActiveThreadId(nextThreadIdValue)
    }

    const handleCloseThread = (threadId: string): void => {
        setThreads((previous): ReadonlyArray<IChatThread> => {
            const nextThreads = previous.filter((thread): boolean => thread.id !== threadId)
            if (activeThreadId === threadId) {
                setActiveThreadId(nextThreads[0]?.id ?? "")
            }

            return nextThreads
        })
    }

    const handleArchiveThread = (threadId: string): void => {
        setThreads((previous): ReadonlyArray<IChatThread> =>
            previous.map((thread): IChatThread => {
                if (thread.id !== threadId) {
                    return thread
                }

                return {
                    ...thread,
                    isArchived: true,
                    title: `${thread.title} (archived)`,
                }
            }),
        )
    }

    const handleSubmitReviewerFeedback = (status: TReviewerFeedbackStatus): void => {
        if (activeSafeGuardTraceItem === undefined) {
            return
        }

        const linkedTraceId =
            selectedFeedbackReason === "duplicate"
                ? safeGuardTraceItems.find((traceItem): boolean => {
                      return (
                          traceItem.finalDecision === "shown"
                          && traceItem.id !== activeSafeGuardTraceItem.id
                      )
                  })?.id
                : undefined

        const details =
            status === "accepted"
                ? linkedTraceId === undefined
                    ? "Feedback accepted and scheduled for continuous-learning update."
                    : `Feedback accepted and linked with ${linkedTraceId}.`
                : FEEDBACK_REJECTION_REASONS[selectedFeedbackReason]

        nextFeedbackId.current += 1
        const feedbackRecord: IReviewerFeedbackRecord = {
            createdAt: new Date().toISOString(),
            details,
            id: `FDBK-${String(nextFeedbackId.current).padStart(3, "0")}`,
            linkedTraceId,
            reason: selectedFeedbackReason,
            status,
            traceId: activeSafeGuardTraceItem.id,
        }

        setFeedbackHistory((previous): ReadonlyArray<IReviewerFeedbackRecord> => {
            return [feedbackRecord, ...previous]
        })
    }

    const handleReviewDecisionChange = (nextDecision: TReviewDecision): void => {
        if (reviewDecisionPolicy.visibility !== "enabled") {
            return
        }

        setReviewDecision(nextDecision)
    }

    return (
        <section className="space-y-4">
            <Card>
                <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-sm text-slate-500">CCR review</p>
                            <h1 className="text-2xl font-semibold text-slate-900">{ccr.title}</h1>
                            <p className="text-sm text-slate-700">
                                {ccr.id} · {ccr.repository} · {ccr.team} · {ccr.status}
                            </p>
                            <p className="mt-2 text-xs uppercase tracking-[0.08em] text-slate-500">
                                Review decision: {decisionBadge.label}
                            </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            {reviewDecisionPolicy.visibility === "hidden" ? null : (
                                <>
                                    <Button
                                        color="success"
                                        isDisabled={reviewDecisionPolicy.visibility === "disabled"}
                                        onPress={(): void => {
                                            handleReviewDecisionChange("approved")
                                        }}
                                        size="sm"
                                        type="button"
                                        variant={reviewDecision === "approved" ? "solid" : "light"}
                                    >
                                        Approve review
                                    </Button>
                                    <Button
                                        color="danger"
                                        isDisabled={reviewDecisionPolicy.visibility === "disabled"}
                                        onPress={(): void => {
                                            handleReviewDecisionChange("rejected")
                                        }}
                                        size="sm"
                                        type="button"
                                        variant={reviewDecision === "rejected" ? "solid" : "light"}
                                    >
                                        Request changes
                                    </Button>
                                    <Button
                                        color="primary"
                                        isDisabled={reviewDecisionPolicy.visibility === "disabled"}
                                        onPress={(): void => {
                                            handleReviewDecisionChange("pending")
                                        }}
                                        size="sm"
                                        type="button"
                                        variant={reviewDecision === "pending" ? "solid" : "light"}
                                    >
                                        Save as in progress
                                    </Button>
                                </>
                            )}
                            {reviewFinishPolicy.visibility === "hidden" ? null : reviewFinishPolicy.visibility ===
                              "disabled" ? (
                                <p className="text-sm text-slate-500">
                                    Finish review unavailable:{" "}
                                    {reviewFinishPolicy.reason ?? "insufficient role permissions"}
                                </p>
                            ) : (
                                <Link className="text-sm underline underline-offset-4" to="/reviews">
                                    Finish review
                                </Link>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardBody className="space-y-2">
                    {reviewDecisionPolicy.reason === undefined
                    || reviewDecisionPolicy.visibility === "enabled" ? null : (
                        <Alert color="warning" title="Role-based restriction" variant="flat">
                            {reviewDecisionPolicy.reason}
                        </Alert>
                    )}
                    <p className="text-sm text-slate-700">
                        <strong>Assignee:</strong> {ccr.assignee}
                    </p>
                    <p className="text-sm text-slate-700">
                        <strong>Comments:</strong> {ccr.comments}
                    </p>
                    <p className="text-sm text-slate-700">
                        <strong>Updated:</strong> {ccr.updatedAt}
                    </p>
                    <p className="text-sm text-slate-700">
                        <strong>Attached files:</strong> {buildAttachedFilesText(ccr.attachedFiles)}
                    </p>
                </CardBody>
            </Card>

            <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)_420px]">
                <aside className="space-y-4">
                    <Card>
                        <CardHeader>
                            <p className="text-sm font-semibold text-slate-900">Files tree</p>
                        </CardHeader>
                        <CardBody className="space-y-2">
                            {ccrDiffFiles.length === 0 ? (
                                <p className="text-sm text-slate-600">No diff files attached.</p>
                            ) : (
                                ccrDiffFiles.map((file): ReactElement => {
                                    const isActive = file.filePath === activeFilePath
                                    return (
                                        <button
                                            className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                                                isActive
                                                    ? "border-blue-200 bg-blue-50 text-blue-900"
                                                    : "border-slate-200 bg-white text-slate-700"
                                            }`}
                                            key={file.filePath}
                                            onClick={(): void => {
                                                setActiveFilePath(file.filePath)
                                            }}
                                            type="button"
                                        >
                                            {file.filePath}
                                        </button>
                                    )
                                })
                            )}
                        </CardBody>
                    </Card>
                </aside>

                <div className="min-w-0 space-y-4">
                    <CodeDiffViewer files={visibleDiffFiles} />
                    {props.streamSourceUrl === undefined ? null : (
                        <SseStreamViewer
                            autoStart={false}
                            eventSourceUrl={props.streamSourceUrl}
                            title={`Live review stream · ${ccr.id}`}
                            maxReconnectAttempts={2}
                        />
                    )}
                    <ReviewCommentThread threads={ccrReviewThreads} />
                </div>

                <aside className="min-w-0 space-y-4">
                    <Alert color={decisionBadge.color}>
                        Review status: <strong>{decisionBadge.label}</strong>. Use actions in the header
                        to finalize this CCR.
                    </Alert>
                    <Card>
                        <CardHeader>
                            <p className="text-sm font-semibold text-slate-900">SafeGuard decision trace</p>
                        </CardHeader>
                        <CardBody className="space-y-3">
                            <p className="text-sm text-slate-700">
                                Applied filters:{" "}
                                {SAFEGUARD_FILTER_SEQUENCE.map((filter): string => {
                                    return SAFEGUARD_FILTER_LABELS[filter]
                                }).join(", ")}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                                <Chip size="sm" variant="flat">
                                    Visible: {visibleTraceCount}
                                </Chip>
                                <Chip size="sm" variant="flat">
                                    Filtered out: {filteredOutTraceCount}
                                </Chip>
                            </div>
                            <ul aria-label="SafeGuard trace list" className="space-y-2">
                                {safeGuardTraceItems.map((traceItem): ReactElement => {
                                    const isActive = activeSafeGuardTraceItem?.id === traceItem.id
                                    return (
                                        <li key={traceItem.id}>
                                            <button
                                                aria-label={`Open trace for ${traceItem.id}`}
                                                className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition ${
                                                    isActive
                                                        ? "border-blue-200 bg-blue-50 text-blue-900"
                                                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                                }`}
                                                type="button"
                                                onClick={(): void => {
                                                    setActiveSafeGuardTraceId(traceItem.id)
                                                }}
                                            >
                                                <p className="font-semibold">{traceItem.id}</p>
                                                <p className="truncate">{traceItem.remark}</p>
                                                <p className="mt-1 text-[11px] text-slate-500">
                                                    {traceItem.filePath}
                                                </p>
                                            </button>
                                        </li>
                                    )
                                })}
                            </ul>
                            {activeSafeGuardTraceItem === undefined ? null : (
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                    <p className="text-sm font-semibold text-slate-900">
                                        {activeSafeGuardTraceItem.id}: {activeSafeGuardTraceItem.remark}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-600">
                                        Decision:{" "}
                                        {activeSafeGuardTraceItem.finalDecision === "shown"
                                            ? "shown"
                                            : "filtered out"}
                                    </p>
                                    {activeSafeGuardTraceItem.hiddenReason === undefined ? null : (
                                        <p className="mt-1 text-xs text-slate-600">
                                            Hidden reason: {activeSafeGuardTraceItem.hiddenReason}
                                        </p>
                                    )}
                                    <ul
                                        aria-label="SafeGuard pipeline details"
                                        className="mt-2 space-y-2 text-xs text-slate-700"
                                    >
                                        {activeSafeGuardTraceItem.steps.map(
                                            (step): ReactElement => (
                                                <li
                                                    className="rounded-md border border-slate-200 bg-white p-2"
                                                    key={`${activeSafeGuardTraceItem.id}-${step.filterId}`}
                                                >
                                                    <p className="font-semibold">
                                                        {SAFEGUARD_FILTER_LABELS[step.filterId]} —{" "}
                                                        {getSafeGuardStepStatusLabel(step.status)}
                                                    </p>
                                                    <p>{step.reason}</p>
                                                </li>
                                            ),
                                        )}
                                    </ul>
                                </div>
                            )}
                        </CardBody>
                    </Card>
                    <Card>
                        <CardHeader>
                            <p className="text-sm font-semibold text-slate-900">
                                Reviewer feedback learning loop
                            </p>
                        </CardHeader>
                        <CardBody className="space-y-3">
                            <p className="text-sm text-slate-700">
                                Submit feedback in two clicks and track whether it was accepted or
                                rejected.
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {(["false_positive", "irrelevant", "duplicate"] as const).map(
                                    (reason): ReactElement => {
                                        const isSelected = selectedFeedbackReason === reason
                                        return (
                                            <Button
                                                key={reason}
                                                aria-label={`Quick action ${FEEDBACK_REASON_LABELS[reason]}`}
                                                size="sm"
                                                type="button"
                                                variant={isSelected ? "solid" : "flat"}
                                                onPress={(): void => {
                                                    setSelectedFeedbackReason(reason)
                                                }}
                                            >
                                                {FEEDBACK_REASON_LABELS[reason]}
                                            </Button>
                                        )
                                    },
                                )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    aria-label="Accept feedback"
                                    color="success"
                                    size="sm"
                                    type="button"
                                    onPress={(): void => {
                                        handleSubmitReviewerFeedback("accepted")
                                    }}
                                >
                                    Accept feedback
                                </Button>
                                <Button
                                    aria-label="Reject feedback"
                                    color="danger"
                                    size="sm"
                                    type="button"
                                    onPress={(): void => {
                                        handleSubmitReviewerFeedback("rejected")
                                    }}
                                >
                                    Reject feedback
                                </Button>
                            </div>
                            {latestActiveTraceFeedback === undefined ? (
                                <Alert color="warning" title="No feedback yet" variant="flat">
                                    Select a reason and submit feedback for current SafeGuard trace.
                                </Alert>
                            ) : (
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                                    <p>
                                        Feedback status:{" "}
                                        <strong>{latestActiveTraceFeedback.status}</strong>
                                    </p>
                                    <p>
                                        Latest reason:{" "}
                                        <strong>
                                            {FEEDBACK_REASON_LABELS[latestActiveTraceFeedback.reason]}
                                        </strong>
                                    </p>
                                    {latestActiveTraceFeedback.status === "rejected" ? (
                                        <p>
                                            Rejection reason: {latestActiveTraceFeedback.details}
                                        </p>
                                    ) : (
                                        <p>Applied outcome: {latestActiveTraceFeedback.details}</p>
                                    )}
                                    {latestActiveTraceFeedback.linkedTraceId === undefined ? null : (
                                        <p>
                                            Linked to {latestActiveTraceFeedback.linkedTraceId} history.
                                        </p>
                                    )}
                                </div>
                            )}
                            <ul aria-label="Feedback history list" className="space-y-2">
                                {activeTraceFeedbackHistory.map(
                                    (feedbackRecord): ReactElement => (
                                        <li
                                            className="rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-700"
                                            key={feedbackRecord.id}
                                        >
                                            <p className="font-semibold">
                                                {feedbackRecord.id} · {feedbackRecord.status}
                                            </p>
                                            <p>
                                                reason: {FEEDBACK_REASON_LABELS[feedbackRecord.reason]}
                                            </p>
                                            <p>time: {formatFeedbackTimestamp(feedbackRecord.createdAt)}</p>
                                            <p>{feedbackRecord.details}</p>
                                        </li>
                                    ),
                                )}
                            </ul>
                        </CardBody>
                    </Card>
                    <Card>
                        <CardHeader>
                            <p className="text-sm font-semibold text-slate-900">Conversation threads</p>
                        </CardHeader>
                        <CardBody className="p-0">
                            <ChatThreadList
                                activeThreadId={activeThreadId}
                                onArchiveThread={handleArchiveThread}
                                onCloseThread={handleCloseThread}
                                onNewThread={handleNewThread}
                                onSelectThread={setActiveThreadId}
                                threads={threads}
                            />
                        </CardBody>
                    </Card>
                    <ChatPanel
                        activeContextId={contextItem.id}
                        className="!static !inset-auto !z-auto !w-full !max-w-none !translate-x-0 !transform-none !border !border-slate-200 !shadow-none"
                        contextItems={[contextItem]}
                        emptyStateText={`Ask anything about ${ccr.id} diff. Quick actions are available below.`}
                        inputAriaLabel="Type a review question"
                        isOpen
                        maxMessageLength={2500}
                        messageListAriaLabel={`${ccr.id} chat messages`}
                        messages={activeMessages}
                        onSendMessage={handleSendMessage}
                        panelAriaLabel={`Conversation for ${ccr.id}`}
                        placeholder={`Ask about ${ccr.id} changes...`}
                        quickActions={quickActions}
                        title={`Conversation · ${ccr.id}`}
                    />
                </aside>
            </div>
        </section>
    )
}
