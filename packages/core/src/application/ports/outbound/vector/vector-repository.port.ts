/**
 * Vector chunk payload for upsert operations.
 */
export interface IVectorChunkDTO {
    readonly id: string
    readonly vector: readonly number[]
    readonly metadata: Readonly<Record<string, unknown>>
}

/**
 * Vector search result payload.
 */
export interface IVectorSearchResultDTO {
    readonly id: string
    readonly score: number
    readonly metadata: Readonly<Record<string, unknown>>
}

/**
 * Outbound contract for vector storage/search backends.
 */
export interface IVectorRepository {
    /**
     * Inserts or updates vector chunks.
     *
     * @param chunks Vector chunks.
     * @returns Promise resolved when operation completes.
     */
    upsert(chunks: readonly IVectorChunkDTO[]): Promise<void>

    /**
     * Searches nearest vectors by query embedding.
     *
     * @param query Query embedding vector.
     * @param filters Optional metadata filters.
     * @param limit Optional result count limit.
     * @returns Ranked vector search results.
     */
    search(
        query: readonly number[],
        filters?: Readonly<Record<string, unknown>>,
        limit?: number,
    ): Promise<readonly IVectorSearchResultDTO[]>

    /**
     * Deletes vectors by identifiers.
     *
     * @param ids Vector identifiers.
     * @returns Promise resolved when delete completes.
     */
    delete(ids: readonly string[]): Promise<void>
}
