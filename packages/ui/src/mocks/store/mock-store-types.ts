/**
 * Результат пагинированного запроса.
 */
export interface IPaginatedResult<T> {
    readonly items: ReadonlyArray<T>
    readonly total: number
    readonly page: number
    readonly limit: number
    readonly totalPages: number
}

/**
 * Базовые параметры фильтрации для list-запросов.
 */
export interface IListFilters {
    readonly page?: number
    readonly limit?: number
    readonly q?: string
}
