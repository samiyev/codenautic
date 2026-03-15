/**
 * Typed error codes for AST service health monitoring.
 */
export const AST_SERVICE_HEALTH_MONITORING_ERROR_CODE = {
    INVALID_COMMIT_SHA: "INVALID_COMMIT_SHA",
    INVALID_CRITICAL_FAILURE_THRESHOLD: "INVALID_CRITICAL_FAILURE_THRESHOLD",
    INVALID_FILE_PATH: "INVALID_FILE_PATH",
    INVALID_FAILURE_THRESHOLD_RANGE: "INVALID_FAILURE_THRESHOLD_RANGE",
    INVALID_MAX_ACCEPTABLE_LATENCY_MS: "INVALID_MAX_ACCEPTABLE_LATENCY_MS",
    INVALID_REPOSITORY_ID: "INVALID_REPOSITORY_ID",
    INVALID_WARNING_FAILURE_THRESHOLD: "INVALID_WARNING_FAILURE_THRESHOLD",
    MISSING_COMMIT_SHA: "MISSING_COMMIT_SHA",
    MISSING_REPOSITORY_ID: "MISSING_REPOSITORY_ID",
    MONITORING_FAILED: "MONITORING_FAILED",
} as const

/**
 * AST service health monitoring error code literal.
 */
export type AstServiceHealthMonitoringErrorCode =
    (typeof AST_SERVICE_HEALTH_MONITORING_ERROR_CODE)[keyof typeof AST_SERVICE_HEALTH_MONITORING_ERROR_CODE]

/**
 * Structured metadata for AST service health monitoring failures.
 */
export interface IAstServiceHealthMonitoringErrorDetails {
    /**
     * Repository identifier when available.
     */
    readonly repositoryId?: string

    /**
     * Commit sha value when available.
     */
    readonly commitSha?: string

    /**
     * File path when available.
     */
    readonly filePath?: string

    /**
     * Numeric value when available.
     */
    readonly value?: number

    /**
     * Error message from underlying dependency when available.
     */
    readonly causeMessage?: string
}

/**
 * Typed AST service health monitoring error with stable metadata.
 */
export class AstServiceHealthMonitoringError extends Error {
    /**
     * Stable machine-readable error code.
     */
    public readonly code: AstServiceHealthMonitoringErrorCode

    /**
     * Repository identifier when available.
     */
    public readonly repositoryId?: string

    /**
     * Commit sha value when available.
     */
    public readonly commitSha?: string

    /**
     * File path when available.
     */
    public readonly filePath?: string

    /**
     * Numeric value when available.
     */
    public readonly value?: number

    /**
     * Error message from underlying dependency when available.
     */
    public readonly causeMessage?: string

    /**
     * Creates typed AST service health monitoring error.
     *
     * @param code Stable machine-readable error code.
     * @param details Normalized error metadata.
     */
    public constructor(
        code: AstServiceHealthMonitoringErrorCode,
        details: IAstServiceHealthMonitoringErrorDetails = {},
    ) {
        super(createAstServiceHealthMonitoringErrorMessage(code, details))

        this.name = "AstServiceHealthMonitoringError"
        this.code = code
        this.repositoryId = details.repositoryId
        this.commitSha = details.commitSha
        this.filePath = details.filePath
        this.value = details.value
        this.causeMessage = details.causeMessage
    }
}

/**
 * Builds stable public message for AST service health monitoring failures.
 *
 * @param code Stable machine-readable error code.
 * @param details Normalized error metadata.
 * @returns Stable public message.
 */
function createAstServiceHealthMonitoringErrorMessage(
    code: AstServiceHealthMonitoringErrorCode,
    details: IAstServiceHealthMonitoringErrorDetails,
): string {
    return AST_SERVICE_HEALTH_MONITORING_ERROR_MESSAGES[code](details)
}

const AST_SERVICE_HEALTH_MONITORING_ERROR_MESSAGES: Readonly<
    Record<
        AstServiceHealthMonitoringErrorCode,
        (details: IAstServiceHealthMonitoringErrorDetails) => string
    >
> = {
    INVALID_COMMIT_SHA: (details) =>
        `Invalid commit sha for ast service health monitoring: ${details.commitSha ?? "<empty>"}`,
    INVALID_CRITICAL_FAILURE_THRESHOLD: (details) =>
        `Invalid critical failure threshold for ast service health monitoring: ${
            details.value ?? Number.NaN
        }`,
    INVALID_FILE_PATH: (details) =>
        `Invalid file path for ast service health monitoring: ${details.filePath ?? "<empty>"}`,
    INVALID_FAILURE_THRESHOLD_RANGE: (details) =>
        `Invalid failure threshold range for ast service health monitoring: ${
            details.value ?? Number.NaN
        }`,
    INVALID_MAX_ACCEPTABLE_LATENCY_MS: (details) =>
        `Invalid max acceptable latency for ast service health monitoring: ${
            details.value ?? Number.NaN
        }`,
    INVALID_REPOSITORY_ID: (details) =>
        `Invalid repository id for ast service health monitoring: ${
            details.repositoryId ?? "<empty>"
        }`,
    INVALID_WARNING_FAILURE_THRESHOLD: (details) =>
        `Invalid warning failure threshold for ast service health monitoring: ${
            details.value ?? Number.NaN
        }`,
    MISSING_COMMIT_SHA: () =>
        "Commit sha is required for ast service health monitoring check configuration",
    MISSING_REPOSITORY_ID: () =>
        "Repository id is required for ast service health monitoring check configuration",
    MONITORING_FAILED: (details) =>
        `Ast service health monitoring failed: ${details.causeMessage ?? "<unknown>"}`,
}
