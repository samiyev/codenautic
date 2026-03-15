import type { IHttpClient } from "../http-client"

/**
 * Уровень severity для конфигурации.
 */
export type TSeverity = "high" | "low" | "medium"

/**
 * Значения административного конфига.
 */
export interface IAdminConfigValues {
    /**
     * Severity threshold policy.
     */
    readonly severityThreshold: TSeverity
    /**
     * Ignore paths configuration.
     */
    readonly ignorePaths: string
    /**
     * Toggle для обязательного reviewer approval.
     */
    readonly requireReviewerApproval: boolean
}

/**
 * Снимок конфигурации с ETag для optimistic concurrency.
 */
export interface IAdminConfigSnapshot {
    /**
     * ETag/version для optimistic concurrency.
     */
    readonly etag: number
    /**
     * Значения админ-конфига.
     */
    readonly values: IAdminConfigValues
}

/**
 * Ответ получения конфигурации.
 */
export interface IAdminConfigResponse {
    /**
     * Снимок конфигурации.
     */
    readonly config: IAdminConfigSnapshot
}

/**
 * Ответ обновления конфигурации при конфликте.
 */
export interface IAdminConfigConflictResponse {
    /**
     * Признак конфликта.
     */
    readonly conflict: true
    /**
     * Серверный снимок, вызвавший конфликт.
     */
    readonly serverConfig: IAdminConfigSnapshot
}

/**
 * Ответ успешного обновления конфигурации.
 */
export interface IAdminConfigUpdateSuccessResponse {
    /**
     * Признак отсутствия конфликта.
     */
    readonly conflict: false
    /**
     * Обновлённый снимок конфигурации.
     */
    readonly config: IAdminConfigSnapshot
}

/**
 * Объединённый ответ обновления конфигурации.
 */
export type TAdminConfigUpdateResponse =
    | IAdminConfigUpdateSuccessResponse
    | IAdminConfigConflictResponse

/**
 * API-контракт домена admin config.
 */
export interface IAdminConfigApi {
    /**
     * Возвращает текущий конфиг с ETag.
     */
    getConfig(): Promise<IAdminConfigResponse>
    /**
     * Обновляет конфиг с optimistic locking через If-Match.
     *
     * @param config - Новые значения конфига.
     * @param etag - Текущий ETag для If-Match.
     */
    updateConfig(config: IAdminConfigValues, etag: number): Promise<TAdminConfigUpdateResponse>
}

/**
 * Endpoint-клиент Admin Config API.
 */
export class AdminConfigApi implements IAdminConfigApi {
    /**
     * HTTP-клиент для запросов.
     */
    private readonly httpClient: IHttpClient

    /**
     * Создаёт экземпляр AdminConfigApi.
     *
     * @param httpClient - HTTP-клиент.
     */
    public constructor(httpClient: IHttpClient) {
        this.httpClient = httpClient
    }

    /**
     * Возвращает текущий конфиг с ETag.
     *
     * @returns Снимок конфигурации.
     */
    public async getConfig(): Promise<IAdminConfigResponse> {
        return this.httpClient.request<IAdminConfigResponse>({
            method: "GET",
            path: "/api/v1/admin-config",
            credentials: "include",
        })
    }

    /**
     * Обновляет конфиг с optimistic locking через If-Match.
     *
     * @param config - Новые значения конфига.
     * @param etag - Текущий ETag для If-Match.
     * @returns Результат обновления (успех или конфликт).
     */
    public async updateConfig(
        config: IAdminConfigValues,
        etag: number,
    ): Promise<TAdminConfigUpdateResponse> {
        return this.httpClient.request<TAdminConfigUpdateResponse>({
            method: "PUT",
            path: "/api/v1/admin-config",
            headers: {
                "If-Match": String(etag),
            },
            body: { values: config },
            credentials: "include",
        })
    }
}
