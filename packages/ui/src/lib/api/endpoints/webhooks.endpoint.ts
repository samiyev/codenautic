import type { IHttpClient } from "../http-client"

/** Статус доставки webhook. */
export type TWebhookDeliveryStatus = "disconnected" | "failed" | "retrying" | "success"

/** Webhook endpoint. */
export interface IWebhookEndpoint {
    /** Идентификатор endpoint. */
    readonly id: string
    /** URL webhook endpoint. */
    readonly url: string
    /** Подписанные event types. */
    readonly eventTypes: ReadonlyArray<string>
    /** Маскированный секрет. */
    readonly secretPreview: string
    /** Включен ли endpoint. */
    readonly isEnabled: boolean
    /** Время последней доставки. */
    readonly lastDeliveryAt?: string
    /** Статус последней доставки. */
    readonly status: TWebhookDeliveryStatus
}

/** Запись лога доставки webhook. */
export interface IWebhookDeliveryLog {
    /** Идентификатор лога. */
    readonly id: string
    /** ID endpoint, которому принадлежит лог. */
    readonly endpointId: string
    /** Время события доставки. */
    readonly timestamp: string
    /** HTTP статус доставки. */
    readonly httpStatus: number
    /** Статус доставки. */
    readonly status: TWebhookDeliveryStatus
    /** Короткое сообщение. */
    readonly message: string
}

/** Ответ списка webhook endpoints. */
export interface IWebhooksListResponse {
    /** Массив webhook endpoints. */
    readonly webhooks: readonly IWebhookEndpoint[]
    /** Массив логов доставки. */
    readonly deliveryLogs: readonly IWebhookDeliveryLog[]
}

/** Запрос на создание webhook endpoint. */
export interface ICreateWebhookRequest {
    /** URL endpoint. */
    readonly url: string
    /** Типы событий. */
    readonly eventTypes: ReadonlyArray<string>
}

/** Запрос на обновление webhook endpoint. */
export interface IUpdateWebhookRequest {
    /** Идентификатор endpoint. */
    readonly id: string
    /** Включен ли endpoint. */
    readonly isEnabled?: boolean
    /** Ротировать секрет. */
    readonly rotateSecret?: boolean
}

/** Запрос на удаление webhook endpoint. */
export interface IDeleteWebhookRequest {
    /** Идентификатор endpoint. */
    readonly id: string
}

/** Результат удаления webhook. */
export interface IDeleteWebhookResponse {
    /** Идентификатор удалённого endpoint. */
    readonly id: string
    /** Флаг подтверждения удаления. */
    readonly removed: boolean
}

/** Контракт Webhooks API. */
export interface IWebhooksApi {
    /** Возвращает список webhook endpoints и delivery logs. */
    list(): Promise<IWebhooksListResponse>

    /** Создаёт новый webhook endpoint. */
    create(request: ICreateWebhookRequest): Promise<IWebhookEndpoint>

    /** Обновляет webhook endpoint. */
    update(request: IUpdateWebhookRequest): Promise<IWebhookEndpoint>

    /** Удаляет webhook endpoint. */
    remove(request: IDeleteWebhookRequest): Promise<IDeleteWebhookResponse>

    /** Возвращает delivery logs для endpoint. */
    getDeliveries(endpointId: string): Promise<readonly IWebhookDeliveryLog[]>
}

/**
 * Endpoint-слой для Webhooks API.
 */
export class WebhooksApi implements IWebhooksApi {
    /**
     * HTTP-клиент для выполнения запросов.
     */
    private readonly httpClient: IHttpClient

    /**
     * Создаёт экземпляр WebhooksApi.
     *
     * @param httpClient - HTTP-клиент.
     */
    public constructor(httpClient: IHttpClient) {
        this.httpClient = httpClient
    }

    /**
     * Возвращает список webhook endpoints и delivery logs.
     *
     * @returns Список endpoints и логов доставки.
     */
    public async list(): Promise<IWebhooksListResponse> {
        return this.httpClient.request<IWebhooksListResponse>({
            method: "GET",
            path: "/api/v1/webhooks",
            credentials: "include",
        })
    }

    /**
     * Создаёт новый webhook endpoint.
     *
     * @param request - Данные для создания.
     * @returns Созданный webhook endpoint.
     */
    public async create(request: ICreateWebhookRequest): Promise<IWebhookEndpoint> {
        return this.httpClient.request<IWebhookEndpoint>({
            method: "POST",
            path: "/api/v1/webhooks",
            body: request,
            credentials: "include",
        })
    }

    /**
     * Обновляет webhook endpoint.
     *
     * @param request - Данные для обновления.
     * @returns Обновлённый webhook endpoint.
     */
    public async update(request: IUpdateWebhookRequest): Promise<IWebhookEndpoint> {
        const normalizedId = request.id.trim()
        if (normalizedId.length === 0) {
            throw new Error("id не должен быть пустым")
        }

        const { id: _id, ...payload } = request

        return this.httpClient.request<IWebhookEndpoint>({
            method: "PUT",
            path: `/api/v1/webhooks/${encodeURIComponent(normalizedId)}`,
            body: payload,
            credentials: "include",
        })
    }

    /**
     * Удаляет webhook endpoint.
     *
     * @param request - Запрос с id endpoint.
     * @returns Результат удаления.
     */
    public async remove(request: IDeleteWebhookRequest): Promise<IDeleteWebhookResponse> {
        const normalizedId = request.id.trim()
        if (normalizedId.length === 0) {
            throw new Error("id не должен быть пустым")
        }

        return this.httpClient.request<IDeleteWebhookResponse>({
            method: "DELETE",
            path: `/api/v1/webhooks/${encodeURIComponent(normalizedId)}`,
            credentials: "include",
        })
    }

    /**
     * Возвращает delivery logs для endpoint.
     *
     * @param endpointId - Идентификатор endpoint.
     * @returns Массив логов доставки.
     */
    public async getDeliveries(endpointId: string): Promise<readonly IWebhookDeliveryLog[]> {
        const normalizedId = endpointId.trim()
        if (normalizedId.length === 0) {
            throw new Error("endpointId не должен быть пустым")
        }

        return this.httpClient.request<readonly IWebhookDeliveryLog[]>({
            method: "GET",
            path: `/api/v1/webhooks/${encodeURIComponent(normalizedId)}/deliveries`,
            credentials: "include",
        })
    }
}
