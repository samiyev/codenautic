import { type ReactElement, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { useDynamicTranslation } from "@/lib/i18n"
import {
    Alert,
    Button,
    Card,
    CardContent,
    CardHeader,
    Chip,
    Dropdown,
    DropdownItem,
    DropdownMenu,
    DropdownTrigger,
} from "@heroui/react"
import { SystemStateCard } from "@/components/infrastructure/system-state-card"
import { PageShell } from "@/components/layout/page-shell"
import { TYPOGRAPHY } from "@/lib/constants/typography"
import { showToastInfo, showToastSuccess } from "@/lib/notifications/toast"
import { useTriage } from "@/lib/hooks/queries/use-triage"
import type {
    ITriageItem,
    TTriageAction,
    TTriageScope,
    TTriageStatus,
    TTriageEscalationLevel,
} from "@/lib/api/endpoints/triage.endpoint"

type TTriageSeverity = "critical" | "high" | "medium"
type TReviewerRole = "admin" | "developer" | "lead" | "viewer"
type TSlaState = "breach" | "healthy" | "warning"

interface IAuditEntry {
    /** Уникальный id записи. */
    readonly id: string
    /** Item, к которому относится запись. */
    readonly itemId: string
    /** Тип выполненного действия. */
    readonly action: TTriageAction
    /** Когда произошло действие. */
    readonly timestamp: string
}

const ASSIGNABLE_ROLES: ReadonlyArray<TReviewerRole> = ["developer", "lead", "admin"]
const ESCALATION_ROLES: ReadonlyArray<TReviewerRole> = ["lead", "admin"]

/**
 * Максимум записей в audit trail истории действий.
 */
const MAX_AUDIT_TRAIL_ENTRIES = 12

function formatTimestamp(rawValue: string): string {
    const date = new Date(rawValue)
    if (Number.isNaN(date.getTime())) {
        return "\u2014"
    }

    return date.toLocaleString([], {
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        month: "2-digit",
    })
}

function severityWeight(severity: TTriageSeverity): number {
    if (severity === "critical") {
        return 3
    }
    if (severity === "high") {
        return 2
    }
    return 1
}

function isRoleAllowed(role: TReviewerRole, allowedRoles: ReadonlyArray<TReviewerRole>): boolean {
    return allowedRoles.includes(role)
}

function getSlaState(item: ITriageItem, nowTimestamp: number): TSlaState {
    const dueTimestamp = new Date(item.dueAt).getTime()
    if (Number.isNaN(dueTimestamp)) {
        return "warning"
    }

    const millisecondsLeft = dueTimestamp - nowTimestamp
    if (millisecondsLeft <= 0) {
        return "breach"
    }

    if (millisecondsLeft <= 30 * 60 * 1000) {
        return "warning"
    }

    return "healthy"
}

function getSlaColor(state: TSlaState): "danger" | "success" | "warning" {
    if (state === "breach") {
        return "danger"
    }
    if (state === "healthy") {
        return "success"
    }
    return "warning"
}

function getStatusColor(
    status: TTriageStatus,
): "accent" | "danger" | "default" | "success" | "warning" {
    if (status === "blocked") {
        return "danger"
    }
    if (status === "in_progress") {
        return "accent"
    }
    if (status === "done") {
        return "success"
    }
    if (status === "snoozed") {
        return "warning"
    }
    return "default"
}

function getEscalationColor(
    level: TTriageEscalationLevel,
): "danger" | "default" | "warning" {
    if (level === "critical") {
        return "danger"
    }
    if (level === "warn") {
        return "warning"
    }
    return "default"
}

/**
 * Unified triage hub "My Work".
 *
 * @returns Единый экран triage с приоритизацией, ownership и escalation.
 */
export function MyWorkPage(): ReactElement {
    const { t } = useTranslation(["dashboard"])
    const { td } = useDynamicTranslation(["dashboard"])
    const [scope, setScope] = useState<TTriageScope>("mine")
    const [reviewerRole, setReviewerRole] = useState<TReviewerRole>("lead")

    const { triageQuery, performAction } = useTriage({ scope })
    const items = triageQuery.data?.items ?? []

    const [lastActionSummary, setLastActionSummary] = useState(
        t("dashboard:myWork.noTriageActions"),
    )
    const [nowTimestamp, setNowTimestamp] = useState<number>(Date.now())
    const [auditTrail, setAuditTrail] = useState<ReadonlyArray<IAuditEntry>>([])

    const slaLabelMap = useMemo(
        (): Record<TSlaState, string> => ({
            breach: t("dashboard:myWork.slaBreachLabel"),
            healthy: t("dashboard:myWork.slaHealthyLabel"),
            warning: t("dashboard:myWork.slaWarningLabel"),
        }),
        [t],
    )

    const auditActionMap = useMemo(
        (): Record<TTriageAction, string> => ({
            assign_to_me: t("dashboard:myWork.assignToMe"),
            escalate: t("dashboard:myWork.escalate"),
            mark_done: t("dashboard:myWork.markDone"),
            mark_read: t("dashboard:myWork.markRead"),
            open_context: t("dashboard:myWork.openReview"),
            snooze: t("dashboard:myWork.snooze"),
            start_work: t("dashboard:myWork.startWork"),
        }),
        [t],
    )

    const filteredItems = useMemo((): ReadonlyArray<ITriageItem> => {
        return [...items].sort((left, right): number => {
            const severityDelta = severityWeight(right.severity) - severityWeight(left.severity)
            if (severityDelta !== 0) {
                return severityDelta
            }

            const leftSlaRank = getSlaState(left, nowTimestamp) === "breach" ? 1 : 0
            const rightSlaRank = getSlaState(right, nowTimestamp) === "breach" ? 1 : 0
            if (rightSlaRank - leftSlaRank !== 0) {
                return rightSlaRank - leftSlaRank
            }

            return new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
        })
    }, [items, nowTimestamp])

    useEffect((): (() => void) | void => {
        const handleKeyboardShortcut = (event: KeyboardEvent): void => {
            if (event.altKey !== true) {
                return
            }

            if (event.key === "1") {
                setScope("mine")
            } else if (event.key === "2") {
                setScope("team")
            } else if (event.key === "3") {
                setScope("repo")
            } else {
                return
            }

            event.preventDefault()
        }

        window.addEventListener("keydown", handleKeyboardShortcut)
        return (): void => {
            window.removeEventListener("keydown", handleKeyboardShortcut)
        }
    }, [])

    useEffect((): (() => void) | void => {
        const timerId = window.setInterval((): void => {
            setNowTimestamp(Date.now())
        }, 30_000)

        return (): void => {
            window.clearInterval(timerId)
        }
    }, [])

    const addAuditEntry = (itemId: string, action: TTriageAction): void => {
        setAuditTrail((previous): ReadonlyArray<IAuditEntry> => {
            const nextEntry: IAuditEntry = {
                action,
                id: `${Date.now()}-${itemId}-${action}`,
                itemId,
                timestamp: new Date().toISOString(),
            }

            return [nextEntry, ...previous].slice(0, MAX_AUDIT_TRAIL_ENTRIES)
        })
    }

    const dispatchAction = (itemId: string, action: TTriageAction): void => {
        performAction.mutate({ id: itemId, action })
        addAuditEntry(itemId, action)
    }

    const handleAssignToMe = (itemId: string): void => {
        if (isRoleAllowed(reviewerRole, ASSIGNABLE_ROLES) !== true) {
            setLastActionSummary(t("dashboard:myWork.cannotAssign"))
            return
        }

        dispatchAction(itemId, "assign_to_me")
        setLastActionSummary(`Assigned ${itemId} to current reviewer.`)
    }

    const handleMarkRead = (itemId: string): void => {
        dispatchAction(itemId, "mark_read")
        setLastActionSummary(`Marked ${itemId} as read.`)
    }

    const handleSnooze = (itemId: string): void => {
        dispatchAction(itemId, "snooze")
        setLastActionSummary(`Snoozed ${itemId} until next triage cycle.`)
        showToastInfo(t("dashboard:myWork.itemSnoozed"))
    }

    const handleOpenReview = (itemId: string): void => {
        const item = items.find((candidate): boolean => candidate.id === itemId)
        if (item === undefined) {
            return
        }

        if (typeof window !== "undefined") {
            window.location.assign(item.deepLink)
        }
        setLastActionSummary(`Opened ${item.id} context: ${item.deepLink}`)
        addAuditEntry(itemId, "open_context")
        showToastSuccess(t("dashboard:myWork.contextOpened"))
    }

    const handleEscalate = (itemId: string): void => {
        if (isRoleAllowed(reviewerRole, ESCALATION_ROLES) !== true) {
            setLastActionSummary(t("dashboard:myWork.cannotEscalate"))
            return
        }

        dispatchAction(itemId, "escalate")
        setLastActionSummary(`Escalated ${itemId} and notified owner channel.`)
        showToastInfo(t("dashboard:myWork.escalationSent"))
    }

    const handleStartWork = (itemId: string): void => {
        if (isRoleAllowed(reviewerRole, ASSIGNABLE_ROLES) !== true) {
            setLastActionSummary(t("dashboard:myWork.cannotUpdateStatus"))
            return
        }

        dispatchAction(itemId, "start_work")
        setLastActionSummary(`Moved ${itemId} to in_progress.`)
    }

    const handleMarkDone = (itemId: string): void => {
        if (isRoleAllowed(reviewerRole, ASSIGNABLE_ROLES) !== true) {
            setLastActionSummary(t("dashboard:myWork.cannotClose"))
            return
        }

        dispatchAction(itemId, "mark_done")
        setLastActionSummary(`Marked ${itemId} as done.`)
    }

    const breachCount = filteredItems.filter((item): boolean => {
        return getSlaState(item, nowTimestamp) === "breach"
    }).length

    return (
        <PageShell
            subtitle={t("dashboard:myWork.pageSubtitle")}
            title={t("dashboard:myWork.pageTitle")}
        >
            <Card className="border border-border/40 bg-surface/40 backdrop-blur-sm">
                <CardHeader className="flex flex-wrap items-center justify-between gap-2 border-b border-border/30 pb-3">
                    <p className={TYPOGRAPHY.sectionTitle}>
                        {t("dashboard:myWork.scopeAndOwnership")}
                    </p>
                    <Chip size="sm" variant="soft">
                        {t("dashboard:myWork.keyboardHint")}
                    </Chip>
                </CardHeader>
                <CardContent className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                        <select
                            aria-label={t("dashboard:myWork.triageScopeAriaLabel")}
                            className="w-full rounded-lg border border-border/50 bg-surface/80 px-3 py-2 text-sm text-foreground outline-none backdrop-blur-sm transition-colors duration-150 focus:border-accent/50 focus:ring-1 focus:ring-accent/20 md:max-w-[220px]"
                            value={scope}
                            onChange={(event): void => {
                                const nextScope = event.currentTarget.value
                                if (
                                    nextScope === "mine" ||
                                    nextScope === "team" ||
                                    nextScope === "repo"
                                ) {
                                    setScope(nextScope)
                                }
                            }}
                        >
                            <option value="mine">mine</option>
                            <option value="team">team</option>
                            <option value="repo">repo</option>
                        </select>

                        <select
                            aria-label={t("dashboard:myWork.reviewerRoleAriaLabel")}
                            className="w-full rounded-lg border border-border/50 bg-surface/80 px-3 py-2 text-sm text-foreground outline-none backdrop-blur-sm transition-colors duration-150 focus:border-accent/50 focus:ring-1 focus:ring-accent/20 md:max-w-[220px]"
                            value={reviewerRole}
                            onChange={(event): void => {
                                const nextRole = event.currentTarget.value
                                if (
                                    nextRole === "viewer" ||
                                    nextRole === "developer" ||
                                    nextRole === "lead" ||
                                    nextRole === "admin"
                                ) {
                                    setReviewerRole(nextRole)
                                }
                            }}
                        >
                            <option value="viewer">viewer</option>
                            <option value="developer">developer</option>
                            <option value="lead">lead</option>
                            <option value="admin">admin</option>
                        </select>
                    </div>

                    <Alert status="accent">
                        <Alert.Title>{t("dashboard:myWork.lastTriageAction")}</Alert.Title>
                        <Alert.Description>{lastActionSummary}</Alert.Description>
                    </Alert>
                    {breachCount > 0 ? (
                        <Alert status="danger">
                            <Alert.Title>{t("dashboard:myWork.escalationWatchlist")}</Alert.Title>
                            <Alert.Description>
                                {td("dashboard:myWork.slaBreachAlert", {
                                    count: String(breachCount),
                                })}
                            </Alert.Description>
                        </Alert>
                    ) : null}
                </CardContent>
            </Card>

            <Card className="border border-border/40 bg-surface/40 backdrop-blur-sm">
                <CardHeader className="border-b border-border/30 pb-3">
                    <p className={TYPOGRAPHY.sectionTitle}>
                        {t("dashboard:myWork.unifiedTriageList")}
                    </p>
                </CardHeader>
                <CardContent className="space-y-2">
                    {filteredItems.length === 0 ? (
                        <SystemStateCard
                            ctaLabel={t("dashboard:myWork.switchScope")}
                            description={t("dashboard:myWork.noTriageItemsDescription")}
                            title={t("dashboard:myWork.noTriageItemsTitle")}
                            variant="empty"
                            onCtaPress={(): void => {
                                setScope("team")
                            }}
                        />
                    ) : (
                        <ul
                            aria-label={t("dashboard:myWork.triageListAriaLabel")}
                            className="space-y-2"
                        >
                            {filteredItems.map((item): ReactElement => {
                                const slaState = getSlaState(item, nowTimestamp)
                                return (
                                    <li
                                        className={[
                                            "rounded-lg border p-3",
                                            "transition-colors duration-150 hover:bg-surface-secondary/30",
                                            slaState === "breach"
                                                ? "border-danger/30 border-l-4 border-l-danger/60 bg-danger/3"
                                                : slaState === "warning"
                                                  ? "border-warning/30 border-l-4 border-l-warning/50 bg-warning/3"
                                                  : "border-border/50 border-l-2 border-l-border bg-surface/60",
                                        ].join(" ")}
                                        key={item.id}
                                    >
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className={TYPOGRAPHY.cardTitle}>{item.title}</p>
                                            <Chip size="sm" variant="soft">
                                                {item.category}
                                            </Chip>
                                            <Chip
                                                color={
                                                    item.severity === "critical"
                                                        ? "danger"
                                                        : "warning"
                                                }
                                                size="sm"
                                                variant="soft"
                                            >
                                                {item.severity}
                                            </Chip>
                                            <Chip size="sm" variant="soft">
                                                {t("dashboard:myWork.ownerLabel")} {item.owner}
                                            </Chip>
                                            <Chip
                                                color={getStatusColor(item.status)}
                                                size="sm"
                                                variant="soft"
                                            >
                                                {t("dashboard:myWork.statusLabel")} {item.status}
                                            </Chip>
                                            <Chip
                                                color={getEscalationColor(item.escalationLevel)}
                                                size="sm"
                                                title={`${t("dashboard:myWork.escalationTitle")} ${item.escalationLevel}`}
                                                variant="soft"
                                            >
                                                {t("dashboard:myWork.escalationLabel")}{" "}
                                                {item.escalationLevel}
                                            </Chip>
                                            <Chip
                                                color={getSlaColor(slaState)}
                                                size="sm"
                                                title={`${t("dashboard:myWork.dueAtTitle")} ${formatTimestamp(item.dueAt)}`}
                                                variant="soft"
                                            >
                                                {slaLabelMap[slaState]}
                                            </Chip>
                                        </div>
                                        <p className="mt-1 text-xs text-muted">
                                            {item.repository} · {t("dashboard:myWork.createdLabel")}{" "}
                                            {formatTimestamp(item.timestamp)} ·{" "}
                                            {t("dashboard:myWork.dueLabel")}{" "}
                                            {formatTimestamp(item.dueAt)} ·{" "}
                                            {t("dashboard:myWork.slaLabel")} {item.slaMinutes}m
                                        </p>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {/* Primary actions — always visible */}
                                            <Button
                                                isDisabled={
                                                    isRoleAllowed(
                                                        reviewerRole,
                                                        ASSIGNABLE_ROLES,
                                                    ) !== true
                                                }
                                                size="sm"
                                                variant="secondary"
                                                onPress={(): void => {
                                                    handleStartWork(item.id)
                                                }}
                                            >
                                                {t("dashboard:myWork.startWork")}
                                            </Button>
                                            <Button
                                                isDisabled={
                                                    isRoleAllowed(
                                                        reviewerRole,
                                                        ASSIGNABLE_ROLES,
                                                    ) !== true
                                                }
                                                size="sm"
                                                variant="secondary"
                                                onPress={(): void => {
                                                    handleMarkDone(item.id)
                                                }}
                                            >
                                                {t("dashboard:myWork.markDone")}
                                            </Button>
                                            <Button
                                                isDisabled={
                                                    isRoleAllowed(
                                                        reviewerRole,
                                                        ESCALATION_ROLES,
                                                    ) !== true
                                                }
                                                size="sm"
                                                variant="secondary"
                                                onPress={(): void => {
                                                    handleEscalate(item.id)
                                                }}
                                            >
                                                {t("dashboard:myWork.escalate")}
                                            </Button>

                                            {/* Secondary actions — overflow dropdown */}
                                            <Dropdown>
                                                <DropdownTrigger>
                                                    <Button size="sm" variant="secondary">
                                                        {t("dashboard:myWork.moreActions")}
                                                    </Button>
                                                </DropdownTrigger>
                                                <DropdownMenu
                                                    aria-label={t(
                                                        "dashboard:myWork.secondaryActionsAriaLabel",
                                                    )}
                                                >
                                                    <DropdownItem
                                                        key="mark_read"
                                                        onPress={(): void => {
                                                            handleMarkRead(item.id)
                                                        }}
                                                    >
                                                        {t("dashboard:myWork.markRead")}
                                                    </DropdownItem>
                                                    <DropdownItem
                                                        key="assign_to_me"
                                                        isDisabled={
                                                            isRoleAllowed(
                                                                reviewerRole,
                                                                ASSIGNABLE_ROLES,
                                                            ) !== true
                                                        }
                                                        onPress={(): void => {
                                                            handleAssignToMe(item.id)
                                                        }}
                                                    >
                                                        {t("dashboard:myWork.assignToMe")}
                                                    </DropdownItem>
                                                    <DropdownItem
                                                        key="snooze"
                                                        onPress={(): void => {
                                                            handleSnooze(item.id)
                                                        }}
                                                    >
                                                        {t("dashboard:myWork.snooze")}
                                                    </DropdownItem>
                                                    <DropdownItem
                                                        key="open_review"
                                                        onPress={(): void => {
                                                            handleOpenReview(item.id)
                                                        }}
                                                    >
                                                        {t("dashboard:myWork.openReview")}
                                                    </DropdownItem>
                                                    <DropdownItem
                                                        key="deep_link"
                                                        onPress={(): void => {
                                                            if (typeof window !== "undefined") {
                                                                window.location.assign(
                                                                    item.deepLink,
                                                                )
                                                            }
                                                        }}
                                                    >
                                                        {t("dashboard:myWork.deepLink")}
                                                    </DropdownItem>
                                                </DropdownMenu>
                                            </Dropdown>
                                        </div>
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <p className={TYPOGRAPHY.sectionTitle}>
                        {t("dashboard:myWork.ownershipAuditTrail")}
                    </p>
                </CardHeader>
                <CardContent className="space-y-2">
                    {auditTrail.length === 0 ? (
                        <p className={TYPOGRAPHY.bodyMuted}>
                            {t("dashboard:myWork.noOwnershipChanges")}
                        </p>
                    ) : (
                        <ul
                            aria-label={t("dashboard:myWork.auditTrailAriaLabel")}
                            className="space-y-1"
                        >
                            {auditTrail.map(
                                (entry): ReactElement => (
                                    <li
                                        className="text-xs text-muted"
                                        key={entry.id}
                                    >{`${entry.itemId} ${auditActionMap[entry.action]} at ${formatTimestamp(entry.timestamp)}`}</li>
                                ),
                            )}
                        </ul>
                    )}
                </CardContent>
            </Card>
        </PageShell>
    )
}
