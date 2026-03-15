import type {
    IPackageDependencyNode,
    IPackageDependencyRelation,
} from "@/components/dependency-graphs/package-dependency-graph"
import type { ICodeCityDashboardRepositoryProfile } from "@/pages/code-city-dashboard/code-city-dashboard-types"

import type { IHttpClient } from "../http-client"

/**
 * Ответ списка профилей CodeCity.
 */
export interface IListCodeCityProfilesResponse {
    /**
     * Профили репозиториев.
     */
    readonly profiles: ReadonlyArray<ICodeCityDashboardRepositoryProfile>
}

/**
 * Ответ графа зависимостей CodeCity.
 */
export interface ICodeCityDependencyGraphResponse {
    /**
     * Узлы графа зависимостей.
     */
    readonly nodes: ReadonlyArray<IPackageDependencyNode>
    /**
     * Связи графа зависимостей.
     */
    readonly relations: ReadonlyArray<IPackageDependencyRelation>
}

/**
 * API-контракт CodeCity.
 */
export interface ICodeCityApi {
    /**
     * Возвращает профили репозиториев CodeCity.
     */
    getRepositoryProfiles(): Promise<IListCodeCityProfilesResponse>
    /**
     * Возвращает граф зависимостей для репозитория.
     *
     * @param repoId - Идентификатор репозитория.
     */
    getDependencyGraph(repoId: string): Promise<ICodeCityDependencyGraphResponse>
}

/**
 * Endpoint-клиент CodeCity API.
 */
export class CodeCityApi implements ICodeCityApi {
    /**
     * HTTP-клиент для запросов.
     */
    private readonly httpClient: IHttpClient

    /**
     * Создаёт экземпляр CodeCityApi.
     *
     * @param httpClient - HTTP-клиент.
     */
    public constructor(httpClient: IHttpClient) {
        this.httpClient = httpClient
    }

    /**
     * Возвращает профили репозиториев CodeCity.
     *
     * @returns Ответ со списком профилей.
     */
    public async getRepositoryProfiles(): Promise<IListCodeCityProfilesResponse> {
        return this.httpClient.request<IListCodeCityProfilesResponse>({
            method: "GET",
            path: "/api/v1/code-city/profiles",
            credentials: "include",
        })
    }

    /**
     * Возвращает граф зависимостей для репозитория.
     *
     * @param repoId - Идентификатор репозитория.
     * @returns Ответ с узлами и связями графа.
     */
    public async getDependencyGraph(repoId: string): Promise<ICodeCityDependencyGraphResponse> {
        const normalizedId = repoId.trim()
        if (normalizedId.length === 0) {
            throw new Error("repoId не должен быть пустым")
        }

        return this.httpClient.request<ICodeCityDependencyGraphResponse>({
            method: "GET",
            path: `/api/v1/code-city/profiles/${encodeURIComponent(normalizedId)}/dependency-graph`,
            credentials: "include",
        })
    }
}
