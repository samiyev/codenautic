/**
 * Minimal MongoDB model contract used by adapters repositories.
 */
export interface IMongoModel<TDocument> {
    /**
     * Finds one document by filter.
     *
     * @param filter Mongo-like filter object.
     * @returns Matched document or null.
     */
    findOne(filter: Readonly<Record<string, unknown>>): Promise<TDocument | null>

    /**
     * Finds many documents by filter.
     *
     * @param filter Mongo-like filter object.
     * @returns Matched documents.
     */
    find(filter: Readonly<Record<string, unknown>>): Promise<readonly TDocument[]>

    /**
     * Replaces one document by filter with optional upsert.
     *
     * @param filter Mongo-like filter object.
     * @param replacement Replacement document.
     * @param options Replace options.
     */
    replaceOne(
        filter: Readonly<Record<string, unknown>>,
        replacement: TDocument,
        options: Readonly<{upsert: boolean}>,
    ): Promise<void>

    /**
     * Deletes one document by filter.
     *
     * @param filter Mongo-like filter object.
     */
    deleteOne(filter: Readonly<Record<string, unknown>>): Promise<void>
}

/**
 * Mapper/factory abstraction for repository entity/document conversion.
 */
export interface IMongoRepositoryFactory<TEntity, TDocument> {
    /**
     * Converts persistence document into domain entity.
     *
     * @param document Persistence document.
     * @returns Domain entity.
     */
    toEntity(document: TDocument): TEntity

    /**
     * Converts domain entity into persistence document.
     *
     * @param entity Domain entity.
     * @returns Persistence document.
     */
    toDocument(entity: TEntity): TDocument
}
