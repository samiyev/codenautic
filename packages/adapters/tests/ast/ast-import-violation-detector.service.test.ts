import {describe, expect, test} from "bun:test"

import {
    AST_IMPORT_VIOLATION_DETECTOR_ERROR_CODE,
    AST_IMPORT_VIOLATION_KIND,
    AstImportViolationDetectorError,
    AstImportViolationDetectorService,
    type IAstBlueprintDefinition,
    type IAstImportEdgeInput,
    type IAstImportViolationDetectorInput,
    type IAstImportViolationDetectorResult,
} from "../../src/ast"

type AstImportViolationDetectorErrorCode =
    (typeof AST_IMPORT_VIOLATION_DETECTOR_ERROR_CODE)[keyof typeof AST_IMPORT_VIOLATION_DETECTOR_ERROR_CODE]

/**
 * Asserts typed import violation detector error for async action.
 *
 * @param callback Action expected to fail.
 * @param code Expected typed error code.
 * @returns Promise resolved when assertion passes.
 */
async function expectAstImportViolationDetectorError(
    callback: () => Promise<unknown>,
    code: AstImportViolationDetectorErrorCode,
): Promise<void> {
    try {
        await callback()
    } catch (error) {
        expect(error).toBeInstanceOf(AstImportViolationDetectorError)

        if (error instanceof AstImportViolationDetectorError) {
            expect(error.code).toBe(code)
            return
        }
    }

    throw new Error("Expected AstImportViolationDetectorError to be thrown")
}

describe("AstImportViolationDetectorService", () => {
    test("detects layer-policy and explicit-forbid violations", async () => {
        const service = new AstImportViolationDetectorService({
            now: () => Date.parse("2026-03-15T12:00:00.000Z"),
        })
        const result = await service.detect({
            blueprint: createBlueprintDefinition(),
            imports: createImportEdges(),
        })

        expect(result.violations).toEqual([
            {
                sourcePath: "src/domain/review.aggregate.ts",
                sourceLayer: "domain",
                targetPath: "src/application/review.use-case.ts",
                targetLayer: "application",
                kind: AST_IMPORT_VIOLATION_KIND.LAYER_POLICY,
                reason: "Target layer is not allowed by source layer policy",
            },
            {
                sourcePath: "src/infrastructure/review.controller.ts",
                sourceLayer: "infrastructure",
                targetPath: "src/domain/review.aggregate.ts",
                targetLayer: "domain",
                kind: AST_IMPORT_VIOLATION_KIND.EXPLICIT_FORBID,
                reason: "Explicit forbid rule blocks this layer dependency",
            },
        ])
        expect(result.summary).toEqual({
            checkedImportCount: 4,
            violationCount: 2,
            compliantImportCount: 2,
            explicitForbidViolationCount: 1,
            layerPolicyViolationCount: 1,
            generatedAt: "2026-03-15T12:00:00.000Z",
        })
    })

    test("loads imports with retry and serves cached idempotent result", async () => {
        let loadCalls = 0
        const sleepCalls: number[] = []
        const service = new AstImportViolationDetectorService({
            loadImports: () => {
                loadCalls += 1
                if (loadCalls === 1) {
                    return Promise.reject(new Error("temporary import indexer timeout"))
                }

                return Promise.resolve(createImportEdges())
            },
            maxLoadAttempts: 2,
            retryBackoffMs: 11,
            cacheTtlMs: 10000,
            sleep: (milliseconds) => {
                sleepCalls.push(milliseconds)
                return Promise.resolve()
            },
            now: () => Date.parse("2026-03-15T12:00:00.000Z"),
        })
        const input: IAstImportViolationDetectorInput = {
            blueprint: createBlueprintDefinition(),
            filePaths: ["src/application/review.use-case.ts"],
        }

        const firstResult = await service.detect(input)
        const secondResult = await service.detect(input)

        expect(loadCalls).toBe(2)
        expect(sleepCalls).toEqual([11])
        expect(secondResult).toEqual(firstResult)
    })

    test("deduplicates in-flight import loading for identical request key", async () => {
        let loadCalls = 0
        const gate = createDeferred()

        const service = new AstImportViolationDetectorService({
            loadImports: async () => {
                loadCalls += 1
                await gate.promise
                return createImportEdges()
            },
        })

        const pendingFirst = service.detect({
            blueprint: createBlueprintDefinition(),
            filePaths: ["src/application/review.use-case.ts"],
        })
        const pendingSecond = service.detect({
            blueprint: createBlueprintDefinition(),
            filePaths: ["src/application/review.use-case.ts"],
        })
        gate.resolve()

        const [firstResult, secondResult] = await Promise.all([pendingFirst, pendingSecond])
        expect(loadCalls).toBe(1)
        expect(secondResult).toEqual(firstResult)
    })

    test("throws typed validation errors for invalid input contracts", async () => {
        const service = new AstImportViolationDetectorService()

        await expectAstImportViolationDetectorError(
            () =>
                service.detect({
                    blueprint: createBlueprintDefinition(),
                }),
            AST_IMPORT_VIOLATION_DETECTOR_ERROR_CODE.INVALID_LOAD_IMPORTS,
        )

        await expectAstImportViolationDetectorError(
            () =>
                service.detect({
                    blueprint: createBlueprintDefinition(),
                    imports: [
                        {
                            sourcePath: "src/a.ts",
                            sourceLayer: "unknown",
                            targetPath: "src/b.ts",
                            targetLayer: "domain",
                        },
                    ],
                }),
            AST_IMPORT_VIOLATION_DETECTOR_ERROR_CODE.UNKNOWN_LAYER_REFERENCE,
        )

        await expectAstImportViolationDetectorError(
            () =>
                service.detect({
                    blueprint: createBlueprintDefinition(),
                    imports: createImportEdges(),
                    filePaths: [],
                }),
            AST_IMPORT_VIOLATION_DETECTOR_ERROR_CODE.EMPTY_FILE_PATHS,
        )
    })

    test("throws retry exhausted when loadImports fails across all attempts", async () => {
        const service = new AstImportViolationDetectorService({
            loadImports: () => Promise.reject(new Error("persistent import indexer outage")),
            maxLoadAttempts: 3,
            retryBackoffMs: 0,
        })

        await expectAstImportViolationDetectorError(
            () =>
                service.detect({
                    blueprint: createBlueprintDefinition(),
                }),
            AST_IMPORT_VIOLATION_DETECTOR_ERROR_CODE.RETRY_EXHAUSTED,
        )
    })

    test("returns cloned cached result to protect internal cache state", async () => {
        const service = new AstImportViolationDetectorService({
            cacheTtlMs: 10000,
            now: () => Date.parse("2026-03-15T12:00:00.000Z"),
        })
        const input: IAstImportViolationDetectorInput = {
            blueprint: createBlueprintDefinition(),
            imports: createImportEdges(),
        }

        const firstResult = await service.detect(input)
        mutateDetectorResult(firstResult)
        const secondResult = await service.detect(input)

        expect(secondResult.violations[0]?.kind).toBe(AST_IMPORT_VIOLATION_KIND.LAYER_POLICY)
        expect(secondResult.summary.violationCount).toBe(2)
    })
})

/**
 * Creates deterministic blueprint definition for import policy tests.
 *
 * @returns Blueprint definition.
 */
function createBlueprintDefinition(): IAstBlueprintDefinition {
    return {
        version: 1,
        layers: [
            {
                name: "application",
                allow: ["application", "domain"],
            },
            {
                name: "domain",
                allow: ["domain"],
            },
            {
                name: "infrastructure",
                allow: ["application", "infrastructure"],
            },
        ],
        rules: [
            {
                source: "application",
                target: "infrastructure",
                mode: "allow",
            },
            {
                source: "infrastructure",
                target: "domain",
                mode: "forbid",
            },
        ],
        modules: [],
        metadata: {},
    }
}

/**
 * Creates deterministic import edge input payload.
 *
 * @returns Import edge list.
 */
function createImportEdges(): readonly IAstImportEdgeInput[] {
    return [
        {
            sourcePath: "src/application/review.use-case.ts",
            sourceLayer: "application",
            targetPath: "src/domain/review.aggregate.ts",
            targetLayer: "domain",
        },
        {
            sourcePath: "src/application/review.use-case.ts",
            sourceLayer: "application",
            targetPath: "src/infrastructure/review.repository.ts",
            targetLayer: "infrastructure",
        },
        {
            sourcePath: "src/infrastructure/review.controller.ts",
            sourceLayer: "infrastructure",
            targetPath: "src/domain/review.aggregate.ts",
            targetLayer: "domain",
        },
        {
            sourcePath: "src/domain/review.aggregate.ts",
            sourceLayer: "domain",
            targetPath: "src/application/review.use-case.ts",
            targetLayer: "application",
        },
    ]
}

/**
 * Mutates detector result payload to verify clone guarantees.
 *
 * @param result Detector result payload.
 */
function mutateDetectorResult(result: IAstImportViolationDetectorResult): void {
    const firstViolation = result.violations[0]
    if (firstViolation !== undefined) {
        ;(firstViolation as {kind: string}).kind =
            AST_IMPORT_VIOLATION_KIND.EXPLICIT_FORBID
    }

    ;(result.summary as {violationCount: number}).violationCount = 100
}

/**
 * Creates deferred primitive for deterministic async orchestration.
 *
 * @returns Deferred promise and resolve callback.
 */
function createDeferred(): {
    readonly promise: Promise<void>
    readonly resolve: () => void
} {
    let resolver: (() => void) | undefined = undefined
    const promise = new Promise<void>((resolve) => {
        resolver = resolve
    })

    return {
        promise,
        resolve: () => {
            if (resolver !== undefined) {
                resolver()
            }
        },
    }
}
