/**
 * Typed error codes for AST service horizontal scaling support.
 */
export const AST_SERVICE_HORIZONTAL_SCALING_ERROR_CODE = {
    INVALID_ACTIVE_JOBS: "INVALID_ACTIVE_JOBS",
    INVALID_CURRENT_REPLICAS: "INVALID_CURRENT_REPLICAS",
    INVALID_HYSTERESIS_PERCENT: "INVALID_HYSTERESIS_PERCENT",
    INVALID_IDEMPOTENCY_CACHE_SIZE: "INVALID_IDEMPOTENCY_CACHE_SIZE",
    INVALID_IDEMPOTENCY_KEY: "INVALID_IDEMPOTENCY_KEY",
    INVALID_MAX_BACKOFF_MS: "INVALID_MAX_BACKOFF_MS",
    INVALID_MAX_REPLICAS: "INVALID_MAX_REPLICAS",
    INVALID_MIN_REPLICAS: "INVALID_MIN_REPLICAS",
    INVALID_QUEUE_DEPTH: "INVALID_QUEUE_DEPTH",
    INVALID_REPLICA_RANGE: "INVALID_REPLICA_RANGE",
    INVALID_RETRY_INITIAL_BACKOFF_MS: "INVALID_RETRY_INITIAL_BACKOFF_MS",
    INVALID_RETRY_MAX_ATTEMPTS: "INVALID_RETRY_MAX_ATTEMPTS",
    INVALID_REPOSITORY_ID: "INVALID_REPOSITORY_ID",
    INVALID_SCALE_DOWN_STEP: "INVALID_SCALE_DOWN_STEP",
    INVALID_SCALE_UP_STEP: "INVALID_SCALE_UP_STEP",
    INVALID_TARGET_BACKLOG_PER_REPLICA: "INVALID_TARGET_BACKLOG_PER_REPLICA",
    INVALID_TOTAL_PENDING_JOBS: "INVALID_TOTAL_PENDING_JOBS",
    METRICS_PROVIDER_FAILED: "METRICS_PROVIDER_FAILED",
    RETRY_EXHAUSTED: "RETRY_EXHAUSTED",
} as const

/**
 * AST service horizontal scaling error code literal.
 */
export type AstServiceHorizontalScalingErrorCode =
    (typeof AST_SERVICE_HORIZONTAL_SCALING_ERROR_CODE)[keyof typeof AST_SERVICE_HORIZONTAL_SCALING_ERROR_CODE]

/**
 * Structured metadata for AST service horizontal scaling failures.
 */
export interface IAstServiceHorizontalScalingErrorDetails {
    /**
     * Invalid numeric value when available.
     */
    readonly value?: number

    /**
     * Invalid repository id when available.
     */
    readonly repositoryId?: string

    /**
     * Invalid idempotency key when available.
     */
    readonly idempotencyKey?: string

    /**
     * Current minimum replicas value when available.
     */
    readonly minReplicas?: number

    /**
     * Current maximum replicas value when available.
     */
    readonly maxReplicas?: number

    /**
     * Current retry attempts when available.
     */
    readonly attempts?: number

    /**
     * Underlying error message when available.
     */
    readonly causeMessage?: string
}

/**
 * Typed AST service horizontal scaling error with stable metadata.
 */
export class AstServiceHorizontalScalingError extends Error {
    /**
     * Stable machine-readable error code.
     */
    public readonly code: AstServiceHorizontalScalingErrorCode

    /**
     * Invalid numeric value when available.
     */
    public readonly value?: number

    /**
     * Invalid repository id when available.
     */
    public readonly repositoryId?: string

    /**
     * Invalid idempotency key when available.
     */
    public readonly idempotencyKey?: string

    /**
     * Current minimum replicas value when available.
     */
    public readonly minReplicas?: number

    /**
     * Current maximum replicas value when available.
     */
    public readonly maxReplicas?: number

    /**
     * Current retry attempts when available.
     */
    public readonly attempts?: number

    /**
     * Underlying error message when available.
     */
    public readonly causeMessage?: string

    /**
     * Creates typed AST service horizontal scaling error.
     *
     * @param code Stable machine-readable error code.
     * @param details Normalized error metadata.
     */
    public constructor(
        code: AstServiceHorizontalScalingErrorCode,
        details: IAstServiceHorizontalScalingErrorDetails = {},
    ) {
        super(createAstServiceHorizontalScalingErrorMessage(code, details))

        this.name = "AstServiceHorizontalScalingError"
        this.code = code
        this.value = details.value
        this.repositoryId = details.repositoryId
        this.idempotencyKey = details.idempotencyKey
        this.minReplicas = details.minReplicas
        this.maxReplicas = details.maxReplicas
        this.attempts = details.attempts
        this.causeMessage = details.causeMessage
    }
}

/**
 * Builds stable public message for AST service horizontal scaling failures.
 *
 * @param code Stable machine-readable error code.
 * @param details Normalized error metadata.
 * @returns Stable public message.
 */
function createAstServiceHorizontalScalingErrorMessage(
    code: AstServiceHorizontalScalingErrorCode,
    details: IAstServiceHorizontalScalingErrorDetails,
): string {
    return AST_SERVICE_HORIZONTAL_SCALING_ERROR_MESSAGES[code](details)
}

const AST_SERVICE_HORIZONTAL_SCALING_ERROR_MESSAGES: Readonly<
    Record<
        AstServiceHorizontalScalingErrorCode,
        (details: IAstServiceHorizontalScalingErrorDetails) => string
    >
> = {
    INVALID_ACTIVE_JOBS: (details) =>
        `Invalid active jobs value for ast horizontal scaling: ${details.value ?? Number.NaN}`,
    INVALID_CURRENT_REPLICAS: (details) =>
        `Invalid current replicas value for ast horizontal scaling: ${
            details.value ?? Number.NaN
        }`,
    INVALID_HYSTERESIS_PERCENT: (details) =>
        `Invalid hysteresis percent for ast horizontal scaling: ${details.value ?? Number.NaN}`,
    INVALID_IDEMPOTENCY_CACHE_SIZE: (details) =>
        `Invalid idempotency cache size for ast horizontal scaling: ${
            details.value ?? Number.NaN
        }`,
    INVALID_IDEMPOTENCY_KEY: (details) =>
        `Invalid idempotency key for ast horizontal scaling: ${
            details.idempotencyKey ?? "<empty>"
        }`,
    INVALID_MAX_BACKOFF_MS: (details) =>
        `Invalid max backoff ms for ast horizontal scaling: ${details.value ?? Number.NaN}`,
    INVALID_MAX_REPLICAS: (details) =>
        `Invalid max replicas value for ast horizontal scaling: ${details.value ?? Number.NaN}`,
    INVALID_MIN_REPLICAS: (details) =>
        `Invalid min replicas value for ast horizontal scaling: ${details.value ?? Number.NaN}`,
    INVALID_QUEUE_DEPTH: (details) =>
        `Invalid queue depth value for ast horizontal scaling: ${details.value ?? Number.NaN}`,
    INVALID_REPLICA_RANGE: (details) =>
        `Invalid replica range for ast horizontal scaling: min=${
            details.minReplicas ?? Number.NaN
        }, max=${details.maxReplicas ?? Number.NaN}`,
    INVALID_RETRY_INITIAL_BACKOFF_MS: (details) =>
        `Invalid retry initial backoff ms for ast horizontal scaling: ${
            details.value ?? Number.NaN
        }`,
    INVALID_RETRY_MAX_ATTEMPTS: (details) =>
        `Invalid retry max attempts for ast horizontal scaling: ${details.value ?? Number.NaN}`,
    INVALID_REPOSITORY_ID: (details) =>
        `Invalid repository id for ast horizontal scaling: ${details.repositoryId ?? "<empty>"}`,
    INVALID_SCALE_DOWN_STEP: (details) =>
        `Invalid scale down step for ast horizontal scaling: ${details.value ?? Number.NaN}`,
    INVALID_SCALE_UP_STEP: (details) =>
        `Invalid scale up step for ast horizontal scaling: ${details.value ?? Number.NaN}`,
    INVALID_TARGET_BACKLOG_PER_REPLICA: (details) =>
        `Invalid target backlog per replica for ast horizontal scaling: ${
            details.value ?? Number.NaN
        }`,
    INVALID_TOTAL_PENDING_JOBS: (details) =>
        `Invalid total pending jobs value for ast horizontal scaling: ${
            details.value ?? Number.NaN
        }`,
    METRICS_PROVIDER_FAILED: (details) =>
        `Ast horizontal scaling metrics provider failed: ${details.causeMessage ?? "<unknown>"}`,
    RETRY_EXHAUSTED: (details) =>
        `Ast horizontal scaling retry exhausted after ${details.attempts ?? 0} attempts: ${
            details.causeMessage ?? "<unknown>"
        }`,
}
