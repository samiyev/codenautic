import type { IHttpClient } from "../http-client"

/** Тип внешнего context-source. */
export const EXTERNAL_CONTEXT_SOURCE_TYPE = {
    jira: "JIRA",
    linear: "LINEAR",
    sentry: "SENTRY",
    docs: "DOCS",
} as const

/** Тип context-source. */
export type TExternalContextSourceType =
    (typeof EXTERNAL_CONTEXT_SOURCE_TYPE)[keyof typeof EXTERNAL_CONTEXT_SOURCE_TYPE]

/** Статус синхронизации внешнего источника. */
export const EXTERNAL_CONTEXT_STATUS = {
    connected: "CONNECTED",
    degraded: "DEGRADED",
    disconnected: "DISCONNECTED",
    syncing: "SYNCING",
} as const

/** Статус context-source. */
export type TExternalContextStatus =
    (typeof EXTERNAL_CONTEXT_STATUS)[keyof typeof EXTERNAL_CONTEXT_STATUS]

/** Описание external context source. */
export interface IExternalContextSource {
    /** Идентификатор источника. */
    readonly id: string
    /** Отображаемое имя. */
    readonly name: string
    /** Тип источника. */
    readonly type: TExternalContextSourceType
    /** Текущий статус. */
    readonly status: TExternalContextStatus
    /** Включен ли источник в пайплайне. */
    readonly enabled: boolean
    /** Количество элементов в индексе. */
    readonly itemCount: number
    /** Момент последней успешной синхронизации. */
    readonly lastSyncedAt?: string
}

/** Сниппет для context preview. */
export interface IExternalContextPreviewItem {
    /** Идентификатор элемента. */
    readonly id: string
    /** Заголовок. */
    readonly title: string
    /** Короткий фрагмент. */
    readonly excerpt: string
    /** Deep link в источник. */
    readonly url: string
    /** Время обновления записи. */
    readonly updatedAt?: string
}

/** Ответ со списком sources. */
export interface IExternalContextSourcesResponse {
    /** Список источников. */
    readonly sources: readonly IExternalContextSource[]
    /** Полный размер списка. */
    readonly total: number
}

/** Ответ с preview для выбранного source. */
export interface IExternalContextPreviewResponse {
    /** Source id preview-пакета. */
    readonly sourceId: string
    /** Сниппеты контекста. */
    readonly items: readonly IExternalContextPreviewItem[]
    /** Полное число элементов в источнике. */
    readonly total: number
}

/** Запрос обновления source-настроек. */
export interface IUpdateExternalContextSourceRequest {
    /** Source id. */
    readonly sourceId: string
    /** Новое состояние enabled. */
    readonly enabled?: boolean
}

/** Ответ обновления source-настроек. */
export interface IUpdateExternalContextSourceResponse {
    /** Обновлённый source. */
    readonly source: IExternalContextSource
}

/** Ответ перезапуска sync по source. */
export interface IRefreshExternalContextSourceResponse {
    /** Source id. */
    readonly sourceId: string
    /** Флаг принятия задачи обновления. */
    readonly accepted: boolean
    /** Текст статуса очереди. */
    readonly status: TExternalContextStatus
}

/** Контракт API внешнего контекста. */
export interface IExternalContextApi {
    /** Возвращает список источников внешнего контекста. */
    listSources(): Promise<IExternalContextSourcesResponse>
    /** Возвращает preview для конкретного source. */
    getPreview(sourceId: string): Promise<IExternalContextPreviewResponse>
    /** Обновляет параметры источника. */
    updateSource(
        request: IUpdateExternalContextSourceRequest,
    ): Promise<IUpdateExternalContextSourceResponse>
    /** Запускает refresh/sync для источника. */
    refreshSource(sourceId: string): Promise<IRefreshExternalContextSourceResponse>
}

/** Endpoint-слой для external context API. */
export class ExternalContextApi implements IExternalContextApi {
    private readonly httpClient: IHttpClient

    public constructor(httpClient: IHttpClient) {
        this.httpClient = httpClient
    }

    public async listSources(): Promise<IExternalContextSourcesResponse> {
        return this.httpClient.request<IExternalContextSourcesResponse>({
            method: "GET",
            path: "/api/v1/context/sources",
            credentials: "include",
        })
    }

    public async getPreview(sourceId: string): Promise<IExternalContextPreviewResponse> {
        const normalizedSourceId = sourceId.trim()
        if (normalizedSourceId.length === 0) {
            throw new Error("sourceId не должен быть пустым")
        }

        return this.httpClient.request<IExternalContextPreviewResponse>({
            method: "GET",
            path: `/api/v1/context/sources/${encodeURIComponent(normalizedSourceId)}/preview`,
            credentials: "include",
        })
    }

    public async updateSource(
        request: IUpdateExternalContextSourceRequest,
    ): Promise<IUpdateExternalContextSourceResponse> {
        const normalizedSourceId = request.sourceId.trim()
        if (normalizedSourceId.length === 0) {
            throw new Error("sourceId не должен быть пустым")
        }

        const { sourceId: _sourceId, ...payload } = request
        return this.httpClient.request<IUpdateExternalContextSourceResponse>({
            method: "PUT",
            path: `/api/v1/context/sources/${encodeURIComponent(normalizedSourceId)}`,
            body: payload,
            credentials: "include",
        })
    }

    public async refreshSource(sourceId: string): Promise<IRefreshExternalContextSourceResponse> {
        const normalizedSourceId = sourceId.trim()
        if (normalizedSourceId.length === 0) {
            throw new Error("sourceId не должен быть пустым")
        }

        return this.httpClient.request<IRefreshExternalContextSourceResponse>({
            method: "POST",
            path: `/api/v1/context/sources/${encodeURIComponent(normalizedSourceId)}/refresh`,
            credentials: "include",
        })
    }
}
