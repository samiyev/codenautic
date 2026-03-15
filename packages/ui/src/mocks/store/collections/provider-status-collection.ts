import type {
    IProviderState,
    IProviderStatusResponse,
    IQueuedAction,
} from "@/lib/api/endpoints/provider-status.endpoint"

/**
 * Коллекция provider status для mock API.
 *
 * Хранит in-memory состояние провайдера и очередь действий.
 */
export class ProviderStatusCollection {
    /**
     * Текущее состояние провайдера.
     */
    private state: IProviderState | undefined

    /**
     * Список действий в очереди.
     */
    private queuedActions: IQueuedAction[] = []

    /**
     * Возвращает текущий статус провайдера.
     *
     * @returns Состояние провайдера и очередь действий.
     */
    public getStatus(): IProviderStatusResponse {
        return {
            state: this.state ?? {
                provider: "llm",
                level: "operational",
                affectedFeatures: [],
                eta: "stable",
                runbookUrl: "https://status.codenautic.local/runbooks/llm",
            },
            queuedActions: [...this.queuedActions],
        }
    }

    /**
     * Добавляет действие в очередь.
     *
     * @param action - Действие для добавления.
     */
    public addQueuedAction(action: IQueuedAction): void {
        this.queuedActions = [action, ...this.queuedActions]
    }

    /**
     * Заполняет коллекцию начальными данными.
     *
     * @param state - Начальное состояние провайдера.
     * @param actions - Начальные действия в очереди.
     */
    public seed(state: IProviderState, actions: ReadonlyArray<IQueuedAction>): void {
        this.clear()
        this.state = state
        this.queuedActions = [...actions]
    }

    /**
     * Полностью очищает коллекцию.
     */
    public clear(): void {
        this.state = undefined
        this.queuedActions = []
    }
}
