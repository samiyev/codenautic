/**
 * Конфигурация HTTP-клиента UI для обращения к runtime/api.
 */
export interface IApiConfig {
    /**
     * Базовый URL API сервера.
     */
    readonly baseUrl: string
    /**
     * Заголовки, добавляемые к каждому запросу по умолчанию.
     */
    readonly defaultHeaders: Readonly<Record<string, string>>
}

/**
 * Источник переменных окружения UI.
 */
export interface IUiEnv {
    readonly VITE_API_URL?: string
}

const DEFAULT_API_URL = "http://localhost:3000"

/**
 * Формирует конфиг API-клиента из переменных окружения.
 *
 * @param env Переменные окружения Vite.
 * @returns Готовый объект конфигурации для API-клиента.
 * @throws Error Если `VITE_API_URL` передан, но пустой.
 */
export function createApiConfig(env: IUiEnv): IApiConfig {
    const rawBaseUrl = env.VITE_API_URL
    if (rawBaseUrl === undefined) {
        return {
            baseUrl: DEFAULT_API_URL,
            defaultHeaders: {
                "Content-Type": "application/json",
            },
        }
    }

    const normalizedBaseUrl = rawBaseUrl.trim()
    if (normalizedBaseUrl.length === 0) {
        throw new Error("VITE_API_URL не должен быть пустым")
    }

    return {
        baseUrl: normalizedBaseUrl,
        defaultHeaders: {
            "Content-Type": "application/json",
        },
    }
}
