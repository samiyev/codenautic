import type { IHttpClient } from "../http-client"

/** Имя тарифного плана. */
export type TPlanName = "enterprise" | "pro" | "starter"

/** Статус биллинга. */
export type TBillingStatus = "active" | "canceled" | "past_due" | "trial"

/** Тип операции в истории плана. */
export type TPlanHistoryAction = "invoice_paid" | "plan_change" | "status_change"

/** Текущий snapshot биллинга. */
export interface IBillingSnapshot {
    /** Активный план. */
    readonly plan: TPlanName
    /** Billing lifecycle state. */
    readonly status: TBillingStatus
}

/** Запись истории изменений плана. */
export interface IPlanHistoryEntry {
    /** Уникальный идентификатор события. */
    readonly id: string
    /** Исполнитель изменения. */
    readonly actor: string
    /** Тип операции. */
    readonly action: TPlanHistoryAction
    /** Итог операции. */
    readonly outcome: string
    /** Время изменения. */
    readonly occurredAt: string
}

/** Ответ биллинга. */
export interface IBillingDataResponse {
    /** Текущий snapshot. */
    readonly snapshot: IBillingSnapshot
    /** История изменений. */
    readonly history: readonly IPlanHistoryEntry[]
}

/** Запрос обновления плана/статуса. */
export interface IUpdateBillingRequest {
    /** Новый план. */
    readonly plan?: TPlanName
    /** Новый статус. */
    readonly status?: TBillingStatus
}

/** Контракт Billing API. */
export interface IBillingApi {
    /** Возвращает текущий snapshot биллинга и историю. */
    getBilling(): Promise<IBillingDataResponse>

    /** Обновляет план и/или статус. */
    updatePlan(request: IUpdateBillingRequest): Promise<IBillingDataResponse>

    /** Возвращает историю изменений. */
    getHistory(): Promise<readonly IPlanHistoryEntry[]>
}

/**
 * Endpoint-слой для Billing API.
 */
export class BillingApi implements IBillingApi {
    /**
     * HTTP-клиент для выполнения запросов.
     */
    private readonly httpClient: IHttpClient

    /**
     * Создаёт экземпляр BillingApi.
     *
     * @param httpClient - HTTP-клиент.
     */
    public constructor(httpClient: IHttpClient) {
        this.httpClient = httpClient
    }

    /**
     * Возвращает текущий snapshot биллинга и историю.
     *
     * @returns Snapshot и история.
     */
    public async getBilling(): Promise<IBillingDataResponse> {
        return this.httpClient.request<IBillingDataResponse>({
            method: "GET",
            path: "/api/v1/billing",
            credentials: "include",
        })
    }

    /**
     * Обновляет план и/или статус.
     *
     * @param request - Данные для обновления.
     * @returns Обновлённый snapshot и история.
     */
    public async updatePlan(request: IUpdateBillingRequest): Promise<IBillingDataResponse> {
        return this.httpClient.request<IBillingDataResponse>({
            method: "PUT",
            path: "/api/v1/billing/plan",
            body: request,
            credentials: "include",
        })
    }

    /**
     * Возвращает историю изменений.
     *
     * @returns Массив записей истории.
     */
    public async getHistory(): Promise<readonly IPlanHistoryEntry[]> {
        return this.httpClient.request<readonly IPlanHistoryEntry[]>({
            method: "GET",
            path: "/api/v1/billing/history",
            credentials: "include",
        })
    }
}
