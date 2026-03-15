import {describe, expect, test} from "bun:test"

import {
    AST_IMPORT_KIND,
    AST_LANGUAGE,
    type IAstImportDTO,
    type IAstSourceLocationDTO,
    type IParsedSourceFileDTO,
} from "@codenautic/core"

import {
    AST_MONOREPO_BOUNDARY_VIOLATION_SEVERITY,
    AST_MONOREPO_BOUNDARY_VIOLATION_TYPE,
    AST_MONOREPO_PACKAGE_BOUNDARY_CHECKER_ERROR_CODE,
    AstMonorepoPackageBoundaryCheckerError,
    AstMonorepoPackageBoundaryCheckerService,
} from "../../src/ast"

/**
 * Creates stable source location fixture.
 *
 * @returns Source location.
 */
function createLocation(): IAstSourceLocationDTO {
    return {
        lineStart: 1,
        lineEnd: 1,
        columnStart: 1,
        columnEnd: 1,
    }
}

/**
 * Creates import fixture.
 *
 * @param source Import source.
 * @returns Import DTO.
 */
function createImport(source: string): IAstImportDTO {
    return {
        source,
        kind: AST_IMPORT_KIND.STATIC,
        specifiers: [],
        typeOnly: false,
        location: createLocation(),
    }
}

/**
 * Creates parsed file fixture.
 *
 * @param filePath Repository-relative file path.
 * @param imports Optional file imports.
 * @returns Parsed source file DTO.
 */
function createParsedFile(
    filePath: string,
    imports: readonly IAstImportDTO[] = [],
): IParsedSourceFileDTO {
    return {
        filePath,
        language: AST_LANGUAGE.TYPESCRIPT,
        hasSyntaxErrors: false,
        imports: [...imports],
        typeAliases: [],
        interfaces: [],
        enums: [],
        classes: [],
        functions: [],
        calls: [],
    }
}

/**
 * Creates deterministic monorepo fixture set.
 *
 * @returns Parsed files.
 */
function createMonorepoFiles(): readonly IParsedSourceFileDTO[] {
    return [
        createParsedFile("packages/core/src/utils.ts"),
        createParsedFile("packages/core/src/self.ts", [
            createImport("@codenautic/core/utils"),
        ]),
        createParsedFile("packages/adapters/src/runtime.ts", [
            createImport("../../core/src/utils"),
        ]),
        createParsedFile("packages/adapters/src/service.ts", [
            createImport("@codenautic/core/utils"),
        ]),
        createParsedFile("packages/adapters/src/unknown.ts", [
            createImport("@codenautic/ghost/module"),
        ]),
    ]
}

/**
 * Asserts typed checker error shape for synchronous action.
 *
 * @param callback Action expected to throw.
 * @param code Expected typed error code.
 */
function expectAstMonorepoPackageBoundaryCheckerError(
    callback: () => unknown,
    code:
        (typeof AST_MONOREPO_PACKAGE_BOUNDARY_CHECKER_ERROR_CODE)[keyof typeof AST_MONOREPO_PACKAGE_BOUNDARY_CHECKER_ERROR_CODE],
): void {
    try {
        callback()
    } catch (error) {
        expect(error).toBeInstanceOf(AstMonorepoPackageBoundaryCheckerError)

        if (error instanceof AstMonorepoPackageBoundaryCheckerError) {
            expect(error.code).toBe(code)
            return
        }
    }

    throw new Error("Expected AstMonorepoPackageBoundaryCheckerError to be thrown")
}

/**
 * Asserts typed checker error shape for async action.
 *
 * @param callback Async action expected to reject.
 * @param code Expected typed error code.
 */
async function expectAstMonorepoPackageBoundaryCheckerErrorAsync(
    callback: () => Promise<unknown>,
    code:
        (typeof AST_MONOREPO_PACKAGE_BOUNDARY_CHECKER_ERROR_CODE)[keyof typeof AST_MONOREPO_PACKAGE_BOUNDARY_CHECKER_ERROR_CODE],
): Promise<void> {
    try {
        await callback()
    } catch (error) {
        expect(error).toBeInstanceOf(AstMonorepoPackageBoundaryCheckerError)

        if (error instanceof AstMonorepoPackageBoundaryCheckerError) {
            expect(error.code).toBe(code)
            return
        }
    }

    throw new Error("Expected AstMonorepoPackageBoundaryCheckerError to be thrown")
}

describe("AstMonorepoPackageBoundaryCheckerService", () => {
    test("detects relative and alias package boundary violations", async () => {
        const checker = new AstMonorepoPackageBoundaryCheckerService()
        const result = await checker.check({
            files: createMonorepoFiles(),
            packageDependencies: {
                adapters: [],
            },
        })

        expect(result.violations).toEqual([
            {
                id: "CROSS_PACKAGE_RELATIVE_IMPORT|packages/adapters/src/runtime.ts|../../core/src/utils|packages/core/src/utils.ts|core",
                type: AST_MONOREPO_BOUNDARY_VIOLATION_TYPE.CROSS_PACKAGE_RELATIVE_IMPORT,
                severity: AST_MONOREPO_BOUNDARY_VIOLATION_SEVERITY.HIGH,
                sourcePackage: "adapters",
                targetPackage: "core",
                sourceFilePath: "packages/adapters/src/runtime.ts",
                targetFilePath: "packages/core/src/utils.ts",
                importSource: "../../core/src/utils",
                reason: "Relative import crosses package boundary from adapters to core",
            },
            {
                id: "UNDECLARED_PACKAGE_DEPENDENCY|packages/adapters/src/service.ts|@codenautic/core/utils||core",
                type: AST_MONOREPO_BOUNDARY_VIOLATION_TYPE.UNDECLARED_PACKAGE_DEPENDENCY,
                severity: AST_MONOREPO_BOUNDARY_VIOLATION_SEVERITY.MEDIUM,
                sourcePackage: "adapters",
                targetPackage: "core",
                sourceFilePath: "packages/adapters/src/service.ts",
                importSource: "@codenautic/core/utils",
                reason: "Package adapters imports core without declared dependency",
            },
            {
                id: "UNKNOWN_PACKAGE_IMPORT|packages/adapters/src/unknown.ts|@codenautic/ghost/module||ghost",
                type: AST_MONOREPO_BOUNDARY_VIOLATION_TYPE.UNKNOWN_PACKAGE_IMPORT,
                severity: AST_MONOREPO_BOUNDARY_VIOLATION_SEVERITY.MEDIUM,
                sourcePackage: "adapters",
                targetPackage: "ghost",
                sourceFilePath: "packages/adapters/src/unknown.ts",
                importSource: "@codenautic/ghost/module",
                reason: "Alias import targets unknown monorepo package ghost",
            },
            {
                id: "SELF_PACKAGE_ALIAS_IMPORT|packages/core/src/self.ts|@codenautic/core/utils||core",
                type: AST_MONOREPO_BOUNDARY_VIOLATION_TYPE.SELF_PACKAGE_ALIAS_IMPORT,
                severity: AST_MONOREPO_BOUNDARY_VIOLATION_SEVERITY.LOW,
                sourcePackage: "core",
                targetPackage: "core",
                sourceFilePath: "packages/core/src/self.ts",
                importSource: "@codenautic/core/utils",
                reason: "Package core imports itself via alias instead of relative path",
            },
        ])
        expect(result.summary).toEqual({
            scannedFileCount: 5,
            packageCount: 2,
            violationCount: 4,
            highSeverityCount: 1,
            truncated: false,
            truncatedViolationCount: 0,
            byType: {
                CROSS_PACKAGE_RELATIVE_IMPORT: 1,
                UNDECLARED_PACKAGE_DEPENDENCY: 1,
                SELF_PACKAGE_ALIAS_IMPORT: 1,
                UNKNOWN_PACKAGE_IMPORT: 1,
            },
            bySeverity: {
                HIGH: 1,
                MEDIUM: 2,
                LOW: 1,
            },
        })
    })

    test("respects declared dependencies and file-path filter", async () => {
        const checker = new AstMonorepoPackageBoundaryCheckerService()
        const result = await checker.check({
            files: createMonorepoFiles(),
            filePaths: ["packages/adapters/src/service.ts"],
            packageDependencies: {
                adapters: ["core"],
            },
        })

        expect(result.violations).toEqual([])
        expect(result.summary.scannedFileCount).toBe(1)
        expect(result.summary.violationCount).toBe(0)
    })

    test("truncates violation output by maxViolations", async () => {
        const checker = new AstMonorepoPackageBoundaryCheckerService()
        const result = await checker.check({
            files: createMonorepoFiles(),
            packageDependencies: {
                adapters: [],
            },
            maxViolations: 2,
        })

        expect(result.violations).toHaveLength(2)
        expect(result.summary.truncated).toBe(true)
        expect(result.summary.truncatedViolationCount).toBe(2)
    })

    test("throws typed errors for invalid options", async () => {
        expectAstMonorepoPackageBoundaryCheckerError(
            () => {
                void new AstMonorepoPackageBoundaryCheckerService({
                    defaultMaxViolations: 0,
                })
            },
            AST_MONOREPO_PACKAGE_BOUNDARY_CHECKER_ERROR_CODE.INVALID_MAX_VIOLATIONS,
        )

        expectAstMonorepoPackageBoundaryCheckerError(
            () => {
                void new AstMonorepoPackageBoundaryCheckerService({
                    packageAliasPrefix: "   ",
                })
            },
            AST_MONOREPO_PACKAGE_BOUNDARY_CHECKER_ERROR_CODE.INVALID_PACKAGE_ALIAS_PREFIX,
        )

        const checker = new AstMonorepoPackageBoundaryCheckerService()

        await expectAstMonorepoPackageBoundaryCheckerErrorAsync(
            async () =>
                checker.check({
                    files: [],
                }),
            AST_MONOREPO_PACKAGE_BOUNDARY_CHECKER_ERROR_CODE.EMPTY_FILES,
        )

        await expectAstMonorepoPackageBoundaryCheckerErrorAsync(
            async () =>
                checker.check({
                    files: [
                        createParsedFile("packages/core/src/utils.ts"),
                        createParsedFile("packages/core/src/utils.ts"),
                    ],
                }),
            AST_MONOREPO_PACKAGE_BOUNDARY_CHECKER_ERROR_CODE.DUPLICATE_FILE_PATH,
        )

        await expectAstMonorepoPackageBoundaryCheckerErrorAsync(
            async () =>
                checker.check({
                    files: createMonorepoFiles(),
                    filePaths: [],
                }),
            AST_MONOREPO_PACKAGE_BOUNDARY_CHECKER_ERROR_CODE.EMPTY_FILE_PATHS,
        )

        await expectAstMonorepoPackageBoundaryCheckerErrorAsync(
            async () =>
                checker.check({
                    files: createMonorepoFiles(),
                    filePaths: ["   "],
                }),
            AST_MONOREPO_PACKAGE_BOUNDARY_CHECKER_ERROR_CODE.INVALID_FILE_PATH,
        )

        await expectAstMonorepoPackageBoundaryCheckerErrorAsync(
            async () =>
                checker.check({
                    files: createMonorepoFiles(),
                    maxViolations: 0,
                }),
            AST_MONOREPO_PACKAGE_BOUNDARY_CHECKER_ERROR_CODE.INVALID_MAX_VIOLATIONS,
        )

        await expectAstMonorepoPackageBoundaryCheckerErrorAsync(
            async () =>
                checker.check({
                    files: createMonorepoFiles(),
                    packageDependencies: {
                        "   ": ["core"],
                    },
                }),
            AST_MONOREPO_PACKAGE_BOUNDARY_CHECKER_ERROR_CODE.INVALID_PACKAGE_NAME,
        )

        await expectAstMonorepoPackageBoundaryCheckerErrorAsync(
            async () =>
                checker.check({
                    files: createMonorepoFiles(),
                    packageDependencies: {
                        adapters: ["core", "   "],
                    },
                }),
            AST_MONOREPO_PACKAGE_BOUNDARY_CHECKER_ERROR_CODE.INVALID_PACKAGE_NAME,
        )
    })
})
