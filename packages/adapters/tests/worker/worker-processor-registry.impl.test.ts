import {describe, expect, test} from "bun:test"

import {
    WorkerProcessorRegistry,
    type WorkerProcessor,
} from "../../src/worker"

describe("WorkerProcessorRegistry", () => {
    test("registers processor and resolves it by normalized job type", async () => {
        const registry = new WorkerProcessorRegistry()
        const processedPayloads: unknown[] = []
        const processor: WorkerProcessor = (payload: unknown): Promise<void> => {
            processedPayloads.push(payload)
            return Promise.resolve()
        }

        registry.register(" scan-repository ", processor)

        const resolvedProcessor = registry.get("scan-repository")
        expect(resolvedProcessor).toBeDefined()
        if (resolvedProcessor === undefined) {
            throw new Error("Processor was not resolved")
        }

        await resolvedProcessor({
            repositoryId: "repo-1",
        })
        expect(processedPayloads).toEqual([
            {
                repositoryId: "repo-1",
            },
        ])
    })

    test("returns undefined for unknown job type", () => {
        const registry = new WorkerProcessorRegistry()

        expect(registry.get("missing-job")).toBeUndefined()
    })

    test("rejects duplicate registration when overwrite is disabled", () => {
        const registry = new WorkerProcessorRegistry()
        const firstProcessor: WorkerProcessor = (_payload: unknown): Promise<void> => {
            return Promise.resolve()
        }
        const secondProcessor: WorkerProcessor = (_payload: unknown): Promise<void> => {
            return Promise.resolve()
        }

        registry.register("scan", firstProcessor)
        expect((): void => registry.register("scan", secondProcessor)).toThrow(
            'Processor is already registered for job type "scan"',
        )
    })

    test("allows processor overwrite when enabled", async () => {
        const registry = new WorkerProcessorRegistry({
            allowOverwrite: true,
        })
        const invocationOrder: string[] = []
        const firstProcessor: WorkerProcessor = (_payload: unknown): Promise<void> => {
            invocationOrder.push("first")
            return Promise.resolve()
        }
        const secondProcessor: WorkerProcessor = (_payload: unknown): Promise<void> => {
            invocationOrder.push("second")
            return Promise.resolve()
        }

        registry.register("scan", firstProcessor)
        registry.register("scan", secondProcessor)

        const resolvedProcessor = registry.get("scan")
        if (resolvedProcessor === undefined) {
            throw new Error("Expected processor to be resolved")
        }

        await resolvedProcessor({})
        expect(invocationOrder).toEqual(["second"])
    })

    test("validates non-empty job type for register and get", () => {
        const registry = new WorkerProcessorRegistry()
        const processor: WorkerProcessor = (_payload: unknown): Promise<void> => {
            return Promise.resolve()
        }

        expect((): void => registry.register(" ", processor)).toThrow(
            "jobType must be a non-empty string",
        )
        expect((): WorkerProcessor | undefined => registry.get(" ")).toThrow(
            "jobType must be a non-empty string",
        )
    })
})
