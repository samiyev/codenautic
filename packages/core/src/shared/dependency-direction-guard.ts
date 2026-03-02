import {existsSync, readdirSync, readFileSync} from "node:fs"
import {dirname, extname, resolve} from "node:path"

import ts from "typescript"

/**
 * Architecture layers that participate in dependency direction checks.
 */
export const ARCHITECTURE_LAYER = {
    DOMAIN: "domain",
    APPLICATION: "application",
    INFRASTRUCTURE: "infrastructure",
} as const

/**
 * Known architecture layer identifier.
 */
export type ArchitectureLayer = (typeof ARCHITECTURE_LAYER)[keyof typeof ARCHITECTURE_LAYER]

/**
 * In-memory representation of a source file.
 */
export interface ISourceFileSnapshot {
    path: string
    content: string
}

/**
 * Dependency direction violation payload.
 */
export interface IDependencyDirectionViolation {
    sourceFile: string
    sourceLayer: ArchitectureLayer
    targetLayer: ArchitectureLayer
    importPath: string
}

/**
 * Additional resolution options for dependency direction validation.
 */
export interface IDependencyDirectionValidationOptions {
    readonly aliasDirectories?: Readonly<Record<string, string>>
}

const TYPE_SCRIPT_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts"])

const FORBIDDEN_TRANSITIONS: Record<ArchitectureLayer, readonly ArchitectureLayer[]> = {
    [ARCHITECTURE_LAYER.DOMAIN]: [
        ARCHITECTURE_LAYER.APPLICATION,
        ARCHITECTURE_LAYER.INFRASTRUCTURE,
    ],
    [ARCHITECTURE_LAYER.APPLICATION]: [ARCHITECTURE_LAYER.INFRASTRUCTURE],
    [ARCHITECTURE_LAYER.INFRASTRUCTURE]: [],
}

const DEFAULT_ALIAS_TARGETS = {
    "@codenautic/core": "packages/core/src",
    "@codenautic/adapters": "packages/adapters/src",
    "@codenautic/runtime": "packages/runtime/src",
    "@codenautic/ui": "packages/ui/src",
} as const

/**
 * Collects TypeScript files from a directory recursively.
 *
 * @param rootDirectory Absolute path to directory.
 * @returns Sorted list of source file snapshots.
 */
export function collectTypeScriptFiles(rootDirectory: string): readonly ISourceFileSnapshot[] {
    if (!existsSync(rootDirectory)) {
        return []
    }

    const snapshots: ISourceFileSnapshot[] = []
    const directoriesToVisit: string[] = [rootDirectory]

    while (directoriesToVisit.length > 0) {
        const currentDirectory = directoriesToVisit.pop()
        if (currentDirectory === undefined) {
            break
        }

        for (const entry of readdirSync(currentDirectory, {withFileTypes: true})) {
            const absolutePath = resolve(currentDirectory, entry.name)

            if (entry.isDirectory()) {
                directoriesToVisit.push(absolutePath)
                continue
            }

            if (!entry.isFile()) {
                continue
            }

            if (!isTypeScriptFile(absolutePath)) {
                continue
            }

            snapshots.push({
                path: absolutePath,
                content: readFileSync(absolutePath, "utf8"),
            })
        }
    }

    return snapshots.sort((left, right) => {
        return left.path.localeCompare(right.path)
    })
}

/**
 * Validates direction of imports between architecture layers.
 *
 * @param files Source file snapshots for validation.
 * @param options Optional alias directories for absolute import resolution.
 * @returns List of direction violations.
 */
export function validateDependencyDirection(
    files: readonly ISourceFileSnapshot[],
    options?: IDependencyDirectionValidationOptions,
): readonly IDependencyDirectionViolation[] {
    const violations: IDependencyDirectionViolation[] = []

    for (const file of files) {
        const sourceLayer = resolveLayer(file.path)
        if (sourceLayer === null) {
            continue
        }

        const aliasDirectories = buildAliasDirectories(file.path, options)
        const importSpecifiers = extractImportSpecifiersFromAst(file.content)

        for (const importPath of importSpecifiers) {
            const targetPath = resolveImportTargetPath(file.path, importPath, aliasDirectories)
            if (targetPath === null) {
                continue
            }

            const targetLayer = resolveLayer(targetPath)
            if (targetLayer === null) {
                continue
            }

            if (!FORBIDDEN_TRANSITIONS[sourceLayer].includes(targetLayer)) {
                continue
            }

            violations.push({
                sourceFile: file.path,
                sourceLayer,
                targetLayer,
                importPath,
            })
        }
    }

    return violations
}

/**
 * Detects whether file extension belongs to TypeScript family.
 *
 * @param filePath File path to check.
 * @returns True when extension is supported.
 */
function isTypeScriptFile(filePath: string): boolean {
    return TYPE_SCRIPT_EXTENSIONS.has(extname(filePath))
}

/**
 * Resolves architecture layer from file path.
 *
 * @param filePath Absolute or relative file path.
 * @returns Layer identifier or null when file is outside layered zones.
 */
function resolveLayer(filePath: string): ArchitectureLayer | null {
    const normalizedPath = filePath.replaceAll("\\", "/")
    const layerMatch = normalizedPath.match(/\/src\/(domain|application|infrastructure)(\/|$)/)

    if (layerMatch === null) {
        return null
    }
    return layerMatch[1] as ArchitectureLayer
}

/**
 * Extracts import specifiers from TypeScript source via AST.
 *
 * @param fileContent TypeScript source code.
 * @returns Import specifiers from static and dynamic imports.
 */
function extractImportSpecifiersFromAst(fileContent: string): readonly string[] {
    const sourceFile = ts.createSourceFile(
        "guard.ts",
        fileContent,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
    )

    const specifiers = new Set<string>()

    const visitNode = (node: ts.Node): void => {
        collectSpecifierFromImportDeclaration(node, specifiers)
        collectSpecifierFromExportDeclaration(node, specifiers)
        collectSpecifierFromImportCall(node, specifiers)
        collectSpecifierFromImportType(node, specifiers)
        collectSpecifierFromImportEquals(node, specifiers)
        ts.forEachChild(node, visitNode)
    }

    visitNode(sourceFile)
    return [...specifiers]
}

/**
 * Collects import specifier from `import` declaration.
 *
 * @param node AST node.
 * @param specifiers Mutable set of detected specifiers.
 */
function collectSpecifierFromImportDeclaration(node: ts.Node, specifiers: Set<string>): void {
    if (!ts.isImportDeclaration(node)) {
        return
    }
    const value = getStringLiteralText(node.moduleSpecifier)
    if (value !== null) {
        specifiers.add(value)
    }
}

/**
 * Collects import specifier from `export ... from` declaration.
 *
 * @param node AST node.
 * @param specifiers Mutable set of detected specifiers.
 */
function collectSpecifierFromExportDeclaration(node: ts.Node, specifiers: Set<string>): void {
    if (!ts.isExportDeclaration(node)) {
        return
    }
    if (node.moduleSpecifier === undefined) {
        return
    }
    const value = getStringLiteralText(node.moduleSpecifier)
    if (value !== null) {
        specifiers.add(value)
    }
}

/**
 * Collects import specifier from `import("...")` call.
 *
 * @param node AST node.
 * @param specifiers Mutable set of detected specifiers.
 */
function collectSpecifierFromImportCall(node: ts.Node, specifiers: Set<string>): void {
    if (!ts.isCallExpression(node)) {
        return
    }
    if (node.expression.kind !== ts.SyntaxKind.ImportKeyword) {
        return
    }
    const argument = node.arguments[0]
    if (argument === undefined) {
        return
    }
    if (!ts.isStringLiteralLike(argument)) {
        return
    }
    specifiers.add(argument.text)
}

/**
 * Collects import specifier from `import("...")` type expression.
 *
 * @param node AST node.
 * @param specifiers Mutable set of detected specifiers.
 */
function collectSpecifierFromImportType(node: ts.Node, specifiers: Set<string>): void {
    if (!ts.isImportTypeNode(node)) {
        return
    }
    if (!ts.isLiteralTypeNode(node.argument)) {
        return
    }
    const literal = node.argument.literal
    if (!ts.isStringLiteralLike(literal)) {
        return
    }
    specifiers.add(literal.text)
}

/**
 * Collects import specifier from `import x = require("...")` declaration.
 *
 * @param node AST node.
 * @param specifiers Mutable set of detected specifiers.
 */
function collectSpecifierFromImportEquals(node: ts.Node, specifiers: Set<string>): void {
    if (!ts.isImportEqualsDeclaration(node)) {
        return
    }
    if (!ts.isExternalModuleReference(node.moduleReference)) {
        return
    }
    const expression = node.moduleReference.expression
    if (expression !== undefined && ts.isStringLiteralLike(expression)) {
        specifiers.add(expression.text)
    }
}

/**
 * Gets text from StringLiteral-like module specifier.
 *
 * @param node Node with string literal content.
 * @returns Literal text or null.
 */
function getStringLiteralText(node: ts.Expression): string | null {
    if (!ts.isStringLiteralLike(node)) {
        return null
    }
    return node.text
}

/**
 * Builds alias resolution map using repository defaults and custom aliases.
 *
 * @param sourceFilePath Source file path used to infer repository root.
 * @param options Validation options.
 * @returns Alias to absolute directory mapping.
 */
function buildAliasDirectories(
    sourceFilePath: string,
    options?: IDependencyDirectionValidationOptions,
): Readonly<Record<string, string>> {
    const repositoryRoot = resolveRepositoryRoot(sourceFilePath)
    const defaults = repositoryRoot === null ? {} : buildDefaultAliasDirectories(repositoryRoot)
    return {
        ...defaults,
        ...(options?.aliasDirectories ?? {}),
    }
}

/**
 * Resolves repository root from any path inside `/packages/*`.
 *
 * @param filePath Source file path.
 * @returns Absolute repository root or null.
 */
function resolveRepositoryRoot(filePath: string): string | null {
    const normalizedPath = filePath.replaceAll("\\", "/")
    const marker = "/packages/"
    const markerIndex = normalizedPath.indexOf(marker)
    if (markerIndex === -1) {
        return null
    }
    return normalizedPath.slice(0, markerIndex)
}

/**
 * Builds default alias mapping for workspace packages.
 *
 * @param repositoryRoot Repository root path.
 * @returns Alias map with absolute target paths.
 */
function buildDefaultAliasDirectories(repositoryRoot: string): Readonly<Record<string, string>> {
    const aliases: Record<string, string> = {}

    for (const [alias, relativeTarget] of Object.entries(DEFAULT_ALIAS_TARGETS)) {
        aliases[alias] = resolve(repositoryRoot, relativeTarget)
    }

    return aliases
}

/**
 * Resolves import specifier to absolute path when it belongs to local layers.
 *
 * @param sourceFilePath Importing file path.
 * @param importPath Import specifier.
 * @param aliasDirectories Alias directories used for absolute imports.
 * @returns Absolute path for local import or null for external dependency.
 */
function resolveImportTargetPath(
    sourceFilePath: string,
    importPath: string,
    aliasDirectories: Readonly<Record<string, string>>,
): string | null {
    if (importPath.startsWith(".")) {
        return resolve(dirname(sourceFilePath), importPath)
    }

    if (importPath.startsWith("/")) {
        return resolve(importPath)
    }

    const aliasedPath = resolveAliasImportPath(importPath, aliasDirectories)
    if (aliasedPath !== null) {
        return aliasedPath
    }

    return null
}

/**
 * Resolves alias import to absolute path.
 *
 * @param importPath Import specifier.
 * @param aliasDirectories Alias to directory map.
 * @returns Absolute path for alias import or null.
 */
function resolveAliasImportPath(
    importPath: string,
    aliasDirectories: Readonly<Record<string, string>>,
): string | null {
    const aliases = Object.entries(aliasDirectories).sort((left, right) => {
        return right[0].length - left[0].length
    })

    for (const [aliasPrefix, absoluteDirectory] of aliases) {
        if (importPath === aliasPrefix) {
            return absoluteDirectory
        }
        const nestedPrefix = `${aliasPrefix}/`
        if (!importPath.startsWith(nestedPrefix)) {
            continue
        }
        const suffix = importPath.slice(nestedPrefix.length)
        return resolve(absoluteDirectory, suffix)
    }

    return null
}
