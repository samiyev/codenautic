import { useMemo, useRef, useState, type ReactElement } from "react"
import { Link } from "@tanstack/react-router"

import { ChatPanel, type IChatPanelContext, type IChatPanelMessage } from "@/components/chat/chat-panel"
import { ChatThreadList, type IChatThread } from "@/components/chat/chat-thread-list"
import { ReviewCommentThread } from "@/components/reviews/review-comment-thread"
import { CodeDiffViewer } from "@/components/reviews/code-diff-viewer"
import { Card, CardBody, CardHeader, Button, Alert } from "@/components/ui"
import { SseStreamViewer } from "@/components/streaming/sse-stream-viewer"
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

/** Страница страницы отдельного CCR review с авто-подставленным контекстом чата. */
export function CcrReviewDetailPage(props: ICcrReviewDetailPageProps): ReactElement {
    const { ccr } = props
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
    const nextMessageId = useRef(0)
    const nextThreadId = useRef(1)
    const contextItem = useMemo((): IChatPanelContext => {
        return ccrToContextItem(ccr)
    }, [ccr])
    const ccrDiffFiles = useMemo((): ReadonlyArray<ICcrDiffFile> => {
        return getCcrDiffById(ccr.id)
    }, [ccr.id])
    const ccrReviewThreads = useMemo((): ReadonlyArray<IReviewCommentThread> => {
        return getCcrReviewThreadsById(ccr.id)
    }, [ccr.id])
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
                            <Button
                                color="success"
                                onPress={(): void => {
                                    setReviewDecision("approved")
                                }}
                                size="sm"
                                type="button"
                                variant={reviewDecision === "approved" ? "solid" : "light"}
                            >
                                Approve review
                            </Button>
                            <Button
                                color="danger"
                                onPress={(): void => {
                                    setReviewDecision("rejected")
                                }}
                                size="sm"
                                type="button"
                                variant={reviewDecision === "rejected" ? "solid" : "light"}
                            >
                                Request changes
                            </Button>
                            <Button
                                color="primary"
                                onPress={(): void => {
                                    setReviewDecision("pending")
                                }}
                                size="sm"
                                type="button"
                                variant={reviewDecision === "pending" ? "solid" : "light"}
                            >
                                Save as in progress
                            </Button>
                            <Link className="text-sm underline underline-offset-4" to="/reviews">
                                Finish review
                            </Link>
                        </div>
                    </div>
                </CardHeader>
                <CardBody className="space-y-2">
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
