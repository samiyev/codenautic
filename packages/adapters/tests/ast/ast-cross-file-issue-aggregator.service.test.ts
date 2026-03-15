import {describe, expect, test} from "bun:test"

import {
    AST_LANGUAGE,
    type IParsedSourceFileDTO,
} from "@codenautic/core"

import {
    AST_CROSS_FILE_ISSUE_AGGREGATOR_ERROR_CODE,
    AST_CROSS_FILE_ISSUE_SEVERITY,
    AST_CROSS_FILE_ISSUE_SOURCE,
    AstCrossFileIssueAggregatorError,
    AstCrossFileIssueAggregatorService,
    type IAstCrossFileIssueInput,
} from "../../src/ast"

/**
 * Creates parsed source file fixture.
 *
 * @param filePath Repository-relative file path.
 * @returns Parsed source file DTO.
 */
function createParsedFile(filePath: string): IParsedSourceFileDTO {
    return {
        filePath,
        language: AST_LANGUAGE.TYPESCRIPT,
        hasSyntaxErrors: false,
        imports: [],
        typeAliases: [],
        interfaces: [],
        enums: [],
        classes: [],
        functions: [],
        calls: [],
    }
}

/**
 * Creates deterministic parsed file fixture set.
 *
 * @returns Parsed source files.
 */
function createFiles(): readonly IParsedSourceFileDTO[] {
    return [
        createParsedFile("src/app.ts"),
        createParsedFile("src/lib.ts"),
        createParsedFile("src/feature.ts"),
        createParsedFile("src/contracts.ts"),
    ]
}

/**
 * Creates deterministic cross-file issue fixture set.
 *
 * @returns Raw issue entries.
 */
function createIssues(): readonly IAstCrossFileIssueInput[] {
    return [
        {
            source: AST_CROSS_FILE_ISSUE_SOURCE.SHARED_STATE,
            severity: AST_CROSS_FILE_ISSUE_SEVERITY.MEDIUM,
            type: "SHARED_MUTABLE_API",
            filePath: "src/app.ts",
            message: "Shared mutable state is exposed through exported mutator methods",
            relatedFilePaths: ["src/lib.ts"],
        },
        {
            source: AST_CROSS_FILE_ISSUE_SOURCE.CIRCULAR_DEPENDENCY,
            severity: AST_CROSS_FILE_ISSUE_SEVERITY.HIGH,
            type: "SCC_CYCLE",
            filePath: "src/lib.ts",
            message: "Circular dependency cycle was detected",
            relatedFilePaths: [
                "src/app.ts",
                "src/feature.ts",
            ],
        },
        {
            source: AST_CROSS_FILE_ISSUE_SOURCE.INTERFACE_CONTRACT,
            severity: AST_CROSS_FILE_ISSUE_SEVERITY.LOW,
            type: "MISSING_INTERFACE_MEMBER",
            filePath: "src/feature.ts",
            message: "Interface implementation does not define one required method",
        },
    ]
}

/**
 * Asserts typed aggregator error shape for synchronous action.
 *
 * @param callback Action expected to throw.
 * @param code Expected typed error code.
 */
function expectAstCrossFileIssueAggregatorError(
    callback: () => unknown,
    code:
        (typeof AST_CROSS_FILE_ISSUE_AGGREGATOR_ERROR_CODE)[keyof typeof AST_CROSS_FILE_ISSUE_AGGREGATOR_ERROR_CODE],
): void {
    try {
        callback()
    } catch (error) {
        expect(error).toBeInstanceOf(AstCrossFileIssueAggregatorError)

        if (error instanceof AstCrossFileIssueAggregatorError) {
            expect(error.code).toBe(code)
            return
        }
    }

    throw new Error("Expected AstCrossFileIssueAggregatorError to be thrown")
}

/**
 * Asserts typed aggregator error shape for async action.
 *
 * @param callback Async action expected to reject.
 * @param code Expected typed error code.
 */
async function expectAstCrossFileIssueAggregatorErrorAsync(
    callback: () => Promise<unknown>,
    code:
        (typeof AST_CROSS_FILE_ISSUE_AGGREGATOR_ERROR_CODE)[keyof typeof AST_CROSS_FILE_ISSUE_AGGREGATOR_ERROR_CODE],
): Promise<void> {
    try {
        await callback()
    } catch (error) {
        expect(error).toBeInstanceOf(AstCrossFileIssueAggregatorError)

        if (error instanceof AstCrossFileIssueAggregatorError) {
            expect(error.code).toBe(code)
            return
        }
    }

    throw new Error("Expected AstCrossFileIssueAggregatorError to be thrown")
}

describe("AstCrossFileIssueAggregatorService", () => {
    test("aggregates issues with deterministic sort and summary", async () => {
        const aggregator = new AstCrossFileIssueAggregatorService()
        const result = await aggregator.aggregate({
            files: createFiles(),
            issues: createIssues(),
        })

        expect(result.issues).toEqual([
            {
                id: "CIRCULAR_DEPENDENCY|HIGH|SCC_CYCLE|src/lib.ts|src/app.ts,src/feature.ts|Circular dependency cycle was detected",
                source: AST_CROSS_FILE_ISSUE_SOURCE.CIRCULAR_DEPENDENCY,
                severity: AST_CROSS_FILE_ISSUE_SEVERITY.HIGH,
                type: "SCC_CYCLE",
                filePath: "src/lib.ts",
                message: "Circular dependency cycle was detected",
                relatedFilePaths: [
                    "src/app.ts",
                    "src/feature.ts",
                ],
            },
            {
                id: "SHARED_STATE|MEDIUM|SHARED_MUTABLE_API|src/app.ts|src/lib.ts|Shared mutable state is exposed through exported mutator methods",
                source: AST_CROSS_FILE_ISSUE_SOURCE.SHARED_STATE,
                severity: AST_CROSS_FILE_ISSUE_SEVERITY.MEDIUM,
                type: "SHARED_MUTABLE_API",
                filePath: "src/app.ts",
                message: "Shared mutable state is exposed through exported mutator methods",
                relatedFilePaths: ["src/lib.ts"],
            },
            {
                id: "INTERFACE_CONTRACT|LOW|MISSING_INTERFACE_MEMBER|src/feature.ts||Interface implementation does not define one required method",
                source: AST_CROSS_FILE_ISSUE_SOURCE.INTERFACE_CONTRACT,
                severity: AST_CROSS_FILE_ISSUE_SEVERITY.LOW,
                type: "MISSING_INTERFACE_MEMBER",
                filePath: "src/feature.ts",
                message: "Interface implementation does not define one required method",
                relatedFilePaths: [],
            },
        ])
        expect(result.fileSummaries).toEqual([
            {
                filePath: "src/app.ts",
                issueCount: 1,
                highSeverityCount: 0,
                relatedFileCount: 1,
                bySeverity: {
                    HIGH: 0,
                    MEDIUM: 1,
                    LOW: 0,
                },
                bySource: {
                    CIRCULAR_DEPENDENCY: 0,
                    INTERFACE_CONTRACT: 0,
                    SHARED_STATE: 1,
                    TYPE_FLOW: 0,
                    BREAKING_CHANGE: 0,
                    CUSTOM: 0,
                },
            },
            {
                filePath: "src/feature.ts",
                issueCount: 1,
                highSeverityCount: 0,
                relatedFileCount: 0,
                bySeverity: {
                    HIGH: 0,
                    MEDIUM: 0,
                    LOW: 1,
                },
                bySource: {
                    CIRCULAR_DEPENDENCY: 0,
                    INTERFACE_CONTRACT: 1,
                    SHARED_STATE: 0,
                    TYPE_FLOW: 0,
                    BREAKING_CHANGE: 0,
                    CUSTOM: 0,
                },
            },
            {
                filePath: "src/lib.ts",
                issueCount: 1,
                highSeverityCount: 1,
                relatedFileCount: 2,
                bySeverity: {
                    HIGH: 1,
                    MEDIUM: 0,
                    LOW: 0,
                },
                bySource: {
                    CIRCULAR_DEPENDENCY: 1,
                    INTERFACE_CONTRACT: 0,
                    SHARED_STATE: 0,
                    TYPE_FLOW: 0,
                    BREAKING_CHANGE: 0,
                    CUSTOM: 0,
                },
            },
        ])
        expect(result.summary).toEqual({
            scannedFileCount: 4,
            issueCount: 3,
            fileCount: 3,
            highSeverityCount: 1,
            truncated: false,
            truncatedIssueCount: 0,
            bySeverity: {
                HIGH: 1,
                MEDIUM: 1,
                LOW: 1,
            },
            bySource: {
                CIRCULAR_DEPENDENCY: 1,
                INTERFACE_CONTRACT: 1,
                SHARED_STATE: 1,
                TYPE_FLOW: 0,
                BREAKING_CHANGE: 0,
                CUSTOM: 0,
            },
        })
    })

    test("applies file-path filter and deduplicates by issue id", async () => {
        const aggregator = new AstCrossFileIssueAggregatorService()
        const result = await aggregator.aggregate({
            files: createFiles(),
            filePaths: ["src/app.ts"],
            issues: [
                {
                    id: "ISSUE-1",
                    source: AST_CROSS_FILE_ISSUE_SOURCE.SHARED_STATE,
                    severity: AST_CROSS_FILE_ISSUE_SEVERITY.MEDIUM,
                    type: "SHARED_MUTABLE_API",
                    filePath: "src/app.ts",
                    message: "Shared mutable state",
                },
                {
                    id: "ISSUE-1",
                    source: AST_CROSS_FILE_ISSUE_SOURCE.SHARED_STATE,
                    severity: AST_CROSS_FILE_ISSUE_SEVERITY.HIGH,
                    type: "SHARED_MUTABLE_API",
                    filePath: "src/app.ts",
                    message: "Duplicate should be ignored",
                },
                {
                    source: AST_CROSS_FILE_ISSUE_SOURCE.CIRCULAR_DEPENDENCY,
                    severity: AST_CROSS_FILE_ISSUE_SEVERITY.HIGH,
                    type: "SCC_CYCLE",
                    filePath: "src/lib.ts",
                    message: "Filtered out by file-path filter",
                },
            ],
        })

        expect(result.issues).toHaveLength(1)
        expect(result.issues[0]?.id).toBe("ISSUE-1")
        expect(result.summary.scannedFileCount).toBe(1)
        expect(result.summary.issueCount).toBe(1)
    })

    test("truncates output by maxIssues", async () => {
        const aggregator = new AstCrossFileIssueAggregatorService()
        const result = await aggregator.aggregate({
            files: createFiles(),
            maxIssues: 2,
            issues: createIssues(),
        })

        expect(result.issues).toHaveLength(2)
        expect(result.summary.truncated).toBe(true)
        expect(result.summary.truncatedIssueCount).toBe(1)
    })

    test("throws typed errors for invalid options", async () => {
        expectAstCrossFileIssueAggregatorError(
            () => {
                void new AstCrossFileIssueAggregatorService({
                    defaultMaxIssues: 0,
                })
            },
            AST_CROSS_FILE_ISSUE_AGGREGATOR_ERROR_CODE.INVALID_MAX_ISSUES,
        )

        const aggregator = new AstCrossFileIssueAggregatorService()

        await expectAstCrossFileIssueAggregatorErrorAsync(
            async () =>
                aggregator.aggregate({
                    files: [],
                    issues: [],
                }),
            AST_CROSS_FILE_ISSUE_AGGREGATOR_ERROR_CODE.EMPTY_FILES,
        )

        await expectAstCrossFileIssueAggregatorErrorAsync(
            async () =>
                aggregator.aggregate({
                    files: [
                        createParsedFile("src/app.ts"),
                        createParsedFile("src/app.ts"),
                    ],
                    issues: [],
                }),
            AST_CROSS_FILE_ISSUE_AGGREGATOR_ERROR_CODE.DUPLICATE_FILE_PATH,
        )

        await expectAstCrossFileIssueAggregatorErrorAsync(
            async () =>
                aggregator.aggregate({
                    files: createFiles(),
                    issues: [],
                    filePaths: [],
                }),
            AST_CROSS_FILE_ISSUE_AGGREGATOR_ERROR_CODE.EMPTY_FILE_PATHS,
        )

        await expectAstCrossFileIssueAggregatorErrorAsync(
            async () =>
                aggregator.aggregate({
                    files: createFiles(),
                    issues: [],
                    filePaths: ["   "],
                }),
            AST_CROSS_FILE_ISSUE_AGGREGATOR_ERROR_CODE.INVALID_FILE_PATH,
        )

        await expectAstCrossFileIssueAggregatorErrorAsync(
            async () =>
                aggregator.aggregate({
                    files: createFiles(),
                    issues: createIssues(),
                    maxIssues: 0,
                }),
            AST_CROSS_FILE_ISSUE_AGGREGATOR_ERROR_CODE.INVALID_MAX_ISSUES,
        )

        await expectAstCrossFileIssueAggregatorErrorAsync(
            async () =>
                aggregator.aggregate({
                    files: createFiles(),
                    issues: [
                        {
                            source: "UNKNOWN" as never,
                            severity: AST_CROSS_FILE_ISSUE_SEVERITY.HIGH,
                            type: "UNKNOWN",
                            filePath: "src/app.ts",
                            message: "Invalid source",
                        },
                    ],
                }),
            AST_CROSS_FILE_ISSUE_AGGREGATOR_ERROR_CODE.INVALID_SOURCE,
        )

        await expectAstCrossFileIssueAggregatorErrorAsync(
            async () =>
                aggregator.aggregate({
                    files: createFiles(),
                    issues: [
                        {
                            source: AST_CROSS_FILE_ISSUE_SOURCE.CUSTOM,
                            severity: "SEVERE" as never,
                            type: "UNKNOWN",
                            filePath: "src/app.ts",
                            message: "Invalid severity",
                        },
                    ],
                }),
            AST_CROSS_FILE_ISSUE_AGGREGATOR_ERROR_CODE.INVALID_SEVERITY,
        )

        await expectAstCrossFileIssueAggregatorErrorAsync(
            async () =>
                aggregator.aggregate({
                    files: createFiles(),
                    issues: [
                        {
                            source: AST_CROSS_FILE_ISSUE_SOURCE.CUSTOM,
                            severity: AST_CROSS_FILE_ISSUE_SEVERITY.LOW,
                            type: "   ",
                            filePath: "src/app.ts",
                            message: "Invalid type",
                        },
                    ],
                }),
            AST_CROSS_FILE_ISSUE_AGGREGATOR_ERROR_CODE.INVALID_ISSUE_TYPE,
        )

        await expectAstCrossFileIssueAggregatorErrorAsync(
            async () =>
                aggregator.aggregate({
                    files: createFiles(),
                    issues: [
                        {
                            source: AST_CROSS_FILE_ISSUE_SOURCE.CUSTOM,
                            severity: AST_CROSS_FILE_ISSUE_SEVERITY.LOW,
                            type: "CUSTOM",
                            filePath: "src/app.ts",
                            message: "   ",
                        },
                    ],
                }),
            AST_CROSS_FILE_ISSUE_AGGREGATOR_ERROR_CODE.INVALID_ISSUE_MESSAGE,
        )

        await expectAstCrossFileIssueAggregatorErrorAsync(
            async () =>
                aggregator.aggregate({
                    files: createFiles(),
                    issues: [
                        {
                            id: "   ",
                            source: AST_CROSS_FILE_ISSUE_SOURCE.CUSTOM,
                            severity: AST_CROSS_FILE_ISSUE_SEVERITY.LOW,
                            type: "CUSTOM",
                            filePath: "src/app.ts",
                            message: "Invalid id",
                        },
                    ],
                }),
            AST_CROSS_FILE_ISSUE_AGGREGATOR_ERROR_CODE.INVALID_ISSUE_ID,
        )

        await expectAstCrossFileIssueAggregatorErrorAsync(
            async () =>
                aggregator.aggregate({
                    files: createFiles(),
                    issues: [
                        {
                            source: AST_CROSS_FILE_ISSUE_SOURCE.CUSTOM,
                            severity: AST_CROSS_FILE_ISSUE_SEVERITY.LOW,
                            type: "CUSTOM",
                            filePath: "src/missing.ts",
                            message: "Missing issue file",
                        },
                    ],
                }),
            AST_CROSS_FILE_ISSUE_AGGREGATOR_ERROR_CODE.ISSUE_FILE_NOT_FOUND,
        )

        await expectAstCrossFileIssueAggregatorErrorAsync(
            async () =>
                aggregator.aggregate({
                    files: createFiles(),
                    issues: [
                        {
                            source: AST_CROSS_FILE_ISSUE_SOURCE.CUSTOM,
                            severity: AST_CROSS_FILE_ISSUE_SEVERITY.LOW,
                            type: "CUSTOM",
                            filePath: "src/app.ts",
                            message: "Invalid related file path",
                            relatedFilePaths: ["   "],
                        },
                    ],
                }),
            AST_CROSS_FILE_ISSUE_AGGREGATOR_ERROR_CODE.INVALID_RELATED_FILE_PATH,
        )

        await expectAstCrossFileIssueAggregatorErrorAsync(
            async () =>
                aggregator.aggregate({
                    files: createFiles(),
                    issues: [
                        {
                            source: AST_CROSS_FILE_ISSUE_SOURCE.CUSTOM,
                            severity: AST_CROSS_FILE_ISSUE_SEVERITY.LOW,
                            type: "CUSTOM",
                            filePath: "src/app.ts",
                            message: "Missing related file",
                            relatedFilePaths: ["src/missing.ts"],
                        },
                    ],
                }),
            AST_CROSS_FILE_ISSUE_AGGREGATOR_ERROR_CODE.RELATED_FILE_NOT_FOUND,
        )
    })
})
