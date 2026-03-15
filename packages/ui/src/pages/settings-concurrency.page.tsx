import { type ReactElement, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import {
    Alert,
    Button,
    Chip,
    Input,
    Modal,
    ModalBody,
    ModalFooter,
    ModalHeader,
    Switch,
} from "@heroui/react"
import { TYPOGRAPHY } from "@/lib/constants/typography"
import { NATIVE_FORM } from "@/lib/constants/spacing"
import { showToastInfo, showToastSuccess } from "@/lib/notifications/toast"
import { useAdminConfig } from "@/lib/hooks/queries/use-admin-config"
import type { IAdminConfigSnapshot } from "@/lib/api/endpoints/admin-config.endpoint"

type TConflictDecision = "merge" | "reload" | "retry"

interface IConfigConflictState {
    /**
     * Локальный snapshot оператора.
     */
    readonly local: IAdminConfigSnapshot
    /**
     * Актуальный snapshot backend.
     */
    readonly remote: IAdminConfigSnapshot
}

interface IConcurrencyAuditEntry {
    /**
     * Идентификатор события.
     */
    readonly id: string
    /**
     * Решение оператора при конфликте.
     */
    readonly decision: TConflictDecision
    /**
     * ETag после применения решения.
     */
    readonly resultingEtag: number
    /**
     * Краткий итог.
     */
    readonly summary: string
    /**
     * Время события.
     */
    readonly occurredAt: string
}

function formatTimestamp(rawValue: string): string {
    const date = new Date(rawValue)
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

function resolveDiffRows(
    local: IAdminConfigSnapshot,
    remote: IAdminConfigSnapshot,
): ReadonlyArray<{
    readonly field: string
    readonly localValue: string
    readonly remoteValue: string
}> {
    const rows: Array<{ field: string; localValue: string; remoteValue: string }> = []

    if (local.values.severityThreshold !== remote.values.severityThreshold) {
        rows.push({
            field: "severityThreshold",
            localValue: local.values.severityThreshold,
            remoteValue: remote.values.severityThreshold,
        })
    }

    if (local.values.ignorePaths !== remote.values.ignorePaths) {
        rows.push({
            field: "ignorePaths",
            localValue: local.values.ignorePaths,
            remoteValue: remote.values.ignorePaths,
        })
    }

    if (local.values.requireReviewerApproval !== remote.values.requireReviewerApproval) {
        rows.push({
            field: "requireReviewerApproval",
            localValue: String(local.values.requireReviewerApproval),
            remoteValue: String(remote.values.requireReviewerApproval),
        })
    }

    return rows
}

/**
 * Экран optimistic concurrency resolver для admin settings.
 *
 * @returns Conflict dialog с merge/reload/retry и audit trail решений.
 */
export function SettingsConcurrencyPage(): ReactElement {
    const { t } = useTranslation(["settings"])
    const { configQuery, updateConfig } = useAdminConfig()

    const DEFAULT_SNAPSHOT: IAdminConfigSnapshot = {
        etag: 1,
        values: {
            ignorePaths: "",
            requireReviewerApproval: false,
            severityThreshold: "medium",
        },
    }

    const remoteSnapshot: IAdminConfigSnapshot = configQuery.data?.config ?? DEFAULT_SNAPSHOT
    const [localDraft, setLocalDraft] = useState<IAdminConfigSnapshot>(remoteSnapshot)
    const [conflictState, setConflictState] = useState<IConfigConflictState | undefined>(undefined)
    const [audit, setAudit] = useState<ReadonlyArray<IConcurrencyAuditEntry>>([])

    useEffect((): void => {
        if (configQuery.data !== undefined) {
            setLocalDraft(configQuery.data.config)
        }
    }, [configQuery.data])

    const diffRows = useMemo((): ReadonlyArray<{
        readonly field: string
        readonly localValue: string
        readonly remoteValue: string
    }> => {
        if (conflictState === undefined) {
            return []
        }

        return resolveDiffRows(conflictState.local, conflictState.remote)
    }, [conflictState])

    const appendAudit = (
        decision: TConflictDecision,
        resultingEtag: number,
        summary: string,
    ): void => {
        setAudit(
            (previous): ReadonlyArray<IConcurrencyAuditEntry> => [
                {
                    decision,
                    id: `CONC-${Date.now().toString(36)}`,
                    occurredAt: new Date().toISOString(),
                    resultingEtag,
                    summary,
                },
                ...previous,
            ],
        )
    }

    const handleSave = (): void => {
        updateConfig.mutate(
            { values: localDraft.values, etag: localDraft.etag },
            {
                onSuccess: (result): void => {
                    if (result.conflict === true) {
                        setConflictState({
                            local: localDraft,
                            remote: result.serverConfig,
                        })
                        showToastInfo(t("settings:concurrency.toast.concurrencyConflictDetected"))
                        return
                    }

                    setLocalDraft(result.config)
                    appendAudit("retry", result.config.etag, "Config saved without conflict.")
                    showToastSuccess(t("settings:concurrency.toast.configSaved"))
                },
            },
        )
    }

    const handleSimulateRemoteChange = (): void => {
        const simulatedValues = {
            ignorePaths: "dist/**,coverage/**,generated/**",
            requireReviewerApproval: true as const,
            severityThreshold:
                remoteSnapshot.values.severityThreshold === "medium"
                    ? ("high" as const)
                    : ("medium" as const),
        }
        updateConfig.mutate(
            { values: simulatedValues, etag: remoteSnapshot.etag },
            {
                onSuccess: (): void => {
                    showToastInfo(t("settings:concurrency.toast.externalUpdateApplied"))
                },
            },
        )
    }

    const handleConflictMerge = (): void => {
        if (conflictState === undefined) {
            return
        }

        updateConfig.mutate(
            { values: conflictState.local.values, etag: conflictState.remote.etag },
            {
                onSuccess: (result): void => {
                    if (result.conflict !== true) {
                        setLocalDraft(result.config)
                        appendAudit("merge", result.config.etag, "Conflict merged with local priority.")
                    }
                    setConflictState(undefined)
                    showToastSuccess(t("settings:concurrency.toast.conflictResolvedByMerge"))
                },
            },
        )
    }

    const handleConflictReload = (): void => {
        if (conflictState === undefined) {
            return
        }

        setLocalDraft(conflictState.remote)
        appendAudit(
            "reload",
            conflictState.remote.etag,
            "Local draft reloaded from remote snapshot.",
        )
        setConflictState(undefined)
        showToastInfo(t("settings:concurrency.toast.localDraftReplacedWithRemote"))
    }

    const handleConflictRetry = (): void => {
        if (conflictState === undefined) {
            return
        }

        const nextDraft: IAdminConfigSnapshot = {
            ...conflictState.local,
            etag: conflictState.remote.etag,
        }
        setLocalDraft(nextDraft)
        appendAudit(
            "retry",
            conflictState.remote.etag,
            "Local draft aligned to latest etag for retry.",
        )
        setConflictState(undefined)
        showToastInfo(t("settings:concurrency.toast.draftAlignedToLatestEtag"))
    }

    return (
        <div className="space-y-6 mx-auto max-w-[1400px]">
            <div className="space-y-1.5">
                <h1 className={TYPOGRAPHY.pageTitle}>{t("settings:concurrency.pageTitle")}</h1>
                <p className={TYPOGRAPHY.bodyMuted}>{t("settings:concurrency.pageSubtitle")}</p>
            </div>
            <div className="space-y-6">
            <section className="space-y-4 rounded-lg border border-border/50 bg-surface-tertiary p-4">
                <div className="space-y-1">
                    <h3 className={TYPOGRAPHY.subsectionTitle}>{t("settings:concurrency.snapshotVersions")}</h3>
                </div>
                <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                    <Chip size="sm" variant="soft">
                        {t("settings:concurrency.localEtag", { etag: localDraft.etag })}
                    </Chip>
                    <Chip size="sm" variant="soft">
                        {t("settings:concurrency.remoteEtag", { etag: remoteSnapshot.etag })}
                    </Chip>
                </div>
                <Input
                    aria-label={t("settings:concurrency.ignorePaths")}
                    value={localDraft.values.ignorePaths}
                    onChange={(e): void => {
                        setLocalDraft(
                            (previous): IAdminConfigSnapshot => ({
                                ...previous,
                                values: {
                                    ...previous.values,
                                    ignorePaths: e.target.value,
                                },
                            }),
                        )
                    }}
                />
                <select
                    aria-label={t("settings:ariaLabel.concurrency.severityThreshold")}
                    className={NATIVE_FORM.select}
                    id="concurrency-severity"
                    value={localDraft.values.severityThreshold}
                    onChange={(event): void => {
                        const nextValue = event.currentTarget.value
                        if (nextValue === "low" || nextValue === "medium" || nextValue === "high") {
                            setLocalDraft(
                                (previous): IAdminConfigSnapshot => ({
                                    ...previous,
                                    values: {
                                        ...previous.values,
                                        severityThreshold: nextValue,
                                    },
                                }),
                            )
                        }
                    }}
                >
                    <option value="low">low</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                </select>
                <Switch
                    aria-label={t("settings:ariaLabel.concurrency.requireReviewerApproval")}
                    isSelected={localDraft.values.requireReviewerApproval}
                    onChange={(isSelected: boolean): void => {
                        setLocalDraft(
                            (previous): IAdminConfigSnapshot => ({
                                ...previous,
                                values: {
                                    ...previous.values,
                                    requireReviewerApproval: isSelected,
                                },
                            }),
                        )
                    }}
                >
                    {t("settings:concurrency.requireReviewerApproval")}
                </Switch>
                <div className="flex flex-wrap gap-2">
                    <Button variant="primary" onPress={handleSave}>
                        {t("settings:concurrency.saveSettingsOptimistic")}
                    </Button>
                    <Button variant="secondary" onPress={handleSimulateRemoteChange}>
                        {t("settings:concurrency.simulateExternalUpdate")}
                    </Button>
                </div>
                </div>
            </section>

            <section className="space-y-4 rounded-lg border border-border/50 bg-surface-tertiary p-4">
                <div className="space-y-1">
                    <h3 className={TYPOGRAPHY.subsectionTitle}>{t("settings:concurrency.conflictResolutionAudit")}</h3>
                </div>
                <div className="space-y-3">
                {audit.length === 0 ? (
                    <Alert status="warning">
                        <Alert.Title>
                            {t("settings:concurrency.noConcurrencyDecisionsTitle")}
                        </Alert.Title>
                        <Alert.Description>
                            {t("settings:concurrency.noConcurrencyDecisionsDescription")}
                        </Alert.Description>
                    </Alert>
                ) : (
                    <ul
                        aria-label={t("settings:ariaLabel.concurrency.auditList")}
                        className="space-y-2"
                    >
                        {audit.map(
                            (entry): ReactElement => (
                                <li
                                    className="rounded-lg border border-border bg-surface p-3 text-sm"
                                    key={entry.id}
                                >
                                    <p className="font-semibold text-foreground">
                                        {entry.decision} · etag {entry.resultingEtag}
                                    </p>
                                    <p className="text-muted">{entry.summary}</p>
                                    <p className="text-xs text-muted">
                                        {formatTimestamp(entry.occurredAt)}
                                    </p>
                                </li>
                            ),
                        )}
                    </ul>
                )}
                </div>
            </section>

            <Modal
                isOpen={conflictState !== undefined}
                onOpenChange={(isOpen): void => {
                    if (isOpen === false) {
                        setConflictState(undefined)
                    }
                }}
            >
                <Modal.Container>
                    <Modal.Dialog>
                        <ModalHeader>
                            {t("settings:concurrency.configConflictDetected")}
                        </ModalHeader>
                        <ModalBody>
                            <p className="text-sm text-muted">
                                {t("settings:concurrency.conflictDescription")}
                            </p>
                            <ul
                                aria-label={t("settings:ariaLabel.concurrency.conflictDiffList")}
                                className="space-y-2"
                            >
                                {diffRows.map(
                                    (row): ReactElement => (
                                        <li
                                            className="rounded-md border border-border bg-surface p-2 text-xs"
                                            key={row.field}
                                        >
                                            <p className="font-semibold text-foreground">
                                                {row.field}
                                            </p>
                                            <p>
                                                {t("settings:concurrency.local", {
                                                    value: row.localValue,
                                                })}
                                            </p>
                                            <p>
                                                {t("settings:concurrency.remote", {
                                                    value: row.remoteValue,
                                                })}
                                            </p>
                                        </li>
                                    ),
                                )}
                            </ul>
                        </ModalBody>
                        <ModalFooter>
                            <Button variant="secondary" onPress={handleConflictReload}>
                                {t("settings:concurrency.reloadRemote")}
                            </Button>
                            <Button variant="secondary" onPress={handleConflictRetry}>
                                {t("settings:concurrency.retryWithLatestEtag")}
                            </Button>
                            <Button variant="primary" onPress={handleConflictMerge}>
                                {t("settings:concurrency.mergeAndSave")}
                            </Button>
                        </ModalFooter>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal>
            </div>
        </div>
    )
}
