import type { IProviderState, IQueuedAction } from "@/lib/api/endpoints/provider-status.endpoint"

import type { ProviderStatusCollection } from "../collections/provider-status-collection"

/**
 * Начальное состояние провайдера.
 */
const DEFAULT_PROVIDER_STATE: IProviderState = {
    provider: "llm",
    level: "operational",
    affectedFeatures: [],
    eta: "stable",
    runbookUrl: "https://status.codenautic.local/runbooks/llm",
}

/**
 * Начальная очередь действий (пустая).
 */
const DEFAULT_QUEUED_ACTIONS: ReadonlyArray<IQueuedAction> = []

/**
 * Заполняет provider status коллекцию начальным набором данных.
 *
 * @param collection - Коллекция provider status для заполнения.
 */
export function seedProviderStatus(collection: ProviderStatusCollection): void {
    collection.seed(DEFAULT_PROVIDER_STATE, DEFAULT_QUEUED_ACTIONS)
}
