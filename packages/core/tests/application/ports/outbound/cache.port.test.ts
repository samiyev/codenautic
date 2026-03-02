import {describe, expect, test} from "bun:test"

import type {ICache} from "../../../../src/application/ports/outbound/cache/cache.port"

class InMemoryCache implements ICache {
    private readonly storage: Map<string, unknown>

    public constructor() {
        this.storage = new Map<string, unknown>()
    }

    public get<TValue>(key: string): Promise<TValue | null> {
        const value = this.storage.get(key)
        if (value === undefined) {
            return Promise.resolve(null)
        }

        return Promise.resolve(value as TValue)
    }

    public set<TValue>(_key: string, _value: TValue, _ttl?: number): Promise<void>

    public set<TValue>(key: string, value: TValue): Promise<void>

    public set<TValue>(key: string, value: TValue, _ttl?: number): Promise<void> {
        this.storage.set(key, value)
        return Promise.resolve()
    }

    public delete(key: string): Promise<void> {
        this.storage.delete(key)
        return Promise.resolve()
    }

    public has(key: string): Promise<boolean> {
        return Promise.resolve(this.storage.has(key))
    }
}

describe("ICache contract", () => {
    test("sets, gets, checks, and deletes values", async () => {
        const cache = new InMemoryCache()

        await cache.set("review:1", {status: "completed"}, 60)
        const found = await cache.get<{status: string}>("review:1")
        const hasBeforeDelete = await cache.has("review:1")

        await cache.delete("review:1")
        const hasAfterDelete = await cache.has("review:1")
        const missing = await cache.get<{status: string}>("review:1")

        expect(found?.status).toBe("completed")
        expect(hasBeforeDelete).toBe(true)
        expect(hasAfterDelete).toBe(false)
        expect(missing).toBeNull()
    })
})
