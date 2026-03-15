import type {
    IAdoptionAnalyticsResponse,
    IFunnelStage,
    IWorkflowHealth,
    TAnalyticsRange,
} from "@/lib/api/endpoints/adoption-analytics.endpoint"

/**
 * Seed-данные для adoption analytics.
 */
interface IAdoptionAnalyticsSeed {
    /**
     * Funnel stages по диапазону.
     */
    readonly funnelByRange: ReadonlyMap<TAnalyticsRange, readonly IFunnelStage[]>
    /**
     * Workflow health по диапазону.
     */
    readonly healthByRange: ReadonlyMap<TAnalyticsRange, readonly IWorkflowHealth[]>
    /**
     * Активные пользователи по диапазону.
     */
    readonly activeUsersByRange: ReadonlyMap<TAnalyticsRange, number>
    /**
     * Time to first value по диапазону.
     */
    readonly ttfvByRange: ReadonlyMap<TAnalyticsRange, string>
}

/**
 * Коллекция adoption analytics для mock API.
 *
 * Хранит in-memory данные adoption funnel.
 * Поддерживает выборку по диапазону.
 */
export class AdoptionAnalyticsCollection {
    /**
     * Seed-данные.
     */
    private data: IAdoptionAnalyticsSeed | undefined

    /**
     * Возвращает adoption analytics за диапазон.
     *
     * @param range - Диапазон дат.
     * @returns Полный ответ adoption analytics.
     */
    public getByRange(range: TAnalyticsRange): IAdoptionAnalyticsResponse {
        return {
            funnelStages: this.data?.funnelByRange.get(range) ?? [],
            workflowHealth: this.data?.healthByRange.get(range) ?? [],
            activeUsers: this.data?.activeUsersByRange.get(range) ?? 0,
            timeToFirstValue: this.data?.ttfvByRange.get(range) ?? "—",
        }
    }

    /**
     * Заполняет коллекцию начальными данными.
     *
     * @param data - Seed-данные.
     */
    public seed(data: IAdoptionAnalyticsSeed): void {
        this.clear()
        this.data = data
    }

    /**
     * Полностью очищает коллекцию.
     */
    public clear(): void {
        this.data = undefined
    }
}
