import type { IHttpClient } from "../http-client"

/**
 * Допустимые статусы репозитория.
 */
export type TRepositoryStatus = "ready" | "scanning" | "error"

/**
 * Модель репозитория.
 */
export interface IRepository {
    /**
     * Уникальный идентификатор репозитория.
     */
    readonly id: string
    /**
     * Имя репозитория.
     */
    readonly name: string
    /**
     * Владелец репозитория (организация или пользователь).
     */
    readonly owner: string
    /**
     * Основная ветка.
     */
    readonly defaultBranch: string
    /**
     * Время последнего скана (ISO 8601).
     */
    readonly lastScanAt: string
    /**
     * Текущий статус репозитория.
     */
    readonly status: TRepositoryStatus
    /**
     * Количество найденных проблем.
     */
    readonly issueCount: number
    /**
     * Общий health score (0–100).
     */
    readonly healthScore: number
}

/**
 * Элемент архитектурного резюме.
 */
export interface IRepositoryArchitectureSummary {
    /**
     * Компонент архитектуры.
     */
    readonly area: string
    /**
     * Уровень риска.
     */
    readonly risk: "low" | "high" | "critical"
    /**
     * Описание текущего состояния.
     */
    readonly summary: string
}

/**
 * Ключевая метрика репозитория.
 */
export interface IRepositoryKeyMetric {
    /**
     * Уникальный идентификатор метрики.
     */
    readonly id: string
    /**
     * Заголовок метрики.
     */
    readonly label: string
    /**
     * Значение метрики.
     */
    readonly value: string
    /**
     * Подпись с пояснением.
     */
    readonly caption: string
    /**
     * Направление тренда.
     */
    readonly trendDirection: "up" | "down" | "neutral"
    /**
     * Текстовая метка тренда.
     */
    readonly trendLabel: string
}

/**
 * Элемент технологического стека.
 */
export interface IRepositoryTechStackItem {
    /**
     * Название технологии.
     */
    readonly name: string
    /**
     * Версия.
     */
    readonly version: string
    /**
     * Описание применения.
     */
    readonly note: string
}

/**
 * Полный overview-профиль репозитория.
 */
export interface IRepositoryOverview {
    /**
     * Базовая информация о репозитории.
     */
    readonly repository: IRepository
    /**
     * Архитектурное резюме по компонентам.
     */
    readonly architectureSummary: ReadonlyArray<IRepositoryArchitectureSummary>
    /**
     * Ключевые метрики.
     */
    readonly keyMetrics: ReadonlyArray<IRepositoryKeyMetric>
    /**
     * Технологический стек.
     */
    readonly techStack: ReadonlyArray<IRepositoryTechStackItem>
    /**
     * Health score обзора.
     */
    readonly healthScore: number
}

/**
 * Ответ списка репозиториев.
 */
export interface IListRepositoriesResponse {
    /**
     * Массив репозиториев.
     */
    readonly repositories: ReadonlyArray<IRepository>
    /**
     * Общее количество.
     */
    readonly total: number
}

/**
 * Ответ overview репозитория.
 */
export interface IRepositoryOverviewResponse {
    /**
     * Полные overview-данные.
     */
    readonly overview: IRepositoryOverview
}

/**
 * API-контракт репозиториев.
 */
export interface IRepositoryApi {
    /**
     * Возвращает список репозиториев.
     */
    listRepositories(): Promise<IListRepositoriesResponse>
    /**
     * Возвращает overview репозитория по ID.
     *
     * @param repositoryId - Идентификатор репозитория.
     */
    getOverview(repositoryId: string): Promise<IRepositoryOverviewResponse>
}

/**
 * Endpoint-клиент Repository API.
 */
export class RepositoryApi implements IRepositoryApi {
    /**
     * HTTP-клиент для запросов.
     */
    private readonly httpClient: IHttpClient

    /**
     * Создаёт экземпляр RepositoryApi.
     *
     * @param httpClient - HTTP-клиент.
     */
    public constructor(httpClient: IHttpClient) {
        this.httpClient = httpClient
    }

    /**
     * Возвращает список репозиториев.
     *
     * @returns Ответ со списком репозиториев и общим количеством.
     */
    public async listRepositories(): Promise<IListRepositoriesResponse> {
        return this.httpClient.request<IListRepositoriesResponse>({
            method: "GET",
            path: "/api/v1/repositories",
            credentials: "include",
        })
    }

    /**
     * Возвращает overview репозитория по ID.
     *
     * @param repositoryId - Идентификатор репозитория.
     * @returns Ответ с полными overview-данными.
     */
    public async getOverview(repositoryId: string): Promise<IRepositoryOverviewResponse> {
        const normalizedId = repositoryId.trim()
        if (normalizedId.length === 0) {
            throw new Error("repositoryId не должен быть пустым")
        }

        return this.httpClient.request<IRepositoryOverviewResponse>({
            method: "GET",
            path: `/api/v1/repositories/${encodeURIComponent(normalizedId)}/overview`,
            credentials: "include",
        })
    }
}
