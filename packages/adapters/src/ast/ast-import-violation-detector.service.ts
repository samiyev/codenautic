import {FilePath} from "@codenautic/core"

import {
    AST_IMPORT_VIOLATION_DETECTOR_ERROR_CODE,
    AstImportViolationDetectorError,
} from "./ast-import-violation-detector.error"
import type {IAstBlueprintDefinition} from "./ast-blueprint-parser.service"

const DEFAULT_MAX_LOAD_ATTEMPTS = 2
const DEFAULT_RETRY_BACKOFF_MS = 15
const DEFAULT_CACHE_TTL_MS = 15000

/**
 * Violation kind for layer import policy checks.
 */
export const AST_IMPORT_VIOLATION_KIND = {
    EXPLICIT_FORBID: "EXPLICIT_FORBID",
    LAYER_POLICY: "LAYER_POLICY",
} as const

/**
 * Import violation kind literal.
 */
export type AstImportViolationKind =
    (typeof AST_IMPORT_VIOLATION_KIND)[keyof typeof AST_IMPORT_VIOLATION_KIND]

interface INormalizedDetectorInput {
    readonly blueprint: IAstBlueprintDefinition
    readonly imports: readonly IAstImportEdgeInput[]
    readonly filePaths?: readonly string[]
}

interface IDetectorResultCacheEntry {
    readonly expiresAt: number
    readonly value: IAstImportViolationDetectorResult
}

interface ILoadedImportsCacheEntry {
    readonly expiresAt: number
    readonly value: readonly IAstImportEdgeInput[]
}

/**
 * One import edge payload for violation checks.
 */
export interface IAstImportEdgeInput {
    /**
     * Source file path.
     */
    readonly sourcePath: string

    /**
     * Source layer.
     */
    readonly sourceLayer: string

    /**
     * Target file path.
     */
    readonly targetPath: string

    /**
     * Target layer.
     */
    readonly targetLayer: string
}

/**
 * One import violation entry.
 */
export interface IAstImportViolation {
    /**
     * Source file path.
     */
    readonly sourcePath: string

    /**
     * Source layer.
     */
    readonly sourceLayer: string

    /**
     * Target file path.
     */
    readonly targetPath: string

    /**
     * Target layer.
     */
    readonly targetLayer: string

    /**
     * Violation classification.
     */
    readonly kind: AstImportViolationKind

    /**
     * Stable human-readable reason.
     */
    readonly reason: string
}

/**
 * Summary payload for import violation detection.
 */
export interface IAstImportViolationDetectorSummary {
    /**
     * Total number of checked imports after optional filter.
     */
    readonly checkedImportCount: number

    /**
     * Number of violating imports.
     */
    readonly violationCount: number

    /**
     * Number of compliant imports.
     */
    readonly compliantImportCount: number

    /**
     * Number of explicit-forbid violations.
     */
    readonly explicitForbidViolationCount: number

    /**
     * Number of allow-list layer policy violations.
     */
    readonly layerPolicyViolationCount: number

    /**
     * ISO timestamp when detection was generated.
     */
    readonly generatedAt: string
}

/**
 * Import violation detector output payload.
 */
export interface IAstImportViolationDetectorResult {
    /**
     * Violation list sorted deterministically.
     */
    readonly violations: readonly IAstImportViolation[]

    /**
     * Detection summary.
     */
    readonly summary: IAstImportViolationDetectorSummary
}

/**
 * Load callback for import edges.
 */
export type AstImportViolationDetectorLoadImports = (
    filePaths?: readonly string[],
) => Promise<readonly IAstImportEdgeInput[]>

/**
 * Deterministic clock callback.
 */
export type AstImportViolationDetectorNow = () => number

/**
 * Sleep callback used by retry logic.
 */
export type AstImportViolationDetectorSleep = (milliseconds: number) => Promise<void>

/**
 * Input payload for import violation detector.
 */
export interface IAstImportViolationDetectorInput {
    /**
     * Parsed blueprint definition.
     */
    readonly blueprint: IAstBlueprintDefinition

    /**
     * Optional explicit import edges payload.
     */
    readonly imports?: readonly IAstImportEdgeInput[]

    /**
     * Optional repository file path filter.
     */
    readonly filePaths?: readonly string[]
}

/**
 * Runtime options for import violation detector.
 */
export interface IAstImportViolationDetectorServiceOptions {
    /**
     * Optional import loader callback.
     */
    readonly loadImports?: AstImportViolationDetectorLoadImports

    /**
     * Optional max attempts for import loading.
     */
    readonly maxLoadAttempts?: number

    /**
     * Optional retry backoff in milliseconds.
     */
    readonly retryBackoffMs?: number

    /**
     * Optional TTL for idempotency cache.
     */
    readonly cacheTtlMs?: number

    /**
     * Optional deterministic clock callback.
     */
    readonly now?: AstImportViolationDetectorNow

    /**
     * Optional sleep callback for retry backoff.
     */
    readonly sleep?: AstImportViolationDetectorSleep
}

/**
 * Import violation detector contract.
 */
export interface IAstImportViolationDetectorService {
    /**
     * Detects architecture import violations from blueprint policy.
     *
     * @param input Detection input payload.
     * @returns Detection result.
     */
    detect(input: IAstImportViolationDetectorInput): Promise<IAstImportViolationDetectorResult>
}

/**
 * Detects import violations using layer allow-lists and explicit blueprint rules.
 */
export class AstImportViolationDetectorService implements IAstImportViolationDetectorService {
    private readonly loadImports?: AstImportViolationDetectorLoadImports
    private readonly maxLoadAttempts: number
    private readonly retryBackoffMs: number
    private readonly cacheTtlMs: number
    private readonly now: AstImportViolationDetectorNow
    private readonly sleep: AstImportViolationDetectorSleep
    private readonly inFlight = new Map<string, Promise<IAstImportViolationDetectorResult>>()
    private readonly cache = new Map<string, IDetectorResultCacheEntry>()
    private readonly loadedImportsInFlight = new Map<string, Promise<readonly IAstImportEdgeInput[]>>()
    private readonly loadedImportsCache = new Map<string, ILoadedImportsCacheEntry>()

    /**
     * Creates AST import violation detector service.
     *
     * @param options Optional runtime overrides.
     */
    public constructor(options: IAstImportViolationDetectorServiceOptions = {}) {
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
     * Detects architecture import violations from blueprint policy.
     *
     * @param input Detection input payload.
     * @returns Detection result.
     */
    public async detect(
        input: IAstImportViolationDetectorInput,
    ): Promise<IAstImportViolationDetectorResult> {
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

        const operation = Promise.resolve(this.detectFresh(normalizedInput, requestKey))
        this.inFlight.set(requestKey, operation)

        try {
            return await operation
        } finally {
            this.inFlight.delete(requestKey)
        }
    }

    /**
     * Resolves and normalizes detection input.
     *
     * @param input Raw detection input.
     * @returns Normalized detection input.
     */
    private async normalizeInput(
        input: IAstImportViolationDetectorInput,
    ): Promise<INormalizedDetectorInput> {
        const blueprint = normalizeBlueprint(input.blueprint)
        const filePaths = normalizeOptionalFilePaths(input.filePaths)

        if (input.imports !== undefined) {
            const imports = normalizeImports(input.imports, blueprint)
            return {
                blueprint,
                imports,
                filePaths,
            }
        }

        const loadedImports = await this.loadImportsWithRetry(filePaths)
        const imports = normalizeImports(loadedImports, blueprint)

        return {
            blueprint,
            imports,
            filePaths,
        }
    }

    /**
     * Runs fresh violation detection and caches result.
     *
     * @param input Normalized detection input.
     * @param requestKey Stable request key.
     * @returns Detection result.
     */
    private detectFresh(
        input: INormalizedDetectorInput,
        requestKey: string,
    ): IAstImportViolationDetectorResult {
        const filteredImports = filterImportsByFilePaths(input.imports, input.filePaths)
        if (filteredImports.length === 0) {
            throw new AstImportViolationDetectorError(
                AST_IMPORT_VIOLATION_DETECTOR_ERROR_CODE.EMPTY_IMPORTS,
            )
        }

        const allowByLayer = createAllowByLayer(input.blueprint)
        const ruleModeByPair = createRuleModeByPair(input.blueprint)
        const violations = detectViolations(filteredImports, allowByLayer, ruleModeByPair)

        const explicitForbidViolationCount = violations.filter(
            (violation) => violation.kind === AST_IMPORT_VIOLATION_KIND.EXPLICIT_FORBID,
        ).length
        const layerPolicyViolationCount = violations.length - explicitForbidViolationCount
        const result: IAstImportViolationDetectorResult = {
            violations,
            summary: {
                checkedImportCount: filteredImports.length,
                violationCount: violations.length,
                compliantImportCount: filteredImports.length - violations.length,
                explicitForbidViolationCount,
                layerPolicyViolationCount,
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
     * Loads import edges with bounded retry/backoff.
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
     * Loads import edges with bounded retry/backoff and stores cache entry.
     *
     * @param filePaths Optional file path filter.
     * @param cacheKey Stable loaded-imports cache key.
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
                const loadedImports = await loader(filePaths)
                const clonedLoadedImports = cloneImportEdges(loadedImports)

                this.loadedImportsCache.set(cacheKey, {
                    value: clonedLoadedImports,
                    expiresAt: this.now() + this.cacheTtlMs,
                })

                return cloneImportEdges(clonedLoadedImports)
            } catch (error) {
                lastCauseMessage = error instanceof Error ? error.message : String(error)

                if (attempt >= this.maxLoadAttempts) {
                    throw new AstImportViolationDetectorError(
                        AST_IMPORT_VIOLATION_DETECTOR_ERROR_CODE.RETRY_EXHAUSTED,
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

        throw new AstImportViolationDetectorError(
            AST_IMPORT_VIOLATION_DETECTOR_ERROR_CODE.LOAD_IMPORTS_FAILED,
            {
                causeMessage: lastCauseMessage,
            },
        )
    }

    /**
     * Removes expired entries from detector cache.
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
     * Removes expired entries from loaded-import cache.
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

/**
 * Creates deterministic allow-list map from blueprint layers.
 *
 * @param blueprint Parsed blueprint definition.
 * @returns Layer allow-list map.
 */
function createAllowByLayer(blueprint: IAstBlueprintDefinition): ReadonlyMap<string, ReadonlySet<string>> {
    const allowByLayer = new Map<string, ReadonlySet<string>>()
    for (const layer of blueprint.layers) {
        allowByLayer.set(layer.name, new Set<string>(layer.allow))
    }

    return allowByLayer
}

/**
 * Creates deterministic rule-mode map from blueprint rules.
 *
 * For conflicting rules on same source/target pair, `forbid` wins over `allow`.
 *
 * @param blueprint Parsed blueprint definition.
 * @returns Rule mode map keyed by `source|target`.
 */
function createRuleModeByPair(blueprint: IAstBlueprintDefinition): ReadonlyMap<string, "allow" | "forbid"> {
    const ruleModeByPair = new Map<string, "allow" | "forbid">()

    for (const rule of blueprint.rules) {
        const key = `${rule.source}|${rule.target}`
        const existing = ruleModeByPair.get(key)

        if (existing === "forbid") {
            continue
        }

        if (rule.mode === "forbid") {
            ruleModeByPair.set(key, "forbid")
            continue
        }

        if (existing === undefined) {
            ruleModeByPair.set(key, "allow")
        }
    }

    return ruleModeByPair
}

/**
 * Detects policy violations for normalized import edges.
 *
 * @param imports Import edge list.
 * @param allowByLayer Layer allow-list map.
 * @param ruleModeByPair Explicit rule mode map.
 * @returns Deterministic violation list.
 */
function detectViolations(
    imports: readonly IAstImportEdgeInput[],
    allowByLayer: ReadonlyMap<string, ReadonlySet<string>>,
    ruleModeByPair: ReadonlyMap<string, "allow" | "forbid">,
): readonly IAstImportViolation[] {
    const sortedImports = [...imports].sort((left, right) => compareImportEdge(left, right))
    const violations: IAstImportViolation[] = []

    for (const importEdge of sortedImports) {
        const pairKey = `${importEdge.sourceLayer}|${importEdge.targetLayer}`
        const ruleMode = ruleModeByPair.get(pairKey)
        if (ruleMode === "forbid") {
            violations.push({
                sourcePath: importEdge.sourcePath,
                sourceLayer: importEdge.sourceLayer,
                targetPath: importEdge.targetPath,
                targetLayer: importEdge.targetLayer,
                kind: AST_IMPORT_VIOLATION_KIND.EXPLICIT_FORBID,
                reason: "Explicit forbid rule blocks this layer dependency",
            })
            continue
        }

        if (ruleMode === "allow") {
            continue
        }

        const allowedTargets = allowByLayer.get(importEdge.sourceLayer)
        const isAllowedByLayerPolicy =
            allowedTargets !== undefined && allowedTargets.has(importEdge.targetLayer)
        if (isAllowedByLayerPolicy === false) {
            violations.push({
                sourcePath: importEdge.sourcePath,
                sourceLayer: importEdge.sourceLayer,
                targetPath: importEdge.targetPath,
                targetLayer: importEdge.targetLayer,
                kind: AST_IMPORT_VIOLATION_KIND.LAYER_POLICY,
                reason: "Target layer is not allowed by source layer policy",
            })
        }
    }

    return violations
}

/**
 * Filters imports by optional file path batch filter.
 *
 * @param imports Import edge list.
 * @param filePaths Optional file path filter.
 * @returns Filtered import list.
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
 * Normalizes optional file path batch filter.
 *
 * @param filePaths Optional file path batch filter.
 * @returns Normalized file path batch filter.
 */
function normalizeOptionalFilePaths(filePaths: readonly string[] | undefined): readonly string[] | undefined {
    if (filePaths === undefined) {
        return undefined
    }

    if (filePaths.length === 0) {
        throw new AstImportViolationDetectorError(
            AST_IMPORT_VIOLATION_DETECTOR_ERROR_CODE.EMPTY_FILE_PATHS,
        )
    }

    const normalizedFilePaths: string[] = []
    for (const filePath of filePaths) {
        normalizedFilePaths.push(normalizeFilePath(filePath))
    }

    return Array.from(new Set<string>(normalizedFilePaths)).sort((left, right) =>
        left.localeCompare(right),
    )
}

/**
 * Normalizes and validates import edges list.
 *
 * @param imports Raw import edges payload.
 * @param blueprint Parsed blueprint definition.
 * @returns Normalized import edges.
 */
function normalizeImports(
    imports: readonly IAstImportEdgeInput[],
    blueprint: IAstBlueprintDefinition,
): readonly IAstImportEdgeInput[] {
    if (imports.length === 0) {
        throw new AstImportViolationDetectorError(
            AST_IMPORT_VIOLATION_DETECTOR_ERROR_CODE.EMPTY_IMPORTS,
        )
    }

    const knownLayerNames = new Set<string>(blueprint.layers.map((layer) => layer.name))
    const normalizedImports: IAstImportEdgeInput[] = []
    for (const importEdge of imports) {
        normalizedImports.push(normalizeImportEdge(importEdge, knownLayerNames))
    }

    return normalizedImports
}

/**
 * Normalizes single import edge payload.
 *
 * @param importEdge Raw import edge.
 * @param knownLayerNames Known layer name set.
 * @returns Normalized import edge.
 */
function normalizeImportEdge(
    importEdge: IAstImportEdgeInput,
    knownLayerNames: ReadonlySet<string>,
): IAstImportEdgeInput {
    const sourcePath = normalizeFilePath(importEdge.sourcePath)
    const targetPath = normalizeFilePath(importEdge.targetPath)
    const sourceLayer = normalizeLayerName(importEdge.sourceLayer)
    const targetLayer = normalizeLayerName(importEdge.targetLayer)

    if (knownLayerNames.has(sourceLayer) === false) {
        throw new AstImportViolationDetectorError(
            AST_IMPORT_VIOLATION_DETECTOR_ERROR_CODE.UNKNOWN_LAYER_REFERENCE,
            {
                layerName: sourceLayer,
                sourcePath,
            },
        )
    }

    if (knownLayerNames.has(targetLayer) === false) {
        throw new AstImportViolationDetectorError(
            AST_IMPORT_VIOLATION_DETECTOR_ERROR_CODE.UNKNOWN_LAYER_REFERENCE,
            {
                layerName: targetLayer,
                targetPath,
            },
        )
    }

    return {
        sourcePath,
        sourceLayer,
        targetPath,
        targetLayer,
    }
}

/**
 * Normalizes and validates blueprint definition contract.
 *
 * @param blueprint Raw blueprint definition.
 * @returns Normalized blueprint.
 */
function normalizeBlueprint(blueprint: IAstBlueprintDefinition): IAstBlueprintDefinition {
    if (isBlueprintDefinition(blueprint) === false) {
        throw new AstImportViolationDetectorError(
            AST_IMPORT_VIOLATION_DETECTOR_ERROR_CODE.INVALID_BLUEPRINT,
        )
    }

    return blueprint
}

/**
 * Creates stable request key for detector idempotency.
 *
 * @param input Normalized detector input.
 * @returns Stable request key.
 */
function createRequestKey(input: INormalizedDetectorInput): string {
    const payload = {
        blueprint: {
            version: input.blueprint.version,
            layers: input.blueprint.layers.map((layer) => ({
                name: layer.name,
                allow: [...layer.allow].sort((left, right) => left.localeCompare(right)),
            })),
            rules: input.blueprint.rules.map((rule) => ({
                source: rule.source,
                target: rule.target,
                mode: rule.mode,
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
 * Creates stable cache key for loaded imports.
 *
 * @param filePaths Optional file path filter.
 * @returns Stable load cache key.
 */
function createLoadImportsCacheKey(filePaths?: readonly string[]): string {
    if (filePaths === undefined) {
        return "*"
    }

    return filePaths.join("|")
}

/**
 * Creates deep clone of detection result.
 *
 * @param result Detection result payload.
 * @returns Cloned result.
 */
function cloneResult(result: IAstImportViolationDetectorResult): IAstImportViolationDetectorResult {
    return {
        violations: result.violations.map((violation): IAstImportViolation => ({
            sourcePath: violation.sourcePath,
            sourceLayer: violation.sourceLayer,
            targetPath: violation.targetPath,
            targetLayer: violation.targetLayer,
            kind: violation.kind,
            reason: violation.reason,
        })),
        summary: {
            checkedImportCount: result.summary.checkedImportCount,
            violationCount: result.summary.violationCount,
            compliantImportCount: result.summary.compliantImportCount,
            explicitForbidViolationCount: result.summary.explicitForbidViolationCount,
            layerPolicyViolationCount: result.summary.layerPolicyViolationCount,
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
 * @param loadImports Optional loadImports callback.
 * @returns Validated loadImports callback.
 */
function validateOptionalLoadImports(
    loadImports: AstImportViolationDetectorLoadImports | undefined,
): AstImportViolationDetectorLoadImports | undefined {
    if (loadImports !== undefined && typeof loadImports !== "function") {
        throw new AstImportViolationDetectorError(
            AST_IMPORT_VIOLATION_DETECTOR_ERROR_CODE.INVALID_LOAD_IMPORTS,
        )
    }

    return loadImports
}

/**
 * Ensures loadImports callback exists.
 *
 * @param loadImports Optional loadImports callback.
 * @returns loadImports callback.
 */
function ensureLoadImports(
    loadImports: AstImportViolationDetectorLoadImports | undefined,
): AstImportViolationDetectorLoadImports {
    if (loadImports === undefined) {
        throw new AstImportViolationDetectorError(
            AST_IMPORT_VIOLATION_DETECTOR_ERROR_CODE.INVALID_LOAD_IMPORTS,
        )
    }

    return loadImports
}

/**
 * Validates max load attempts option.
 *
 * @param maxLoadAttempts Raw max load attempts value.
 * @returns Validated max load attempts.
 */
function validateMaxLoadAttempts(maxLoadAttempts: number): number {
    if (Number.isInteger(maxLoadAttempts) === false || maxLoadAttempts <= 0) {
        throw new AstImportViolationDetectorError(
            AST_IMPORT_VIOLATION_DETECTOR_ERROR_CODE.INVALID_MAX_LOAD_ATTEMPTS,
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
 * @param retryBackoffMs Raw retry backoff value.
 * @returns Validated retry backoff.
 */
function validateRetryBackoffMs(retryBackoffMs: number): number {
    if (Number.isFinite(retryBackoffMs) === false || retryBackoffMs < 0) {
        throw new AstImportViolationDetectorError(
            AST_IMPORT_VIOLATION_DETECTOR_ERROR_CODE.INVALID_RETRY_BACKOFF_MS,
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
 * @param cacheTtlMs Raw cache TTL value.
 * @returns Validated cache TTL.
 */
function validateCacheTtlMs(cacheTtlMs: number): number {
    if (Number.isFinite(cacheTtlMs) === false || cacheTtlMs < 0) {
        throw new AstImportViolationDetectorError(
            AST_IMPORT_VIOLATION_DETECTOR_ERROR_CODE.INVALID_CACHE_TTL_MS,
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
function validateSleep(sleep: AstImportViolationDetectorSleep): AstImportViolationDetectorSleep {
    if (typeof sleep !== "function") {
        throw new AstImportViolationDetectorError(
            AST_IMPORT_VIOLATION_DETECTOR_ERROR_CODE.INVALID_SLEEP,
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
 * Normalizes and validates file path.
 *
 * @param filePath Raw file path.
 * @returns Normalized file path.
 */
function normalizeFilePath(filePath: string): string {
    if (typeof filePath !== "string") {
        throw new AstImportViolationDetectorError(
            AST_IMPORT_VIOLATION_DETECTOR_ERROR_CODE.INVALID_FILE_PATH,
            {
                sourcePath: String(filePath),
            },
        )
    }

    try {
        return FilePath.create(filePath).toString()
    } catch (error) {
        throw new AstImportViolationDetectorError(
            AST_IMPORT_VIOLATION_DETECTOR_ERROR_CODE.INVALID_IMPORT_PATH,
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
        throw new AstImportViolationDetectorError(
            AST_IMPORT_VIOLATION_DETECTOR_ERROR_CODE.INVALID_IMPORT_LAYER,
            {
                layerName: typeof layerName === "string" ? layerName : String(layerName),
            },
        )
    }

    return layerName.trim()
}

/**
 * Checks whether value matches blueprint definition shape used by detector.
 *
 * @param value Raw value.
 * @returns True when value is valid blueprint shape.
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
