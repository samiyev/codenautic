/**
 * Typed error codes for AST blueprint parser.
 */
export const AST_BLUEPRINT_PARSER_ERROR_CODE = {
    DUPLICATE_LAYER_NAME: "DUPLICATE_LAYER_NAME",
    DUPLICATE_MODULE_NAME: "DUPLICATE_MODULE_NAME",
    DUPLICATE_MODULE_PATH: "DUPLICATE_MODULE_PATH",
    DUPLICATE_RULE: "DUPLICATE_RULE",
    EMPTY_BLUEPRINT_YAML: "EMPTY_BLUEPRINT_YAML",
    INVALID_BLUEPRINT_LAYERS: "INVALID_BLUEPRINT_LAYERS",
    INVALID_BLUEPRINT_MODULES: "INVALID_BLUEPRINT_MODULES",
    INVALID_BLUEPRINT_ROOT: "INVALID_BLUEPRINT_ROOT",
    INVALID_BLUEPRINT_RULES: "INVALID_BLUEPRINT_RULES",
    INVALID_BLUEPRINT_VERSION: "INVALID_BLUEPRINT_VERSION",
    INVALID_CACHE_TTL_MS: "INVALID_CACHE_TTL_MS",
    INVALID_LAYER_ALLOW: "INVALID_LAYER_ALLOW",
    INVALID_LAYER_NAME: "INVALID_LAYER_NAME",
    INVALID_MAX_PARSE_ATTEMPTS: "INVALID_MAX_PARSE_ATTEMPTS",
    INVALID_METADATA_VALUE: "INVALID_METADATA_VALUE",
    INVALID_MODULE_LAYER: "INVALID_MODULE_LAYER",
    INVALID_MODULE_NAME: "INVALID_MODULE_NAME",
    INVALID_MODULE_PATHS: "INVALID_MODULE_PATHS",
    INVALID_PARSE_YAML: "INVALID_PARSE_YAML",
    INVALID_RETRY_BACKOFF_MS: "INVALID_RETRY_BACKOFF_MS",
    INVALID_RULE_MODE: "INVALID_RULE_MODE",
    INVALID_RULE_SOURCE: "INVALID_RULE_SOURCE",
    INVALID_RULE_TARGET: "INVALID_RULE_TARGET",
    INVALID_SLEEP: "INVALID_SLEEP",
    INVALID_SOURCE_PATH: "INVALID_SOURCE_PATH",
    RETRY_EXHAUSTED: "RETRY_EXHAUSTED",
    UNKNOWN_ALLOWED_LAYER: "UNKNOWN_ALLOWED_LAYER",
    UNKNOWN_MODULE_LAYER: "UNKNOWN_MODULE_LAYER",
    UNKNOWN_RULE_LAYER: "UNKNOWN_RULE_LAYER",
} as const

/**
 * AST blueprint parser error code literal.
 */
export type AstBlueprintParserErrorCode =
    (typeof AST_BLUEPRINT_PARSER_ERROR_CODE)[keyof typeof AST_BLUEPRINT_PARSER_ERROR_CODE]

/**
 * Structured metadata for AST blueprint parser failures.
 */
export interface IAstBlueprintParserErrorDetails {
    /**
     * Source blueprint path when available.
     */
    readonly sourcePath?: string

    /**
     * YAML/metadata key when available.
     */
    readonly key?: string

    /**
     * Layer name when available.
     */
    readonly layerName?: string

    /**
     * Module name when available.
     */
    readonly moduleName?: string

    /**
     * Rule source layer when available.
     */
    readonly ruleSource?: string

    /**
     * Rule target layer when available.
     */
    readonly ruleTarget?: string

    /**
     * Rule mode when available.
     */
    readonly mode?: string

    /**
     * Module path when available.
     */
    readonly path?: string

    /**
     * Retry attempt number when available.
     */
    readonly attempt?: number

    /**
     * Maximum parse attempts when available.
     */
    readonly maxParseAttempts?: number

    /**
     * Retry backoff in milliseconds when available.
     */
    readonly retryBackoffMs?: number

    /**
     * Cache TTL in milliseconds when available.
     */
    readonly cacheTtlMs?: number

    /**
     * Underlying error message when available.
     */
    readonly causeMessage?: string
}

/**
 * Typed AST blueprint parser error with stable metadata.
 */
export class AstBlueprintParserError extends Error {
    /**
     * Stable machine-readable error code.
     */
    public readonly code: AstBlueprintParserErrorCode

    /**
     * Source blueprint path when available.
     */
    public readonly sourcePath?: string

    /**
     * YAML/metadata key when available.
     */
    public readonly key?: string

    /**
     * Layer name when available.
     */
    public readonly layerName?: string

    /**
     * Module name when available.
     */
    public readonly moduleName?: string

    /**
     * Rule source layer when available.
     */
    public readonly ruleSource?: string

    /**
     * Rule target layer when available.
     */
    public readonly ruleTarget?: string

    /**
     * Rule mode when available.
     */
    public readonly mode?: string

    /**
     * Module path when available.
     */
    public readonly path?: string

    /**
     * Retry attempt number when available.
     */
    public readonly attempt?: number

    /**
     * Maximum parse attempts when available.
     */
    public readonly maxParseAttempts?: number

    /**
     * Retry backoff in milliseconds when available.
     */
    public readonly retryBackoffMs?: number

    /**
     * Cache TTL in milliseconds when available.
     */
    public readonly cacheTtlMs?: number

    /**
     * Underlying error message when available.
     */
    public readonly causeMessage?: string

    /**
     * Creates typed AST blueprint parser error.
     *
     * @param code Stable machine-readable error code.
     * @param details Structured error metadata.
     */
    public constructor(
        code: AstBlueprintParserErrorCode,
        details: IAstBlueprintParserErrorDetails = {},
    ) {
        super(createAstBlueprintParserErrorMessage(code, details))

        this.name = "AstBlueprintParserError"
        this.code = code
        this.sourcePath = details.sourcePath
        this.key = details.key
        this.layerName = details.layerName
        this.moduleName = details.moduleName
        this.ruleSource = details.ruleSource
        this.ruleTarget = details.ruleTarget
        this.mode = details.mode
        this.path = details.path
        this.attempt = details.attempt
        this.maxParseAttempts = details.maxParseAttempts
        this.retryBackoffMs = details.retryBackoffMs
        this.cacheTtlMs = details.cacheTtlMs
        this.causeMessage = details.causeMessage
    }
}

/**
 * Builds stable public message for blueprint parser failures.
 *
 * @param code Stable machine-readable error code.
 * @param details Structured error metadata.
 * @returns Stable public message.
 */
function createAstBlueprintParserErrorMessage(
    code: AstBlueprintParserErrorCode,
    details: IAstBlueprintParserErrorDetails,
): string {
    return AST_BLUEPRINT_PARSER_ERROR_MESSAGES[code](details)
}

const AST_BLUEPRINT_PARSER_ERROR_MESSAGES: Readonly<
    Record<AstBlueprintParserErrorCode, (details: IAstBlueprintParserErrorDetails) => string>
> = {
    DUPLICATE_LAYER_NAME: (details) =>
        `Duplicate blueprint layer name: ${details.layerName ?? "<empty>"}`,
    DUPLICATE_MODULE_NAME: (details) =>
        `Duplicate blueprint module name: ${details.moduleName ?? "<empty>"}`,
    DUPLICATE_MODULE_PATH: (details) =>
        `Duplicate blueprint module path: ${details.path ?? "<empty>"}`,
    DUPLICATE_RULE: (details) =>
        `Duplicate blueprint rule: ${details.ruleSource ?? "<empty>"} -> ${
            details.ruleTarget ?? "<empty>"
        } (${details.mode ?? "<empty>"})`,
    EMPTY_BLUEPRINT_YAML: () => "Blueprint YAML cannot be empty",
    INVALID_BLUEPRINT_LAYERS: () => "Blueprint layers must be a non-empty array",
    INVALID_BLUEPRINT_MODULES: () => "Blueprint modules must be an array",
    INVALID_BLUEPRINT_ROOT: () => "Blueprint YAML root must be an object",
    INVALID_BLUEPRINT_RULES: () => "Blueprint rules must be a non-empty array",
    INVALID_BLUEPRINT_VERSION: () => "Blueprint version must be a positive integer",
    INVALID_CACHE_TTL_MS: (details) =>
        `Invalid blueprint parser cache TTL: ${details.cacheTtlMs ?? Number.NaN}`,
    INVALID_LAYER_ALLOW: (details) =>
        `Invalid allow-list for layer: ${details.layerName ?? "<empty>"}`,
    INVALID_LAYER_NAME: (details) =>
        `Invalid blueprint layer name: ${details.layerName ?? "<empty>"}`,
    INVALID_MAX_PARSE_ATTEMPTS: (details) =>
        `Invalid blueprint parser max parse attempts: ${details.maxParseAttempts ?? Number.NaN}`,
    INVALID_METADATA_VALUE: (details) =>
        `Invalid blueprint metadata value for key: ${details.key ?? "<empty>"}`,
    INVALID_MODULE_LAYER: (details) =>
        `Invalid blueprint module layer: ${details.layerName ?? "<empty>"}`,
    INVALID_MODULE_NAME: (details) =>
        `Invalid blueprint module name: ${details.moduleName ?? "<empty>"}`,
    INVALID_MODULE_PATHS: (details) =>
        `Invalid paths for blueprint module: ${details.moduleName ?? "<empty>"}`,
    INVALID_PARSE_YAML: () => "Blueprint parser parseYaml callback must be a function",
    INVALID_RETRY_BACKOFF_MS: (details) =>
        `Invalid blueprint parser retry backoff: ${details.retryBackoffMs ?? Number.NaN}`,
    INVALID_RULE_MODE: (details) =>
        `Invalid blueprint rule mode: ${details.mode ?? "<empty>"}`,
    INVALID_RULE_SOURCE: (details) =>
        `Invalid blueprint rule source: ${details.ruleSource ?? "<empty>"}`,
    INVALID_RULE_TARGET: (details) =>
        `Invalid blueprint rule target: ${details.ruleTarget ?? "<empty>"}`,
    INVALID_SLEEP: () => "Blueprint parser sleep callback must be a function",
    INVALID_SOURCE_PATH: (details) =>
        `Invalid blueprint source path: ${details.sourcePath ?? "<empty>"}`,
    RETRY_EXHAUSTED: (details) =>
        `Blueprint parsing retries exhausted after ${
            details.maxParseAttempts ?? Number.NaN
        } attempts: ${details.causeMessage ?? "<unknown>"}`,
    UNKNOWN_ALLOWED_LAYER: (details) =>
        `Unknown allowed layer reference: ${details.layerName ?? "<empty>"}`,
    UNKNOWN_MODULE_LAYER: (details) =>
        `Unknown module layer reference: ${details.layerName ?? "<empty>"}`,
    UNKNOWN_RULE_LAYER: (details) =>
        `Unknown rule layer reference: ${details.layerName ?? "<empty>"}`,
}
