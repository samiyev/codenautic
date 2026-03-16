import type { IIntegrationState } from "@/lib/api/endpoints/integrations.endpoint"

import type { IntegrationsCollection } from "../collections/integrations-collection"

/**
 * Начальный набор интеграций.
 *
 * Jira и Slack подключены, Linear отключён, Sentry в состоянии degraded.
 */
const SEED_INTEGRATIONS: ReadonlyArray<IIntegrationState> = [
    {
        id: "int-jira",
        provider: "Jira",
        description: "Issue sync and ticket linking for review findings.",
        workspace: "https://acme.atlassian.net",
        target: "PLAT",
        connected: true,
        status: "connected",
        syncEnabled: true,
        notificationsEnabled: true,
        secretConfigured: true,
        lastSyncAt: "2026-03-04T09:12:00.000Z",
    },
    {
        id: "int-linear",
        provider: "Linear",
        description: "Lightweight issue routing for triage and ownership.",
        workspace: "acme-workspace",
        target: "ENG",
        connected: false,
        status: "disconnected",
        syncEnabled: false,
        notificationsEnabled: false,
        secretConfigured: false,
    },
    {
        id: "int-sentry",
        provider: "Sentry",
        description: "Production incidents and error alerts correlation.",
        workspace: "acme-org",
        target: "web-frontend",
        connected: true,
        status: "degraded",
        syncEnabled: true,
        notificationsEnabled: true,
        secretConfigured: true,
        lastSyncAt: "2026-03-04T08:41:00.000Z",
    },
    {
        id: "int-slack",
        provider: "Slack",
        description: "Delivery channel for notifications and review events.",
        workspace: "acme-workspace",
        target: "#code-review",
        connected: true,
        status: "connected",
        syncEnabled: true,
        notificationsEnabled: true,
        secretConfigured: true,
        lastSyncAt: "2026-03-04T09:18:00.000Z",
    },
]

/**
 * Заполняет integrations коллекцию начальным набором данных.
 *
 * @param collection - Коллекция интеграций для заполнения.
 */
export function seedIntegrations(collection: IntegrationsCollection): void {
    collection.seed({
        integrations: SEED_INTEGRATIONS,
    })
}
