import {describe, expect, test} from "bun:test"

import {
    AST_BLUEPRINT_PARSER_ERROR_CODE,
    AST_BLUEPRINT_RULE_MODE,
    AstBlueprintParserError,
    AstBlueprintParserService,
    type IAstBlueprintDefinition,
    type IAstBlueprintParserInput,
} from "../../src/ast"

type AstBlueprintParserErrorCode =
    (typeof AST_BLUEPRINT_PARSER_ERROR_CODE)[keyof typeof AST_BLUEPRINT_PARSER_ERROR_CODE]

/**
 * Asserts typed blueprint parser error for async action.
 *
 * @param callback Action expected to fail.
 * @param code Expected typed error code.
 * @returns Promise resolved when assertion passes.
 */
async function expectAstBlueprintParserError(
    callback: () => Promise<unknown>,
    code: AstBlueprintParserErrorCode,
): Promise<void> {
    try {
        await callback()
    } catch (error) {
        expect(error).toBeInstanceOf(AstBlueprintParserError)

        if (error instanceof AstBlueprintParserError) {
            expect(error.code).toBe(code)
            return
        }
    }

    throw new Error("Expected AstBlueprintParserError to be thrown")
}

describe("AstBlueprintParserService", () => {
    test("parses and normalizes architecture blueprint YAML", async () => {
        const service = new AstBlueprintParserService()
        const result = await service.parse({
            sourcePath: " configs\\architecture\\blueprint.yaml ",
            blueprintYaml: createValidBlueprintYaml(),
        })

        expect(result).toEqual({
            version: 2,
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
                    target: "domain",
                    mode: AST_BLUEPRINT_RULE_MODE.ALLOW,
                },
                {
                    source: "infrastructure",
                    target: "domain",
                    mode: AST_BLUEPRINT_RULE_MODE.FORBID,
                },
            ],
            modules: [
                {
                    name: "review.aggregate",
                    layer: "domain",
                    paths: ["src/domain/review.aggregate.ts"],
                },
                {
                    name: "review.controller",
                    layer: "infrastructure",
                    paths: ["src/infrastructure/http/review.controller.ts"],
                },
            ],
            metadata: {
                description: "review flow architecture",
                name: "review-blueprint",
            },
            sourcePath: "configs/architecture/blueprint.yaml",
        })
    })

    test("retries parser callback and serves cached idempotent result", async () => {
        let parseCalls = 0
        const sleepCalls: number[] = []
        const service = new AstBlueprintParserService({
            parseYaml: () => {
                parseCalls += 1
                if (parseCalls === 1) {
                    return Promise.reject(new Error("temporary parser failure"))
                }

                return Promise.resolve(Bun.YAML.parse(createValidBlueprintYaml()))
            },
            maxParseAttempts: 2,
            retryBackoffMs: 12,
            cacheTtlMs: 10000,
            sleep: (milliseconds) => {
                sleepCalls.push(milliseconds)
                return Promise.resolve()
            },
            now: () => Date.parse("2026-03-15T12:00:00.000Z"),
        })

        const input: IAstBlueprintParserInput = {
            blueprintYaml: createValidBlueprintYaml(),
        }
        const firstResult = await service.parse(input)
        const secondResult = await service.parse(input)

        expect(parseCalls).toBe(2)
        expect(sleepCalls).toEqual([12])
        expect(secondResult).toEqual(firstResult)
    })

    test("deduplicates in-flight parsing for identical payload", async () => {
        let parseCalls = 0
        const gate = createDeferred()
        const service = new AstBlueprintParserService({
            parseYaml: async () => {
                parseCalls += 1
                await gate.promise
                return Bun.YAML.parse(createValidBlueprintYaml())
            },
        })

        const pendingFirst = service.parse({
            blueprintYaml: createValidBlueprintYaml(),
            sourcePath: "config/blueprint.yaml",
        })
        const pendingSecond = service.parse({
            blueprintYaml: createValidBlueprintYaml(),
            sourcePath: "config/blueprint.yaml",
        })
        gate.resolve()

        const [firstResult, secondResult] = await Promise.all([pendingFirst, pendingSecond])
        expect(parseCalls).toBe(1)
        expect(secondResult).toEqual(firstResult)
    })

    test("throws typed schema validation errors", async () => {
        const service = new AstBlueprintParserService()

        await expectAstBlueprintParserError(
            () =>
                service.parse({
                    blueprintYaml: "   ",
                }),
            AST_BLUEPRINT_PARSER_ERROR_CODE.EMPTY_BLUEPRINT_YAML,
        )

        await expectAstBlueprintParserError(
            () =>
                service.parse({
                    blueprintYaml: [
                        "version: 1",
                        "layers:",
                        "  - name: domain",
                        "    allow:",
                        "      - domain",
                        "rules:",
                        "  - source: domain",
                        "    target: unknown",
                        "    mode: allow",
                    ].join("\n"),
                }),
            AST_BLUEPRINT_PARSER_ERROR_CODE.UNKNOWN_RULE_LAYER,
        )

        await expectAstBlueprintParserError(
            () =>
                service.parse({
                    blueprintYaml: [
                        "version: 1",
                        "layers:",
                        "  - name: domain",
                        "    allow:",
                        "      - domain",
                        "rules:",
                        "  - source: domain",
                        "    target: domain",
                        "    mode: allow",
                        "modules:",
                        "  - name: mod-a",
                        "    layer: domain",
                        "    paths:",
                        "      - src/domain/a.ts",
                        "  - name: mod-b",
                        "    layer: domain",
                        "    paths:",
                        "      - src/domain/a.ts",
                    ].join("\n"),
                }),
            AST_BLUEPRINT_PARSER_ERROR_CODE.DUPLICATE_MODULE_PATH,
        )
    })

    test("throws retry exhausted when parser keeps failing", async () => {
        const service = new AstBlueprintParserService({
            parseYaml: () => Promise.reject(new Error("persistent parser outage")),
            maxParseAttempts: 3,
            retryBackoffMs: 0,
        })

        await expectAstBlueprintParserError(
            () =>
                service.parse({
                    blueprintYaml: createValidBlueprintYaml(),
                }),
            AST_BLUEPRINT_PARSER_ERROR_CODE.RETRY_EXHAUSTED,
        )
    })

    test("returns cloned cached result to protect internal state", async () => {
        const service = new AstBlueprintParserService({
            cacheTtlMs: 10000,
            now: () => Date.parse("2026-03-15T12:00:00.000Z"),
        })
        const input: IAstBlueprintParserInput = {
            blueprintYaml: createValidBlueprintYaml(),
        }

        const firstResult = await service.parse(input)
        mutateBlueprintDefinition(firstResult)
        const secondResult = await service.parse(input)

        expect(secondResult.layers[0]?.name).toBe("application")
        expect(secondResult.metadata.name).toBe("review-blueprint")
    })
})

/**
 * Creates valid deterministic architecture blueprint YAML.
 *
 * @returns Blueprint YAML payload.
 */
function createValidBlueprintYaml(): string {
    return [
        "name: review-blueprint",
        "description: review flow architecture",
        "version: 2",
        "layers:",
        "  - name: infrastructure",
        "    allow:",
        "      - application",
        "      - infrastructure",
        "  - name: domain",
        "    allow:",
        "      - domain",
        "  - name: application",
        "    allow:",
        "      - domain",
        "      - application",
        "rules:",
        "  - source: infrastructure",
        "    target: domain",
        "    mode: forbid",
        "  - source: application",
        "    target: domain",
        "    mode: allow",
        "modules:",
        "  - name: review.controller",
        "    layer: infrastructure",
        "    paths:",
        "      - src/infrastructure/http/review.controller.ts",
        "  - name: review.aggregate",
        "    layer: domain",
        "    paths:",
        "      - src/domain/review.aggregate.ts",
    ].join("\n")
}

/**
 * Mutates parsed blueprint result to verify clone guarantees.
 *
 * @param definition Blueprint definition DTO.
 */
function mutateBlueprintDefinition(definition: IAstBlueprintDefinition): void {
    const firstLayer = definition.layers[0]
    if (firstLayer !== undefined) {
        ;(firstLayer as {name: string}).name = "mutated-layer"
    }

    ;(definition.metadata as Record<string, string>).name = "mutated-name"
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
