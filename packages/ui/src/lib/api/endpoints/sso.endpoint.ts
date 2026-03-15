import type { IHttpClient } from "../http-client"

/**
 * Конфигурация SAML провайдера.
 */
export interface ISamlConfig {
    /**
     * SAML Entity ID (SP).
     */
    readonly entityId: string
    /**
     * URL IdP SSO endpoint.
     */
    readonly ssoUrl: string
    /**
     * X.509 certificate body.
     */
    readonly x509Certificate: string
}

/**
 * Конфигурация OIDC провайдера.
 */
export interface IOidcConfig {
    /**
     * OIDC issuer URL.
     */
    readonly issuerUrl: string
    /**
     * Client identifier.
     */
    readonly clientId: string
    /**
     * Client secret (masked in UI).
     */
    readonly clientSecret: string
}

/**
 * Ответ с SAML конфигурацией.
 */
export interface ISamlConfigResponse {
    /**
     * Данные SAML конфигурации.
     */
    readonly saml: ISamlConfig
}

/**
 * Ответ с OIDC конфигурацией.
 */
export interface IOidcConfigResponse {
    /**
     * Данные OIDC конфигурации.
     */
    readonly oidc: IOidcConfig
}

/**
 * Тип SSO провайдера.
 */
export type TSsoProvider = "oidc" | "saml"

/**
 * Запрос на тестирование SSO подключения.
 */
export interface ISsoTestRequest {
    /**
     * Провайдер для тестирования.
     */
    readonly provider: TSsoProvider
}

/**
 * Результат тестирования SSO подключения.
 */
export interface ISsoTestResponse {
    /**
     * Провайдер теста.
     */
    readonly provider: TSsoProvider
    /**
     * Результат теста.
     */
    readonly status: "failed" | "passed"
    /**
     * Сообщение результата.
     */
    readonly message: string
}

/**
 * API-контракт управления SSO конфигурацией.
 */
export interface ISsoApi {
    /**
     * Возвращает SAML конфигурацию.
     */
    getSamlConfig(): Promise<ISamlConfigResponse>

    /**
     * Обновляет SAML конфигурацию.
     *
     * @param data - Новая конфигурация SAML.
     */
    updateSamlConfig(data: ISamlConfig): Promise<ISamlConfigResponse>

    /**
     * Возвращает OIDC конфигурацию.
     */
    getOidcConfig(): Promise<IOidcConfigResponse>

    /**
     * Обновляет OIDC конфигурацию.
     *
     * @param data - Новая конфигурация OIDC.
     */
    updateOidcConfig(data: IOidcConfig): Promise<IOidcConfigResponse>

    /**
     * Тестирует SSO подключение.
     *
     * @param data - Параметры теста.
     */
    testConnection(data: ISsoTestRequest): Promise<ISsoTestResponse>
}

/**
 * Endpoint-клиент SSO API.
 */
export class SsoApi implements ISsoApi {
    /**
     * HTTP-клиент для запросов.
     */
    private readonly httpClient: IHttpClient

    /**
     * Создаёт экземпляр SsoApi.
     *
     * @param httpClient - HTTP-клиент.
     */
    public constructor(httpClient: IHttpClient) {
        this.httpClient = httpClient
    }

    /**
     * Возвращает SAML конфигурацию.
     *
     * @returns Ответ с SAML конфигурацией.
     */
    public async getSamlConfig(): Promise<ISamlConfigResponse> {
        return this.httpClient.request<ISamlConfigResponse>({
            method: "GET",
            path: "/api/v1/sso/saml",
            credentials: "include",
        })
    }

    /**
     * Обновляет SAML конфигурацию.
     *
     * @param data - Новая конфигурация SAML.
     * @returns Ответ с обновлённой конфигурацией.
     */
    public async updateSamlConfig(data: ISamlConfig): Promise<ISamlConfigResponse> {
        return this.httpClient.request<ISamlConfigResponse>({
            method: "PUT",
            path: "/api/v1/sso/saml",
            body: data,
            credentials: "include",
        })
    }

    /**
     * Возвращает OIDC конфигурацию.
     *
     * @returns Ответ с OIDC конфигурацией.
     */
    public async getOidcConfig(): Promise<IOidcConfigResponse> {
        return this.httpClient.request<IOidcConfigResponse>({
            method: "GET",
            path: "/api/v1/sso/oidc",
            credentials: "include",
        })
    }

    /**
     * Обновляет OIDC конфигурацию.
     *
     * @param data - Новая конфигурация OIDC.
     * @returns Ответ с обновлённой конфигурацией.
     */
    public async updateOidcConfig(data: IOidcConfig): Promise<IOidcConfigResponse> {
        return this.httpClient.request<IOidcConfigResponse>({
            method: "PUT",
            path: "/api/v1/sso/oidc",
            body: data,
            credentials: "include",
        })
    }

    /**
     * Тестирует SSO подключение.
     *
     * @param data - Параметры теста.
     * @returns Ответ с результатом теста.
     */
    public async testConnection(data: ISsoTestRequest): Promise<ISsoTestResponse> {
        return this.httpClient.request<ISsoTestResponse>({
            method: "POST",
            path: "/api/v1/sso/test",
            body: data,
            credentials: "include",
        })
    }
}
