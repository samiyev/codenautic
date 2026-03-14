import type {GitAclErrorKind, INormalizedGitAclError} from "./acl"

/**
 * Typed error codes for Bitbucket provider failures.
 */
export const BITBUCKET_PROVIDER_ERROR_CODE = {
    API_REQUEST_FAILED: "API_REQUEST_FAILED",
    UNSUPPORTED_OPERATION: "UNSUPPORTED_OPERATION",
} as const

/**
 * Bitbucket provider error code literal.
 */
export type BitbucketProviderErrorCode =
    (typeof BITBUCKET_PROVIDER_ERROR_CODE)[keyof typeof BITBUCKET_PROVIDER_ERROR_CODE]

/**
 * Structured metadata for Bitbucket provider failures.
 */
export interface IBitbucketProviderErrorDetails {
    /**
     * Operation name associated with the failure.
     */
    readonly operation?: string

    /**
     * Optional unsupported capability label.
     */
    readonly capability?: string

    /**
     * Normalized ACL failure payload when request reached the provider.
     */
    readonly normalized?: INormalizedGitAclError
}

type IBitbucketProviderErrorMessageBuilder = (
    details: IBitbucketProviderErrorDetails,
) => string

const BITBUCKET_PROVIDER_ERROR_MESSAGES: Readonly<
    Record<BitbucketProviderErrorCode, IBitbucketProviderErrorMessageBuilder>
> = {
    [BITBUCKET_PROVIDER_ERROR_CODE.API_REQUEST_FAILED]: (
        details: IBitbucketProviderErrorDetails,
    ): string => {
        return details.normalized?.message ?? "Bitbucket git request failed"
    },
    [BITBUCKET_PROVIDER_ERROR_CODE.UNSUPPORTED_OPERATION]: (
        details: IBitbucketProviderErrorDetails,
    ): string => {
        const operation = details.operation ?? "<unknown>"
        return `Bitbucket provider does not support operation: ${operation}`
    },
}

/**
 * Typed error raised by Bitbucket provider.
 */
export class BitbucketProviderError extends Error {
    /**
     * Stable machine-readable error code.
     */
    public readonly code: BitbucketProviderErrorCode

    /**
     * Operation name associated with the failure.
     */
    public readonly operation?: string

    /**
     * Optional unsupported capability label.
     */
    public readonly capability?: string

    /**
     * Normalized ACL failure payload when available.
     */
    public readonly normalized?: INormalizedGitAclError

    /**
     * Creates typed Bitbucket provider error.
     *
     * @param code Stable machine-readable error code.
     * @param details Normalized error metadata.
     */
    public constructor(
        code: BitbucketProviderErrorCode,
        details: IBitbucketProviderErrorDetails = {},
    ) {
        super(buildBitbucketProviderErrorMessage(code, details))

        this.name = "BitbucketProviderError"
        this.code = code
        this.operation = details.operation
        this.capability = details.capability
        this.normalized = details.normalized
    }

    /**
     * Retryable flag derived from normalized error payload.
     *
     * @returns True when the failed request may be retried.
     */
    public get isRetryable(): boolean {
        return this.normalized?.isRetryable ?? false
    }

    /**
     * Normalized ACL error kind when available.
     *
     * @returns Canonical git ACL error kind or undefined.
     */
    public get kind(): GitAclErrorKind | undefined {
        return this.normalized?.kind
    }

    /**
     * Optional HTTP status code from normalized ACL payload.
     *
     * @returns Status code or undefined.
     */
    public get statusCode(): number | undefined {
        return this.normalized?.statusCode
    }

    /**
     * Optional retry-after hint from normalized ACL payload.
     *
     * @returns Delay in milliseconds or undefined.
     */
    public get retryAfterMs(): number | undefined {
        return this.normalized?.retryAfterMs
    }
}

/**
 * Builds stable public message for Bitbucket provider failures.
 *
 * @param code Stable machine-readable error code.
 * @param details Normalized error metadata.
 * @returns Stable public error message.
 */
function buildBitbucketProviderErrorMessage(
    code: BitbucketProviderErrorCode,
    details: IBitbucketProviderErrorDetails,
): string {
    return BITBUCKET_PROVIDER_ERROR_MESSAGES[code](details)
}
