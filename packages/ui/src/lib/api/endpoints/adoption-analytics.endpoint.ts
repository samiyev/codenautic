import type { IHttpClient } from "../http-client"

/** Диапазон дат для adoption analytics. */
export type TAnalyticsRange = "7d" | "30d" | "90d"

/** Идентификатор funnel шага. */
export type TFunnelStageId =
    | "add_repo"
    | "connect_provider"
    | "first_ccr_reviewed"
    | "first_insights"
    | "first_scan"

/**
 * Шаг adoption funnel.
 */
export interface IFunnelStage {
    /**
     * Идентификатор funnel шага.
     */
    readonly id: TFunnelStageId
    /**
     * Человеко-читаемый label шага.
     */
    readonly label: string
    /**
     * Количество org/users на шаге.
     */
    readonly count: number
}

/**
 * Здоровье workflow stage.
 */
export interface IWorkflowHealth {
    /**
     * Workflow stage.
     */
    readonly stage: string
    /**
     * Индикатор здоровья stage.
     */
    readonly health: "at_risk" | "healthy" | "needs_attention"
    /**
     * Пояснение по stage.
     */
    readonly summary: string
}

/**
 * Ответ adoption analytics API.
 */
export interface IAdoptionAnalyticsResponse {
    /**
     * Шаги adoption funnel.
     */
    readonly funnelStages: readonly IFunnelStage[]
    /**
     * Здоровье workflow stages.
     */
    readonly workflowHealth: readonly IWorkflowHealth[]
    /**
     * Количество активных пользователей за период.
     */
    readonly activeUsers: number
    /**
     * Медианное время до первой ценности.
     */
    readonly timeToFirstValue: string
}

/**
 * Контракт Adoption Analytics API.
 */
export interface IAdoptionAnalyticsApi {
    /**
     * Возвращает adoption analytics данные за указанный диапазон.
     *
     * @param range - Диапазон дат.
     */
    getFunnel(range: TAnalyticsRange): Promise<IAdoptionAnalyticsResponse>
}

/**
 * Endpoint-слой для Adoption Analytics API.
 */
export class AdoptionAnalyticsApi implements IAdoptionAnalyticsApi {
    /**
     * HTTP-клиент для выполнения запросов.
     */
    private readonly httpClient: IHttpClient

    /**
     * Создаёт экземпляр AdoptionAnalyticsApi.
     *
     * @param httpClient - HTTP-клиент.
     */
    public constructor(httpClient: IHttpClient) {
        this.httpClient = httpClient
    }

    /**
     * Возвращает adoption analytics данные за указанный диапазон.
     *
     * @param range - Диапазон дат.
     * @returns Funnel stages, workflow health, KPI метрики.
     */
    public async getFunnel(range: TAnalyticsRange): Promise<IAdoptionAnalyticsResponse> {
        return this.httpClient.request<IAdoptionAnalyticsResponse>({
            method: "GET",
            path: "/api/v1/analytics/adoption",
            query: { range },
            credentials: "include",
        })
    }
}
