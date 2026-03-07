/**
 * Input for deterministic git ACL idempotency key generation.
 */
export interface IGitAclIdempotencyInput {
    /**
     * Logical provider identifier.
     */
    readonly provider: string

    /**
     * Logical operation identifier.
     */
    readonly operation: string

    /**
     * Merge request identifier.
     */
    readonly mergeRequestId: string

    /**
     * Optional external request identifier.
     */
    readonly requestId?: string
}

/**
 * Builds deterministic idempotency key for git ACL operations.
 *
 * @param input Key input segments.
 * @returns Deterministic normalized key.
 */
export function createGitAclIdempotencyKey(input: IGitAclIdempotencyInput): string {
    const provider = normalizeSegment(input.provider)
    const operation = normalizeSegment(input.operation)
    const mergeRequestId = normalizeSegment(input.mergeRequestId)
    const requestId = normalizeSegment(input.requestId ?? "no-request-id")

    return `git:${provider}:${operation}:${mergeRequestId}:${requestId}`
}

/**
 * Normalizes key segment to stable lowercase token.
 *
 * @param value Raw segment value.
 * @returns Normalized segment.
 */
function normalizeSegment(value: string): string {
    const trimmed = value.trim().toLowerCase()
    if (trimmed.length === 0) {
        return "undefined"
    }

    return trimmed.replaceAll(/\s+/g, "-")
}
