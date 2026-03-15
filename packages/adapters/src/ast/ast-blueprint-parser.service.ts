import {FilePath} from "@codenautic/core"

import {
    AST_BLUEPRINT_PARSER_ERROR_CODE,
    AstBlueprintParserError,
    type AstBlueprintParserErrorCode,
} from "./ast-blueprint-parser.error"

const DEFAULT_MAX_PARSE_ATTEMPTS = 2
const DEFAULT_RETRY_BACKOFF_MS = 15
const DEFAULT_CACHE_TTL_MS = 15000
const KNOWN_BLUEPRINT_KEYS = ["version", "layers", "rules", "modules"] as const

/**
 * Supported import rule modes for architecture blueprint.
 */
export const AST_BLUEPRINT_RULE_MODE = {
    ALLOW: "allow",
    FORBID: "forbid",
} as const

/**
 * Blueprint rule mode literal.
 */
export type AstBlueprintRuleMode =
    (typeof AST_BLUEPRINT_RULE_MODE)[keyof typeof AST_BLUEPRINT_RULE_MODE]

/**
 * Scalar metadata value supported by blueprint parser.
 */
export type AstBlueprintMetadataValue = string | number | boolean | null

interface INormalizedBlueprintParserInput {
    readonly blueprintYaml: string
    readonly sourcePath?: string
}

interface IBlueprintDefinitionCacheEntry {
    readonly expiresAt: number
    readonly value: IAstBlueprintDefinition
}

interface IBlueprintLayerDraft {
    readonly name: string
    readonly allow: readonly string[]
}

interface IBlueprintRuleDraft {
    readonly source: string
    readonly target: string
    readonly mode: AstBlueprintRuleMode
}

interface IBlueprintModuleDraft {
    readonly name: string
    readonly layer: string
    readonly paths: readonly string[]
}

/**
 * One layer definition from architecture blueprint.
 */
export interface IAstBlueprintLayerDefinition {
    /**
     * Layer identifier.
     */
    readonly name: string

    /**
     * Allowed dependency targets for this layer.
     */
    readonly allow: readonly string[]
}

/**
 * One import rule from architecture blueprint.
 */
export interface IAstBlueprintRuleDefinition {
    /**
     * Source layer.
     */
    readonly source: string

    /**
     * Target layer.
     */
    readonly target: string

    /**
     * Rule mode.
     */
    readonly mode: AstBlueprintRuleMode
}

/**
 * One module boundary definition from architecture blueprint.
 */
export interface IAstBlueprintModuleDefinition {
    /**
     * Module identifier.
     */
    readonly name: string

    /**
     * Parent layer for module.
     */
    readonly layer: string

    /**
     * Repository-relative paths belonging to module.
     */
    readonly paths: readonly string[]
}

/**
 * Parsed and validated architecture blueprint DTO.
 */
export interface IAstBlueprintDefinition {
    /**
     * Blueprint version.
     */
    readonly version: number

    /**
     * Normalized layer list.
     */
    readonly layers: readonly IAstBlueprintLayerDefinition[]

    /**
     * Normalized rule list.
     */
    readonly rules: readonly IAstBlueprintRuleDefinition[]

    /**
     * Normalized module list.
     */
    readonly modules: readonly IAstBlueprintModuleDefinition[]

    /**
     * Scalar metadata from blueprint root.
     */
    readonly metadata: Readonly<Record<string, AstBlueprintMetadataValue>>

    /**
     * Optional source path for blueprint.
     */
    readonly sourcePath?: string
}

/**
 * Input payload for architecture blueprint parser.
 */
export interface IAstBlueprintParserInput {
    /**
     * Raw YAML content.
     */
    readonly blueprintYaml: string

    /**
     * Optional source path for diagnostics.
     */
    readonly sourcePath?: string
}

/**
 * YAML parse callback for blueprint parser.
 */
export type AstBlueprintParserParseYaml = (blueprintYaml: string) => Promise<unknown>

/**
 * Deterministic clock callback.
 */
export type AstBlueprintParserNow = () => number

/**
 * Sleep callback used by retry logic.
 */
export type AstBlueprintParserSleep = (milliseconds: number) => Promise<void>

/**
 * Runtime options for blueprint parser service.
 */
export interface IAstBlueprintParserServiceOptions {
    /**
     * Optional YAML parse callback override.
     */
    readonly parseYaml?: AstBlueprintParserParseYaml

    /**
     * Optional max attempts for YAML parsing.
     */
    readonly maxParseAttempts?: number

    /**
     * Optional retry backoff in milliseconds.
     */
    readonly retryBackoffMs?: number

    /**
     * Optional TTL for parser cache.
     */
    readonly cacheTtlMs?: number

    /**
     * Optional deterministic clock callback.
     */
    readonly now?: AstBlueprintParserNow

    /**
     * Optional sleep callback for retry backoff.
     */
    readonly sleep?: AstBlueprintParserSleep
}

/**
 * Blueprint parser contract.
 */
export interface IAstBlueprintParserService {
    /**
     * Parses and validates architecture blueprint YAML.
     *
     * @param input Blueprint parser input payload.
     * @returns Parsed architecture blueprint DTO.
     */
    parse(input: IAstBlueprintParserInput): Promise<IAstBlueprintDefinition>
}

/**
 * Parses architecture blueprint YAML into deterministic validated DTO.
 */
export class AstBlueprintParserService implements IAstBlueprintParserService {
    private readonly parseYaml: AstBlueprintParserParseYaml
    private readonly maxParseAttempts: number
    private readonly retryBackoffMs: number
    private readonly cacheTtlMs: number
    private readonly now: AstBlueprintParserNow
    private readonly sleep: AstBlueprintParserSleep
    private readonly inFlight = new Map<string, Promise<IAstBlueprintDefinition>>()
    private readonly cache = new Map<string, IBlueprintDefinitionCacheEntry>()

    /**
     * Creates AST blueprint parser service.
     *
     * @param options Optional runtime overrides.
     */
    public constructor(options: IAstBlueprintParserServiceOptions = {}) {
        this.parseYaml = validateParseYaml(options.parseYaml ?? defaultParseYaml)
        this.maxParseAttempts = validateMaxParseAttempts(
            options.maxParseAttempts ?? DEFAULT_MAX_PARSE_ATTEMPTS,
        )
        this.retryBackoffMs = validateRetryBackoffMs(
            options.retryBackoffMs ?? DEFAULT_RETRY_BACKOFF_MS,
        )
        this.cacheTtlMs = validateCacheTtlMs(options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS)
        this.now = options.now ?? Date.now
        this.sleep = validateSleep(options.sleep ?? defaultSleep)
    }

    /**
     * Parses and validates architecture blueprint YAML.
     *
     * @param input Blueprint parser input payload.
     * @returns Parsed architecture blueprint DTO.
     */
    public async parse(input: IAstBlueprintParserInput): Promise<IAstBlueprintDefinition> {
        const normalizedInput = normalizeBlueprintParserInput(input)
        const requestKey = createRequestKey(normalizedInput)
        const now = this.now()
        this.pruneExpiredCache(now)

        const cached = this.cache.get(requestKey)
        if (cached !== undefined && cached.expiresAt > now) {
            return cloneBlueprintDefinition(cached.value)
        }

        const existingInFlight = this.inFlight.get(requestKey)
        if (existingInFlight !== undefined) {
            return existingInFlight
        }

        const operation = Promise.resolve(this.parseFresh(normalizedInput, requestKey))
        this.inFlight.set(requestKey, operation)

        try {
            return await operation
        } finally {
            this.inFlight.delete(requestKey)
        }
    }

    /**
     * Parses fresh blueprint result and stores idempotency cache.
     *
     * @param input Normalized parser input.
     * @param requestKey Stable request key.
     * @returns Parsed architecture blueprint DTO.
     */
    private async parseFresh(
        input: INormalizedBlueprintParserInput,
        requestKey: string,
    ): Promise<IAstBlueprintDefinition> {
        const parsedYaml = await this.parseYamlWithRetry(input.blueprintYaml, input.sourcePath)
        const definition = buildBlueprintDefinition(parsedYaml, input.sourcePath)
        const cloned = cloneBlueprintDefinition(definition)

        this.cache.set(requestKey, {
            value: cloned,
            expiresAt: this.now() + this.cacheTtlMs,
        })

        return cloneBlueprintDefinition(cloned)
    }

    /**
     * Parses YAML with bounded retry/backoff.
     *
     * @param blueprintYaml Raw YAML payload.
     * @param sourcePath Optional source path.
     * @returns Parsed raw object.
     */
    private async parseYamlWithRetry(blueprintYaml: string, sourcePath?: string): Promise<unknown> {
        let lastCauseMessage = "<unknown>"

        for (let attempt = 1; attempt <= this.maxParseAttempts; attempt += 1) {
            try {
                return await this.parseYaml(blueprintYaml)
            } catch (error) {
                lastCauseMessage = error instanceof Error ? error.message : String(error)

                if (attempt >= this.maxParseAttempts) {
                    throw new AstBlueprintParserError(
                        AST_BLUEPRINT_PARSER_ERROR_CODE.RETRY_EXHAUSTED,
                        {
                            attempt,
                            maxParseAttempts: this.maxParseAttempts,
                            retryBackoffMs: this.retryBackoffMs,
                            causeMessage: lastCauseMessage,
                            sourcePath,
                        },
                    )
                }

                if (this.retryBackoffMs > 0) {
                    await this.sleep(this.retryBackoffMs)
                }
            }
        }

        throw new AstBlueprintParserError(AST_BLUEPRINT_PARSER_ERROR_CODE.RETRY_EXHAUSTED, {
            maxParseAttempts: this.maxParseAttempts,
            retryBackoffMs: this.retryBackoffMs,
            causeMessage: lastCauseMessage,
            sourcePath,
        })
    }

    /**
     * Removes expired entries from parser cache.
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
}

/**
 * Parses architecture blueprint object and validates schema.
 *
 * @param rawBlueprint Raw parsed YAML object.
 * @param sourcePath Optional source path.
 * @returns Parsed architecture blueprint DTO.
 */
function buildBlueprintDefinition(rawBlueprint: unknown, sourcePath?: string): IAstBlueprintDefinition {
    const root = ensureBlueprintRoot(rawBlueprint)
    const version = parseBlueprintVersion(root)
    const layers = parseBlueprintLayers(root)
    validateLayerAllowReferences(layers)
    const rules = parseBlueprintRules(root, layers)
    const modules = parseBlueprintModules(root, layers)
    const metadata = parseBlueprintMetadata(root)

    return {
        version,
        layers,
        rules,
        modules,
        metadata,
        sourcePath,
    }
}

/**
 * Validates and normalizes blueprint parser input.
 *
 * @param input Raw parser input.
 * @returns Normalized parser input.
 */
function normalizeBlueprintParserInput(
    input: IAstBlueprintParserInput,
): INormalizedBlueprintParserInput {
    const blueprintYaml = normalizeBlueprintYaml(input.blueprintYaml)
    const sourcePath = normalizeOptionalSourcePath(input.sourcePath)

    return {
        blueprintYaml,
        sourcePath,
    }
}

/**
 * Normalizes blueprint YAML input.
 *
 * @param blueprintYaml Raw blueprint YAML payload.
 * @returns Normalized YAML payload.
 */
function normalizeBlueprintYaml(blueprintYaml: string): string {
    if (typeof blueprintYaml !== "string") {
        throw new AstBlueprintParserError(AST_BLUEPRINT_PARSER_ERROR_CODE.EMPTY_BLUEPRINT_YAML)
    }

    if (blueprintYaml.trim().length === 0) {
        throw new AstBlueprintParserError(AST_BLUEPRINT_PARSER_ERROR_CODE.EMPTY_BLUEPRINT_YAML)
    }

    return blueprintYaml
}

/**
 * Normalizes optional source path.
 *
 * @param sourcePath Optional source path.
 * @returns Normalized source path.
 */
function normalizeOptionalSourcePath(sourcePath: string | undefined): string | undefined {
    if (sourcePath === undefined) {
        return undefined
    }

    if (typeof sourcePath !== "string") {
        throw new AstBlueprintParserError(AST_BLUEPRINT_PARSER_ERROR_CODE.INVALID_SOURCE_PATH, {
            sourcePath: String(sourcePath),
        })
    }

    try {
        return FilePath.create(sourcePath).toString()
    } catch (error) {
        throw new AstBlueprintParserError(AST_BLUEPRINT_PARSER_ERROR_CODE.INVALID_SOURCE_PATH, {
            sourcePath,
            causeMessage: error instanceof Error ? error.message : String(error),
        })
    }
}

/**
 * Parses and validates blueprint root object.
 *
 * @param rawBlueprint Parsed YAML payload.
 * @returns Blueprint root record.
 */
function ensureBlueprintRoot(rawBlueprint: unknown): Readonly<Record<string, unknown>> {
    if (isRecord(rawBlueprint) === false) {
        throw new AstBlueprintParserError(AST_BLUEPRINT_PARSER_ERROR_CODE.INVALID_BLUEPRINT_ROOT)
    }

    return rawBlueprint
}

/**
 * Parses blueprint version.
 *
 * @param root Blueprint root record.
 * @returns Normalized blueprint version.
 */
function parseBlueprintVersion(root: Readonly<Record<string, unknown>>): number {
    const rawVersion = root["version"]
    if (typeof rawVersion !== "number" || Number.isInteger(rawVersion) === false || rawVersion <= 0) {
        throw new AstBlueprintParserError(AST_BLUEPRINT_PARSER_ERROR_CODE.INVALID_BLUEPRINT_VERSION)
    }

    return rawVersion
}

/**
 * Parses blueprint layers section.
 *
 * @param root Blueprint root record.
 * @returns Normalized layer list.
 */
function parseBlueprintLayers(
    root: Readonly<Record<string, unknown>>,
): readonly IAstBlueprintLayerDefinition[] {
    const rawLayers = root["layers"]
    if (Array.isArray(rawLayers) === false || rawLayers.length === 0) {
        throw new AstBlueprintParserError(AST_BLUEPRINT_PARSER_ERROR_CODE.INVALID_BLUEPRINT_LAYERS)
    }

    const seenLayerNames = new Set<string>()
    const parsedLayers = rawLayers.map((rawLayer): IBlueprintLayerDraft => {
        const layer = parseBlueprintLayer(rawLayer)
        if (seenLayerNames.has(layer.name)) {
            throw new AstBlueprintParserError(AST_BLUEPRINT_PARSER_ERROR_CODE.DUPLICATE_LAYER_NAME, {
                layerName: layer.name,
            })
        }

        seenLayerNames.add(layer.name)
        return layer
    })

    return parsedLayers
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((layer): IAstBlueprintLayerDefinition => ({
            name: layer.name,
            allow: [...layer.allow].sort((left, right) => left.localeCompare(right)),
        }))
}

/**
 * Parses single blueprint layer item.
 *
 * @param rawLayer Raw layer item.
 * @returns Parsed layer draft.
 */
function parseBlueprintLayer(rawLayer: unknown): IBlueprintLayerDraft {
    if (isRecord(rawLayer) === false) {
        throw new AstBlueprintParserError(AST_BLUEPRINT_PARSER_ERROR_CODE.INVALID_BLUEPRINT_LAYERS)
    }

    const name = normalizeNonEmptyString(
        rawLayer["name"],
        AST_BLUEPRINT_PARSER_ERROR_CODE.INVALID_LAYER_NAME,
        "layerName",
    )
    const allow = parseLayerAllow(rawLayer["allow"], name)

    return {
        name,
        allow,
    }
}

/**
 * Parses allow-list for blueprint layer.
 *
 * @param rawAllow Raw allow-list payload.
 * @param layerName Layer name for diagnostics.
 * @returns Normalized allow-list.
 */
function parseLayerAllow(rawAllow: unknown, layerName: string): readonly string[] {
    if (rawAllow === undefined) {
        return []
    }

    if (Array.isArray(rawAllow) === false) {
        throw new AstBlueprintParserError(AST_BLUEPRINT_PARSER_ERROR_CODE.INVALID_LAYER_ALLOW, {
            layerName,
        })
    }

    const seenAllowedLayers = new Set<string>()
    const allowedLayers: string[] = []
    for (const rawAllowedLayer of rawAllow) {
        const allowedLayer = normalizeNonEmptyString(
            rawAllowedLayer,
            AST_BLUEPRINT_PARSER_ERROR_CODE.INVALID_LAYER_ALLOW,
            "layerName",
            layerName,
        )
        if (seenAllowedLayers.has(allowedLayer)) {
            continue
        }

        seenAllowedLayers.add(allowedLayer)
        allowedLayers.push(allowedLayer)
    }

    return allowedLayers
}

/**
 * Validates references in layer allow-lists.
 *
 * @param layers Parsed layer list.
 */
function validateLayerAllowReferences(layers: readonly IAstBlueprintLayerDefinition[]): void {
    const knownLayers = new Set<string>(layers.map((layer) => layer.name))
    for (const layer of layers) {
        for (const allowedLayer of layer.allow) {
            if (knownLayers.has(allowedLayer) === false) {
                throw new AstBlueprintParserError(
                    AST_BLUEPRINT_PARSER_ERROR_CODE.UNKNOWN_ALLOWED_LAYER,
                    {
                        layerName: allowedLayer,
                    },
                )
            }
        }
    }
}

/**
 * Parses blueprint rules section.
 *
 * @param root Blueprint root record.
 * @param layers Parsed layer list.
 * @returns Normalized rule list.
 */
function parseBlueprintRules(
    root: Readonly<Record<string, unknown>>,
    layers: readonly IAstBlueprintLayerDefinition[],
): readonly IAstBlueprintRuleDefinition[] {
    const rawRules = root["rules"]
    if (Array.isArray(rawRules) === false || rawRules.length === 0) {
        throw new AstBlueprintParserError(AST_BLUEPRINT_PARSER_ERROR_CODE.INVALID_BLUEPRINT_RULES)
    }

    const knownLayers = new Set<string>(layers.map((layer) => layer.name))
    const seenRules = new Set<string>()
    const parsedRules = rawRules.map((rawRule): IBlueprintRuleDraft => {
        const rule = parseBlueprintRule(rawRule)
        validateRuleLayers(rule, knownLayers)
        const ruleKey = `${rule.source}|${rule.target}|${rule.mode}`
        if (seenRules.has(ruleKey)) {
            throw new AstBlueprintParserError(AST_BLUEPRINT_PARSER_ERROR_CODE.DUPLICATE_RULE, {
                ruleSource: rule.source,
                ruleTarget: rule.target,
                mode: rule.mode,
            })
        }

        seenRules.add(ruleKey)
        return rule
    })

    return parsedRules
        .sort((left, right) => {
            const sourceCompare = left.source.localeCompare(right.source)
            if (sourceCompare !== 0) {
                return sourceCompare
            }

            const targetCompare = left.target.localeCompare(right.target)
            if (targetCompare !== 0) {
                return targetCompare
            }

            return left.mode.localeCompare(right.mode)
        })
        .map((rule): IAstBlueprintRuleDefinition => ({
            source: rule.source,
            target: rule.target,
            mode: rule.mode,
        }))
}

/**
 * Parses single blueprint rule item.
 *
 * @param rawRule Raw rule item.
 * @returns Parsed rule draft.
 */
function parseBlueprintRule(rawRule: unknown): IBlueprintRuleDraft {
    if (isRecord(rawRule) === false) {
        throw new AstBlueprintParserError(AST_BLUEPRINT_PARSER_ERROR_CODE.INVALID_BLUEPRINT_RULES)
    }

    const source = normalizeNonEmptyString(
        rawRule["source"],
        AST_BLUEPRINT_PARSER_ERROR_CODE.INVALID_RULE_SOURCE,
        "ruleSource",
    )
    const target = normalizeNonEmptyString(
        rawRule["target"],
        AST_BLUEPRINT_PARSER_ERROR_CODE.INVALID_RULE_TARGET,
        "ruleTarget",
    )
    const mode = parseBlueprintRuleMode(rawRule["mode"])

    return {
        source,
        target,
        mode,
    }
}

/**
 * Parses blueprint rule mode.
 *
 * @param rawMode Raw rule mode value.
 * @returns Normalized rule mode.
 */
function parseBlueprintRuleMode(rawMode: unknown): AstBlueprintRuleMode {
    const mode = normalizeNonEmptyString(
        rawMode,
        AST_BLUEPRINT_PARSER_ERROR_CODE.INVALID_RULE_MODE,
        "mode",
    )
    if (mode !== AST_BLUEPRINT_RULE_MODE.ALLOW && mode !== AST_BLUEPRINT_RULE_MODE.FORBID) {
        throw new AstBlueprintParserError(AST_BLUEPRINT_PARSER_ERROR_CODE.INVALID_RULE_MODE, {
            mode,
        })
    }

    return mode
}

/**
 * Validates source and target layer references in one rule.
 *
 * @param rule Parsed rule draft.
 * @param knownLayers Known layer name set.
 */
function validateRuleLayers(rule: IBlueprintRuleDraft, knownLayers: ReadonlySet<string>): void {
    if (knownLayers.has(rule.source) === false) {
        throw new AstBlueprintParserError(AST_BLUEPRINT_PARSER_ERROR_CODE.UNKNOWN_RULE_LAYER, {
            layerName: rule.source,
        })
    }

    if (knownLayers.has(rule.target) === false) {
        throw new AstBlueprintParserError(AST_BLUEPRINT_PARSER_ERROR_CODE.UNKNOWN_RULE_LAYER, {
            layerName: rule.target,
        })
    }
}

/**
 * Parses blueprint modules section.
 *
 * @param root Blueprint root record.
 * @param layers Parsed layer list.
 * @returns Normalized module list.
 */
function parseBlueprintModules(
    root: Readonly<Record<string, unknown>>,
    layers: readonly IAstBlueprintLayerDefinition[],
): readonly IAstBlueprintModuleDefinition[] {
    const rawModules = root["modules"]
    if (rawModules === undefined) {
        return []
    }

    if (Array.isArray(rawModules) === false) {
        throw new AstBlueprintParserError(AST_BLUEPRINT_PARSER_ERROR_CODE.INVALID_BLUEPRINT_MODULES)
    }

    const knownLayers = new Set<string>(layers.map((layer) => layer.name))
    const seenModuleNames = new Set<string>()
    const parsedModules = rawModules.map((rawModule): IBlueprintModuleDraft => {
        const moduleDefinition = parseBlueprintModule(rawModule)
        if (seenModuleNames.has(moduleDefinition.name)) {
            throw new AstBlueprintParserError(
                AST_BLUEPRINT_PARSER_ERROR_CODE.DUPLICATE_MODULE_NAME,
                {
                    moduleName: moduleDefinition.name,
                },
            )
        }

        seenModuleNames.add(moduleDefinition.name)
        validateModuleLayer(moduleDefinition, knownLayers)
        return moduleDefinition
    })

    validateUniqueModulePaths(parsedModules)

    return parsedModules
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((moduleDefinition): IAstBlueprintModuleDefinition => ({
            name: moduleDefinition.name,
            layer: moduleDefinition.layer,
            paths: [...moduleDefinition.paths].sort((left, right) => left.localeCompare(right)),
        }))
}

/**
 * Parses single blueprint module item.
 *
 * @param rawModule Raw module item.
 * @returns Parsed module draft.
 */
function parseBlueprintModule(rawModule: unknown): IBlueprintModuleDraft {
    if (isRecord(rawModule) === false) {
        throw new AstBlueprintParserError(AST_BLUEPRINT_PARSER_ERROR_CODE.INVALID_BLUEPRINT_MODULES)
    }

    const name = normalizeNonEmptyString(
        rawModule["name"],
        AST_BLUEPRINT_PARSER_ERROR_CODE.INVALID_MODULE_NAME,
        "moduleName",
    )
    const layer = normalizeNonEmptyString(
        rawModule["layer"],
        AST_BLUEPRINT_PARSER_ERROR_CODE.INVALID_MODULE_LAYER,
        "layerName",
    )
    const paths = parseModulePaths(rawModule["paths"], name)

    return {
        name,
        layer,
        paths,
    }
}

/**
 * Parses module paths section.
 *
 * @param rawPaths Raw paths payload.
 * @param moduleName Module name for diagnostics.
 * @returns Normalized module paths.
 */
function parseModulePaths(rawPaths: unknown, moduleName: string): readonly string[] {
    if (Array.isArray(rawPaths) === false || rawPaths.length === 0) {
        throw new AstBlueprintParserError(AST_BLUEPRINT_PARSER_ERROR_CODE.INVALID_MODULE_PATHS, {
            moduleName,
        })
    }

    const seenPaths = new Set<string>()
    const paths: string[] = []
    for (const rawPath of rawPaths) {
        const path = normalizeNonEmptyString(
            rawPath,
            AST_BLUEPRINT_PARSER_ERROR_CODE.INVALID_MODULE_PATHS,
            "path",
        )
        let normalizedPath = path
        try {
            normalizedPath = FilePath.create(path).toString()
        } catch (error) {
            throw new AstBlueprintParserError(
                AST_BLUEPRINT_PARSER_ERROR_CODE.INVALID_MODULE_PATHS,
                {
                    moduleName,
                    path,
                    causeMessage: error instanceof Error ? error.message : String(error),
                },
            )
        }

        if (seenPaths.has(normalizedPath)) {
            continue
        }

        seenPaths.add(normalizedPath)
        paths.push(normalizedPath)
    }

    return paths
}

/**
 * Validates module layer reference.
 *
 * @param moduleDefinition Parsed module definition.
 * @param knownLayers Known layer name set.
 */
function validateModuleLayer(
    moduleDefinition: IBlueprintModuleDraft,
    knownLayers: ReadonlySet<string>,
): void {
    if (knownLayers.has(moduleDefinition.layer) === false) {
        throw new AstBlueprintParserError(AST_BLUEPRINT_PARSER_ERROR_CODE.UNKNOWN_MODULE_LAYER, {
            layerName: moduleDefinition.layer,
            moduleName: moduleDefinition.name,
        })
    }
}

/**
 * Validates unique file paths across all modules.
 *
 * @param modules Parsed module list.
 */
function validateUniqueModulePaths(modules: readonly IBlueprintModuleDraft[]): void {
    const pathOwnerByValue = new Map<string, string>()

    for (const moduleDefinition of modules) {
        for (const path of moduleDefinition.paths) {
            const existingOwner = pathOwnerByValue.get(path)
            if (existingOwner !== undefined && existingOwner !== moduleDefinition.name) {
                throw new AstBlueprintParserError(
                    AST_BLUEPRINT_PARSER_ERROR_CODE.DUPLICATE_MODULE_PATH,
                    {
                        moduleName: moduleDefinition.name,
                        path,
                    },
                )
            }

            pathOwnerByValue.set(path, moduleDefinition.name)
        }
    }
}

/**
 * Parses scalar metadata from blueprint root object.
 *
 * @param root Blueprint root record.
 * @returns Scalar metadata map.
 */
function parseBlueprintMetadata(
    root: Readonly<Record<string, unknown>>,
): Readonly<Record<string, AstBlueprintMetadataValue>> {
    const metadataEntries: Array<readonly [string, AstBlueprintMetadataValue]> = []
    const knownKeySet = new Set<string>(KNOWN_BLUEPRINT_KEYS)

    for (const [key, rawValue] of Object.entries(root)) {
        if (knownKeySet.has(key)) {
            continue
        }

        if (isMetadataScalarValue(rawValue) === false) {
            throw new AstBlueprintParserError(AST_BLUEPRINT_PARSER_ERROR_CODE.INVALID_METADATA_VALUE, {
                key,
            })
        }

        metadataEntries.push([key, rawValue])
    }

    metadataEntries.sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))

    const metadata: Record<string, AstBlueprintMetadataValue> = {}
    for (const [key, value] of metadataEntries) {
        metadata[key] = value
    }

    return metadata
}

/**
 * Creates stable request key for parser idempotency.
 *
 * @param input Normalized parser input.
 * @returns Stable request key.
 */
function createRequestKey(input: INormalizedBlueprintParserInput): string {
    const sourcePath = input.sourcePath ?? ""
    return `${sourcePath}\n${input.blueprintYaml}`
}

/**
 * Creates deep clone for blueprint definition.
 *
 * @param definition Blueprint definition.
 * @returns Cloned blueprint definition.
 */
function cloneBlueprintDefinition(definition: IAstBlueprintDefinition): IAstBlueprintDefinition {
    const metadata: Record<string, AstBlueprintMetadataValue> = {}
    for (const [key, value] of Object.entries(definition.metadata)) {
        metadata[key] = value
    }

    return {
        version: definition.version,
        layers: definition.layers.map((layer): IAstBlueprintLayerDefinition => ({
            name: layer.name,
            allow: [...layer.allow],
        })),
        rules: definition.rules.map((rule): IAstBlueprintRuleDefinition => ({
            source: rule.source,
            target: rule.target,
            mode: rule.mode,
        })),
        modules: definition.modules.map((moduleDefinition): IAstBlueprintModuleDefinition => ({
            name: moduleDefinition.name,
            layer: moduleDefinition.layer,
            paths: [...moduleDefinition.paths],
        })),
        metadata,
        sourcePath: definition.sourcePath,
    }
}

/**
 * Normalizes non-empty string value.
 *
 * @param value Raw string value.
 * @param errorCode Error code to throw on invalid value.
 * @param field Error details field name.
 * @param fieldValue Optional explicit value for error details field.
 * @returns Normalized non-empty string.
 */
function normalizeNonEmptyString(
    value: unknown,
    errorCode: AstBlueprintParserErrorCode,
    field: "layerName" | "moduleName" | "path" | "mode" | "ruleSource" | "ruleTarget",
    fieldValue?: string,
): string {
    if (typeof value !== "string") {
        throw createStringValidationError(errorCode, field, fieldValue)
    }

    const normalized = value.trim()
    if (normalized.length === 0) {
        throw createStringValidationError(errorCode, field, fieldValue)
    }

    return normalized
}

/**
 * Creates typed string-validation error.
 *
 * @param code Typed error code.
 * @param field Error details field.
 * @param value Optional field value.
 * @returns Typed parser error.
 */
function createStringValidationError(
    code: AstBlueprintParserErrorCode,
    field: "layerName" | "moduleName" | "path" | "mode" | "ruleSource" | "ruleTarget",
    value?: string,
): AstBlueprintParserError {
    if (field === "layerName") {
        return new AstBlueprintParserError(code, {layerName: value})
    }

    if (field === "moduleName") {
        return new AstBlueprintParserError(code, {moduleName: value})
    }

    if (field === "path") {
        return new AstBlueprintParserError(code, {path: value})
    }

    if (field === "mode") {
        return new AstBlueprintParserError(code, {mode: value})
    }

    if (field === "ruleSource") {
        return new AstBlueprintParserError(code, {ruleSource: value})
    }

    return new AstBlueprintParserError(code, {ruleTarget: value})
}

/**
 * Checks whether value is a plain object record.
 *
 * @param value Raw value.
 * @returns True when value is object record.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && Array.isArray(value) === false
}

/**
 * Checks whether value is supported scalar metadata value.
 *
 * @param value Raw value.
 * @returns True when value is supported scalar metadata value.
 */
function isMetadataScalarValue(value: unknown): value is AstBlueprintMetadataValue {
    if (typeof value === "string" || typeof value === "boolean") {
        return true
    }

    if (value === null) {
        return true
    }

    if (typeof value === "number") {
        return Number.isFinite(value)
    }

    return false
}

/**
 * Validates max parse attempts option.
 *
 * @param maxParseAttempts Raw max parse attempts value.
 * @returns Validated max parse attempts.
 */
function validateMaxParseAttempts(maxParseAttempts: number): number {
    if (Number.isInteger(maxParseAttempts) === false || maxParseAttempts <= 0) {
        throw new AstBlueprintParserError(AST_BLUEPRINT_PARSER_ERROR_CODE.INVALID_MAX_PARSE_ATTEMPTS, {
            maxParseAttempts,
        })
    }

    return maxParseAttempts
}

/**
 * Validates retry backoff option.
 *
 * @param retryBackoffMs Raw retry backoff value.
 * @returns Validated retry backoff.
 */
function validateRetryBackoffMs(retryBackoffMs: number): number {
    if (Number.isFinite(retryBackoffMs) === false || retryBackoffMs < 0) {
        throw new AstBlueprintParserError(AST_BLUEPRINT_PARSER_ERROR_CODE.INVALID_RETRY_BACKOFF_MS, {
            retryBackoffMs,
        })
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
        throw new AstBlueprintParserError(AST_BLUEPRINT_PARSER_ERROR_CODE.INVALID_CACHE_TTL_MS, {
            cacheTtlMs,
        })
    }

    return cacheTtlMs
}

/**
 * Validates parse callback option.
 *
 * @param parseYaml Raw parse callback.
 * @returns Validated parse callback.
 */
function validateParseYaml(parseYaml: AstBlueprintParserParseYaml): AstBlueprintParserParseYaml {
    if (typeof parseYaml !== "function") {
        throw new AstBlueprintParserError(AST_BLUEPRINT_PARSER_ERROR_CODE.INVALID_PARSE_YAML)
    }

    return parseYaml
}

/**
 * Validates sleep callback option.
 *
 * @param sleep Raw sleep callback.
 * @returns Validated sleep callback.
 */
function validateSleep(sleep: AstBlueprintParserSleep): AstBlueprintParserSleep {
    if (typeof sleep !== "function") {
        throw new AstBlueprintParserError(AST_BLUEPRINT_PARSER_ERROR_CODE.INVALID_SLEEP)
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
 * Default YAML parser implementation.
 *
 * @param blueprintYaml Raw blueprint YAML payload.
 * @returns Parsed YAML object.
 */
function defaultParseYaml(blueprintYaml: string): Promise<unknown> {
    return Promise.resolve(Bun.YAML.parse(blueprintYaml))
}
