/**
 * Typed error codes for LLM chain builder failures.
 */
export const LLM_CHAIN_BUILDER_ERROR_CODE = {
    INVALID_PROVIDER: "INVALID_PROVIDER",
    INVALID_PROMPT_TEMPLATE_MANAGER: "INVALID_PROMPT_TEMPLATE_MANAGER",
    INVALID_DEFAULT_MODEL: "INVALID_DEFAULT_MODEL",
    INVALID_DEFAULT_MAX_ATTEMPTS: "INVALID_DEFAULT_MAX_ATTEMPTS",
    INVALID_DEFAULT_RETRY_BACKOFF_MS: "INVALID_DEFAULT_RETRY_BACKOFF_MS",
    INVALID_IDEMPOTENCY_TTL_MS: "INVALID_IDEMPOTENCY_TTL_MS",
    INVALID_CHAIN_NAME: "INVALID_CHAIN_NAME",
    CHAIN_ALREADY_EXISTS: "CHAIN_ALREADY_EXISTS",
    CHAIN_NOT_FOUND: "CHAIN_NOT_FOUND",
    EMPTY_CHAIN_STEPS: "EMPTY_CHAIN_STEPS",
    INVALID_STEP_NAME: "INVALID_STEP_NAME",
    DUPLICATE_STEP_NAME: "DUPLICATE_STEP_NAME",
    INVALID_STEP_TEMPLATE_NAME: "INVALID_STEP_TEMPLATE_NAME",
    INVALID_STEP_MAX_ATTEMPTS: "INVALID_STEP_MAX_ATTEMPTS",
    INVALID_STEP_RETRY_BACKOFF_MS: "INVALID_STEP_RETRY_BACKOFF_MS",
    INVALID_IDEMPOTENCY_KEY: "INVALID_IDEMPOTENCY_KEY",
    STEP_EXECUTION_FAILED: "STEP_EXECUTION_FAILED",
} as const

/**
 * LLM chain builder error code literal.
 */
export type LlmChainBuilderErrorCode =
    (typeof LLM_CHAIN_BUILDER_ERROR_CODE)[keyof typeof LLM_CHAIN_BUILDER_ERROR_CODE]

/**
 * Structured metadata for LLM chain builder failures.
 */
export interface ILlmChainBuilderErrorDetails {
    /**
     * Chain name when available.
     */
    readonly chainName?: string

    /**
     * Step name when available.
     */
    readonly stepName?: string

    /**
     * Template name when available.
     */
    readonly templateName?: string

    /**
     * Idempotency key when available.
     */
    readonly idempotencyKey?: string

    /**
     * Retry attempt number when available.
     */
    readonly attempt?: number

    /**
     * Original cause message when available.
     */
    readonly causeMessage?: string
}

/**
 * Error thrown by LLM chain builder.
 */
export class LlmChainBuilderError extends Error {
    /**
     * Stable machine-readable error code.
     */
    public readonly code: LlmChainBuilderErrorCode

    /**
     * Chain name when available.
     */
    public readonly chainName?: string

    /**
     * Step name when available.
     */
    public readonly stepName?: string

    /**
     * Template name when available.
     */
    public readonly templateName?: string

    /**
     * Idempotency key when available.
     */
    public readonly idempotencyKey?: string

    /**
     * Retry attempt number when available.
     */
    public readonly attempt?: number

    /**
     * Original cause message when available.
     */
    public readonly causeMessage?: string

    /**
     * Creates LLM chain builder error.
     *
     * @param code Stable machine-readable error code.
     * @param details Optional normalized error details.
     */
    public constructor(
        code: LlmChainBuilderErrorCode,
        details: ILlmChainBuilderErrorDetails = {},
    ) {
        super(buildLlmChainBuilderErrorMessage(code, details))
        this.name = "LlmChainBuilderError"
        this.code = code
        this.chainName = details.chainName
        this.stepName = details.stepName
        this.templateName = details.templateName
        this.idempotencyKey = details.idempotencyKey
        this.attempt = details.attempt
        this.causeMessage = details.causeMessage
    }
}

/**
 * Builds public error message for LLM chain builder errors.
 *
 * @param code Error code.
 * @param details Error details.
 * @returns Public error message.
 */
function buildLlmChainBuilderErrorMessage(
    code: LlmChainBuilderErrorCode,
    details: ILlmChainBuilderErrorDetails,
): string {
    const chainName = resolveChainName(details.chainName)
    const stepName = resolveStepName(details.stepName)
    const idempotencyKey = resolveIdempotencyKey(details.idempotencyKey)

    const messages: Readonly<Record<LlmChainBuilderErrorCode, string>> = {
        [LLM_CHAIN_BUILDER_ERROR_CODE.INVALID_PROVIDER]:
            "LLM chain builder requires provider with chat(), stream(), and embed()",
        [LLM_CHAIN_BUILDER_ERROR_CODE.INVALID_PROMPT_TEMPLATE_MANAGER]:
            "LLM chain builder requires promptTemplateManager with renderTemplate()",
        [LLM_CHAIN_BUILDER_ERROR_CODE.INVALID_DEFAULT_MODEL]:
            "LLM chain builder default model cannot be empty",
        [LLM_CHAIN_BUILDER_ERROR_CODE.INVALID_DEFAULT_MAX_ATTEMPTS]:
            "LLM chain builder default max attempts must be a positive integer",
        [LLM_CHAIN_BUILDER_ERROR_CODE.INVALID_DEFAULT_RETRY_BACKOFF_MS]:
            "LLM chain builder default retry backoff must be a non-negative integer",
        [LLM_CHAIN_BUILDER_ERROR_CODE.INVALID_IDEMPOTENCY_TTL_MS]:
            "LLM chain builder idempotency TTL must be a positive integer",
        [LLM_CHAIN_BUILDER_ERROR_CODE.INVALID_CHAIN_NAME]:
            `LLM chain name is invalid: ${chainName}`,
        [LLM_CHAIN_BUILDER_ERROR_CODE.CHAIN_ALREADY_EXISTS]:
            `LLM chain already exists: ${chainName}`,
        [LLM_CHAIN_BUILDER_ERROR_CODE.CHAIN_NOT_FOUND]:
            `LLM chain not found: ${chainName}`,
        [LLM_CHAIN_BUILDER_ERROR_CODE.EMPTY_CHAIN_STEPS]:
            `LLM chain requires at least one step: ${chainName}`,
        [LLM_CHAIN_BUILDER_ERROR_CODE.INVALID_STEP_NAME]:
            `LLM chain step name is invalid in chain: ${chainName}`,
        [LLM_CHAIN_BUILDER_ERROR_CODE.DUPLICATE_STEP_NAME]:
            `LLM chain step name must be unique: ${stepName}`,
        [LLM_CHAIN_BUILDER_ERROR_CODE.INVALID_STEP_TEMPLATE_NAME]:
            `LLM chain template name is invalid for step: ${stepName}`,
        [LLM_CHAIN_BUILDER_ERROR_CODE.INVALID_STEP_MAX_ATTEMPTS]:
            `LLM chain step max attempts is invalid: ${stepName}`,
        [LLM_CHAIN_BUILDER_ERROR_CODE.INVALID_STEP_RETRY_BACKOFF_MS]:
            `LLM chain step retry backoff is invalid: ${stepName}`,
        [LLM_CHAIN_BUILDER_ERROR_CODE.INVALID_IDEMPOTENCY_KEY]:
            `LLM chain idempotency key is invalid: ${idempotencyKey}`,
        [LLM_CHAIN_BUILDER_ERROR_CODE.STEP_EXECUTION_FAILED]:
            `LLM chain step execution failed: ${stepName}`,
    }

    return messages[code]
}

/**
 * Resolves chain label for error messages.
 *
 * @param chainName Optional chain name.
 * @returns Safe chain label.
 */
function resolveChainName(chainName: string | undefined): string {
    if (chainName === undefined) {
        return "<unknown>"
    }

    return chainName
}

/**
 * Resolves step label for error messages.
 *
 * @param stepName Optional step name.
 * @returns Safe step label.
 */
function resolveStepName(stepName: string | undefined): string {
    if (stepName === undefined) {
        return "<unknown>"
    }

    return stepName
}

/**
 * Resolves idempotency key label for error messages.
 *
 * @param idempotencyKey Optional idempotency key.
 * @returns Safe idempotency key label.
 */
function resolveIdempotencyKey(idempotencyKey: string | undefined): string {
    if (idempotencyKey === undefined) {
        return "<empty>"
    }

    return idempotencyKey
}
