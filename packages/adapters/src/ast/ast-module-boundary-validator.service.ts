import {FilePath} from "@codenautic/core"

import type {IAstBlueprintDefinition, IAstBlueprintModuleDefinition} from "./ast-blueprint-parser.service"
import type {IAstImportEdgeInput} from "./ast-import-violation-detector.service"
import {
    AST_MODULE_BOUNDARY_VALIDATOR_ERROR_CODE,
    AstModuleBoundaryValidatorError,
} from "./ast-module-boundary-validator.error"

const DEFAULT_MAX_LOAD_ATTEMPTS = 2
const DEFAULT_RETRY_BACKOFF_MS = 15
const DEFAULT_CACHE_TTL_MS = 15000

/**
 * Violation kind for module boundary validator.
 */
export const AST_MODULE_BOUNDARY_VIOLATION_KIND = {
    CROSS_BOUNDARY_INTERNAL_IMPORT: "CROSS_BOUNDARY_INTERNAL_IMPORT",
} as const

/**
 * Module boundary violation kind literal.
 */
export type AstModuleBoundaryViolationKind =
    (typeof AST_MODULE_BOUNDARY_VIOLATION_KIND)[keyof typeof AST_MODULE_BOUNDARY_VIOLATION_KIND]

interface INormalizedValidatorInput {
    readonly blueprint: IAstBlueprintDefinition
    readonly imports: readonly IAstImportEdgeInput[]
    readonly filePaths?: readonly string[]
}

interface IModuleMatcher {
    readonly name: string
    readonly layer: string
    readonly patterns: readonly string[]
}

interface IValidatorResultCacheEntry {
    readonly expiresAt: number
    readonly value: IAstModuleBoundaryValidatorResult
}

interface ILoadedImportsCacheEntry {
    readonly expiresAt: number
    readonly value: readonly IAstImportEdgeInput[]
}

/**
 * One module boundary violation entry.
 */
export interface IAstModuleBoundaryViolation {
    /**
     * Source file path.
     */
    readonly sourcePath: string

    /**
     * Target file path.
     */
    readonly targetPath: string

    /**
     * Source module identifier.
     */
    readonly sourceModule: string

    /**
     * Target module identifier.
     */
    readonly targetModule: string

    /**
     * Source layer.
     */
    readonly sourceLayer: string

    /**
     * Target layer.
     */
    readonly targetLayer: string

    /**
     * Violation kind.
     */
    readonly kind: AstModuleBoundaryViolationKind

    /**
     * Stable human-readable reason.
     */
    readonly reason: string
}

/**
 * Summary payload for module boundary validation.
 */
export interface IAstModuleBoundaryValidatorSummary {
    /**
     * Number of imports checked after optional filePath filter.
     */
    readonly checkedImportCount: number

    /**
     * Number of imports skipped because module mapping was missing.
     */
    readonly skippedImportCount: number

    /**
     * Number of violating imports.
     */
    readonly violationCount: number

    /**
     * Number of compliant imports among mapped imports.
     */
    readonly compliantImportCount: number

    /**
     * Number of unique source modules participating in violations.
     */
    readonly uniqueSourceModuleViolationCount: number

    /**
     * Number of unique target modules participating in violations.
     */
    readonly uniqueTargetModuleViolationCount: number

    /**
     * ISO timestamp when validation was generated.
     */
    readonly generatedAt: string
}

/**
 * Module boundary validator output payload.
 */
export interface IAstModuleBoundaryValidatorResult {
    /**
     * Deterministic module boundary violations.
     */
    readonly violations: readonly IAstModuleBoundaryViolation[]

    /**
     * Validation summary.
     */
    readonly summary: IAstModuleBoundaryValidatorSummary
}

/**
 * Load callback for import edges.
 */
export type AstModuleBoundaryValidatorLoadImports = (
    filePaths?: readonly string[],
) => Promise<readonly IAstImportEdgeInput[]>

/**
 * Deterministic clock callback.
 */
export type AstModuleBoundaryValidatorNow = () => number

/**
 * Sleep callback used by retry logic.
 */
export type AstModuleBoundaryValidatorSleep = (milliseconds: number) => Promise<void>

/**
 * Input payload for module boundary validator.
 */
export interface IAstModuleBoundaryValidatorInput {
    /**
     * Parsed blueprint definition with modules section.
     */
    readonly blueprint: IAstBlueprintDefinition

    /**
     * Optional explicit import edges payload.
     */
    readonly imports?: readonly IAstImportEdgeInput[]

    /**
     * Optional source/target file path filter.
     */
    readonly filePaths?: readonly string[]
}

/**
 * Runtime options for module boundary validator.
 */
export interface IAstModuleBoundaryValidatorServiceOptions {
    /**
     * Optional import loader callback.
     */
    readonly loadImports?: AstModuleBoundaryValidatorLoadImports

    /**
     * Optional max load attempts.
     */
    readonly maxLoadAttempts?: number

    /**
     * Optional retry backoff in milliseconds.
     */
    readonly retryBackoffMs?: number

    /**
     * Optional TTL for cache entries.
     */
    readonly cacheTtlMs?: number

    /**
     * Optional deterministic clock callback.
     */
    readonly now?: AstModuleBoundaryValidatorNow

    /**
     * Optional sleep callback for retry backoff.
     */
    readonly sleep?: AstModuleBoundaryValidatorSleep
}

/**
 * Module boundary validator contract.
 */
export interface IAstModuleBoundaryValidatorService {
    /**
     * Validates module boundaries against import edges.
     *
     * @param input Module boundary validator input.
     * @returns Module boundary validation result.
     */
    validate(input: IAstModuleBoundaryValidatorInput): Promise<IAstModuleBoundaryValidatorResult>
}

/**
 * Validates that imports do not cross module boundaries for internal files.
 */
export class AstModuleBoundaryValidatorService implements IAstModuleBoundaryValidatorService {
    private readonly loadImports?: AstModuleBoundaryValidatorLoadImports
    private readonly maxLoadAttempts: number
    private readonly retryBackoffMs: number
    private readonly cacheTtlMs: number
    private readonly now: AstModuleBoundaryValidatorNow
    private readonly sleep: AstModuleBoundaryValidatorSleep
    private readonly inFlight = new Map<string, Promise<IAstModuleBoundaryValidatorResult>>()
    private readonly cache = new Map<string, IValidatorResultCacheEntry>()
    private readonly loadedImportsInFlight = new Map<string, Promise<readonly IAstImportEdgeInput[]>>()
    private readonly loadedImportsCache = new Map<string, ILoadedImportsCacheEntry>()

    /**
     * Creates AST module boundary validator service.
     *
     * @param options Optional runtime overrides.
     */
    public constructor(options: IAstModuleBoundaryValidatorServiceOptions = {}) {
        this.loadImports = validateOptionalLoadImports(options.loadImports)
        this.maxLoadAttempts = validateMaxLoadAttempts(
            options.maxLoadAttempts ?? DEFAULT_MAX_LOAD_ATTEMPTS,
        )
        this.retryBackoffMs = validateRetryBackoffMs(
            options.retryBackoffMs ?? DEFAULT_RETRY_BACKOFF_MS,
        )
        this.cacheTtlMs = validateCacheTtlMs(options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS)
        this.now = options.now ?? Date.now
        this.sleep = validateSleep(options.sleep ?? defaultSleep)
    }

    /**
     * Validates module boundaries against import edges.
     *
     * @param input Module boundary validator input.
     * @returns Module boundary validation result.
     */
    public async validate(
        input: IAstModuleBoundaryValidatorInput,
    ): Promise<IAstModuleBoundaryValidatorResult> {
        const normalizedInput = await this.normalizeInput(input)
        const requestKey = createRequestKey(normalizedInput)
        const now = this.now()
        this.pruneExpiredCache(now)
        this.pruneExpiredLoadedImportsCache(now)

        const cached = this.cache.get(requestKey)
        if (cached !== undefined && cached.expiresAt > now) {
            return cloneResult(cached.value)
        }

        const existingInFlight = this.inFlight.get(requestKey)
        if (existingInFlight !== undefined) {
            return existingInFlight
        }

        const operation = Promise.resolve(this.validateFresh(normalizedInput, requestKey))
        this.inFlight.set(requestKey, operation)

        try {
            return await operation
        } finally {
            this.inFlight.delete(requestKey)
        }
    }

    /**
     * Resolves and normalizes input payload.
     *
     * @param input Raw validator input.
     * @returns Normalized validator input.
     */
    private async normalizeInput(
        input: IAstModuleBoundaryValidatorInput,
    ): Promise<INormalizedValidatorInput> {
        const blueprint = normalizeBlueprint(input.blueprint)
        const filePaths = normalizeOptionalFilePaths(input.filePaths)

        if (input.imports !== undefined) {
            return {
                blueprint,
                imports: normalizeImports(input.imports),
                filePaths,
            }
        }

        const loadedImports = await this.loadImportsWithRetry(filePaths)

        return {
            blueprint,
            imports: normalizeImports(loadedImports),
            filePaths,
        }
    }

    /**
     * Runs fresh module boundary validation and stores cache entry.
     *
     * @param input Normalized validator input.
     * @param requestKey Stable request key.
     * @returns Module boundary validation result.
     */
    private validateFresh(
        input: INormalizedValidatorInput,
        requestKey: string,
    ): IAstModuleBoundaryValidatorResult {
        const moduleMatchers = buildModuleMatchers(input.blueprint.modules)
        const filteredImports = filterImportsByFilePaths(input.imports, input.filePaths)
        if (filteredImports.length === 0) {
            throw new AstModuleBoundaryValidatorError(
                AST_MODULE_BOUNDARY_VALIDATOR_ERROR_CODE.EMPTY_IMPORTS,
            )
        }

        const validation = detectBoundaryViolations(filteredImports, moduleMatchers)
        const result: IAstModuleBoundaryValidatorResult = {
            violations: validation.violations,
            summary: {
                checkedImportCount: filteredImports.length,
                skippedImportCount: validation.skippedImportCount,
                violationCount: validation.violations.length,
                compliantImportCount:
                    filteredImports.length - validation.skippedImportCount - validation.violations.length,
                uniqueSourceModuleViolationCount: validation.uniqueSourceModules.size,
                uniqueTargetModuleViolationCount: validation.uniqueTargetModules.size,
                generatedAt: new Date(this.now()).toISOString(),
            },
        }
        const cloned = cloneResult(result)

        this.cache.set(requestKey, {
            value: cloned,
            expiresAt: this.now() + this.cacheTtlMs,
        })

        return cloneResult(cloned)
    }

    /**
     * Loads import edges with bounded retry/backoff and idempotency cache.
     *
     * @param filePaths Optional file path filter.
     * @returns Loaded import edges.
     */
    private async loadImportsWithRetry(
        filePaths?: readonly string[],
    ): Promise<readonly IAstImportEdgeInput[]> {
        const cacheKey = createLoadImportsCacheKey(filePaths)
        const now = this.now()
        this.pruneExpiredLoadedImportsCache(now)

        const cached = this.loadedImportsCache.get(cacheKey)
        if (cached !== undefined && cached.expiresAt > now) {
            return cloneImportEdges(cached.value)
        }

        const existingInFlight = this.loadedImportsInFlight.get(cacheKey)
        if (existingInFlight !== undefined) {
            return existingInFlight
        }

        const operation = this.loadImportsWithRetryFresh(filePaths, cacheKey)
        this.loadedImportsInFlight.set(cacheKey, operation)

        try {
            return await operation
        } finally {
            this.loadedImportsInFlight.delete(cacheKey)
        }
    }

    /**
     * Loads import edges with retries and stores load-cache.
     *
     * @param filePaths Optional file path filter.
     * @param cacheKey Stable load-cache key.
     * @returns Loaded import edges.
     */
    private async loadImportsWithRetryFresh(
        filePaths: readonly string[] | undefined,
        cacheKey: string,
    ): Promise<readonly IAstImportEdgeInput[]> {
        const loader = ensureLoadImports(this.loadImports)
        let lastCauseMessage = "<unknown>"

        for (let attempt = 1; attempt <= this.maxLoadAttempts; attempt += 1) {
            try {
                const loaded = await loader(filePaths)
                const cloned = cloneImportEdges(loaded)

                this.loadedImportsCache.set(cacheKey, {
                    value: cloned,
                    expiresAt: this.now() + this.cacheTtlMs,
                })

                return cloneImportEdges(cloned)
            } catch (error) {
                lastCauseMessage = error instanceof Error ? error.message : String(error)
                if (attempt >= this.maxLoadAttempts) {
                    throw new AstModuleBoundaryValidatorError(
                        AST_MODULE_BOUNDARY_VALIDATOR_ERROR_CODE.RETRY_EXHAUSTED,
                        {
                            attempt,
                            maxLoadAttempts: this.maxLoadAttempts,
                            retryBackoffMs: this.retryBackoffMs,
                            causeMessage: lastCauseMessage,
                        },
                    )
                }

                if (this.retryBackoffMs > 0) {
                    await this.sleep(this.retryBackoffMs)
                }
            }
        }

        throw new AstModuleBoundaryValidatorError(
            AST_MODULE_BOUNDARY_VALIDATOR_ERROR_CODE.RETRY_EXHAUSTED,
            {
                maxLoadAttempts: this.maxLoadAttempts,
                retryBackoffMs: this.retryBackoffMs,
                causeMessage: lastCauseMessage,
            },
        )
    }

    /**
     * Removes expired entries from result cache.
     *
     * @param now Current timestamp.
     */
    private pruneExpiredCache(now: number): void {
        for (const [key, entry] of this.cache.entries()) {
            if (entry.expiresAt <= now) {
                this.cache.delete(key)
            }
        }
    }

    /**
     * Removes expired entries from loaded-imports cache.
     *
     * @param now Current timestamp.
     */
    private pruneExpiredLoadedImportsCache(now: number): void {
        for (const [key, entry] of this.loadedImportsCache.entries()) {
            if (entry.expiresAt <= now) {
                this.loadedImportsCache.delete(key)
            }
        }
    }
}

interface IBoundaryValidationAccumulator {
    readonly violations: IAstModuleBoundaryViolation[]
    readonly uniqueSourceModules: Set<string>
    readonly uniqueTargetModules: Set<string>
    skippedImportCount: number
}

/**
 * Detects module-boundary violations from import edges.
 *
 * @param imports Normalized import edges.
 * @param moduleMatchers Module matcher list.
 * @returns Deterministic validation accumulator.
 */
function detectBoundaryViolations(
    imports: readonly IAstImportEdgeInput[],
    moduleMatchers: readonly IModuleMatcher[],
): IBoundaryValidationAccumulator {
    const sortedImports = [...imports].sort(compareImportEdge)
    const accumulator: IBoundaryValidationAccumulator = {
        violations: [],
        uniqueSourceModules: new Set<string>(),
        uniqueTargetModules: new Set<string>(),
        skippedImportCount: 0,
    }

    for (const importEdge of sortedImports) {
        const sourceModule = resolveModuleForFilePath(importEdge.sourcePath, moduleMatchers, "source")
        const targetModule = resolveModuleForFilePath(importEdge.targetPath, moduleMatchers, "target")
        if (sourceModule === undefined || targetModule === undefined) {
            accumulator.skippedImportCount += 1
            continue
        }

        if (sourceModule.name === targetModule.name) {
            continue
        }

        accumulator.violations.push({
            sourcePath: importEdge.sourcePath,
            targetPath: importEdge.targetPath,
            sourceModule: sourceModule.name,
            targetModule: targetModule.name,
            sourceLayer: sourceModule.layer,
            targetLayer: targetModule.layer,
            kind: AST_MODULE_BOUNDARY_VIOLATION_KIND.CROSS_BOUNDARY_INTERNAL_IMPORT,
            reason: `Cross-module internal import from ${sourceModule.name} to ${targetModule.name}`,
        })
        accumulator.uniqueSourceModules.add(sourceModule.name)
        accumulator.uniqueTargetModules.add(targetModule.name)
    }

    return accumulator
}

/**
 * Builds module matchers from blueprint module definitions.
 *
 * @param modules Blueprint module definitions.
 * @returns Module matchers.
 */
function buildModuleMatchers(modules: readonly IAstBlueprintModuleDefinition[]): readonly IModuleMatcher[] {
    return modules
        .map((moduleDefinition): IModuleMatcher => ({
            name: moduleDefinition.name,
            layer: moduleDefinition.layer,
            patterns: moduleDefinition.paths,
        }))
        .sort((left, right) => left.name.localeCompare(right.name))
}

/**
 * Resolves module for file path using module patterns.
 *
 * @param filePath Repository file path.
 * @param moduleMatchers Module matcher list.
 * @param side Error metadata side marker.
 * @returns Matching module or undefined.
 */
function resolveModuleForFilePath(
    filePath: string,
    moduleMatchers: readonly IModuleMatcher[],
    side: "source" | "target",
): IModuleMatcher | undefined {
    const matches: IModuleMatcher[] = []
    for (const moduleMatcher of moduleMatchers) {
        if (moduleMatcher.patterns.some((pattern) => matchModulePattern(filePath, pattern))) {
            matches.push(moduleMatcher)
        }
    }

    if (matches.length <= 1) {
        return matches[0]
    }

    throw new AstModuleBoundaryValidatorError(
        AST_MODULE_BOUNDARY_VALIDATOR_ERROR_CODE.AMBIGUOUS_MODULE_MATCH,
        side === "source" ? {sourcePath: filePath} : {targetPath: filePath},
    )
}

/**
 * Matches file path against one module pattern.
 *
 * @param filePath Repository file path.
 * @param pattern Module pattern.
 * @returns True when file path matches module pattern.
 */
function matchModulePattern(filePath: string, pattern: string): boolean {
    const normalizedPattern = pattern.trim()
    const hasGlobOperators =
        normalizedPattern.includes("*") || normalizedPattern.includes("?")
    if (hasGlobOperators) {
        return FilePath.create(filePath).matchesGlob(normalizedPattern)
    }

    const normalizedFilePath = FilePath.create(filePath).toString()
    if (normalizedFilePath === normalizedPattern) {
        return true
    }

    return normalizedFilePath.startsWith(`${normalizedPattern}/`)
}

/**
 * Normalizes and validates blueprint definition for module boundaries.
 *
 * @param blueprint Raw blueprint definition.
 * @returns Validated blueprint definition.
 */
function normalizeBlueprint(blueprint: IAstBlueprintDefinition): IAstBlueprintDefinition {
    if (isBlueprintDefinition(blueprint) === false) {
        throw new AstModuleBoundaryValidatorError(
            AST_MODULE_BOUNDARY_VALIDATOR_ERROR_CODE.INVALID_BLUEPRINT,
        )
    }

    if (blueprint.modules.length === 0) {
        throw new AstModuleBoundaryValidatorError(
            AST_MODULE_BOUNDARY_VALIDATOR_ERROR_CODE.WITHOUT_MODULES,
        )
    }

    return blueprint
}

/**
 * Normalizes optional file path filter.
 *
 * @param filePaths Optional file path filter.
 * @returns Normalized file path filter.
 */
function normalizeOptionalFilePaths(filePaths: readonly string[] | undefined): readonly string[] | undefined {
    if (filePaths === undefined) {
        return undefined
    }

    if (filePaths.length === 0) {
        throw new AstModuleBoundaryValidatorError(
            AST_MODULE_BOUNDARY_VALIDATOR_ERROR_CODE.EMPTY_FILE_PATHS,
        )
    }

    const normalized: string[] = []
    for (const filePath of filePaths) {
        normalized.push(normalizeFilePath(filePath))
    }

    return Array.from(new Set<string>(normalized)).sort((left, right) => left.localeCompare(right))
}

/**
 * Normalizes and validates import list.
 *
 * @param imports Raw import list.
 * @returns Normalized import list.
 */
function normalizeImports(imports: readonly IAstImportEdgeInput[]): readonly IAstImportEdgeInput[] {
    if (imports.length === 0) {
        throw new AstModuleBoundaryValidatorError(
            AST_MODULE_BOUNDARY_VALIDATOR_ERROR_CODE.EMPTY_IMPORTS,
        )
    }

    const normalized: IAstImportEdgeInput[] = []
    for (const importEdge of imports) {
        normalized.push(normalizeImportEdge(importEdge))
    }

    return normalized
}

/**
 * Normalizes single import edge.
 *
 * @param importEdge Raw import edge.
 * @returns Normalized import edge.
 */
function normalizeImportEdge(importEdge: IAstImportEdgeInput): IAstImportEdgeInput {
    return {
        sourcePath: normalizeFilePath(importEdge.sourcePath),
        sourceLayer: normalizeLayerName(importEdge.sourceLayer),
        targetPath: normalizeFilePath(importEdge.targetPath),
        targetLayer: normalizeLayerName(importEdge.targetLayer),
    }
}

/**
 * Filters imports by optional file path list.
 *
 * @param imports Import list.
 * @param filePaths Optional file path filter.
 * @returns Filtered imports.
 */
function filterImportsByFilePaths(
    imports: readonly IAstImportEdgeInput[],
    filePaths?: readonly string[],
): readonly IAstImportEdgeInput[] {
    if (filePaths === undefined) {
        return imports
    }

    const filePathSet = new Set<string>(filePaths)
    return imports.filter(
        (importEdge) =>
            filePathSet.has(importEdge.sourcePath) || filePathSet.has(importEdge.targetPath),
    )
}

/**
 * Creates stable request key for idempotency.
 *
 * @param input Normalized validator input.
 * @returns Stable request key.
 */
function createRequestKey(input: INormalizedValidatorInput): string {
    const payload = {
        blueprint: {
            version: input.blueprint.version,
            modules: input.blueprint.modules.map((moduleDefinition) => ({
                name: moduleDefinition.name,
                layer: moduleDefinition.layer,
                paths: [...moduleDefinition.paths].sort((left, right) => left.localeCompare(right)),
            })),
        },
        imports: input.imports.map((importEdge) => ({
            sourcePath: importEdge.sourcePath,
            sourceLayer: importEdge.sourceLayer,
            targetPath: importEdge.targetPath,
            targetLayer: importEdge.targetLayer,
        })),
        filePaths: input.filePaths === undefined ? undefined : [...input.filePaths],
    }

    return JSON.stringify(payload)
}

/**
 * Creates stable load-cache key.
 *
 * @param filePaths Optional file path filter.
 * @returns Stable load-cache key.
 */
function createLoadImportsCacheKey(filePaths?: readonly string[]): string {
    if (filePaths === undefined) {
        return "*"
    }

    return filePaths.join("|")
}

/**
 * Creates deep clone of result payload.
 *
 * @param result Result payload.
 * @returns Cloned result payload.
 */
function cloneResult(result: IAstModuleBoundaryValidatorResult): IAstModuleBoundaryValidatorResult {
    return {
        violations: result.violations.map((violation): IAstModuleBoundaryViolation => ({
            sourcePath: violation.sourcePath,
            targetPath: violation.targetPath,
            sourceModule: violation.sourceModule,
            targetModule: violation.targetModule,
            sourceLayer: violation.sourceLayer,
            targetLayer: violation.targetLayer,
            kind: violation.kind,
            reason: violation.reason,
        })),
        summary: {
            checkedImportCount: result.summary.checkedImportCount,
            skippedImportCount: result.summary.skippedImportCount,
            violationCount: result.summary.violationCount,
            compliantImportCount: result.summary.compliantImportCount,
            uniqueSourceModuleViolationCount: result.summary.uniqueSourceModuleViolationCount,
            uniqueTargetModuleViolationCount: result.summary.uniqueTargetModuleViolationCount,
            generatedAt: result.summary.generatedAt,
        },
    }
}

/**
 * Creates deep clone for import edge list.
 *
 * @param imports Import edge list.
 * @returns Cloned import edge list.
 */
function cloneImportEdges(imports: readonly IAstImportEdgeInput[]): readonly IAstImportEdgeInput[] {
    return imports.map((importEdge): IAstImportEdgeInput => ({
        sourcePath: importEdge.sourcePath,
        sourceLayer: importEdge.sourceLayer,
        targetPath: importEdge.targetPath,
        targetLayer: importEdge.targetLayer,
    }))
}

/**
 * Compares import edges deterministically.
 *
 * @param left Left import edge.
 * @param right Right import edge.
 * @returns Compare result.
 */
function compareImportEdge(left: IAstImportEdgeInput, right: IAstImportEdgeInput): number {
    const sourcePathCompare = left.sourcePath.localeCompare(right.sourcePath)
    if (sourcePathCompare !== 0) {
        return sourcePathCompare
    }

    const targetPathCompare = left.targetPath.localeCompare(right.targetPath)
    if (targetPathCompare !== 0) {
        return targetPathCompare
    }

    const sourceLayerCompare = left.sourceLayer.localeCompare(right.sourceLayer)
    if (sourceLayerCompare !== 0) {
        return sourceLayerCompare
    }

    return left.targetLayer.localeCompare(right.targetLayer)
}

/**
 * Validates optional loadImports callback.
 *
 * @param loadImports Optional load callback.
 * @returns Validated load callback.
 */
function validateOptionalLoadImports(
    loadImports: AstModuleBoundaryValidatorLoadImports | undefined,
): AstModuleBoundaryValidatorLoadImports | undefined {
    if (loadImports !== undefined && typeof loadImports !== "function") {
        throw new AstModuleBoundaryValidatorError(
            AST_MODULE_BOUNDARY_VALIDATOR_ERROR_CODE.INVALID_LOAD_IMPORTS,
        )
    }

    return loadImports
}

/**
 * Ensures loadImports callback is available.
 *
 * @param loadImports Optional load callback.
 * @returns Load callback.
 */
function ensureLoadImports(
    loadImports: AstModuleBoundaryValidatorLoadImports | undefined,
): AstModuleBoundaryValidatorLoadImports {
    if (loadImports === undefined) {
        throw new AstModuleBoundaryValidatorError(
            AST_MODULE_BOUNDARY_VALIDATOR_ERROR_CODE.INVALID_LOAD_IMPORTS,
        )
    }

    return loadImports
}

/**
 * Validates max load attempts option.
 *
 * @param maxLoadAttempts Raw max load attempts.
 * @returns Validated max load attempts.
 */
function validateMaxLoadAttempts(maxLoadAttempts: number): number {
    if (Number.isInteger(maxLoadAttempts) === false || maxLoadAttempts <= 0) {
        throw new AstModuleBoundaryValidatorError(
            AST_MODULE_BOUNDARY_VALIDATOR_ERROR_CODE.INVALID_MAX_LOAD_ATTEMPTS,
            {
                maxLoadAttempts,
            },
        )
    }

    return maxLoadAttempts
}

/**
 * Validates retry backoff option.
 *
 * @param retryBackoffMs Raw retry backoff.
 * @returns Validated retry backoff.
 */
function validateRetryBackoffMs(retryBackoffMs: number): number {
    if (Number.isFinite(retryBackoffMs) === false || retryBackoffMs < 0) {
        throw new AstModuleBoundaryValidatorError(
            AST_MODULE_BOUNDARY_VALIDATOR_ERROR_CODE.INVALID_RETRY_BACKOFF_MS,
            {
                retryBackoffMs,
            },
        )
    }

    return retryBackoffMs
}

/**
 * Validates cache TTL option.
 *
 * @param cacheTtlMs Raw cache TTL.
 * @returns Validated cache TTL.
 */
function validateCacheTtlMs(cacheTtlMs: number): number {
    if (Number.isFinite(cacheTtlMs) === false || cacheTtlMs < 0) {
        throw new AstModuleBoundaryValidatorError(
            AST_MODULE_BOUNDARY_VALIDATOR_ERROR_CODE.INVALID_CACHE_TTL_MS,
            {
                cacheTtlMs,
            },
        )
    }

    return cacheTtlMs
}

/**
 * Validates sleep callback option.
 *
 * @param sleep Raw sleep callback.
 * @returns Validated sleep callback.
 */
function validateSleep(sleep: AstModuleBoundaryValidatorSleep): AstModuleBoundaryValidatorSleep {
    if (typeof sleep !== "function") {
        throw new AstModuleBoundaryValidatorError(
            AST_MODULE_BOUNDARY_VALIDATOR_ERROR_CODE.INVALID_SLEEP,
        )
    }

    return sleep
}

/**
 * Default sleep callback for retry backoff.
 *
 * @param milliseconds Sleep duration.
 * @returns Promise resolved after provided timeout.
 */
async function defaultSleep(milliseconds: number): Promise<void> {
    await new Promise<void>((resolve) => {
        setTimeout(resolve, milliseconds)
    })
}

/**
 * Normalizes file path and validates format.
 *
 * @param filePath Raw file path.
 * @returns Normalized file path.
 */
function normalizeFilePath(filePath: string): string {
    if (typeof filePath !== "string") {
        throw new AstModuleBoundaryValidatorError(
            AST_MODULE_BOUNDARY_VALIDATOR_ERROR_CODE.INVALID_FILE_PATH,
            {
                sourcePath: String(filePath),
            },
        )
    }

    try {
        return FilePath.create(filePath).toString()
    } catch (error) {
        throw new AstModuleBoundaryValidatorError(
            AST_MODULE_BOUNDARY_VALIDATOR_ERROR_CODE.INVALID_IMPORT_PATH,
            {
                sourcePath: filePath,
                causeMessage: error instanceof Error ? error.message : String(error),
            },
        )
    }
}

/**
 * Normalizes and validates layer name.
 *
 * @param layerName Raw layer name.
 * @returns Normalized layer name.
 */
function normalizeLayerName(layerName: string): string {
    if (typeof layerName !== "string" || layerName.trim().length === 0) {
        throw new AstModuleBoundaryValidatorError(
            AST_MODULE_BOUNDARY_VALIDATOR_ERROR_CODE.INVALID_IMPORT_LAYER,
            {
                layerName: typeof layerName === "string" ? layerName : String(layerName),
            },
        )
    }

    return layerName.trim()
}

/**
 * Checks whether value is compatible with blueprint shape needed by validator.
 *
 * @param value Raw value.
 * @returns True when value has expected blueprint shape.
 */
function isBlueprintDefinition(value: unknown): value is IAstBlueprintDefinition {
    if (typeof value !== "object" || value === null) {
        return false
    }

    const candidate = value as Partial<IAstBlueprintDefinition>
    return (
        typeof candidate.version === "number" &&
        Array.isArray(candidate.layers) &&
        Array.isArray(candidate.rules) &&
        Array.isArray(candidate.modules) &&
        typeof candidate.metadata === "object" &&
        candidate.metadata !== null
    )
}
