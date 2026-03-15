import type { IHttpClient } from "../http-client"

/** Имя LLM модели. */
export type TModelName = "claude-3-7-sonnet" | "gpt-4.1-mini" | "gpt-4o-mini" | "mistral-small-latest"

/** Режим группировки для token usage. */
export type TTokenUsageGroupBy = "ccr" | "developer" | "model"

/** Диапазон дат для token usage. */
export type TTokenUsageRange = "1d" | "7d" | "30d" | "90d"

/** Запись о расходе токенов. */
export interface ITokenUsageRecord {
    /**
     * Идентификатор usage строки.
     */
    readonly id: string
    /**
     * LLM model.
     */
    readonly model: TModelName
    /**
     * Имя разработчика.
     */
    readonly developer: string
    /**
     * Идентификатор CCR.
     */
    readonly ccr: string
    /**
     * Prompt tokens.
     */
    readonly promptTokens: number
    /**
     * Completion tokens.
     */
    readonly completionTokens: number
}

/** Агрегированная строка по группе. */
export interface IAggregatedUsageRow {
    /**
     * Группа (model/developer/CCR).
     */
    readonly key: string
    /**
     * Prompt tokens.
     */
    readonly promptTokens: number
    /**
     * Completion tokens.
     */
    readonly completionTokens: number
    /**
     * Total tokens.
     */
    readonly totalTokens: number
    /**
     * Estimated cost in USD.
     */
    readonly estimatedCostUsd: number
}

/** Ответ token usage API. */
export interface ITokenUsageResponse {
    /**
     * Агрегированные строки по выбранной группировке.
     */
    readonly rows: readonly IAggregatedUsageRow[]
    /**
     * Сырые записи расхода токенов.
     */
    readonly records: readonly ITokenUsageRecord[]
}

/** Контракт Token Usage API. */
export interface ITokenUsageApi {
    /**
     * Возвращает usage данные за указанный диапазон с группировкой.
     *
     * @param range - Диапазон дат.
     * @param groupBy - Режим группировки.
     */
    getUsage(range: TTokenUsageRange, groupBy: TTokenUsageGroupBy): Promise<ITokenUsageResponse>
}

/**
 * Endpoint-слой для Token Usage API.
 */
export class TokenUsageApi implements ITokenUsageApi {
    /**
     * HTTP-клиент для выполнения запросов.
     */
    private readonly httpClient: IHttpClient

    /**
     * Создаёт экземпляр TokenUsageApi.
     *
     * @param httpClient - HTTP-клиент.
     */
    public constructor(httpClient: IHttpClient) {
        this.httpClient = httpClient
    }

    /**
     * Возвращает usage данные за указанный диапазон с группировкой.
     *
     * @param range - Диапазон дат.
     * @param groupBy - Режим группировки.
     * @returns Агрегированные строки и сырые записи.
     */
    public async getUsage(
        range: TTokenUsageRange,
        groupBy: TTokenUsageGroupBy,
    ): Promise<ITokenUsageResponse> {
        return this.httpClient.request<ITokenUsageResponse>({
            method: "GET",
            path: "/api/v1/token-usage",
            query: { range, groupBy },
            credentials: "include",
        })
    }
}
