import type { IHttpClient } from "../http-client"

/**
 * Допустимые провайдеры интеграций.
 */
export const INTEGRATION_PROVIDERS = ["Jira", "Linear", "Sentry", "Slack"] as const

/**
 * Тип провайдера интеграции.
 */
export type TIntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number]

/**
 * Статус подключения интеграции.
 */
export const INTEGRATION_STATUS = {
    connected: "connected",
    degraded: "degraded",
    disconnected: "disconnected",
} as const

/**
 * Тип статуса интеграции.
 */
export type TIntegrationStatus =
    (typeof INTEGRATION_STATUS)[keyof typeof INTEGRATION_STATUS]

/**
 * Состояние одной интеграции.
 */
export interface IIntegrationState {
    /**
     * Идентификатор интеграции.
     */
    readonly id: string
    /**
     * Название провайдера.
     */
    readonly provider: TIntegrationProvider
    /**
     * Короткое описание роли интеграции.
     */
    readonly description: string
    /**
     * Workspace/base path.
     */
    readonly workspace: string
    /**
     * Ключ проекта/канала/сервиса.
     */
    readonly target: string
    /**
     * Подключена ли интеграция.
     */
    readonly connected: boolean
    /**
     * Статус health-check.
     */
    readonly status: TIntegrationStatus
    /**
     * Включен ли sync в pipeline.
     */
    readonly syncEnabled: boolean
    /**
     * Включены ли уведомления для интеграции.
     */
    readonly notificationsEnabled: boolean
    /**
     * Настроен ли секрет/token.
     */
    readonly secretConfigured: boolean
    /**
     * Время последней синхронизации.
     */
    readonly lastSyncAt?: string
}

/**
 * Ответ со списком интеграций.
 */
export interface IIntegrationsListResponse {
    /**
     * Массив интеграций.
     */
    readonly integrations: ReadonlyArray<IIntegrationState>
    /**
     * Общее количество.
     */
    readonly total: number
}

/**
 * Запрос подключения/отключения интеграции.
 */
export interface IToggleIntegrationRequest {
    /**
     * Идентификатор интеграции.
     */
    readonly id: string
    /**
     * Целевое состояние подключения.
     */
    readonly connected: boolean
}

/**
 * Запрос сохранения конфигурации интеграции.
 */
export interface ISaveIntegrationConfigRequest {
    /**
     * Идентификатор интеграции.
     */
    readonly id: string
    /**
     * Workspace/base path.
     */
    readonly workspace?: string
    /**
     * Ключ проекта/канала/сервиса.
     */
    readonly target?: string
    /**
     * Включен ли sync.
     */
    readonly syncEnabled?: boolean
    /**
     * Включены ли уведомления.
     */
    readonly notificationsEnabled?: boolean
}

/**
 * Ответ с обновлённой интеграцией.
 */
export interface IIntegrationResponse {
    /**
     * Обновлённая интеграция.
     */
    readonly integration: IIntegrationState
}

/**
 * Запрос тестирования соединения с интеграцией.
 */
export interface ITestIntegrationRequest {
    /**
     * Идентификатор интеграции.
     */
    readonly id: string
}

/**
 * Ответ тестирования соединения с интеграцией.
 */
export interface ITestIntegrationResponse {
    /**
     * Идентификатор интеграции.
     */
    readonly id: string
    /**
     * Результат теста.
     */
    readonly ok: boolean
    /**
     * Сообщение о результате.
     */
    readonly message: string
}

/**
 * API-контракт управления интеграциями.
 */
export interface IIntegrationsApi {
    /**
     * Возвращает список всех интеграций.
     */
    list(): Promise<IIntegrationsListResponse>

    /**
     * Подключает или отключает интеграцию.
     *
     * @param request - Данные подключения.
     */
    toggleConnection(request: IToggleIntegrationRequest): Promise<IIntegrationResponse>

    /**
     * Сохраняет конфигурацию интеграции.
     *
     * @param request - Данные конфигурации.
     */
    saveConfig(request: ISaveIntegrationConfigRequest): Promise<IIntegrationResponse>

    /**
     * Тестирует соединение с интеграцией.
     *
     * @param request - Данные для теста.
     */
    testConnection(request: ITestIntegrationRequest): Promise<ITestIntegrationResponse>
}

/**
 * Endpoint-клиент Integrations API.
 */
export class IntegrationsApi implements IIntegrationsApi {
    /**
     * HTTP-клиент для запросов.
     */
    private readonly httpClient: IHttpClient

    /**
     * Создаёт экземпляр IntegrationsApi.
     *
     * @param httpClient - HTTP-клиент.
     */
    public constructor(httpClient: IHttpClient) {
        this.httpClient = httpClient
    }

    /**
     * Возвращает список всех интеграций.
     *
     * @returns Ответ со списком интеграций.
     */
    public async list(): Promise<IIntegrationsListResponse> {
        return this.httpClient.request<IIntegrationsListResponse>({
            method: "GET",
            path: "/api/v1/integrations",
            credentials: "include",
        })
    }

    /**
     * Подключает или отключает интеграцию.
     *
     * @param request - Данные подключения.
     * @returns Ответ с обновлённой интеграцией.
     */
    public async toggleConnection(
        request: IToggleIntegrationRequest,
    ): Promise<IIntegrationResponse> {
        const normalizedId = request.id.trim()
        if (normalizedId.length === 0) {
            throw new Error("id интеграции не должен быть пустым")
        }

        return this.httpClient.request<IIntegrationResponse>({
            method: "PUT",
            path: `/api/v1/integrations/${encodeURIComponent(normalizedId)}/connection`,
            body: { connected: request.connected },
            credentials: "include",
        })
    }

    /**
     * Сохраняет конфигурацию интеграции.
     *
     * @param request - Данные конфигурации.
     * @returns Ответ с обновлённой интеграцией.
     */
    public async saveConfig(
        request: ISaveIntegrationConfigRequest,
    ): Promise<IIntegrationResponse> {
        const normalizedId = request.id.trim()
        if (normalizedId.length === 0) {
            throw new Error("id интеграции не должен быть пустым")
        }

        const { id: _id, ...payload } = request
        return this.httpClient.request<IIntegrationResponse>({
            method: "PUT",
            path: `/api/v1/integrations/${encodeURIComponent(normalizedId)}/config`,
            body: payload,
            credentials: "include",
        })
    }

    /**
     * Тестирует соединение с интеграцией.
     *
     * @param request - Данные для теста.
     * @returns Ответ с результатом теста.
     */
    public async testConnection(
        request: ITestIntegrationRequest,
    ): Promise<ITestIntegrationResponse> {
        const normalizedId = request.id.trim()
        if (normalizedId.length === 0) {
            throw new Error("id интеграции не должен быть пустым")
        }

        return this.httpClient.request<ITestIntegrationResponse>({
            method: "POST",
            path: `/api/v1/integrations/${encodeURIComponent(normalizedId)}/test`,
            credentials: "include",
        })
    }
}
