/**
 * Хук состояния страницы детального просмотра CCR review.
 *
 * Извлекает всё управление состоянием из компонента страницы
 * в переиспользуемый custom hook: useState, useRef, useMemo,
 * вычисляемые значения и обработчики событий.
 */

import { useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { useDynamicTranslation } from "@/lib/i18n"
import type { IChatPanelContext, IChatPanelMessage } from "@/components/chat/chat-panel"
import type { IChatThread } from "@/components/chat/chat-thread-list"
import type {
    ICodeCityTreemapFileDescriptor,
    ICodeCityTreemapImpactedFileDescriptor,
} from "@/components/codecity/codecity-treemap"
import type { IImpactAnalysisSeed, IImpactAnalysisSelection } from "@/components/predictions/impact-analysis-panel"
import type {
    ICcrWorkspaceContextResponse,
    ICcrWorkspaceDiffFile,
    ICcrWorkspaceReviewCommentThread,
} from "@/lib/api/endpoints/ccr-workspace.endpoint"
import { useCodeReview } from "@/lib/hooks/queries"
import { getUiActionPolicy, useUiRole } from "@/lib/permissions/ui-policy"
import {
    ccrToContextItem,
    getCcrDiffById,
    getCcrReviewThreadsById,
    type ICcrDiffFile,
    type IReviewCommentThread,
    type ICcrRowData,
} from "@/pages/ccr-data"

import type {
    IFileNeighborhoodDetails,
    IReviewerFeedbackRecord,
    IReviewHistoryHeatEntry,
    IReviewRiskIndicator,
    ISafeGuardTraceItem,
    TReviewDecision,
    TReviewerFeedbackReason,
    TReviewerFeedbackStatus,
    TReviewHistoryWindow,
    TSafeGuardFilterId,
    TSafeGuardStepStatus,
    TThreadMessagesMap,
} from "../ccr-review-detail.types"
import { FEEDBACK_REJECTION_REASONS, SAFEGUARD_FILTER_SEQUENCE } from "../ccr-review-detail.constants"
import {
    buildExplainMessage,
    buildFileNeighborhoodDetails,
    buildReviewContextTreemapFiles,
    buildReviewHistoryHeatEntries,
    buildReviewImpactSeeds,
    buildReviewNeighborhoodByPath,
    buildSafeGuardTraceItems,
    buildSummaryMessage,
    formatFeedbackTimestamp,
    mapReviewDecisionBadge,
    resolveReviewHistoryHeatColor,
    resolveReviewRiskIndicator,
} from "../ccr-review-detail.utils"

/**
 * Максимум отображаемых hottest записей истории review.
 */
const MAX_HOTTEST_REVIEW_HISTORY_ENTRIES = 4

/**
 * Входные параметры хука состояния CCR review.
 */
interface ICcrReviewStateProps {
    /**
     * Данные CCR, для которой рендерится review context.
     */
    readonly ccr: ICcrRowData
    /**
     * API-контекст review workspace (опционально).
     */
    readonly workspaceContext?: ICcrWorkspaceContextResponse
}

/**
 * Хук, инкапсулирующий всё состояние и логику страницы детального
 * просмотра CCR review.
 *
 * Содержит 11 useState, 3 useRef, 23+ useMemo / вычисляемых значений
 * и 8 обработчиков событий. Возвращает единый объект состояния,
 * готовый к использованию секциями страницы.
 *
 * @param props - Данные CCR и опциональный workspace-контекст.
 * @returns Объект со всеми значениями состояния, вычисляемыми данными,
 *          обработчиками и сеттерами.
 */
export function useCcrReviewState(props: ICcrReviewStateProps) {
    const { ccr } = props
    const { t } = useTranslation(["reviews"])
    const { td } = useDynamicTranslation(["reviews"])
    const activeUiRole = useUiRole()

    /* ─────────────────── useState (11) ─────────────────── */

    const [reviewDecision, setReviewDecision] = useState<TReviewDecision>("pending")
    const [activeFilePath, setActiveFilePath] = useState<string | undefined>(ccr.attachedFiles[0])
    const [isReviewContextMiniMapExpanded, setReviewContextMiniMapExpanded] =
        useState<boolean>(false)
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
    const [selectedReviewHistoryWindow, setSelectedReviewHistoryWindow] =
        useState<TReviewHistoryWindow>("30d")
    const [isReviewHistoryHeatmapEnabled, setReviewHistoryHeatmapEnabled] = useState<boolean>(false)
    const [impactFocusStatus, setImpactFocusStatus] = useState<string>("")
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
    const [activeSafeGuardTraceId, setActiveSafeGuardTraceId] = useState<string>("")

    /* ─────────────────── useRef (3) ─────────────────── */

    const nextMessageId = useRef(0)
    const nextThreadId = useRef(1)
    const nextFeedbackId = useRef(3)

    /* ─────────────────── useMemo / вычисляемые (23+) ─────────────────── */

    const contextItem = useMemo((): IChatPanelContext => {
        return ccrToContextItem(ccr)
    }, [ccr])

    const ccrDiffFiles = useMemo((): ReadonlyArray<ICcrDiffFile> => {
        const contextDiffFiles = props.workspaceContext?.diffFiles
        if (contextDiffFiles !== undefined && props.workspaceContext?.reviewId === ccr.id) {
            return contextDiffFiles.map((file): ICcrDiffFile => {
                const typedFile: ICcrWorkspaceDiffFile = file

                return {
                    filePath: typedFile.filePath,
                    language: typedFile.language,
                    lines: typedFile.lines,
                }
            })
        }

        return getCcrDiffById(ccr.id)
    }, [ccr.id, props.workspaceContext?.diffFiles, props.workspaceContext?.reviewId])

    const ccrReviewThreads = useMemo((): ReadonlyArray<IReviewCommentThread> => {
        const contextThreads = props.workspaceContext?.threads
        if (contextThreads !== undefined && props.workspaceContext?.reviewId === ccr.id) {
            return contextThreads.map((thread): IReviewCommentThread => {
                const typedThread: ICcrWorkspaceReviewCommentThread = thread

                return {
                    author: typedThread.author,
                    createdAt: typedThread.createdAt,
                    feedback: typedThread.feedback,
                    id: typedThread.id,
                    isResolved: typedThread.isResolved,
                    message: typedThread.message,
                    replies: typedThread.replies,
                }
            })
        }

        return getCcrReviewThreadsById(ccr.id)
    }, [ccr.id, props.workspaceContext?.reviewId, props.workspaceContext?.threads])

    const codeReview = useCodeReview({
        reviewId: ccr.id,
    })

    const reviewContextTreemapFiles = useMemo((): ReadonlyArray<ICodeCityTreemapFileDescriptor> => {
        return buildReviewContextTreemapFiles(ccrDiffFiles, ccr.updatedAt)
    }, [ccr.updatedAt, ccrDiffFiles])

    const reviewContextFileIdByPath = useMemo((): Readonly<Record<string, string>> => {
        const mapping: Record<string, string> = {}
        reviewContextTreemapFiles.forEach((file): void => {
            mapping[file.path] = file.id
        })
        return mapping
    }, [reviewContextTreemapFiles])

    const reviewContextFilePathById = useMemo((): Readonly<Record<string, string>> => {
        const mapping: Record<string, string> = {}
        reviewContextTreemapFiles.forEach((file): void => {
            mapping[file.id] = file.path
        })
        return mapping
    }, [reviewContextTreemapFiles])

    const reviewContextHighlightedFileId = useMemo((): string | undefined => {
        if (activeFilePath === undefined) {
            return undefined
        }
        return reviewContextFileIdByPath[activeFilePath]
    }, [activeFilePath, reviewContextFileIdByPath])

    const reviewContextImpactedFiles =
        useMemo((): ReadonlyArray<ICodeCityTreemapImpactedFileDescriptor> => {
            return ccr.attachedFiles
                .map(
                    (
                        attachedFilePath,
                        attachedIndex,
                    ): ICodeCityTreemapImpactedFileDescriptor | undefined => {
                        const fileId = reviewContextFileIdByPath[attachedFilePath]
                        if (fileId === undefined) {
                            return undefined
                        }

                        if (attachedIndex === 0) {
                            return {
                                fileId,
                                impactType: "changed",
                            }
                        }
                        if (attachedIndex === 1) {
                            return {
                                fileId,
                                impactType: "impacted",
                            }
                        }
                        return {
                            fileId,
                            impactType: "ripple",
                        }
                    },
                )
                .filter(
                    (descriptor): descriptor is ICodeCityTreemapImpactedFileDescriptor =>
                        descriptor !== undefined,
                )
        }, [ccr.attachedFiles, reviewContextFileIdByPath])

    const reviewImpactSeeds = useMemo((): ReadonlyArray<IImpactAnalysisSeed> => {
        return buildReviewImpactSeeds(ccrDiffFiles, reviewContextFileIdByPath)
    }, [ccrDiffFiles, reviewContextFileIdByPath])

    const reviewNeighborhoodByPath = useMemo((): Readonly<
        Record<string, ReadonlyArray<string>>
    > => {
        return buildReviewNeighborhoodByPath(ccrDiffFiles)
    }, [ccrDiffFiles])

    const fileNeighborhoodDetailsByPath = useMemo((): Readonly<
        Record<string, IFileNeighborhoodDetails>
    > => {
        return buildFileNeighborhoodDetails(ccrDiffFiles)
    }, [ccrDiffFiles])

    const reviewHistoryHeatEntries = useMemo((): ReadonlyArray<IReviewHistoryHeatEntry> => {
        return buildReviewHistoryHeatEntries(ccrDiffFiles)
    }, [ccrDiffFiles])

    const maxReviewHistoryActivity = useMemo((): number => {
        return reviewHistoryHeatEntries.reduce((maxValue, entry): number => {
            return Math.max(maxValue, entry.reviewsByWindow[selectedReviewHistoryWindow])
        }, 0)
    }, [reviewHistoryHeatEntries, selectedReviewHistoryWindow])

    const reviewHistoryColorByFileId = useMemo((): Readonly<Record<string, string>> => {
        if (isReviewHistoryHeatmapEnabled === false) {
            return {}
        }

        return reviewHistoryHeatEntries.reduce((mapping, entry): Record<string, string> => {
            const fileId = reviewContextFileIdByPath[entry.filePath]
            if (fileId === undefined) {
                return mapping
            }
            return {
                ...mapping,
                [fileId]: resolveReviewHistoryHeatColor(
                    entry.reviewsByWindow[selectedReviewHistoryWindow],
                    maxReviewHistoryActivity,
                ),
            }
        }, {})
    }, [
        isReviewHistoryHeatmapEnabled,
        maxReviewHistoryActivity,
        reviewContextFileIdByPath,
        reviewHistoryHeatEntries,
        selectedReviewHistoryWindow,
    ])

    const hottestReviewHistoryEntries = useMemo((): ReadonlyArray<IReviewHistoryHeatEntry> => {
        return [...reviewHistoryHeatEntries]
            .sort((leftEntry, rightEntry): number => {
                return (
                    rightEntry.reviewsByWindow[selectedReviewHistoryWindow] -
                    leftEntry.reviewsByWindow[selectedReviewHistoryWindow]
                )
            })
            .slice(0, MAX_HOTTEST_REVIEW_HISTORY_ENTRIES)
    }, [reviewHistoryHeatEntries, selectedReviewHistoryWindow])

    const reviewRiskIndicator = useMemo((): IReviewRiskIndicator => {
        return resolveReviewRiskIndicator(ccrDiffFiles, reviewHistoryHeatEntries, reviewImpactSeeds)
    }, [ccrDiffFiles, reviewHistoryHeatEntries, reviewImpactSeeds])

    const activeNeighborhoodFiles = useMemo((): ReadonlyArray<string> => {
        if (activeFilePath === undefined) {
            return []
        }
        return reviewNeighborhoodByPath[activeFilePath] ?? []
    }, [activeFilePath, reviewNeighborhoodByPath])

    const activeNeighborhoodDetails = useMemo((): IFileNeighborhoodDetails | undefined => {
        if (activeFilePath === undefined) {
            return undefined
        }
        return fileNeighborhoodDetailsByPath[activeFilePath]
    }, [activeFilePath, fileNeighborhoodDetailsByPath])

    const safeGuardTraceItems = useMemo((): ReadonlyArray<ISafeGuardTraceItem> => {
        return buildSafeGuardTraceItems(ccr)
    }, [ccr])

    const visibleDiffFiles = useMemo((): ReadonlyArray<ICcrDiffFile> => {
        if (activeFilePath === undefined) {
            return ccrDiffFiles
        }

        const focusedFiles = ccrDiffFiles.filter(
            (file): boolean => file.filePath === activeFilePath,
        )
        if (focusedFiles.length === 0) {
            return ccrDiffFiles
        }

        return focusedFiles
    }, [activeFilePath, ccrDiffFiles])

    const activeMessages =
        activeThreadId.length === 0 ? [] : (messagesByThread[activeThreadId] ?? [])

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
                feedbackRecord.traceId === activeSafeGuardTraceItem.id ||
                feedbackRecord.linkedTraceId === activeSafeGuardTraceItem.id
            )
        })
    }, [activeSafeGuardTraceItem, feedbackHistory])

    const latestActiveTraceFeedback = activeTraceFeedbackHistory[0]

    const translatedDecisionLabels = useMemo(
        (): Readonly<Record<TReviewDecision, string>> => ({
            approved: t("reviews:detail.decisionApproved"),
            pending: t("reviews:detail.decisionInProgress"),
            rejected: t("reviews:detail.decisionRequestChanges"),
        }),
        [t],
    )

    const translatedSafeGuardStepLabels = useMemo(
        (): Readonly<Record<TSafeGuardStepStatus, string>> => ({
            applied: t("reviews:detail.stepApplied"),
            filtered_out: t("reviews:detail.stepFilteredOut"),
            passed: t("reviews:detail.stepPassed"),
        }),
        [t],
    )

    const translatedFilterLabels = useMemo(
        (): Readonly<Record<TSafeGuardFilterId, string>> => ({
            dedup: t("reviews:detail.filterDedup"),
            hallucination: t("reviews:detail.filterHallucination"),
            severity: t("reviews:detail.filterSeverity"),
        }),
        [t],
    )

    const translatedFeedbackReasonLabels = useMemo(
        (): Readonly<Record<TReviewerFeedbackReason, string>> => ({
            duplicate: t("reviews:detail.reasonDuplicate"),
            false_positive: t("reviews:detail.reasonFalsePositive"),
            irrelevant: t("reviews:detail.reasonIrrelevant"),
        }),
        [t],
    )

    const quickActions = useMemo(
        (): ReadonlyArray<{
            readonly id: string
            readonly label: string
            readonly message: string
        }> => [
            {
                id: "explain-this-file",
                label: t("reviews:detail.quickActionExplainFile"),
                message: buildExplainMessage(ccr),
            },
            {
                id: "summarize-changes",
                label: t("reviews:detail.quickActionSummarizeChanges"),
                message: buildSummaryMessage(ccr),
            },
        ],
        [ccr],
    )

    /* ─────────────────── обработчики (8) ─────────────────── */

    /**
     * Отправляет сообщение в активный тред чата.
     *
     * @param message - Текст сообщения от пользователя.
     */
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

    /**
     * Создаёт новый тред чата и делает его активным.
     */
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

    /**
     * Закрывает тред чата по идентификатору.
     * Если закрываемый тред — активный, переключает на первый оставшийся.
     *
     * @param threadId - Идентификатор закрываемого треда.
     */
    const handleCloseThread = (threadId: string): void => {
        setThreads((previous): ReadonlyArray<IChatThread> => {
            const nextThreads = previous.filter((thread): boolean => thread.id !== threadId)
            if (activeThreadId === threadId) {
                setActiveThreadId(nextThreads[0]?.id ?? "")
            }

            return nextThreads
        })
    }

    /**
     * Архивирует тред чата, добавляя пометку "(archived)" к заголовку.
     *
     * @param threadId - Идентификатор архивируемого треда.
     */
    const handleArchiveThread = (threadId: string): void => {
        setThreads(
            (previous): ReadonlyArray<IChatThread> =>
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

    /**
     * Отправляет feedback reviewer по активному SafeGuard trace item.
     *
     * @param status - Статус feedback: accepted или rejected.
     */
    const handleSubmitReviewerFeedback = (status: TReviewerFeedbackStatus): void => {
        if (activeSafeGuardTraceItem === undefined) {
            return
        }

        const linkedTraceId =
            selectedFeedbackReason === "duplicate"
                ? safeGuardTraceItems.find((traceItem): boolean => {
                      return (
                          traceItem.finalDecision === "shown" &&
                          traceItem.id !== activeSafeGuardTraceItem.id
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

    /**
     * Меняет решение по review, если политика разрешает.
     *
     * @param nextDecision - Новое решение: approved, pending или rejected.
     */
    const handleReviewDecisionChange = (nextDecision: TReviewDecision): void => {
        if (reviewDecisionPolicy.visibility !== "enabled") {
            return
        }

        setReviewDecision(nextDecision)
    }

    /**
     * Обработчик выбора файла на мини-карте review context.
     * Переводит fileId в путь и устанавливает активный файл.
     *
     * @param fileId - Идентификатор файла в treemap.
     */
    const handleReviewContextMiniMapSelect = (fileId: string): void => {
        const selectedFilePath = reviewContextFilePathById[fileId]
        if (selectedFilePath === undefined) {
            return
        }
        setActiveFilePath(selectedFilePath)
    }

    /**
     * Применяет фокус impact analysis: обновляет статус
     * и переключает activeFilePath на первый затронутый файл.
     *
     * @param selection - Выбранный элемент impact analysis.
     */
    const handleApplyImpactFocus = (selection: IImpactAnalysisSelection): void => {
        setImpactFocusStatus(
            `Focused impact: ${selection.label} · risk ${String(selection.riskScore)} · blast radius ${String(selection.affectedFiles.length)} files.`,
        )
        const firstAffectedFile = selection.affectedFiles[0]
        if (firstAffectedFile === undefined) {
            return
        }
        setActiveFilePath(firstAffectedFile)
    }

    /* ─────────────────── возвращаемый объект ─────────────────── */

    return {
        activeFilePath,
        activeMessages,
        activeNeighborhoodDetails,
        activeNeighborhoodFiles,
        activeSafeGuardTraceId,
        activeSafeGuardTraceItem,
        activeThreadId,
        activeTraceFeedbackHistory,
        activeUiRole,
        ccr,
        ccrDiffFiles,
        ccrReviewThreads,
        codeReview,
        contextItem,
        decisionBadge,
        feedbackHistory,
        filteredOutTraceCount,
        fileNeighborhoodDetailsByPath,
        handleApplyImpactFocus,
        handleArchiveThread,
        handleCloseThread,
        handleNewThread,
        handleReviewContextMiniMapSelect,
        handleReviewDecisionChange,
        handleSendMessage,
        handleSubmitReviewerFeedback,
        hottestReviewHistoryEntries,
        impactFocusStatus,
        isReviewContextMiniMapExpanded,
        isReviewHistoryHeatmapEnabled,
        latestActiveTraceFeedback,
        maxReviewHistoryActivity,
        messagesByThread,
        quickActions,
        reviewContextFileIdByPath,
        reviewContextFilePathById,
        reviewContextHighlightedFileId,
        reviewContextImpactedFiles,
        reviewContextTreemapFiles,
        reviewDecision,
        reviewDecisionPolicy,
        reviewFinishPolicy,
        reviewHistoryColorByFileId,
        reviewHistoryHeatEntries,
        reviewImpactSeeds,
        reviewNeighborhoodByPath,
        reviewRiskIndicator,
        safeGuardTraceItems,
        selectedFeedbackReason,
        selectedReviewHistoryWindow,
        setActiveFilePath,
        setActiveSafeGuardTraceId,
        setActiveThreadId,
        setReviewContextMiniMapExpanded,
        setReviewHistoryHeatmapEnabled,
        setSelectedFeedbackReason,
        setSelectedReviewHistoryWindow,
        t,
        td,
        threads,
        translatedDecisionLabels,
        translatedFeedbackReasonLabels,
        translatedFilterLabels,
        translatedSafeGuardStepLabels,
        visibleDiffFiles,
        visibleTraceCount,
    }
}

/**
 * Тип возвращаемого значения хука useCcrReviewState.
 */
export type ICcrReviewState = ReturnType<typeof useCcrReviewState>

export type { ICcrReviewStateProps }
