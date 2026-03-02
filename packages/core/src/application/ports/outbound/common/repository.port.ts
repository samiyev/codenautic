import type {UniqueId} from "../../../../domain/value-objects/unique-id.value-object"

/**
 * Generic persistence contract for aggregate repositories.
 *
 * @template TEntity Aggregate/entity type.
 */
export interface IRepository<TEntity> {
    /**
     * Finds entity by identifier.
     *
     * @param id Entity identifier.
     * @returns Entity or null.
     */
    findById(id: UniqueId): Promise<TEntity | null>

    /**
     * Persists entity state.
     *
     * @param entity Entity to save.
     * @returns Promise that resolves when save completes.
     */
    save(entity: TEntity): Promise<void>
}
