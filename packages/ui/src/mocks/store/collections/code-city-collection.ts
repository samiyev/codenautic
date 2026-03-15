import type {
    IPackageDependencyNode,
    IPackageDependencyRelation,
} from "@/components/dependency-graphs/package-dependency-graph"
import type { ICodeCityDashboardRepositoryProfile } from "@/pages/code-city-dashboard/code-city-dashboard-types"

/**
 * Данные для seed-инициализации CodeCityCollection.
 */
export interface ICodeCitySeedData {
    /**
     * Профили репозиториев CodeCity.
     */
    readonly profiles: ReadonlyArray<ICodeCityDashboardRepositoryProfile>
    /**
     * Узлы графа зависимостей.
     */
    readonly dependencyNodes: ReadonlyArray<IPackageDependencyNode>
    /**
     * Связи графа зависимостей.
     */
    readonly dependencyRelations: ReadonlyArray<IPackageDependencyRelation>
}

/**
 * Коллекция CodeCity данных для mock API.
 *
 * Хранит in-memory профили репозиториев и граф зависимостей.
 * Поддерживает чтение, seed и clear.
 */
export class CodeCityCollection {
    /**
     * Хранилище профилей репозиториев по ID.
     */
    private profiles: Map<string, ICodeCityDashboardRepositoryProfile> = new Map()

    /**
     * Узлы графа зависимостей.
     */
    private nodes: ReadonlyArray<IPackageDependencyNode> = []

    /**
     * Связи графа зависимостей.
     */
    private relations: ReadonlyArray<IPackageDependencyRelation> = []

    /**
     * Возвращает список всех профилей CodeCity.
     *
     * @returns Массив всех профилей.
     */
    public listProfiles(): ReadonlyArray<ICodeCityDashboardRepositoryProfile> {
        return Array.from(this.profiles.values())
    }

    /**
     * Возвращает профиль CodeCity по идентификатору.
     *
     * @param repoId - Идентификатор репозитория.
     * @returns Профиль или undefined, если не найден.
     */
    public getProfileById(repoId: string): ICodeCityDashboardRepositoryProfile | undefined {
        return this.profiles.get(repoId)
    }

    /**
     * Возвращает узлы графа зависимостей.
     *
     * @returns Массив узлов.
     */
    public getDependencyNodes(): ReadonlyArray<IPackageDependencyNode> {
        return this.nodes
    }

    /**
     * Возвращает связи графа зависимостей.
     *
     * @returns Массив связей.
     */
    public getDependencyRelations(): ReadonlyArray<IPackageDependencyRelation> {
        return this.relations
    }

    /**
     * Заполняет коллекцию начальными данными.
     *
     * Очищает текущее состояние и загружает переданные данные.
     *
     * @param data - Данные для seed-инициализации.
     */
    public seed(data: ICodeCitySeedData): void {
        this.clear()

        for (const profile of data.profiles) {
            this.profiles.set(profile.id, profile)
        }

        this.nodes = data.dependencyNodes
        this.relations = data.dependencyRelations
    }

    /**
     * Полностью очищает коллекцию.
     */
    public clear(): void {
        this.profiles.clear()
        this.nodes = []
        this.relations = []
    }
}
