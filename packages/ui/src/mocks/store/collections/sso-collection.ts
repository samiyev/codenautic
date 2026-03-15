import type { IOidcConfig, ISamlConfig } from "@/lib/api/endpoints/sso.endpoint"

/**
 * Данные для seed-инициализации SsoCollection.
 */
export interface ISsoSeedData {
    /**
     * Начальная SAML конфигурация.
     */
    readonly saml: ISamlConfig
    /**
     * Начальная OIDC конфигурация.
     */
    readonly oidc: IOidcConfig
}

/**
 * Коллекция SSO конфигурации для mock API.
 *
 * Хранит in-memory конфигурации SAML и OIDC.
 * Поддерживает чтение, обновление, seed и clear.
 */
export class SsoCollection {
    /**
     * SAML конфигурация.
     */
    private saml: ISamlConfig = { entityId: "", ssoUrl: "", x509Certificate: "" }

    /**
     * OIDC конфигурация.
     */
    private oidc: IOidcConfig = { issuerUrl: "", clientId: "", clientSecret: "" }

    /**
     * Возвращает текущую SAML конфигурацию.
     *
     * @returns SAML конфигурация.
     */
    public getSaml(): ISamlConfig {
        return this.saml
    }

    /**
     * Обновляет SAML конфигурацию.
     *
     * @param config - Новая SAML конфигурация.
     * @returns Обновлённая SAML конфигурация.
     */
    public updateSaml(config: ISamlConfig): ISamlConfig {
        this.saml = { ...config }
        return this.saml
    }

    /**
     * Возвращает текущую OIDC конфигурацию.
     *
     * @returns OIDC конфигурация.
     */
    public getOidc(): IOidcConfig {
        return this.oidc
    }

    /**
     * Обновляет OIDC конфигурацию.
     *
     * @param config - Новая OIDC конфигурация.
     * @returns Обновлённая OIDC конфигурация.
     */
    public updateOidc(config: IOidcConfig): IOidcConfig {
        this.oidc = { ...config }
        return this.oidc
    }

    /**
     * Заполняет коллекцию начальными данными.
     *
     * Очищает текущее состояние и загружает переданные данные.
     *
     * @param data - Данные для seed-инициализации.
     */
    public seed(data: ISsoSeedData): void {
        this.clear()
        this.saml = { ...data.saml }
        this.oidc = { ...data.oidc }
    }

    /**
     * Полностью очищает коллекцию (сбрасывает конфигурации в пустое состояние).
     */
    public clear(): void {
        this.saml = { entityId: "", ssoUrl: "", x509Certificate: "" }
        this.oidc = { issuerUrl: "", clientId: "", clientSecret: "" }
    }
}
