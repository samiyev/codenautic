import {describe, expect, test} from "bun:test"

import type {
    IVectorChunkDTO,
    IVectorRepository,
    IVectorSearchResultDTO,
} from "../../../../src/application/ports/outbound/vector/vector-repository.port"

class InMemoryVectorRepository implements IVectorRepository {
    private readonly storage: Map<string, IVectorChunkDTO>

    public constructor() {
        this.storage = new Map<string, IVectorChunkDTO>()
    }

    public upsert(chunks: readonly IVectorChunkDTO[]): Promise<void> {
        for (const chunk of chunks) {
            this.storage.set(chunk.id, chunk)
        }

        return Promise.resolve()
    }

    public search(
        query: readonly number[],
        _filters?: Readonly<Record<string, unknown>>,
        limit?: number,
    ): Promise<readonly IVectorSearchResultDTO[]> {
        const ranked = [...this.storage.values()]
            .map((chunk): IVectorSearchResultDTO => {
                const score = cosineScore(query, chunk.vector)
                return {
                    id: chunk.id,
                    score,
                    metadata: chunk.metadata,
                }
            })
            .sort((left, right) => {
                return right.score - left.score
            })

        const effectiveLimit = limit ?? ranked.length
        return Promise.resolve(ranked.slice(0, effectiveLimit))
    }

    public delete(ids: readonly string[]): Promise<void> {
        for (const id of ids) {
            this.storage.delete(id)
        }

        return Promise.resolve()
    }
}

describe("IVectorRepository contract", () => {
    test("upserts, searches, and deletes vectors", async () => {
        const repository = new InMemoryVectorRepository()
        await repository.upsert([
            {
                id: "chunk-1",
                vector: [1, 0],
                metadata: {file: "a.ts"},
            },
            {
                id: "chunk-2",
                vector: [0, 1],
                metadata: {file: "b.ts"},
            },
        ])

        const results = await repository.search([1, 0], undefined, 1)
        expect(results).toHaveLength(1)
        expect(results[0]?.id).toBe("chunk-1")

        await repository.delete(["chunk-1"])
        const afterDelete = await repository.search([1, 0])
        expect(afterDelete.find((result) => {
            return result.id === "chunk-1"
        })).toBeUndefined()
    })
})

/**
 * Computes cosine score for two vectors.
 *
 * @param left Left vector.
 * @param right Right vector.
 * @returns Cosine score.
 */
function cosineScore(left: readonly number[], right: readonly number[]): number {
    let dot = 0
    let leftMagnitude = 0
    let rightMagnitude = 0

    const sharedLength = Math.min(left.length, right.length)
    for (let index = 0; index < sharedLength; index++) {
        const leftValue = left[index]
        const rightValue = right[index]

        if (leftValue === undefined || rightValue === undefined) {
            continue
        }

        dot += leftValue * rightValue
        leftMagnitude += leftValue * leftValue
        rightMagnitude += rightValue * rightValue
    }

    if (leftMagnitude === 0 || rightMagnitude === 0) {
        return 0
    }

    return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude))
}
