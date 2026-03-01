import type {IApiConfig} from "./config"

/**
 * Разрешённые HTTP-методы для UI API-клиента.
 */
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

/**
 * Примитивы, разрешённые в query-параметрах.
 */
export type QueryValue = string | number | boolean

/**
 * Параметры HTTP-запроса.
 */
export interface IHttpRequest {
    /**
     * HTTP-метод.
     */
    readonly method: HttpMethod
    /**
     * Относительный путь эндпойнта (например, `/api/v1/health`).
     */
    readonly path: string
    /**
     * Query-параметры.
     */
    readonly query?: Readonly<Record<string, QueryValue | undefined>>
    /**
     * Дополнительные заголовки.
     */
    readonly headers?: Readonly<Record<string, string>>
    /**
     * Тело запроса в JSON-формате.
     */
    readonly body?: unknown
    /**
     * AbortSignal для отмены запроса.
     */
    readonly signal?: AbortSignal
}

/**
 * Контракт HTTP-клиента.
 */
export interface IHttpClient {
    /**
     * Выполняет HTTP-запрос и возвращает типизированный JSON-ответ.
     *
     * @param request Параметры запроса.
     * @returns Ответ API, десериализованный из JSON.
     */
    request<TResponse>(request: IHttpRequest): Promise<TResponse>
}

/**
 * Ошибка HTTP-запроса с metadata для обработки на уровне UI.
 */
export class ApiHttpError extends Error {
    public readonly status: number
    public readonly path: string

    public constructor(status: number, path: string, message: string) {
        super(message)
        this.name = "ApiHttpError"
        this.status = status
        this.path = path
    }
}

/**
 * Реализация HTTP-клиента поверх `fetch`.
 */
export class FetchHttpClient implements IHttpClient {
    private readonly config: IApiConfig

    public constructor(config: IApiConfig) {
        this.config = config
    }

    public async request<TResponse>(request: IHttpRequest): Promise<TResponse> {
        const url = this.buildUrl(request.path, request.query)
        const response = await fetch(url, {
            method: request.method,
            headers: {
                ...this.config.defaultHeaders,
                ...request.headers,
            },
            body: this.buildBody(request.body),
            signal: request.signal,
        })

        if (response.ok !== true) {
            throw new ApiHttpError(response.status, request.path, `HTTP ${response.status} for ${request.path}`)
        }

        return (await response.json()) as TResponse
    }

    private buildBody(body: unknown): BodyInit | undefined {
        if (body === undefined) {
            return undefined
        }
        return JSON.stringify(body)
    }

    private buildUrl(path: string, query: Readonly<Record<string, QueryValue | undefined>> | undefined): string {
        const normalizedPath = path.startsWith("/") ? path : `/${path}`
        const target = new URL(normalizedPath, this.config.baseUrl)

        if (query !== undefined) {
            for (const [key, value] of Object.entries(query)) {
                if (value !== undefined) {
                    target.searchParams.set(key, String(value))
                }
            }
        }

        return target.toString()
    }
}
