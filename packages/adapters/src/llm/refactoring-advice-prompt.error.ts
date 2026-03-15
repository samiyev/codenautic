/**
 * Typed error codes for refactoring advice prompt builder failures.
 */
export const REFACTORING_ADVICE_PROMPT_ERROR_CODE = {
    INVALID_CODE_METRICS: "INVALID_CODE_METRICS",
    INVALID_COUPLING_DATA: "INVALID_COUPLING_DATA",
    INVALID_METRIC_NAME: "INVALID_METRIC_NAME",
    INVALID_METRIC_VALUE: "INVALID_METRIC_VALUE",
    INVALID_SOURCE_PATH: "INVALID_SOURCE_PATH",
    INVALID_TARGET_PATH: "INVALID_TARGET_PATH",
    INVALID_COUPLING_STRENGTH: "INVALID_COUPLING_STRENGTH",
    INVALID_SHARED_COMMIT_COUNT: "INVALID_SHARED_COMMIT_COUNT",
    INVALID_LAST_SEEN_AT: "INVALID_LAST_SEEN_AT",
    INVALID_ARCHITECTURE_CONSTRAINT: "INVALID_ARCHITECTURE_CONSTRAINT",
    INVALID_IDEMPOTENCY_KEY: "INVALID_IDEMPOTENCY_KEY",
    INVALID_MAX_ATTEMPTS: "INVALID_MAX_ATTEMPTS",
    INVALID_RETRY_BACKOFF_MS: "INVALID_RETRY_BACKOFF_MS",
    INVALID_IDEMPOTENCY_TTL_MS: "INVALID_IDEMPOTENCY_TTL_MS",
    CONTEXT_LOAD_FAILED: "CONTEXT_LOAD_FAILED",
} as const

/**
 * Refactoring advice prompt error code literal.
 */
export type RefactoringAdvicePromptErrorCode =
    (typeof REFACTORING_ADVICE_PROMPT_ERROR_CODE)[keyof typeof REFACTORING_ADVICE_PROMPT_ERROR_CODE]

/**
 * Structured metadata for refactoring advice prompt failures.
 */
export interface IRefactoringAdvicePromptErrorDetails {
    /**
     * Invalid metric name when available.
     */
    readonly metricName?: string

    /**
     * Invalid source path when available.
     */
    readonly sourcePath?: string

    /**
     * Invalid target path when available.
     */
    readonly targetPath?: string

    /**
     * Invalid architecture constraint when available.
     */
    readonly architectureConstraint?: string

    /**
     * Invalid idempotency key when available.
     */
    readonly idempotencyKey?: string

    /**
     * Retry attempt when available.
     */
    readonly attempt?: number

    /**
     * Original cause message when available.
     */
    readonly causeMessage?: string
}

/**
 * Error thrown by refactoring advice prompt builder.
 */
export class RefactoringAdvicePromptError extends Error {
    /**
     * Stable machine-readable error code.
     */
    public readonly code: RefactoringAdvicePromptErrorCode

    /**
     * Invalid metric name when available.
     */
    public readonly metricName?: string

    /**
     * Invalid source path when available.
     */
    public readonly sourcePath?: string

    /**
     * Invalid target path when available.
     */
    public readonly targetPath?: string

    /**
     * Invalid architecture constraint when available.
     */
    public readonly architectureConstraint?: string

    /**
     * Invalid idempotency key when available.
     */
    public readonly idempotencyKey?: string

    /**
     * Retry attempt when available.
     */
    public readonly attempt?: number

    /**
     * Original cause message when available.
     */
    public readonly causeMessage?: string

    /**
     * Creates refactoring advice prompt error.
     *
     * @param code Stable machine-readable error code.
     * @param details Optional normalized details.
     */
    public constructor(
        code: RefactoringAdvicePromptErrorCode,
        details: IRefactoringAdvicePromptErrorDetails = {},
    ) {
        super(buildRefactoringAdvicePromptErrorMessage(code, details))
        this.name = "RefactoringAdvicePromptError"
        this.code = code
        this.metricName = details.metricName
        this.sourcePath = details.sourcePath
        this.targetPath = details.targetPath
        this.architectureConstraint = details.architectureConstraint
        this.idempotencyKey = details.idempotencyKey
        this.attempt = details.attempt
        this.causeMessage = details.causeMessage
    }
}

/**
 * Builds public refactoring advice prompt error message.
 *
 * @param code Error code.
 * @param details Error details.
 * @returns Public error message.
 */
function buildRefactoringAdvicePromptErrorMessage(
    code: RefactoringAdvicePromptErrorCode,
    details: IRefactoringAdvicePromptErrorDetails,
): string {
    const messages: Readonly<Record<RefactoringAdvicePromptErrorCode, string>> = {
        [REFACTORING_ADVICE_PROMPT_ERROR_CODE.INVALID_CODE_METRICS]:
            "Refactoring advice prompt requires non-empty code metrics",
        [REFACTORING_ADVICE_PROMPT_ERROR_CODE.INVALID_COUPLING_DATA]:
            "Refactoring advice prompt requires non-empty coupling data",
        [REFACTORING_ADVICE_PROMPT_ERROR_CODE.INVALID_METRIC_NAME]:
            `Refactoring metric name is invalid: ${details.metricName ?? "<empty>"}`,
        [REFACTORING_ADVICE_PROMPT_ERROR_CODE.INVALID_METRIC_VALUE]:
            "Refactoring metric value must be a finite number",
        [REFACTORING_ADVICE_PROMPT_ERROR_CODE.INVALID_SOURCE_PATH]:
            `Refactoring source path is invalid: ${details.sourcePath ?? "<empty>"}`,
        [REFACTORING_ADVICE_PROMPT_ERROR_CODE.INVALID_TARGET_PATH]:
            `Refactoring target path is invalid: ${details.targetPath ?? "<empty>"}`,
        [REFACTORING_ADVICE_PROMPT_ERROR_CODE.INVALID_COUPLING_STRENGTH]:
            "Refactoring coupling strength must be a non-negative finite number",
        [REFACTORING_ADVICE_PROMPT_ERROR_CODE.INVALID_SHARED_COMMIT_COUNT]:
            "Refactoring shared commit count must be a positive integer",
        [REFACTORING_ADVICE_PROMPT_ERROR_CODE.INVALID_LAST_SEEN_AT]:
            "Refactoring coupling lastSeenAt must be a valid date string",
        [REFACTORING_ADVICE_PROMPT_ERROR_CODE.INVALID_ARCHITECTURE_CONSTRAINT]:
            `Refactoring architecture constraint is invalid: ${
                details.architectureConstraint ?? "<empty>"
            }`,
        [REFACTORING_ADVICE_PROMPT_ERROR_CODE.INVALID_IDEMPOTENCY_KEY]:
            `Refactoring idempotency key is invalid: ${details.idempotencyKey ?? "<empty>"}`,
        [REFACTORING_ADVICE_PROMPT_ERROR_CODE.INVALID_MAX_ATTEMPTS]:
            "Refactoring advice prompt max attempts must be a positive integer",
        [REFACTORING_ADVICE_PROMPT_ERROR_CODE.INVALID_RETRY_BACKOFF_MS]:
            "Refactoring advice prompt retry backoff must be a non-negative integer",
        [REFACTORING_ADVICE_PROMPT_ERROR_CODE.INVALID_IDEMPOTENCY_TTL_MS]:
            "Refactoring advice prompt idempotency TTL must be a positive integer",
        [REFACTORING_ADVICE_PROMPT_ERROR_CODE.CONTEXT_LOAD_FAILED]:
            "Refactoring advice prompt failed to load additional context",
    }

    return messages[code]
}
