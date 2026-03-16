import type {
    ILlmProviderConfig,
    TLlmProviderStatus,
} from "@/lib/api/endpoints/llm-providers.endpoint"

/**
 * Частичные данные для обновления конфигурации LLM провайдера.
 */
export interface IUpdateLlmProviderData {
    /**
     * Модель для использования.
     */
    readonly model?: string
    /**
     * API key (передаётся в открытом виде).
     */
    readonly apiKey?: string
    /**
     * Custom endpoint URL.
     */
    readonly endpoint?: string
}

/**
 * Данные для seed-инициализации LlmProvidersCollection.
 */
export interface ILlmProvidersSeedData {
    /**
     * Начальный набор конфигураций LLM провайдеров.
     */
    readonly providers: ReadonlyArray<ILlmProviderConfig>
}

/**
 * Маскирует API key, оставляя только последние 4 символа.
 *
 * @param apiKey - Исходный ключ.
 * @returns Маскированная строка.
 */
function maskApiKey(apiKey: string): string {
    if (apiKey.length <= 4) {
        return "****"
    }
    return `${"*".repeat(apiKey.length - 4)}${apiKey.slice(-4)}`
}

/**
 * Коллекция LLM провайдеров для mock API.
 *
 * Хранит in-memory конфигурации LLM провайдеров.
 * Поддерживает list, update, test connection, seed и clear.
 */
export class LlmProvidersCollection {
    /**
     * Хранилище конфигураций по ID.
     */
    private providers: Map<string, ILlmProviderConfig> = new Map()

    /**
     * Внутреннее хранилище полных API keys (не маскированных).
     */
    private apiKeys: Map<string, string> = new Map()

    /**
     * Возвращает список всех конфигураций LLM провайдеров.
     *
     * @returns Массив конфигураций.
     */
    public listProviders(): ReadonlyArray<ILlmProviderConfig> {
        return Array.from(this.providers.values())
    }

    /**
     * Возвращает конфигурацию LLM провайдера по идентификатору.
     *
     * @param id - Идентификатор конфигурации.
     * @returns Конфигурация или undefined.
     */
    public getProviderById(id: string): ILlmProviderConfig | undefined {
        return this.providers.get(id)
    }

    /**
     * Обновляет конфигурацию LLM провайдера.
     *
     * @param id - Идентификатор конфигурации.
     * @param patch - Данные для обновления.
     * @returns Обновлённая конфигурация или undefined.
     */
    public updateProvider(
        id: string,
        patch: IUpdateLlmProviderData,
    ): ILlmProviderConfig | undefined {
        const existing = this.providers.get(id)
        if (existing === undefined) {
            return undefined
        }

        let maskedApiKey = existing.maskedApiKey
        if (patch.apiKey !== undefined && patch.apiKey.length > 0) {
            this.apiKeys.set(id, patch.apiKey)
            maskedApiKey = maskApiKey(patch.apiKey)
        }

        const updated: ILlmProviderConfig = {
            ...existing,
            model: patch.model ?? existing.model,
            endpoint: patch.endpoint ?? existing.endpoint,
            maskedApiKey,
            id: existing.id,
            provider: existing.provider,
        }

        this.providers.set(id, updated)
        return updated
    }

    /**
     * Симулирует тест соединения с LLM провайдером.
     *
     * Провайдер считается доступным если у него настроен API key.
     *
     * @param id - Идентификатор конфигурации.
     * @returns Результат теста или undefined.
     */
    public testConnection(
        id: string,
    ): { readonly ok: boolean; readonly message: string; readonly latencyMs: number } | undefined {
        const provider = this.providers.get(id)
        if (provider === undefined) {
            return undefined
        }

        const hasKey = this.apiKeys.has(id) && (this.apiKeys.get(id) ?? "").length >= 10
        const ok = hasKey
        const message = ok ? "Connection successful" : "API key is missing or too short"
        const latencyMs = ok ? Math.floor(Math.random() * 200) + 50 : 0

        const status: TLlmProviderStatus = ok ? "CONNECTED" : "DEGRADED"
        const updated: ILlmProviderConfig = {
            ...provider,
            connected: ok,
            status,
            lastTestedAt: new Date().toISOString(),
        }
        this.providers.set(id, updated)

        return { ok, message, latencyMs }
    }

    /**
     * Заполняет коллекцию начальными данными.
     *
     * @param data - Данные для seed-инициализации.
     */
    public seed(data: ILlmProvidersSeedData): void {
        this.clear()

        for (const provider of data.providers) {
            this.providers.set(provider.id, provider)
        }
    }

    /**
     * Полностью очищает коллекцию.
     */
    public clear(): void {
        this.providers.clear()
        this.apiKeys.clear()
    }
}
