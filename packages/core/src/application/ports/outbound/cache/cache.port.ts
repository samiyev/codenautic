/**
 * Outbound contract for cache provider.
 */
export interface ICache {
    /**
     * Gets value by cache key.
     *
     * @template TValue Stored value type.
     * @param key Cache key.
     * @returns Cached value or null.
     */
    get<TValue>(key: string): Promise<TValue | null>

    /**
     * Sets value by cache key.
     *
     * @template TValue Stored value type.
     * @param key Cache key.
     * @param value Value to cache.
     * @param ttl Optional ttl in seconds.
     * @returns Promise resolved when value is stored.
     */
    set<TValue>(key: string, value: TValue, ttl?: number): Promise<void>

    /**
     * Deletes value by cache key.
     *
     * @param key Cache key.
     * @returns Promise resolved when value is deleted.
     */
    delete(key: string): Promise<void>

    /**
     * Checks key existence in cache.
     *
     * @param key Cache key.
     * @returns True when key exists.
     */
    has(key: string): Promise<boolean>
}
