import { type ReactElement, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { useDynamicTranslation } from "@/lib/i18n"
import { ContextPreview } from "@/components/settings/context-preview"
import { ContextSourceCard } from "@/components/settings/context-source-card"
import { TestConnectionButton } from "@/components/settings/test-connection-button"
import { Button, Card, CardContent, CardHeader, Chip, Input, Switch, Tabs } from "@heroui/react"
import { SettingsWebhooksPage } from "@/pages/settings-webhooks.page"
import { TYPOGRAPHY } from "@/lib/constants/typography"
import { useExternalContext } from "@/lib/hooks/queries/use-external-context"
import { useIntegrations } from "@/lib/hooks/queries/use-integrations"
import { showToastError, showToastInfo, showToastSuccess } from "@/lib/notifications/toast"
import type {
    IIntegrationState,
    TIntegrationProvider,
    TIntegrationStatus,
} from "@/lib/api/endpoints/integrations.endpoint"

function mapStatusChipColor(status: TIntegrationStatus): "default" | "success" | "warning" {
    if (status === "connected") {
        return "success"
    }

    if (status === "degraded") {
        return "warning"
    }

    return "default"
}

function mapStatusLabelKey(status: TIntegrationStatus): string {
    if (status === "connected") {
        return "connected"
    }

    if (status === "degraded") {
        return "degraded"
    }

    return "disconnected"
}

function resolveWorkspacePlaceholder(provider: TIntegrationProvider): string {
    if (provider === "Jira") {
        return "https://acme.atlassian.net"
    }

    if (provider === "Linear") {
        return "acme-workspace"
    }

    if (provider === "Sentry") {
        return "acme-org"
    }

    return "acme-workspace"
}

function resolveTargetPlaceholder(provider: TIntegrationProvider): string {
    if (provider === "Jira") {
        return "Project key (PLAT)"
    }

    if (provider === "Linear") {
        return "Team key (ENG)"
    }

    if (provider === "Sentry") {
        return "Project slug (web-frontend)"
    }

    return "Channel (#code-review)"
}

/**
 * Страница управления внешними интеграциями.
 *
 * @returns Экран конфигурации Jira/Linear/Sentry/Slack.
 */
export function SettingsIntegrationsPage(): ReactElement {
    const { t } = useTranslation(["settings"])
    const { td } = useDynamicTranslation(["settings"])
    const integrationsApi = useIntegrations()
    const integrations = integrationsApi.integrationsQuery.data?.integrations ?? []
    const [drafts, setDrafts] = useState<
        Readonly<Record<string, { readonly workspace?: string; readonly target?: string }>>
    >({})
    const [selectedContextSourceId, setSelectedContextSourceId] = useState<string | undefined>(
        undefined,
    )

    /**
     * Возвращает значение draft-поля или fallback из API.
     *
     * @param integrationId - Идентификатор интеграции.
     * @param field - Имя поля.
     * @param fallback - Значение из API.
     * @returns Значение для отображения.
     */
    const getDraftValue = (
        integrationId: string,
        field: "workspace" | "target",
        fallback: string,
    ): string => {
        const draft = drafts[integrationId]
        if (draft === undefined) {
            return fallback
        }
        return draft[field] ?? fallback
    }

    /**
     * Обновляет draft-поле для интеграции.
     *
     * @param integrationId - Идентификатор интеграции.
     * @param field - Имя поля.
     * @param value - Новое значение.
     */
    const setDraftValue = (
        integrationId: string,
        field: "workspace" | "target",
        value: string,
    ): void => {
        setDrafts((previous): typeof previous => ({
            ...previous,
            [integrationId]: {
                ...previous[integrationId],
                [field]: value,
            },
        }))
    }
    const externalContext = useExternalContext({
        selectedSourceId: selectedContextSourceId,
        previewEnabled: selectedContextSourceId !== undefined,
    })

    const summary = useMemo((): {
        readonly connected: number
        readonly degraded: number
        readonly disconnected: number
    } => {
        return integrations.reduce(
            (
                accumulator,
                integration,
            ): {
                readonly connected: number
                readonly degraded: number
                readonly disconnected: number
            } => {
                if (integration.status === "connected") {
                    return {
                        ...accumulator,
                        connected: accumulator.connected + 1,
                    }
                }

                if (integration.status === "degraded") {
                    return {
                        ...accumulator,
                        degraded: accumulator.degraded + 1,
                    }
                }

                return {
                    ...accumulator,
                    disconnected: accumulator.disconnected + 1,
                }
            },
            {
                connected: 0,
                degraded: 0,
                disconnected: 0,
            },
        )
    }, [integrations])

    useEffect((): void => {
        if (selectedContextSourceId !== undefined) {
            return
        }

        const firstSourceId = externalContext.sourcesQuery.data?.sources.at(0)?.id
        if (firstSourceId === undefined) {
            return
        }

        setSelectedContextSourceId(firstSourceId)
    }, [externalContext.sourcesQuery.data?.sources, selectedContextSourceId])

    /**
     * Находит интеграцию по провайдеру.
     *
     * @param provider - Провайдер.
     * @returns Интеграция или undefined.
     */
    const findIntegration = (provider: TIntegrationProvider): IIntegrationState | undefined => {
        return integrations.find((item): boolean => item.provider === provider)
    }

    const handleSaveConfiguration = (provider: TIntegrationProvider): void => {
        const integration = findIntegration(provider)
        if (integration === undefined) {
            return
        }

        const draft = drafts[integration.id]
        integrationsApi.saveConfig.mutate(
            {
                id: integration.id,
                workspace: draft?.workspace ?? integration.workspace,
                target: draft?.target ?? integration.target,
                syncEnabled: integration.syncEnabled,
                notificationsEnabled: integration.notificationsEnabled,
            },
            {
                onSuccess: (): void => {
                    setDrafts((previous): typeof previous => {
                        const { [integration.id]: _removed, ...rest } = previous
                        return rest
                    })
                    showToastSuccess(
                        t("settings:integrations.toast.configSaved", { provider }),
                    )
                },
                onError: (): void => {
                    showToastError(
                        t("settings:integrations.toast.configSaved", { provider }),
                    )
                },
            },
        )
    }

    const handleToggleConnection = (provider: TIntegrationProvider): void => {
        const integration = findIntegration(provider)
        if (integration === undefined) {
            return
        }

        const shouldConnect = integration.connected !== true
        integrationsApi.toggleConnection.mutate(
            {
                id: integration.id,
                connected: shouldConnect,
            },
            {
                onSuccess: (): void => {
                    showToastInfo(
                        t("settings:integrations.toast.connectionStateUpdated", { provider }),
                    )
                },
            },
        )
    }

    const handleTestConnection = async (
        provider: TIntegrationProvider,
    ): Promise<boolean> => {
        const integration = findIntegration(provider)
        if (integration === undefined) {
            return false
        }

        try {
            const result = await integrationsApi.testConnection.mutateAsync({
                id: integration.id,
            })

            if (result.ok === true) {
                showToastSuccess(
                    t("settings:integrations.toast.providerHealthy", { provider }),
                )
            } else {
                showToastError(
                    t("settings:integrations.toast.healthCheckFailed", { provider }),
                )
            }

            return result.ok
        } catch {
            showToastError(
                t("settings:integrations.toast.healthCheckFailed", { provider }),
            )
            return false
        }
    }

    const handleToggleContextSource = async (
        sourceId: string,
        nextEnabled: boolean,
    ): Promise<void> => {
        try {
            await externalContext.updateSource.mutateAsync({
                sourceId,
                enabled: nextEnabled,
            })
            showToastSuccess(t("settings:integrations.toast.contextSourceUpdated"))
        } catch {
            showToastError(t("settings:integrations.toast.unableToUpdateContextSource"))
        }
    }

    const handleRefreshContextSource = async (sourceId: string): Promise<void> => {
        try {
            await externalContext.refreshSource.mutateAsync(sourceId)
            showToastInfo(t("settings:integrations.toast.contextSourceRefreshQueued"))
        } catch {
            showToastError(t("settings:integrations.toast.unableToQueueRefresh"))
        }
    }

    const selectedContextSource = externalContext.sourcesQuery.data?.sources.find(
        (source): boolean => source.id === selectedContextSourceId,
    )

    return (
        <Tabs aria-label={t("settings:integrations.tabsLabel", { defaultValue: "Integrations settings" })} variant="secondary">
            <Tabs.List>
                <Tabs.Tab id="integrations">{t("settings:integrations.tabIntegrations", { defaultValue: "Integrations" })}</Tabs.Tab>
                <Tabs.Tab id="webhooks">{t("settings:integrations.tabWebhooks", { defaultValue: "Webhooks" })}</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel id="integrations">
        <div className="space-y-6 mx-auto max-w-[1400px]"><div className="space-y-1.5"><h1 className={TYPOGRAPHY.pageTitle}>{t("settings:integrations.pageTitle")}</h1><p className={TYPOGRAPHY.bodyMuted}>{t("settings:integrations.pageSubtitle")}</p></div><div className="space-y-6">
            <Card>
                <CardHeader>
                    <p className={TYPOGRAPHY.sectionTitle}>
                        {t("settings:integrations.connectionHealthSummary")}
                    </p>
                </CardHeader>
                <CardContent className="grid gap-2 text-sm sm:grid-cols-3">
                    <p className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-success">
                        {t("settings:integrations.connected")}{" "}
                        <span className="font-semibold">{summary.connected}</span>
                    </p>
                    <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-warning">
                        {t("settings:integrations.degraded")}{" "}
                        <span className="font-semibold">{summary.degraded}</span>
                    </p>
                    <p className="rounded-lg border border-border bg-surface px-3 py-2 text-foreground">
                        {t("settings:integrations.disconnected")}{" "}
                        <span className="font-semibold">{summary.disconnected}</span>
                    </p>
                </CardContent>
            </Card>

            {integrationsApi.integrationsQuery.isPending ? (
                <p aria-live="polite" className="text-sm text-muted">
                    {t("settings:integrations.loadingContextSources")}
                </p>
            ) : (
            <div className="space-y-4">
                {integrations.map(
                    (integration): ReactElement => (
                        <Card key={integration.id}>
                            <CardHeader className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <p className={TYPOGRAPHY.sectionTitle}>
                                        {integration.provider}
                                    </p>
                                    <p className="text-sm text-muted">{integration.description}</p>
                                </div>
                                <Chip
                                    color={mapStatusChipColor(integration.status)}
                                    size="sm"
                                    variant="soft"
                                >
                                    {td(
                                        `settings:integrations.${mapStatusLabelKey(integration.status)}`,
                                    )}
                                </Chip>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="grid gap-3 md:grid-cols-2">
                                    <Input
                                        aria-label={t("settings:integrations.workspaceEndpoint")}
                                        onChange={(e): void => {
                                            setDraftValue(
                                                integration.id,
                                                "workspace",
                                                e.target.value,
                                            )
                                        }}
                                        placeholder={resolveWorkspacePlaceholder(
                                            integration.provider,
                                        )}
                                        value={getDraftValue(
                                            integration.id,
                                            "workspace",
                                            integration.workspace,
                                        )}
                                    />
                                    <Input
                                        aria-label={t("settings:integrations.target")}
                                        onChange={(e): void => {
                                            setDraftValue(
                                                integration.id,
                                                "target",
                                                e.target.value,
                                            )
                                        }}
                                        placeholder={resolveTargetPlaceholder(integration.provider)}
                                        value={getDraftValue(
                                            integration.id,
                                            "target",
                                            integration.target,
                                        )}
                                    />
                                </div>

                                <div className="flex flex-wrap items-center gap-4 text-sm">
                                    <Switch
                                        isSelected={integration.syncEnabled}
                                        onChange={(_isSelected: boolean): void => {
                                            integrationsApi.saveConfig.mutate({
                                                id: integration.id,
                                                syncEnabled: !integration.syncEnabled,
                                            })
                                        }}
                                    >
                                        {t("settings:integrations.enableSync")}
                                    </Switch>
                                    <Switch
                                        isSelected={integration.notificationsEnabled}
                                        onChange={(_isSelected: boolean): void => {
                                            integrationsApi.saveConfig.mutate({
                                                id: integration.id,
                                                notificationsEnabled:
                                                    !integration.notificationsEnabled,
                                            })
                                        }}
                                    >
                                        {t("settings:integrations.enableNotifications")}
                                    </Switch>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <TestConnectionButton
                                        onTest={(): Promise<boolean> =>
                                            handleTestConnection(integration.provider)
                                        }
                                        providerLabel={integration.provider}
                                    />
                                    <Button
                                        onPress={(): void => {
                                            handleToggleConnection(integration.provider)
                                        }}
                                        size="sm"
                                        variant={
                                            integration.connected === true ? "secondary" : "primary"
                                        }
                                    >
                                        {integration.connected === true
                                            ? t("settings:integrations.disconnect")
                                            : t("settings:integrations.connect")}
                                    </Button>
                                    <Button
                                        onPress={(): void => {
                                            handleSaveConfiguration(integration.provider)
                                        }}
                                        size="sm"
                                        variant="ghost"
                                    >
                                        {t("settings:integrations.saveConfiguration")}
                                    </Button>
                                </div>

                                <p className="text-xs text-muted">
                                    {t("settings:integrations.secretToken")}{" "}
                                    {integration.secretConfigured === true
                                        ? t("settings:integrations.configured")
                                        : t("settings:integrations.notConfigured")}{" "}
                                    · {t("settings:integrations.lastSync")}{" "}
                                    {integration.lastSyncAt ??
                                        t("settings:integrations.notSyncedYet")}
                                </p>
                            </CardContent>
                        </Card>
                    ),
                )}
            </div>
            )}

            <Card>
                <CardHeader>
                    <div>
                        <p className={TYPOGRAPHY.sectionTitle}>
                            {t("settings:integrations.externalContextSources")}
                        </p>
                        <p className="text-sm text-muted">
                            {t("settings:integrations.manageContextSources")}
                        </p>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {externalContext.sourcesQuery.isPending ? (
                        <p aria-live="polite" className="text-sm text-muted">
                            {t("settings:integrations.loadingContextSources")}
                        </p>
                    ) : externalContext.sourcesQuery.error !== null ? (
                        <p aria-live="polite" className="text-sm text-danger">
                            {t("settings:integrations.failedToLoadContextSources")}
                        </p>
                    ) : (
                        <div className="grid gap-3 lg:grid-cols-2">
                            <div className="space-y-3">
                                {externalContext.sourcesQuery.data?.sources.map(
                                    (source): ReactElement => (
                                        <ContextSourceCard
                                            key={source.id}
                                            isLoading={
                                                externalContext.updateSource.isPending ||
                                                externalContext.refreshSource.isPending
                                            }
                                            selected={source.id === selectedContextSourceId}
                                            source={source}
                                            onRefresh={handleRefreshContextSource}
                                            onSelect={(sourceId): void => {
                                                setSelectedContextSourceId(sourceId)
                                            }}
                                            onToggleEnabled={handleToggleContextSource}
                                        />
                                    ),
                                ) ?? []}
                            </div>
                            <ContextPreview
                                isError={externalContext.previewQuery.error !== null}
                                isLoading={externalContext.previewQuery.isPending}
                                preview={externalContext.previewQuery.data}
                                sourceName={selectedContextSource?.name}
                            />
                        </div>
                    )}
                </CardContent>
            </Card>
        </div></div>
            </Tabs.Panel>
            <Tabs.Panel id="webhooks">
                <SettingsWebhooksPage />
            </Tabs.Panel>
        </Tabs>
    )
}
