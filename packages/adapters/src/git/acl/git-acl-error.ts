/**
 * Canonical git ACL error categories.
 */
export const GIT_ACL_ERROR_KIND = {
    AUTH: "AUTH",
    NOT_FOUND: "NOT_FOUND",
    RATE_LIMITED: "RATE_LIMITED",
    SERVER_ERROR: "SERVER_ERROR",
    VALIDATION: "VALIDATION",
    UNKNOWN: "UNKNOWN",
} as const

/**
 * Git ACL error kind literal.
 */
export type GitAclErrorKind = (typeof GIT_ACL_ERROR_KIND)[keyof typeof GIT_ACL_ERROR_KIND]

/**
 * Normalized git ACL error payload.
 */
export interface INormalizedGitAclError {
    /**
     * Canonical error kind.
     */
    readonly kind: GitAclErrorKind

    /**
     * Human-readable error message.
     */
    readonly message: string

    /**
     * HTTP status code when available.
     */
    readonly statusCode?: number

    /**
     * Retry delay hint in milliseconds.
     */
    readonly retryAfterMs?: number

    /**
     * Retry flag.
     */
    readonly isRetryable: boolean
}

const RETRYABLE_NETWORK_CODES = new Set<string>(["ECONNRESET", "ETIMEDOUT", "EAI_AGAIN"])

/**
 * Normalizes provider error into canonical ACL error.
 *
 * @param error Raw provider error.
 * @returns Normalized error.
 */
export function normalizeGitAclError(error: unknown): INormalizedGitAclError {
    const details = getErrorDetails(error)
    const statusResult = normalizeStatusError(details)

    if (statusResult !== undefined) {
        return statusResult
    }

    if (details.code !== undefined && RETRYABLE_NETWORK_CODES.has(details.code)) {
        return {
            kind: GIT_ACL_ERROR_KIND.SERVER_ERROR,
            message: details.message,
            isRetryable: true,
        }
    }

    return {
        kind: GIT_ACL_ERROR_KIND.UNKNOWN,
        message: details.message,
        statusCode: details.statusCode,
        isRetryable: false,
    }
}

/**
 * Resolves normalized result for HTTP status-based error cases.
 *
 * @param details Parsed error details.
 * @returns Normalized result when status code is recognized.
 */
function normalizeStatusError(details: IErrorDetails): INormalizedGitAclError | undefined {
    if (details.statusCode === 429) {
        return {
            kind: GIT_ACL_ERROR_KIND.RATE_LIMITED,
            message: details.message,
            statusCode: 429,
            retryAfterMs: details.retryAfterMs,
            isRetryable: true,
        }
    }

    if (details.statusCode !== undefined && details.statusCode >= 500) {
        return {
            kind: GIT_ACL_ERROR_KIND.SERVER_ERROR,
            message: details.message,
            statusCode: details.statusCode,
            retryAfterMs: details.retryAfterMs,
            isRetryable: true,
        }
    }

    if (details.statusCode === 401 || details.statusCode === 403) {
        return {
            kind: GIT_ACL_ERROR_KIND.AUTH,
            message: details.message,
            statusCode: details.statusCode,
            isRetryable: false,
        }
    }

    if (details.statusCode === 404) {
        return {
            kind: GIT_ACL_ERROR_KIND.NOT_FOUND,
            message: details.message,
            statusCode: 404,
            isRetryable: false,
        }
    }

    if (details.statusCode !== undefined && details.statusCode >= 400) {
        return {
            kind: GIT_ACL_ERROR_KIND.VALIDATION,
            message: details.message,
            statusCode: details.statusCode,
            isRetryable: false,
        }
    }

    return undefined
}

/**
 * Returns retry decision for normalized/raw ACL error.
 *
 * @param error Raw or normalized error payload.
 * @param attempt Current 1-based attempt number.
 * @param maxAttempts Maximum allowed attempts.
 * @returns True when operation should be retried.
 */
export function shouldRetryGitAclError(
    error: unknown,
    attempt: number,
    maxAttempts: number,
): boolean {
    if (attempt < 1 || maxAttempts < 1) {
        return false
    }

    const normalized = isNormalizedGitAclError(error) ? error : normalizeGitAclError(error)
    return normalized.isRetryable && attempt < maxAttempts
}

interface IErrorDetails {
    readonly message: string
    readonly statusCode?: number
    readonly retryAfterMs?: number
    readonly code?: string
}

/**
 * Extracts status/code/retry hints from unknown provider error.
 *
 * @param error Raw provider error.
 * @returns Parsed error details.
 */
function getErrorDetails(error: unknown): IErrorDetails {
    const record = toRecord(error)
    const statusCode = resolveStatusCode(record)
    const retryAfterMs = resolveRetryAfterMs(record)
    const code = resolveCode(record)

    return {
        message: resolveMessage(error, record),
        statusCode,
        retryAfterMs,
        code,
    }
}

/**
 * Type guard for normalized ACL error.
 *
 * @param value Candidate value.
 * @returns True when payload is already normalized.
 */
function isNormalizedGitAclError(value: unknown): value is INormalizedGitAclError {
    const record = toRecord(value)
    const kind = record?.["kind"]
    const message = record?.["message"]
    const isRetryable = record?.["isRetryable"]

    return typeof kind === "string" && typeof message === "string" && typeof isRetryable === "boolean"
}

/**
 * Converts unknown to plain record.
 *
 * @param value Candidate value.
 * @returns Record or null.
 */
function toRecord(value: unknown): Readonly<Record<string, unknown>> | null {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return null
    }

    return value as Readonly<Record<string, unknown>>
}

/**
 * Resolves error message.
 *
 * @param error Raw error value.
 * @param record Error record.
 * @returns Message string.
 */
function resolveMessage(error: unknown, record: Readonly<Record<string, unknown>> | null): string {
    if (error instanceof Error && error.message.trim().length > 0) {
        return error.message
    }

    const raw = record?.["message"]
    if (typeof raw === "string" && raw.trim().length > 0) {
        return raw
    }

    return "Unknown git ACL error"
}

/**
 * Resolves status code from known error shapes.
 *
 * @param record Error record.
 * @returns Status code when available.
 */
function resolveStatusCode(record: Readonly<Record<string, unknown>> | null): number | undefined {
    const directStatus = toFiniteNumber(record?.["statusCode"])
    if (directStatus !== undefined) {
        return directStatus
    }

    const alternateStatus = toFiniteNumber(record?.["status"])
    if (alternateStatus !== undefined) {
        return alternateStatus
    }

    const response = toRecord(record?.["response"])
    return toFiniteNumber(response?.["status"])
}

/**
 * Resolves retry-after delay in milliseconds.
 *
 * @param record Error record.
 * @returns Retry delay.
 */
function resolveRetryAfterMs(record: Readonly<Record<string, unknown>> | null): number | undefined {
    const direct = toFiniteNumber(record?.["retryAfterMs"])
    if (direct !== undefined && direct > 0) {
        return Math.trunc(direct)
    }

    const headers = toRecord(record?.["headers"])
    const headerValue = headers?.["retry-after"]
    if (typeof headerValue !== "string") {
        return undefined
    }

    const parsed = Number.parseFloat(headerValue)
    return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed * 1000) : undefined
}

/**
 * Resolves network error code.
 *
 * @param record Error record.
 * @returns Network code.
 */
function resolveCode(record: Readonly<Record<string, unknown>> | null): string | undefined {
    const raw = record?.["code"]
    if (typeof raw !== "string" || raw.trim().length === 0) {
        return undefined
    }

    return raw
}

/**
 * Converts unknown value to finite number.
 *
 * @param value Unknown value.
 * @returns Number when value is finite.
 */
function toFiniteNumber(value: unknown): number | undefined {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value
    }

    if (typeof value === "string" && value.trim().length > 0) {
        const parsed = Number.parseFloat(value)
        if (Number.isFinite(parsed)) {
            return parsed
        }
    }

    return undefined
}
