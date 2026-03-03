/**
 * Узел иерархии treemap для CodeCity.
 */
export const TREEMAP_NODE_TYPE = {
    FILE: "file",
    DIRECTORY: "directory",
} as const

export type TreemapNodeType = (typeof TREEMAP_NODE_TYPE)[keyof typeof TREEMAP_NODE_TYPE]

/**
 * Упрощённые метрики узла дерева CodeCity.
 */
export interface ITreemapNodeMetrics {
    /**
     * Размер узла в treemap-слое.
     */
    readonly value: number
    /**
     * Дополнительные произвольные метрики узла.
     */
    readonly extras?: Record<string, number>
}

/**
 * Рекурсивный узел treemap-иерархии.
 */
export interface ITreemapNodeDTO {
    /**
     * Уникальный идентификатор узла.
     */
    readonly id: string
    /**
     * Читаемое имя узла.
     */
    readonly name: string
    /**
     * Тип узла.
     */
    readonly type: TreemapNodeType
    /**
     * Метрики узла.
     */
    readonly metrics: ITreemapNodeMetrics
    /**
     * Вложенные узлы для директории.
     */
    readonly children: readonly ITreemapNodeDTO[]
}
