import {describe, expect, test} from "bun:test"

import {
    AST_MODULE_BOUNDARY_VALIDATOR_ERROR_CODE,
    AST_MODULE_BOUNDARY_VIOLATION_KIND,
    AstModuleBoundaryValidatorError,
    AstModuleBoundaryValidatorService,
    type IAstBlueprintDefinition,
    type IAstImportEdgeInput,
    type IAstModuleBoundaryValidatorInput,
    type IAstModuleBoundaryValidatorResult,
} from "../../src/ast"

type AstModuleBoundaryValidatorErrorCode =
    (typeof AST_MODULE_BOUNDARY_VALIDATOR_ERROR_CODE)[keyof typeof AST_MODULE_BOUNDARY_VALIDATOR_ERROR_CODE]

/**
 * Asserts typed module boundary validator error for async action.
 *
 * @param callback Action expected to fail.
 * @param code Expected typed error code.
 * @returns Promise resolved when assertion passes.
 */
async function expectAstModuleBoundaryValidatorError(
    callback: () => Promise<unknown>,
    code: AstModuleBoundaryValidatorErrorCode,
): Promise<void> {
    try {
        await callback()
    } catch (error) {
        expect(error).toBeInstanceOf(AstModuleBoundaryValidatorError)

        if (error instanceof AstModuleBoundaryValidatorError) {
            expect(error.code).toBe(code)
            return
        }
    }

    throw new Error("Expected AstModuleBoundaryValidatorError to be thrown")
}

describe("AstModuleBoundaryValidatorService", () => {
    test("detects cross-boundary internal imports with skipped unknown-module imports", async () => {
        const service = new AstModuleBoundaryValidatorService({
            now: () => Date.parse("2026-03-15T12:00:00.000Z"),
        })
        const result = await service.validate({
            blueprint: createBlueprintDefinition(),
            imports: createImportEdges(),
        })

        expect(result.violations).toEqual([
            {
                sourcePath: "src/application/review/use-case.ts",
                targetPath: "src/domain/review/aggregate.ts",
                sourceModule: "review.application",
                targetModule: "review.domain",
                sourceLayer: "application",
                targetLayer: "domain",
                kind: AST_MODULE_BOUNDARY_VIOLATION_KIND.CROSS_BOUNDARY_INTERNAL_IMPORT,
                reason: "Cross-module internal import from review.application to review.domain",
            },
            {
                sourcePath: "src/domain/review/aggregate.ts",
                targetPath: "src/domain/billing/invoice.ts",
                sourceModule: "review.domain",
                targetModule: "billing.domain",
                sourceLayer: "domain",
                targetLayer: "domain",
                kind: AST_MODULE_BOUNDARY_VIOLATION_KIND.CROSS_BOUNDARY_INTERNAL_IMPORT,
                reason: "Cross-module internal import from review.domain to billing.domain",
            },
        ])
        expect(result.summary).toEqual({
            checkedImportCount: 4,
            skippedImportCount: 1,
            violationCount: 2,
            compliantImportCount: 1,
            uniqueSourceModuleViolationCount: 2,
            uniqueTargetModuleViolationCount: 2,
            generatedAt: "2026-03-15T12:00:00.000Z",
        })
    })

    test("loads imports with retry and serves cached idempotent result", async () => {
        let loadCalls = 0
        const sleepCalls: number[] = []
        const service = new AstModuleBoundaryValidatorService({
            loadImports: () => {
                loadCalls += 1
                if (loadCalls === 1) {
                    return Promise.reject(new Error("temporary import loader timeout"))
                }

                return Promise.resolve(createImportEdges())
            },
            maxLoadAttempts: 2,
            retryBackoffMs: 12,
            cacheTtlMs: 10000,
            sleep: (milliseconds) => {
                sleepCalls.push(milliseconds)
                return Promise.resolve()
            },
            now: () => Date.parse("2026-03-15T12:00:00.000Z"),
        })
        const input: IAstModuleBoundaryValidatorInput = {
            blueprint: createBlueprintDefinition(),
            filePaths: ["src/application/review/use-case.ts"],
        }

        const firstResult = await service.validate(input)
        const secondResult = await service.validate(input)

        expect(loadCalls).toBe(2)
        expect(sleepCalls).toEqual([12])
        expect(secondResult).toEqual(firstResult)
    })

    test("deduplicates in-flight import loading for identical request", async () => {
        let loadCalls = 0
        const gate = createDeferred()
        const service = new AstModuleBoundaryValidatorService({
            loadImports: async () => {
                loadCalls += 1
                await gate.promise
                return createImportEdges()
            },
        })

        const pendingFirst = service.validate({
            blueprint: createBlueprintDefinition(),
            filePaths: ["src/application/review/use-case.ts"],
        })
        const pendingSecond = service.validate({
            blueprint: createBlueprintDefinition(),
            filePaths: ["src/application/review/use-case.ts"],
        })
        gate.resolve()

        const [firstResult, secondResult] = await Promise.all([pendingFirst, pendingSecond])
        expect(loadCalls).toBe(1)
        expect(secondResult).toEqual(firstResult)
    })

    test("throws typed validation errors for invalid contracts", async () => {
        const service = new AstModuleBoundaryValidatorService()

        await expectAstModuleBoundaryValidatorError(
            () =>
                service.validate({
                    blueprint: createBlueprintDefinition(),
                }),
            AST_MODULE_BOUNDARY_VALIDATOR_ERROR_CODE.INVALID_LOAD_IMPORTS,
        )

        await expectAstModuleBoundaryValidatorError(
            () =>
                service.validate({
                    blueprint: {
                        ...createBlueprintDefinition(),
                        modules: [],
                    },
                    imports: createImportEdges(),
                }),
            AST_MODULE_BOUNDARY_VALIDATOR_ERROR_CODE.WITHOUT_MODULES,
        )

        await expectAstModuleBoundaryValidatorError(
            () =>
                service.validate({
                    blueprint: createBlueprintDefinition(),
                    imports: createImportEdges(),
                    filePaths: [],
                }),
            AST_MODULE_BOUNDARY_VALIDATOR_ERROR_CODE.EMPTY_FILE_PATHS,
        )

        await expectAstModuleBoundaryValidatorError(
            () =>
                service.validate({
                    blueprint: createAmbiguousBlueprintDefinition(),
                    imports: [
                        {
                            sourcePath: "src/domain/common/utils/source.ts",
                            sourceLayer: "domain",
                            targetPath: "src/domain/common/utils/target.ts",
                            targetLayer: "domain",
                        },
                    ],
                }),
            AST_MODULE_BOUNDARY_VALIDATOR_ERROR_CODE.AMBIGUOUS_MODULE_MATCH,
        )
    })

    test("throws retry exhausted when loader fails across all attempts", async () => {
        const service = new AstModuleBoundaryValidatorService({
            loadImports: () => Promise.reject(new Error("persistent loader outage")),
            maxLoadAttempts: 3,
            retryBackoffMs: 0,
        })

        await expectAstModuleBoundaryValidatorError(
            () =>
                service.validate({
                    blueprint: createBlueprintDefinition(),
                }),
            AST_MODULE_BOUNDARY_VALIDATOR_ERROR_CODE.RETRY_EXHAUSTED,
        )
    })

    test("returns cloned cached result to protect internal cache state", async () => {
        const service = new AstModuleBoundaryValidatorService({
            cacheTtlMs: 10000,
            now: () => Date.parse("2026-03-15T12:00:00.000Z"),
        })
        const input: IAstModuleBoundaryValidatorInput = {
            blueprint: createBlueprintDefinition(),
            imports: createImportEdges(),
        }

        const firstResult = await service.validate(input)
        mutateResult(firstResult)
        const secondResult = await service.validate(input)

        expect(secondResult.violations[0]?.sourceModule).toBe("review.application")
        expect(secondResult.summary.violationCount).toBe(2)
    })
})

/**
 * Creates deterministic blueprint definition for module boundary validation tests.
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
        ],
        rules: [],
        modules: [
            {
                name: "review.application",
                layer: "application",
                paths: ["src/application/review/**"],
            },
            {
                name: "review.domain",
                layer: "domain",
                paths: ["src/domain/review/**"],
            },
            {
                name: "billing.domain",
                layer: "domain",
                paths: ["src/domain/billing/**"],
            },
        ],
        metadata: {},
    }
}

/**
 * Creates blueprint definition with overlapping module patterns for ambiguity test.
 *
 * @returns Ambiguous blueprint definition.
 */
function createAmbiguousBlueprintDefinition(): IAstBlueprintDefinition {
    return {
        version: 1,
        layers: [
            {
                name: "domain",
                allow: ["domain"],
            },
        ],
        rules: [],
        modules: [
            {
                name: "common.domain",
                layer: "domain",
                paths: ["src/domain/common/**"],
            },
            {
                name: "common-utils.domain",
                layer: "domain",
                paths: ["src/domain/common/utils/**"],
            },
        ],
        metadata: {},
    }
}

/**
 * Creates deterministic import edge dataset.
 *
 * @returns Import edge list.
 */
function createImportEdges(): readonly IAstImportEdgeInput[] {
    return [
        {
            sourcePath: "src/application/review/use-case.ts",
            sourceLayer: "application",
            targetPath: "src/domain/review/aggregate.ts",
            targetLayer: "domain",
        },
        {
            sourcePath: "src/domain/review/aggregate.ts",
            sourceLayer: "domain",
            targetPath: "src/domain/review/value-object.ts",
            targetLayer: "domain",
        },
        {
            sourcePath: "src/domain/review/aggregate.ts",
            sourceLayer: "domain",
            targetPath: "src/domain/billing/invoice.ts",
            targetLayer: "domain",
        },
        {
            sourcePath: "src/application/review/use-case.ts",
            sourceLayer: "application",
            targetPath: "src/external/helpers.ts",
            targetLayer: "domain",
        },
    ]
}

/**
 * Mutates result payload to verify clone guarantees.
 *
 * @param result Validator result payload.
 */
function mutateResult(result: IAstModuleBoundaryValidatorResult): void {
    const firstViolation = result.violations[0]
    if (firstViolation !== undefined) {
        ;(firstViolation as {sourceModule: string}).sourceModule = "mutated.module"
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
