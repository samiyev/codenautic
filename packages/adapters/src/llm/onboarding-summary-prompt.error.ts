/**
 * Typed error codes for onboarding summary prompt builder failures.
 */
export const ONBOARDING_SUMMARY_PROMPT_ERROR_CODE = {
    INVALID_TECH_STACK: "INVALID_TECH_STACK",
    INVALID_ARCHITECTURE_HIGHLIGHTS: "INVALID_ARCHITECTURE_HIGHLIGHTS",
    INVALID_METRICS: "INVALID_METRICS",
    INVALID_TECH_STACK_ENTRY: "INVALID_TECH_STACK_ENTRY",
    INVALID_ARCHITECTURE_HIGHLIGHT: "INVALID_ARCHITECTURE_HIGHLIGHT",
    INVALID_METRIC_NAME: "INVALID_METRIC_NAME",
    INVALID_METRIC_VALUE: "INVALID_METRIC_VALUE",
    INVALID_IDEMPOTENCY_KEY: "INVALID_IDEMPOTENCY_KEY",
    INVALID_MAX_ATTEMPTS: "INVALID_MAX_ATTEMPTS",
    INVALID_RETRY_BACKOFF_MS: "INVALID_RETRY_BACKOFF_MS",
    INVALID_IDEMPOTENCY_TTL_MS: "INVALID_IDEMPOTENCY_TTL_MS",
    CONTEXT_LOAD_FAILED: "CONTEXT_LOAD_FAILED",
} as const

/**
 * Onboarding summary prompt error code literal.
 */
export type OnboardingSummaryPromptErrorCode =
    (typeof ONBOARDING_SUMMARY_PROMPT_ERROR_CODE)[keyof typeof ONBOARDING_SUMMARY_PROMPT_ERROR_CODE]

/**
 * Structured metadata for onboarding summary prompt failures.
 */
export interface IOnboardingSummaryPromptErrorDetails {
    /**
     * Invalid entry value when available.
     */
    readonly entry?: string

    /**
     * Invalid metric name when available.
     */
    readonly metricName?: string

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
 * Error thrown by onboarding summary prompt builder.
 */
export class OnboardingSummaryPromptError extends Error {
    /**
     * Stable machine-readable error code.
     */
    public readonly code: OnboardingSummaryPromptErrorCode

    /**
     * Invalid entry value when available.
     */
    public readonly entry?: string

    /**
     * Invalid metric name when available.
     */
    public readonly metricName?: string

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
     * Creates onboarding summary prompt error.
     *
     * @param code Stable machine-readable error code.
     * @param details Optional normalized details.
     */
    public constructor(
        code: OnboardingSummaryPromptErrorCode,
        details: IOnboardingSummaryPromptErrorDetails = {},
    ) {
        super(buildOnboardingSummaryPromptErrorMessage(code, details))
        this.name = "OnboardingSummaryPromptError"
        this.code = code
        this.entry = details.entry
        this.metricName = details.metricName
        this.idempotencyKey = details.idempotencyKey
        this.attempt = details.attempt
        this.causeMessage = details.causeMessage
    }
}

/**
 * Builds public onboarding summary prompt error message.
 *
 * @param code Error code.
 * @param details Error details.
 * @returns Public error message.
 */
function buildOnboardingSummaryPromptErrorMessage(
    code: OnboardingSummaryPromptErrorCode,
    details: IOnboardingSummaryPromptErrorDetails,
): string {
    const messages: Readonly<Record<OnboardingSummaryPromptErrorCode, string>> = {
        [ONBOARDING_SUMMARY_PROMPT_ERROR_CODE.INVALID_TECH_STACK]:
            "Onboarding summary prompt requires non-empty tech stack",
        [ONBOARDING_SUMMARY_PROMPT_ERROR_CODE.INVALID_ARCHITECTURE_HIGHLIGHTS]:
            "Onboarding summary prompt requires non-empty architecture highlights",
        [ONBOARDING_SUMMARY_PROMPT_ERROR_CODE.INVALID_METRICS]:
            "Onboarding summary prompt requires non-empty metrics",
        [ONBOARDING_SUMMARY_PROMPT_ERROR_CODE.INVALID_TECH_STACK_ENTRY]:
            `Onboarding tech stack entry is invalid: ${details.entry ?? "<empty>"}`,
        [ONBOARDING_SUMMARY_PROMPT_ERROR_CODE.INVALID_ARCHITECTURE_HIGHLIGHT]:
            `Onboarding architecture highlight is invalid: ${details.entry ?? "<empty>"}`,
        [ONBOARDING_SUMMARY_PROMPT_ERROR_CODE.INVALID_METRIC_NAME]:
            `Onboarding metric name is invalid: ${details.metricName ?? "<empty>"}`,
        [ONBOARDING_SUMMARY_PROMPT_ERROR_CODE.INVALID_METRIC_VALUE]:
            "Onboarding metric value must be a finite number",
        [ONBOARDING_SUMMARY_PROMPT_ERROR_CODE.INVALID_IDEMPOTENCY_KEY]:
            `Onboarding idempotency key is invalid: ${details.idempotencyKey ?? "<empty>"}`,
        [ONBOARDING_SUMMARY_PROMPT_ERROR_CODE.INVALID_MAX_ATTEMPTS]:
            "Onboarding summary prompt max attempts must be a positive integer",
        [ONBOARDING_SUMMARY_PROMPT_ERROR_CODE.INVALID_RETRY_BACKOFF_MS]:
            "Onboarding summary prompt retry backoff must be a non-negative integer",
        [ONBOARDING_SUMMARY_PROMPT_ERROR_CODE.INVALID_IDEMPOTENCY_TTL_MS]:
            "Onboarding summary prompt idempotency TTL must be a positive integer",
        [ONBOARDING_SUMMARY_PROMPT_ERROR_CODE.CONTEXT_LOAD_FAILED]:
            "Onboarding summary prompt failed to load additional context",
    }

    return messages[code]
}
