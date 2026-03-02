import {describe, expect, test} from "bun:test"

import {Embedding} from "../../../src/domain/value-objects/embedding.value-object"

describe("Embedding", () => {
    test("creates embedding with dimensions, model and optional metadata", () => {
        const embedding = Embedding.create({
            vector: [0.1, 0.2, 0.3],
            dimensions: 3,
            model: "text-embedding-3-large",
            metadata: {
                filePath: "src/domain/review.aggregate.ts",
            },
        })

        expect(embedding.vector).toEqual([0.1, 0.2, 0.3])
        expect(embedding.dimensions).toBe(3)
        expect(embedding.model).toBe("text-embedding-3-large")
        expect(embedding.metadata).toEqual({
            filePath: "src/domain/review.aggregate.ts",
        })
    })

    test("throws when dimensions do not match vector length", () => {
        expect(() => {
            Embedding.create({
                vector: [0.1, 0.2, 0.3],
                dimensions: 2,
                model: "text-embedding-3-large",
            })
        }).toThrow("Embedding dimensions must match vector length")
    })

    test("computes cosine similarity between embeddings", () => {
        const first = Embedding.create({
            vector: [1, 0, 0],
            dimensions: 3,
            model: "text-embedding-3-large",
        })
        const second = Embedding.create({
            vector: [1, 0, 0],
            dimensions: 3,
            model: "text-embedding-3-large",
        })
        const third = Embedding.create({
            vector: [0, 1, 0],
            dimensions: 3,
            model: "text-embedding-3-large",
        })

        expect(first.similarity(second)).toBe(1)
        expect(first.similarity(third)).toBe(0)
    })
})
