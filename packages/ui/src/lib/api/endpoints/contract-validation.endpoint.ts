import type { IHttpClient } from "../http-client"

/**
 * Уровень severity для drift-нарушения.
 */
export type TDriftSeverity = "low" | "medium" | "high" | "critical"

/**
 * Одно drift-нарушение архитектурных правил.
 */
export interface IDriftViolation {
    /** Уникальный идентификатор нарушения. */
    readonly id: string
    /** Путь к файлу, содержащему нарушение. */
    readonly filePath: string
    /** Архитектурный слой, в котором обнаружено нарушение. */
    readonly layer: string
    /** Нарушенное правило. */
    readonly rule: string
    /** Уровень severity нарушения. */
    readonly severity: TDriftSeverity
    /** ISO-дата обнаружения нарушения. */
    readonly detectedAt: string
    /** Описание нарушения. */
    readonly description: string
}

/**
 * Точка данных тренда drift-нарушений.
 */
export interface IDriftTrendPoint {
    /** ISO-дата или период точки данных. */
    readonly date: string
    /** Количество нарушений на эту дату. */
    readonly violations: number
    /** Количество исправленных нарушений на эту дату. */
    readonly resolved: number
}

/**
 * Узел графа архитектуры.
 */
export interface IArchitectureNode {
    /** Уникальный идентификатор узла. */
    readonly id: string
    /** Отображаемое название узла. */
    readonly label: string
    /** Тип узла (модуль, пакет и т.д.). */
    readonly type: string
    /** Архитектурный слой узла. */
    readonly layer: string
}

/**
 * Ребро графа архитектуры.
 */
export interface IArchitectureEdge {
    /** Идентификатор узла-источника. */
    readonly source: string
    /** Идентификатор узла-цели. */
    readonly target: string
}

/**
 * Ответ получения blueprint YAML.
 */
export interface IBlueprintResponse {
    /** YAML-содержимое blueprint. */
    readonly yaml: string
}

/**
 * Ответ получения guardrails YAML.
 */
export interface IGuardrailsResponse {
    /** YAML-содержимое guardrails. */
    readonly yaml: string
}

/**
 * Ответ получения drift-нарушений.
 */
export interface IDriftViolationsResponse {
    /** Список drift-нарушений. */
    readonly violations: ReadonlyArray<IDriftViolation>
    /** Общее количество нарушений. */
    readonly total: number
}

/**
 * Ответ получения тренда drift-нарушений.
 */
export interface IDriftTrendResponse {
    /** Точки данных тренда. */
    readonly points: ReadonlyArray<IDriftTrendPoint>
}

/**
 * Ответ получения графа архитектуры.
 */
export interface IArchitectureGraphResponse {
    /** Узлы графа. */
    readonly nodes: ReadonlyArray<IArchitectureNode>
    /** Рёбра графа. */
    readonly edges: ReadonlyArray<IArchitectureEdge>
}

/**
 * Ответ обновления blueprint или guardrails.
 */
export interface IUpdateYamlResponse {
    /** Флаг успешного обновления. */
    readonly updated: boolean
}

/**
 * Контракт API для contract validation.
 */
export interface IContractValidationApi {
    /**
     * Загружает YAML blueprint архитектуры.
     *
     * @returns Ответ с YAML-содержимым blueprint.
     */
    getBlueprint(): Promise<IBlueprintResponse>

    /**
     * Обновляет YAML blueprint архитектуры.
     *
     * @param yaml - Новое YAML-содержимое.
     * @returns Ответ с флагом успешного обновления.
     */
    updateBlueprint(yaml: string): Promise<IUpdateYamlResponse>

    /**
     * Загружает YAML guardrails.
     *
     * @returns Ответ с YAML-содержимым guardrails.
     */
    getGuardrails(): Promise<IGuardrailsResponse>

    /**
     * Обновляет YAML guardrails.
     *
     * @param yaml - Новое YAML-содержимое.
     * @returns Ответ с флагом успешного обновления.
     */
    updateGuardrails(yaml: string): Promise<IUpdateYamlResponse>

    /**
     * Возвращает список drift-нарушений.
     *
     * @returns Ответ со списком нарушений и общим количеством.
     */
    getDriftViolations(): Promise<IDriftViolationsResponse>

    /**
     * Возвращает тренд drift-нарушений.
     *
     * @returns Ответ с точками данных тренда.
     */
    getDriftTrend(): Promise<IDriftTrendResponse>

    /**
     * Возвращает граф архитектуры.
     *
     * @returns Ответ с узлами и рёбрами графа.
     */
    getArchitectureGraph(): Promise<IArchitectureGraphResponse>
}

/**
 * Endpoint-слой для contract validation API.
 */
export class ContractValidationApi implements IContractValidationApi {
    /**
     * HTTP-клиент для выполнения запросов.
     */
    private readonly httpClient: IHttpClient

    /**
     * Создаёт экземпляр ContractValidationApi.
     *
     * @param httpClient - HTTP-клиент для выполнения запросов.
     */
    public constructor(httpClient: IHttpClient) {
        this.httpClient = httpClient
    }

    /**
     * Загружает YAML blueprint архитектуры.
     *
     * @returns Ответ с YAML-содержимым blueprint.
     */
    public async getBlueprint(): Promise<IBlueprintResponse> {
        return this.httpClient.request<IBlueprintResponse>({
            method: "GET",
            path: "/api/v1/settings/contract-validation/blueprint",
            credentials: "include",
        })
    }

    /**
     * Обновляет YAML blueprint архитектуры.
     *
     * @param yaml - Новое YAML-содержимое.
     * @returns Ответ с флагом успешного обновления.
     */
    public async updateBlueprint(yaml: string): Promise<IUpdateYamlResponse> {
        return this.httpClient.request<IUpdateYamlResponse>({
            method: "PUT",
            path: "/api/v1/settings/contract-validation/blueprint",
            body: { yaml },
            credentials: "include",
        })
    }

    /**
     * Загружает YAML guardrails.
     *
     * @returns Ответ с YAML-содержимым guardrails.
     */
    public async getGuardrails(): Promise<IGuardrailsResponse> {
        return this.httpClient.request<IGuardrailsResponse>({
            method: "GET",
            path: "/api/v1/settings/contract-validation/guardrails",
            credentials: "include",
        })
    }

    /**
     * Обновляет YAML guardrails.
     *
     * @param yaml - Новое YAML-содержимое.
     * @returns Ответ с флагом успешного обновления.
     */
    public async updateGuardrails(yaml: string): Promise<IUpdateYamlResponse> {
        return this.httpClient.request<IUpdateYamlResponse>({
            method: "PUT",
            path: "/api/v1/settings/contract-validation/guardrails",
            body: { yaml },
            credentials: "include",
        })
    }

    /**
     * Возвращает список drift-нарушений.
     *
     * @returns Ответ со списком нарушений и общим количеством.
     */
    public async getDriftViolations(): Promise<IDriftViolationsResponse> {
        return this.httpClient.request<IDriftViolationsResponse>({
            method: "GET",
            path: "/api/v1/settings/contract-validation/drift/violations",
            credentials: "include",
        })
    }

    /**
     * Возвращает тренд drift-нарушений.
     *
     * @returns Ответ с точками данных тренда.
     */
    public async getDriftTrend(): Promise<IDriftTrendResponse> {
        return this.httpClient.request<IDriftTrendResponse>({
            method: "GET",
            path: "/api/v1/settings/contract-validation/drift/trend",
            credentials: "include",
        })
    }

    /**
     * Возвращает граф архитектуры.
     *
     * @returns Ответ с узлами и рёбрами графа.
     */
    public async getArchitectureGraph(): Promise<IArchitectureGraphResponse> {
        return this.httpClient.request<IArchitectureGraphResponse>({
            method: "GET",
            path: "/api/v1/settings/contract-validation/architecture-graph",
            credentials: "include",
        })
    }
}
